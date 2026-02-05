import {
  DescribeInstancesCommand,
  Instance,
} from '@aws-sdk/client-ec2';
import {
  GetMetricDataCommand,
  MetricDataQuery,
  Statistic,
} from '@aws-sdk/client-cloudwatch';
import { AWSClient } from './client';
import { SavingsOpportunity } from '../../types/opportunity';
import { getEC2MonthlyCost } from '../../analyzers/cost-estimator';
import dayjs from 'dayjs';

interface EC2Metrics {
  cpu: number;
  networkIn?: number;
  networkOut?: number;
  memory?: number;
  diskReadOps?: number;
  diskWriteOps?: number;
}

export async function analyzeEC2Instances(
  client: AWSClient,
  detailedMetrics: boolean = false
): Promise<SavingsOpportunity[]> {
  const ec2Client = client.getEC2Client();
  const cloudwatchClient = client.getCloudWatchClient();

  const result = await ec2Client.send(
    new DescribeInstancesCommand({
      Filters: [{ Name: 'instance-state-name', Values: ['running'] }],
    })
  );

  const instances: Instance[] = [];
  for (const reservation of result.Reservations || []) {
    instances.push(...(reservation.Instances || []));
  }

  const opportunities: SavingsOpportunity[] = [];

  for (const instance of instances) {
    if (!instance.InstanceId || !instance.InstanceType) continue;

    // Get metrics based on mode
    const metrics = detailedMetrics
      ? await getDetailedMetrics(cloudwatchClient, instance, 30)
      : await getBasicMetrics(cloudwatchClient, instance.InstanceId, 30);

    // Determine if instance is idle/underutilized
    const isIdle = metrics.cpu < 5;
    const isUnderutilized = metrics.cpu < 20;

    // Calculate confidence based on available metrics
    let confidence: 'high' | 'medium' | 'low' = 'low';
    let reasoning = '';

    if (detailedMetrics) {
      const metricsLow = [
        metrics.cpu < 20,
        metrics.networkIn !== undefined && metrics.networkIn < 1000000, // < 1MB/s
        metrics.networkOut !== undefined && metrics.networkOut < 1000000,
        metrics.diskReadOps !== undefined && metrics.diskReadOps < 100, // < 100 IOPS
        metrics.diskWriteOps !== undefined && metrics.diskWriteOps < 100,
      ].filter(Boolean).length;

      if (metricsLow >= 4) {
        confidence = 'high';
        reasoning = 'All metrics low';
      } else if (metricsLow >= 2) {
        confidence = 'medium';
        reasoning = 'Multiple metrics low';
      } else {
        confidence = 'low';
        reasoning = 'Mixed metric signals';
      }

      // Check for memory if available
      if (metrics.memory !== undefined) {
        if (metrics.memory > 70) {
          confidence = 'low';
          reasoning = 'High memory usage detected';
        }
      } else {
        reasoning += ' (memory data unavailable)';
      }
    } else {
      confidence = 'low';
      reasoning = 'CPU only - verify memory/disk before downsizing';
    }

    if (isIdle) {
      const monthlyCost = getEC2MonthlyCost(instance.InstanceType);
      
      let recommendation = `Stop instance or downsize to t3.small (avg CPU: ${metrics.cpu.toFixed(1)}%)`;
      if (detailedMetrics) {
        recommendation = buildDetailedRecommendation(metrics, instance.InstanceType);
      }

      opportunities.push({
        id: `ec2-idle-${instance.InstanceId}`,
        provider: 'aws',
        resourceType: 'ec2',
        resourceId: instance.InstanceId,
        resourceName: instance.Tags?.find((t) => t.Key === 'Name')?.Value,
        category: 'idle',
        currentCost: monthlyCost,
        estimatedSavings: monthlyCost,
        confidence,
        recommendation,
        metadata: {
          instanceType: instance.InstanceType,
          metrics,
          reasoning,
          state: instance.State?.Name,
        },
        detectedAt: new Date(),
      });
    } else if (isUnderutilized && detailedMetrics && confidence === 'high') {
      // Only suggest downsizing if we have high confidence (multiple metrics checked)
      const monthlyCost = getEC2MonthlyCost(instance.InstanceType);
      const recommendation = buildDetailedRecommendation(metrics, instance.InstanceType);
      
      opportunities.push({
        id: `ec2-underutilized-${instance.InstanceId}`,
        provider: 'aws',
        resourceType: 'ec2',
        resourceId: instance.InstanceId,
        resourceName: instance.Tags?.find((t) => t.Key === 'Name')?.Value,
        category: 'underutilized',
        currentCost: monthlyCost,
        estimatedSavings: monthlyCost * 0.5, // Estimate 50% savings from downsizing
        confidence,
        recommendation,
        metadata: {
          instanceType: instance.InstanceType,
          metrics,
          reasoning,
          state: instance.State?.Name,
        },
        detectedAt: new Date(),
      });
    }
  }

  return opportunities;
}

