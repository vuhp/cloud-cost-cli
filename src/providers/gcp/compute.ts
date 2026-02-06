import { GCPClient } from './client';
import { SavingsOpportunity } from '../../types/opportunity';
import { getGCEMonthlyCost } from '../../analyzers/cost-estimator';
import { ZonesClient } from '@google-cloud/compute';
import dayjs from 'dayjs';

// Cache zones per region to avoid repeated API calls
const zonesCache = new Map<string, string[]>();

async function getZonesInRegion(client: GCPClient, region: string): Promise<string[]> {
  // Check cache first
  if (zonesCache.has(region)) {
    return zonesCache.get(region)!;
  }

  try {
    const zonesClient = new ZonesClient();
    const [zones] = await zonesClient.list({
      project: client.projectId,
      filter: `name:${region}-*`,
    });

    const zoneNames = zones
      .filter(z => z.name && z.status === 'UP')
      .map(z => z.name!);

    // Cache the result
    if (zoneNames.length > 0) {
      zonesCache.set(region, zoneNames);
      return zoneNames;
    }
  } catch (error) {
    console.error(`Failed to fetch zones for region ${region}, using fallback:`, error);
  }
  
  // Fallback to common zones if API call fails or returns empty
  const fallbackZones = [`${region}-a`, `${region}-b`, `${region}-c`];
  zonesCache.set(region, fallbackZones);
  return fallbackZones;
}

interface GCEMetrics {
  cpu: number;
  memory?: number; // requires monitoring agent
  networkSent?: number; // bytes/sec
  networkReceived?: number; // bytes/sec
  diskReadOps?: number;
  diskWriteOps?: number;
}

