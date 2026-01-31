import { AzureClient } from './client';
import { SavingsOpportunity } from '../../types/opportunity';

// Azure SQL Database pricing (per month, East US, vCore model)
export const AZURE_SQL_PRICING: Record<string, number> = {
  'GP_Gen5_2': 438.29,  // General Purpose, 2 vCores
  'GP_Gen5_4': 876.58,  // General Purpose, 4 vCores
  'GP_Gen5_8': 1753.16, // General Purpose, 8 vCores
  'BC_Gen5_2': 876.58,  // Business Critical, 2 vCores
  'BC_Gen5_4': 1753.16, // Business Critical, 4 vCores
};

function getSQLMonthlyCost(sku: string): number {
  return AZURE_SQL_PRICING[sku] || 500; // Fallback estimate
}

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
          const currentCost = getSQLMonthlyCost(sku);

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
                sku,
                tier,
                avgDtu,
                server: server.name,
                location: db.location,
              },
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
                sku,
                tier,
                avgDtu,
                server: server.name,
              },
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
    console.error('Error analyzing Azure SQL:', error);
    return opportunities;
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

function extractResourceGroup(resourceId: string): string | null {
  const match = resourceId.match(/resourceGroups\/([^\/]+)/i);
  return match ? match[1] : null;
}