// Basic metrics: CPU only (fast)
async function getBasicMetrics(
  cloudwatchClient: any,
  instanceId: string,
  days: number
): Promise<EC2Metrics> {
  const cpu = await getAvgCPU(cloudwatchClient, instanceId, days);
  return { cpu };
}

// Detailed metrics: CPU + Network + Disk + Memory (slower but comprehensive)
async function getDetailedMetrics(
  cloudwatchClient: any,
  instance: Instance,
  days: number
): Promise<EC2Metrics> {
  const endTime = new Date();
  const startTime = dayjs(endTime).subtract(days, 'day').toDate();
  const instanceId = instance.InstanceId!;

  // Build metric queries for batched fetching
  const queries: MetricDataQuery[] = [
    {
      Id: 'cpu',
      MetricStat: {
        Metric: {
          Namespace: 'AWS/EC2',
          MetricName: 'CPUUtilization',
          Dimensions: [{ Name: 'InstanceId', Value: instanceId }],
        },
        Period: 86400, // 1 day
        Stat: 'Average',
      },
    },
    {
      Id: 'network_in',
      MetricStat: {
        Metric: {
          Namespace: 'AWS/EC2',
          MetricName: 'NetworkIn',
          Dimensions: [{ Name: 'InstanceId', Value: instanceId }],
        },
        Period: 86400,
        Stat: 'Average',
      },
    },
    {
      Id: 'network_out',
      MetricStat: {
        Metric: {
          Namespace: 'AWS/EC2',
          MetricName: 'NetworkOut',
          Dimensions: [{ Name: 'InstanceId', Value: instanceId }],
        },
        Period: 86400,
        Stat: 'Average',
      },
    },
  ];

  // Add disk I/O metrics if EBS volumes are attached
  if (instance.BlockDeviceMappings && instance.BlockDeviceMappings.length > 0) {
    for (const bdm of instance.BlockDeviceMappings) {
      if (bdm.Ebs?.VolumeId) {
        queries.push({
          Id: `disk_read_${bdm.DeviceName?.replace(/[^a-z0-9]/gi, '')}`,
          MetricStat: {
            Metric: {
              Namespace: 'AWS/EBS',
              MetricName: 'VolumeReadOps',
              Dimensions: [{ Name: 'VolumeId', Value: bdm.Ebs.VolumeId }],
            },
            Period: 86400,
            Stat: 'Average',
          },
        });
        queries.push({
          Id: `disk_write_${bdm.DeviceName?.replace(/[^a-z0-9]/gi, '')}`,
          MetricStat: {
            Metric: {
              Namespace: 'AWS/EBS',
              MetricName: 'VolumeWriteOps',
              Dimensions: [{ Name: 'VolumeId', Value: bdm.Ebs.VolumeId }],
            },
            Period: 86400,
            Stat: 'Average',
          },
        });
      }
    }
  }

  // Try to add memory metric (only available if CloudWatch agent is installed)
  queries.push({
    Id: 'memory',
    MetricStat: {
      Metric: {
        Namespace: 'CWAgent',
        MetricName: 'mem_used_percent',
        Dimensions: [{ Name: 'InstanceId', Value: instanceId }],
      },
      Period: 86400,
      Stat: 'Average',
    },
  });

  try {
    const result = await cloudwatchClient.send(
      new GetMetricDataCommand({
        MetricDataQueries: queries,
        StartTime: startTime,
        EndTime: endTime,
      })
    );

    const metrics: EC2Metrics = {
      cpu: 0,
      networkIn: 0,
      networkOut: 0,
      diskReadOps: 0,
      diskWriteOps: 0,
    };

    // Parse results
    for (const metricData of result.MetricDataResults || []) {
      if (!metricData.Values || metricData.Values.length === 0) continue;

      const avg = metricData.Values.reduce((sum: number, val: number) => sum + val, 0) / metricData.Values.length;

      if (metricData.Id === 'cpu') {
        metrics.cpu = avg;
      } else if (metricData.Id === 'network_in') {
        metrics.networkIn = avg;
      } else if (metricData.Id === 'network_out') {
        metrics.networkOut = avg;
      } else if (metricData.Id === 'memory') {
        metrics.memory = avg;
      } else if (metricData.Id?.startsWith('disk_read')) {
        metrics.diskReadOps = (metrics.diskReadOps || 0) + avg;
      } else if (metricData.Id?.startsWith('disk_write')) {
        metrics.diskWriteOps = (metrics.diskWriteOps || 0) + avg;
      }
    }

    return metrics;
  } catch (error) {
    // Fallback to basic metrics if detailed fetch fails
    const cpu = await getAvgCPU(cloudwatchClient, instanceId, days);
    return { cpu };
  }
}

