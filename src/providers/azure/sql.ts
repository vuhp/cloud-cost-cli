import { AzureClient } from './client';
import { SavingsOpportunity } from '../../types/opportunity';
import { getSqlPriceEstimate } from '../../utils/azure-pricing';

export async function analyzeAzureSQL(
  client: AzureClient
): Promise<SavingsOpportunity[]> {
  const sqlClient = client.getSqlClient();
  const monitorClient = client.getMonitorClient();
  const opportunities: SavingsOpportunity[] = [];

  try {
    // List all SQL servers
    const servers = sqlClient.servers.list();

    for await (const server of servers) {
      if (!server.id || !server.name) continue;

      // Filter by location if specified
      if (client.location && server.location?.toLowerCase() !== client.location.toLowerCase()) {
        continue;
      }

      const resourceGroup = extractResourceGroup(server.id);
      if (!resourceGroup) continue;

      try {
        // List databases on this server
        const databases = sqlClient.databases.listByServer(resourceGroup, server.name);

        for await (const db of databases) {
          if (!db.id || !db.name || db.name === 'master') continue;

          const sku = db.sku?.name || 'Unknown';
          const tier = db.sku?.tier || 'Unknown';

          // Try to determine size: prefer monitor metric (actual used) then db.maxSizeBytes then unknown
          let sizeBytes: number | null = null;
          try {
            // Some DBs have properties.maxSizeBytes
            if (db.maxSizeBytes) {
              sizeBytes = Number(db.maxSizeBytes);
            }
          } catch {}

          // Try monitor metric for storage used (prefer actual usage)
          try {
            const used = await getRecentStorageUsed(monitorClient, db.id, 7);
            if (used && used > 0) {
              sizeBytes = used;
            }
          } catch (err) {
            // ignore
          }

          const sizeGB = sizeBytes ? +(sizeBytes / (1024 * 1024 * 1024)).toFixed(2) : null;

          // Estimate current cost using SKU-based estimator (may not include storage)
          const price = getSqlPriceEstimate({ skuName: sku, region: db.location, sizeGB: sizeGB ?? undefined });
          const currentCost = price.monthly;

          const baseMetadata: any = {
            sku,
            tier,
            server: server.name,
            location: db.location,
            priceBreakdown: price.breakdown,
            currency: price.currency,
          };
          if (sizeBytes) baseMetadata.sizeBytes = sizeBytes;

          // default cost source is 'calculated'
          const costSource: 'actual' | 'estimated' | 'calculated' = 'calculated';

          // Get DTU/CPU usage metrics
          const avgDtu = await getAverageDTU(monitorClient, db.id, 7);

          // Opportunity 1: Low utilization database
          if (avgDtu < 10) {
            opportunities.push({
              id: `azure-sql-underutilized-${db.name}`,
              provider: 'azure',
              resourceType: 'sql',
              resourceId: db.id,
              resourceName: db.name,
              category: 'oversized',
              currentCost,
              estimatedSavings: currentCost * 0.5, // Could downsize by ~50%
              confidence: 'medium',
              recommendation: `Database is underutilized (${avgDtu.toFixed(1)}% avg DTU). Consider downsizing tier.`,
              metadata: {
                ...baseMetadata,
                avgDtu,
              },
              size_gb: sizeGB,
              costSource,
              detectedAt: new Date(),
            });
          }

          // Opportunity 2: Business Critical that could be General Purpose
          if (tier === 'BusinessCritical' && avgDtu < 30) {
            opportunities.push({
              id: `azure-sql-tier-${db.name}`,
              provider: 'azure',
              resourceType: 'sql',
              resourceId: db.id,
              resourceName: db.name,
              category: 'oversized',
              currentCost,
              estimatedSavings: currentCost * 0.5, // BC is ~2x GP cost
              confidence: 'low',
              recommendation: 'Consider switching from Business Critical to General Purpose tier if high availability is not required.',
              metadata: {
                ...baseMetadata,
                avgDtu,
              },
              size_gb: sizeGB,
              costSource,
              detectedAt: new Date(),
            });
          }
        }
      } catch (error) {
        // Skip this server if we can't fetch databases
        continue;
      }
    }

    return opportunities;
  } catch (error) {
    throw error;
  }
}

async function getAverageDTU(
  monitorClient: any,
  resourceId: string,
  days: number
): Promise<number> {
  try {
    const endTime = new Date();
    const startTime = new Date();
    startTime.setDate(startTime.getDate() - days);

    const metrics = await monitorClient.metrics.list(resourceId, {
      timespan: `${startTime.toISOString()}/${endTime.toISOString()}`,
      interval: 'PT1H',
      metricnames: 'dtu_consumption_percent',
      aggregation: 'Average',
    });

    const timeseries = metrics.value?.[0]?.timeseries?.[0]?.data || [];

    if (timeseries.length === 0) {
      return 0;
    }

    const values = timeseries
      .map((d: any) => d.average)
      .filter((v: any) => v !== null && v !== undefined);

    if (values.length === 0) {
      return 0;
    }

    const sum = values.reduce((a: number, b: number) => a + b, 0);
    return sum / values.length;
  } catch (error) {
    return 0;
  }
}

async function getRecentStorageUsed(monitorClient: any, resourceId: string, days: number): Promise<number | null> {
  try {
    const endTime = new Date();
    const startTime = new Date();
    startTime.setDate(startTime.getDate() - days);

    // Try common metric names for SQL storage
    const metricNames = ['storage_used_bytes', 'storage', 'data_storage', 'storageBytes'];

    for (const name of metricNames) {
      try {
        const metrics = await monitorClient.metrics.list(resourceId, {
          timespan: `${startTime.toISOString()}/${endTime.toISOString()}`,
          interval: 'PT1H',
          metricnames: name,
          aggregation: 'Average',
        });

        const timeseries = metrics.value?.[0]?.timeseries?.[0]?.data || [];
        const values = timeseries
          .map((d: any) => d.average || d.total || d.maximum)
          .filter((v: any) => v !== null && v !== undefined && !isNaN(v));

        if (values.length > 0) {
          // take 95th percentile-ish by sorting and picking near the top to avoid spikes
          values.sort((a: number, b: number) => a - b);
          const idx = Math.max(0, Math.floor(values.length * 0.95) - 1);
          return values[idx];
        }
      } catch (err) {
        // try next metric name
        continue;
      }
    }

    return null;
  } catch (err) {
    return null;
  }
}

function extractResourceGroup(resourceId: string): string | null {
  const match = resourceId.match(/resourceGroups\/([^\/]+)/i);
  return match ? match[1] : null;
}