export async function analyzeGCEInstances(
  client: GCPClient,
  detailedMetrics: boolean = false
): Promise<SavingsOpportunity[]> {
  const computeClient = client.getComputeClient();
  const monitoringClient = client.getMonitoringClient();

  const opportunities: SavingsOpportunity[] = [];

  // GCP instances are zone-specific, so we need to check multiple zones
  const zones = await getZonesInRegion(client, client.region);

  for (const zone of zones) {
    const [instances] = await computeClient.list({
      project: client.projectId,
      zone: zone,
      filter: 'status = "RUNNING"',
    });

    for await (const instance of instances) {
      if (!instance.name || !instance.machineType) continue;

      // Extract machine type from full URL
      const machineType = instance.machineType.split('/').pop() || '';

      // Get metrics based on mode
      const metrics = detailedMetrics
        ? await getDetailedMetrics(monitoringClient, client.projectId, instance.name, zone, 30)
        : await getBasicMetrics(monitoringClient, client.projectId, instance.name, zone, 30);

      // Determine if instance is idle/underutilized
      const isIdle = metrics.cpu < 5;
      const isUnderutilized = metrics.cpu < 20;

      // Calculate confidence based on available metrics
      let confidence: 'high' | 'medium' | 'low' = 'low';
      let reasoning = '';

      if (detailedMetrics) {
        const metricsLow = [
          metrics.cpu < 20,
          metrics.networkSent !== undefined && metrics.networkSent < 1000000, // < 1MB/s
          metrics.networkReceived !== undefined && metrics.networkReceived < 1000000,
          metrics.diskReadOps !== undefined && metrics.diskReadOps < 100,
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

        // Check memory if available
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

      // Opportunity 1: Idle instance
      if (isIdle) {
        const monthlyCost = getGCEMonthlyCost(machineType);
        
        let recommendation = `Stop instance or downsize to e2-micro (avg CPU: ${metrics.cpu.toFixed(1)}%)`;
        if (detailedMetrics) {
          recommendation = buildDetailedRecommendation(metrics, machineType, true);
        }

        opportunities.push({
          id: `gce-idle-${instance.name}`,
          provider: 'gcp',
          resourceType: 'compute-engine',
          resourceId: instance.name,
          resourceName: instance.labels?.name || instance.name,
          category: 'idle',
          currentCost: monthlyCost,
          estimatedSavings: monthlyCost,
          confidence,
          recommendation,
          metadata: {
            machineType,
            zone,
            metrics,
            reasoning,
            status: instance.status,
          },
          detectedAt: new Date(),
        });
      }
      // Opportunity 2: Underutilized (only if detailed metrics and high confidence)
      else if (isUnderutilized && detailedMetrics && confidence === 'high') {
        const monthlyCost = getGCEMonthlyCost(machineType);
        const recommendation = buildDetailedRecommendation(metrics, machineType, false);

        opportunities.push({
          id: `gce-underutilized-${instance.name}`,
          provider: 'gcp',
          resourceType: 'compute-engine',
          resourceId: instance.name,
          resourceName: instance.labels?.name || instance.name,
          category: 'underutilized',
          currentCost: monthlyCost,
          estimatedSavings: monthlyCost * 0.5,
          confidence,
          recommendation,
          metadata: {
            machineType,
            zone,
            metrics,
            reasoning,
            status: instance.status,
          },
          detectedAt: new Date(),
        });
      }
    }
  }

  return opportunities;
}

// Basic metrics: CPU only (fast)
async function getBasicMetrics(
  monitoringClient: any,
  projectId: string,
  instanceName: string,
  zone: string,
  days: number
): Promise<GCEMetrics> {
  const cpu = await getAvgCPU(monitoringClient, projectId, instanceName, zone, days);
  return { cpu };
}

// Detailed metrics: CPU + Memory + Network + Disk (comprehensive)
async function getDetailedMetrics(
  monitoringClient: any,
  projectId: string,
  instanceName: string,
  zone: string,
  days: number
): Promise<GCEMetrics> {
  const endTime = new Date();
  const startTime = dayjs(endTime).subtract(days, 'day').toDate();

  const interval = {
    startTime: { seconds: Math.floor(startTime.getTime() / 1000) },
    endTime: { seconds: Math.floor(endTime.getTime() / 1000) },
  };

  const aggregation = {
    alignmentPeriod: { seconds: 86400 }, // 1 day
    perSeriesAligner: 'ALIGN_MEAN',
    crossSeriesReducer: 'REDUCE_MEAN',
  };

  const metrics: GCEMetrics = { cpu: 0 };

  try {
    // Fetch all metrics
    const metricTypes = [
      'compute.googleapis.com/instance/cpu/utilization',
      'agent.googleapis.com/memory/percent_used',
      'compute.googleapis.com/instance/network/sent_bytes_count',
      'compute.googleapis.com/instance/network/received_bytes_count',
      'compute.googleapis.com/instance/disk/read_ops_count',
      'compute.googleapis.com/instance/disk/write_ops_count',
    ];

    for (const metricType of metricTypes) {
      try {
        const request = {
          name: `projects/${projectId}`,
          filter: 
            `metric.type="${metricType}" ` +
            `AND resource.type="gce_instance" ` +
            `AND resource.labels.instance_name="${instanceName}"`,
          interval,
          aggregation,
        };

        const [timeSeries] = await monitoringClient.listTimeSeries(request);

        if (!timeSeries || timeSeries.length === 0) continue;

        let sum = 0;
        let count = 0;

        for (const series of timeSeries) {
          for (const point of series.points || []) {
            if (point.value?.doubleValue !== undefined) {
              sum += point.value.doubleValue;
              count++;
            }
          }
        }

        if (count === 0) continue;
        const avg = sum / count;

        // Map to metrics object
        switch (metricType) {
          case 'compute.googleapis.com/instance/cpu/utilization':
            metrics.cpu = avg * 100; // Convert ratio to percentage
            break;
          case 'agent.googleapis.com/memory/percent_used':
            metrics.memory = avg;
            break;
          case 'compute.googleapis.com/instance/network/sent_bytes_count':
            metrics.networkSent = avg;
            break;
          case 'compute.googleapis.com/instance/network/received_bytes_count':
            metrics.networkReceived = avg;
            break;
          case 'compute.googleapis.com/instance/disk/read_ops_count':
            metrics.diskReadOps = avg;
            break;
          case 'compute.googleapis.com/instance/disk/write_ops_count':
            metrics.diskWriteOps = avg;
            break;
        }
      } catch (error) {
        // Some metrics may not be available, continue with others
        continue;
      }
    }

    return metrics;
  } catch (error) {
    console.error('Error fetching detailed metrics:', error);
    // Fallback to basic metrics
    const cpu = await getAvgCPU(monitoringClient, projectId, instanceName, zone, days);
    return { cpu };
  }
}

async function getAvgCPU(
  monitoringClient: any,
  projectId: string,
  instanceName: string,
  zone: string,
  days: number
): Promise<number> {
  const endTime = new Date();
  const startTime = dayjs(endTime).subtract(days, 'day').toDate();

  try {
    const request = {
      name: `projects/${projectId}`,
      filter: 
        `metric.type="compute.googleapis.com/instance/cpu/utilization" ` +
        `AND resource.type="gce_instance" ` +
        `AND resource.labels.instance_name="${instanceName}"`,
      interval: {
        startTime: {
          seconds: Math.floor(startTime.getTime() / 1000),
        },
        endTime: {
          seconds: Math.floor(endTime.getTime() / 1000),
        },
      },
      aggregation: {
        alignmentPeriod: { seconds: 86400 }, // 1 day
        perSeriesAligner: 'ALIGN_MEAN',
        crossSeriesReducer: 'REDUCE_MEAN',
      },
    };

    const [timeSeries] = await monitoringClient.listTimeSeries(request);

    if (!timeSeries || timeSeries.length === 0) {
      return 0;
    }

    let sum = 0;
    let count = 0;

    for (const series of timeSeries) {
      for (const point of series.points || []) {
        if (point.value?.doubleValue !== undefined) {
          // GCP returns CPU as a ratio (0-1), convert to percentage
          sum += point.value.doubleValue * 100;
          count++;
        }
      }
    }

    return count > 0 ? sum / count : 0;
  } catch (error) {
    // Monitoring metrics may not be available for all instances
    return 0;
  }
}

function buildDetailedRecommendation(
  metrics: GCEMetrics,
  machineType: string,
  isIdle: boolean
): string {
  const parts = [];
  
  parts.push(`CPU: ${metrics.cpu.toFixed(1)}%`);
  
  if (metrics.memory !== undefined) {
    parts.push(`Memory: ${metrics.memory.toFixed(1)}%`);
  }
  
  if (metrics.networkSent !== undefined && metrics.networkReceived !== undefined) {
    const totalMB = ((metrics.networkSent + metrics.networkReceived) / 1024 / 1024).toFixed(1);
    parts.push(`Network: ${totalMB} MB/s`);
  }
  
  if (metrics.diskReadOps !== undefined && metrics.diskWriteOps !== undefined) {
    const totalIOPS = (metrics.diskReadOps + metrics.diskWriteOps).toFixed(0);
    parts.push(`Disk: ${totalIOPS} IOPS`);
  }

  const metricsSummary = parts.join(' | ');
  
  if (isIdle) {
    return `Instance is idle (${metricsSummary}) - consider stopping or terminating`;
  } else {
    return `Low utilization (${metricsSummary}) - consider downsizing to smaller machine type`;
  }
}
