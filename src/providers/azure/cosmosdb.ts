import { AzureClient } from './client';
import { SavingsOpportunity } from '../../types/opportunity';

/**
 * Analyze Azure CosmosDB accounts for cost optimization opportunities
 * 
 * CosmosDB pricing (East US):
 * Provisioned Throughput:
 * - $0.008 per 100 RU/s per hour (~$5.84/month per 100 RU/s)
 * - Minimum: 400 RU/s (~$23.36/month)
 * 
 * Serverless:
 * - $0.25 per million RU consumed
 * - $0.25 per GB stored per month
 */
export async function analyzeCosmosDB(
  client: AzureClient
): Promise<SavingsOpportunity[]> {
  const opportunities: SavingsOpportunity[] = [];

  try {
    const cosmosClient = client.getCosmosDBManagementClient();

    // List all CosmosDB accounts
    const accounts = [];
    for await (const account of cosmosClient.databaseAccounts.list()) {
      accounts.push(account);
    }

    for (const account of accounts) {
      if (!account.id || !account.name) continue;

      const accountName = account.name;
      const location = account.location;
      const capabilities = account.capabilities || [];

      // Check if serverless
      const isServerless = capabilities.some((cap: any) =>
        cap.name === 'EnableServerless'
      );

      // Get databases for this account
      const resourceGroup = account.id.split('/')[4];

      try {
        const databases = [];
        for await (const db of cosmosClient.sqlResources.listSqlDatabases(resourceGroup, accountName)) {
          databases.push(db);
        }

        for (const db of databases) {
          if (!db.name) continue;

          const dbName = db.name;

          // Get containers
          try {
            const containers = [];
            for await (const container of cosmosClient.sqlResources.listSqlContainers(resourceGroup, accountName, dbName)) {
              containers.push(container);
            }

            for (const container of containers) {
              if (!container.name || !container.resource) continue;

              const containerName = container.name;

              // Get throughput settings
              try {
                const throughput = await cosmosClient.sqlResources.getSqlContainerThroughput(
                  resourceGroup,
                  accountName,
                  dbName,
                  containerName
                );

                if (throughput.resource) {
                  const provisionedRU = throughput.resource.throughput || 0;
                  const autoscaleMaxRU = throughput.resource.autoscaleSettings?.maxThroughput;

                  // Calculate monthly cost
                  const monthlyCost = calculateProvisionedCost(provisionedRU);

                  // Opportunity 1: High provisioned throughput (>10,000 RU/s)
                  if (provisionedRU >= 10000 && !autoscaleMaxRU) {
                    const recommendedRU = Math.max(400, Math.floor(provisionedRU * 0.5));
                    const recommendedCost = calculateProvisionedCost(recommendedRU);
                    const savings = monthlyCost - recommendedCost;

                    if (savings > 50) {
                      opportunities.push({
                        id: `azure-cosmosdb-overprovisioned-${accountName}-${dbName}-${containerName}`,
                        provider: 'azure',
                        resourceType: 'cosmosdb',
                        resourceId: container.id || '',
                        resourceName: `${accountName}/${dbName}/${containerName}`,
                        category: 'oversized',
                        currentCost: monthlyCost,
                        estimatedSavings: savings,
                        confidence: 'medium',
                        recommendation: `High provisioned throughput (${provisionedRU} RU/s). Consider autoscale or reducing to ${recommendedRU} RU/s if usage is lower.`,
                        metadata: {
                          accountName,
                          databaseName: dbName,
                          containerName,
                          currentRU: provisionedRU,
                          recommendedRU,
                          location,
                        },
                        detectedAt: new Date(),
                      });
                    }
                  }

                  // Opportunity 2: Provisioned mode with low throughput (should use serverless)
                  if (provisionedRU <= 1000 && !isServerless) {
                    const serverlessCost = 25; // Estimate for low usage
                    const savings = monthlyCost - serverlessCost;

                    if (savings > 10) {
                      opportunities.push({
                        id: `azure-cosmosdb-serverless-candidate-${accountName}-${dbName}-${containerName}`,
                        provider: 'azure',
                        resourceType: 'cosmosdb',
                        resourceId: container.id || '',
                        resourceName: `${accountName}/${dbName}/${containerName}`,
                        category: 'misconfigured',
                        currentCost: monthlyCost,
                        estimatedSavings: savings,
                        confidence: 'medium',
                        recommendation: `Low throughput (${provisionedRU} RU/s). Consider Serverless mode for unpredictable/low workloads.`,
                        metadata: {
                          accountName,
                          databaseName: dbName,
                          containerName,
                          currentRU: provisionedRU,
                          location,
                        },
                        detectedAt: new Date(),
                      });
                    }
                  }
                }
              } catch (throughputError) {
                // Container might not have dedicated throughput (using database-level)
                continue;
              }
            }
          } catch (containerError) {
            // Can't list containers, skip
            continue;
          }
        }
      } catch (dbError) {
        // Can't list databases, skip this account
        continue;
      }
    }

    return opportunities;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Calculate monthly cost for provisioned throughput
 * $0.008 per 100 RU/s per hour = $5.84 per 100 RU/s per month
 */
function calculateProvisionedCost(ruPerSecond: number): number {
  const costPer100RU = 5.84;
  return (ruPerSecond / 100) * costPer100RU;
}
