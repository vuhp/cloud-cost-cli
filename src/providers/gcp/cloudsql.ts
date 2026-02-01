import { GCPClient } from './client';
import { SavingsOpportunity } from '../../types/opportunity';
import { getGCPCloudSQLMonthlyCost } from '../../analyzers/cost-estimator';
import dayjs from 'dayjs';

export async function analyzeCloudSQLInstances(
  client: GCPClient
): Promise<SavingsOpportunity[]> {
  const sqlClient = client.getCloudSQLClient();
  const monitoringClient = client.getMonitoringClient();

  const opportunities: SavingsOpportunity[] = [];

  try {
    const request = {
      project: client.projectId,
    };
    
    const response = await sqlClient.list(request);
    const instances = response[0]?.items || [];

    for (const instance of instances || []) {
      if (!instance.name || !instance.settings?.tier) continue;

      // Get average CPU over last 30 days
      const avgCpu = await getAvgCPU(
        monitoringClient,
        client.projectId,
        instance.name,
        30
      );

      // Detect oversized: low CPU (<20%)
      if (avgCpu < 20 && avgCpu > 0 && instance.state === 'RUNNABLE') {
        const tier = instance.settings.tier;
        const currentCost = getGCPCloudSQLMonthlyCost(tier);

        // Estimate smaller tier
        const smallerTier = getSmallerTier(tier);
        const proposedCost = smallerTier ? getGCPCloudSQLMonthlyCost(smallerTier) : 0;
        const savings = currentCost - proposedCost;

        if (savings > 0) {
          opportunities.push({
            id: `cloudsql-oversized-${instance.name}`,
            provider: 'gcp',
            resourceType: 'cloud-sql',
            resourceId: instance.name,
            resourceName: instance.name,
            category: 'oversized',
            currentCost,
            estimatedSavings: savings,
            confidence: 'medium',
            recommendation: `Downsize to ${smallerTier || 'smaller tier'} (avg CPU: ${avgCpu.toFixed(1)}%)`,
            metadata: {
              tier,
              avgCpu,
              databaseVersion: instance.databaseVersion,
              region: instance.region,
            },
            detectedAt: new Date(),
          });
        }
      }
    }
  } catch (error) {
    // Skip if Cloud SQL API is not enabled or permission issues
  }

  return opportunities;
}

async function getAvgCPU(
  monitoringClient: any,
  projectId: string,
  instanceName: string,
  days: number
): Promise<number> {
  const endTime = new Date();
  const startTime = dayjs(endTime).subtract(days, 'day').toDate();

  try {
    const request = {
      name: `projects/${projectId}`,
      filter:
        `metric.type="cloudsql.googleapis.com/database/cpu/utilization" ` +
        `AND resource.labels.database_id="${projectId}:${instanceName}"`,
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
    return 0;
  }
}

function getSmallerTier(currentTier: string): string | null {
  // GCP Cloud SQL tier mapping (simplified)
  const tierMap: Record<string, string> = {
    'db-n1-standard-4': 'db-n1-standard-2',
    'db-n1-standard-2': 'db-n1-standard-1',
    'db-n1-standard-8': 'db-n1-standard-4',
    'db-n1-standard-16': 'db-n1-standard-8',
    'db-custom-4-16384': 'db-custom-2-8192',
    'db-custom-2-8192': 'db-custom-1-4096',
  };

  return tierMap[currentTier] || null;
}
