import { GCPClient } from './client';
import { SavingsOpportunity } from '../../types/opportunity';
import { getGCEMonthlyCost } from '../../analyzers/cost-estimator';
import dayjs from 'dayjs';

export async function analyzeGCEInstances(
  client: GCPClient
): Promise<SavingsOpportunity[]> {
  const computeClient = client.getComputeClient();
  const monitoringClient = client.getMonitoringClient();

  const opportunities: SavingsOpportunity[] = [];

  // GCP instances are zone-specific, so we need to check multiple zones
  const zones = await getZonesInRegion(client.region);

  for (const zone of zones) {
    const [instances] = await computeClient.list({
      project: client.projectId,
      zone: zone,
      filter: 'status = "RUNNING"',
    });

    for await (const instance of instances) {
      if (!instance.name || !instance.machineType) continue;

      // Extract machine type from full URL (e.g., "zones/us-central1-a/machineTypes/n1-standard-1")
      const machineType = instance.machineType.split('/').pop() || '';

      // Get average CPU over last 30 days
      const avgCpu = await getAvgCPU(
        monitoringClient,
        client.projectId,
        instance.name,
        zone,
        30
      );

      if (avgCpu < 5) {
        const monthlyCost = getGCEMonthlyCost(machineType);
        opportunities.push({
          id: `gce-idle-${instance.name}`,
          provider: 'gcp',
          resourceType: 'compute-engine',
          resourceId: instance.name,
          resourceName: instance.labels?.name || instance.name,
          category: 'idle',
          currentCost: monthlyCost,
          estimatedSavings: monthlyCost,
          confidence: 'high',
          recommendation: `Stop instance or downsize to e2-micro (avg CPU: ${avgCpu.toFixed(1)}%)`,
          metadata: {
            machineType,
            zone,
            avgCpu,
            status: instance.status,
          },
          detectedAt: new Date(),
        });
      }
    }
  }

  return opportunities;
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
        `AND resource.labels.instance_id="${instanceName}" ` +
        `AND resource.labels.zone="${zone}"`,
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

function getZonesInRegion(region: string): string[] {
  // Common GCP zones per region (a, b, c, f)
  // In a production app, you'd query this dynamically via Compute API
  return [
    `${region}-a`,
    `${region}-b`,
    `${region}-c`,
    `${region}-f`,
  ];
}