async function getAvgCPU(
  cloudwatchClient: any,
  instanceId: string,
  days: number
): Promise<number> {
  const endTime = new Date();
  const startTime = dayjs(endTime).subtract(days, 'day').toDate();

  try {
    const result = await cloudwatchClient.send(
      new GetMetricDataCommand({
        MetricDataQueries: [
          {
            Id: 'cpu',
            MetricStat: {
              Metric: {
                Namespace: 'AWS/EC2',
                MetricName: 'CPUUtilization',
                Dimensions: [{ Name: 'InstanceId', Value: instanceId }],
              },
              Period: 86400,
              Stat: 'Average',
            },
          },
        ],
        StartTime: startTime,
        EndTime: endTime,
      })
    );

    if (!result.MetricDataResults || result.MetricDataResults.length === 0) {
      return 0;
    }

    const values = result.MetricDataResults[0].Values || [];
    if (values.length === 0) return 0;

    const avg = values.reduce((sum: number, val: number) => sum + val, 0) / values.length;
    return avg;
  } catch (error) {
    // CloudWatch metrics may not be available for all instances
    return 0;
  }
}

function buildDetailedRecommendation(metrics: EC2Metrics, instanceType: string): string {
  const parts = [];
  
  parts.push(`CPU: ${metrics.cpu.toFixed(1)}%`);
  
  if (metrics.memory !== undefined) {
    parts.push(`Memory: ${metrics.memory.toFixed(1)}%`);
  }
  
  if (metrics.networkIn !== undefined && metrics.networkOut !== undefined) {
    const totalMB = ((metrics.networkIn + metrics.networkOut) / 1024 / 1024).toFixed(1);
    parts.push(`Network: ${totalMB} MB/s`);
  }
  
  if (metrics.diskReadOps !== undefined && metrics.diskWriteOps !== undefined) {
    const totalIOPS = (metrics.diskReadOps + metrics.diskWriteOps).toFixed(0);
    parts.push(`Disk: ${totalIOPS} IOPS`);
  }

  const metricsSummary = parts.join(' | ');
  
  if (metrics.cpu < 5) {
    return `Instance is idle (${metricsSummary}) - consider stopping or terminating`;
  } else if (metrics.cpu < 20) {
    return `Low utilization (${metricsSummary}) - consider downsizing to smaller instance type`;
  }
  
  return `Review utilization (${metricsSummary})`;
}
