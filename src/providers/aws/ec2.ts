import {
  DescribeInstancesCommand,
  Instance,
} from '@aws-sdk/client-ec2';
import {
  GetMetricStatisticsCommand,
  Statistic,
} from '@aws-sdk/client-cloudwatch';
import { AWSClient } from './client';
import { SavingsOpportunity } from '../../types/opportunity';
import { getEC2MonthlyCost } from '../../analyzers/cost-estimator';
import dayjs from 'dayjs';

export async function analyzeEC2Instances(
  client: AWSClient
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

    // Get average CPU over last 30 days
    const avgCpu = await getAvgCPU(
      cloudwatchClient,
      instance.InstanceId,
      30
    );

    if (avgCpu < 5) {
      const monthlyCost = getEC2MonthlyCost(instance.InstanceType);
      opportunities.push({
        id: `ec2-idle-${instance.InstanceId}`,
        provider: 'aws',
        resourceType: 'ec2',
        resourceId: instance.InstanceId,
        resourceName: instance.Tags?.find((t) => t.Key === 'Name')?.Value,
        category: 'idle',
        currentCost: monthlyCost,
        estimatedSavings: monthlyCost,
        confidence: 'high',
        recommendation: `Stop instance or downsize to t3.small (avg CPU: ${avgCpu.toFixed(1)}%)`,
        metadata: {
          instanceType: instance.InstanceType,
          avgCpu,
          state: instance.State?.Name,
        },
        detectedAt: new Date(),
      });
    }
  }

  return opportunities;
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
      new GetMetricStatisticsCommand({
        Namespace: 'AWS/EC2',
        MetricName: 'CPUUtilization',
        Dimensions: [{ Name: 'InstanceId', Value: instanceId }],
        StartTime: startTime,
        EndTime: endTime,
        Period: 86400, // 1 day
        Statistics: [Statistic.Average],
      })
    );

    if (!result.Datapoints || result.Datapoints.length === 0) {
      return 0;
    }

    const avg =
      result.Datapoints.reduce((sum: number, dp: any) => sum + (dp.Average || 0), 0) /
      result.Datapoints.length;
    return avg;
  } catch (error) {
    // CloudWatch metrics may not be available for all instances
    return 0;
  }
}
