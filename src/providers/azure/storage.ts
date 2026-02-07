import { AzureClient } from './client';
import { SavingsOpportunity } from '../../types/opportunity';
import { getAzureStorageMonthlyCost } from '../../analyzers/cost-estimator';

export async function analyzeAzureStorage(
  client: AzureClient
): Promise<SavingsOpportunity[]> {
  const storageClient = client.getStorageClient();
  const opportunities: SavingsOpportunity[] = [];

  try {
    // List all storage accounts
    const accounts = storageClient.storageAccounts.list();

    for await (const account of accounts) {
      if (!account.id || !account.name) continue;

      // Filter by location if specified
      if (client.location && account.location?.toLowerCase() !== client.location.toLowerCase()) {
        continue;
      }

      const resourceGroup = extractResourceGroup(account.id);
      if (!resourceGroup) continue;

      try {
        // Get blob service properties
        const blobServices = await storageClient.blobServices.getServiceProperties(
          resourceGroup,
          account.name
        );

        // Check if lifecycle management is enabled
        const hasLifecyclePolicy = await hasLifecycleManagement(
          storageClient,
          resourceGroup,
          account.name
        );

        if (!hasLifecyclePolicy) {
          // Estimate potential savings (assume 30% of data could move to cool/archive)
          // This is a rough estimate - actual savings depend on usage patterns
          const estimatedSavings = 50; // Conservative estimate

          opportunities.push({
            id: `azure-storage-lifecycle-${account.name}`,
            provider: 'azure',
            resourceType: 'storage',
            resourceId: account.id,
            resourceName: account.name,
            category: 'misconfigured',
            currentCost: 100, // Placeholder - hard to estimate without usage data
            estimatedSavings,
            confidence: 'low',
            recommendation: 'Enable lifecycle management to automatically move old data to Cool or Archive tiers.',
            metadata: {
              location: account.location,
              accountType: account.kind,
              replication: account.sku?.name,
            },
            detectedAt: new Date(),
          });
        }

        // Check for public access
        if (account.allowBlobPublicAccess === true) {
          opportunities.push({
            id: `azure-storage-public-${account.name}`,
            provider: 'azure',
            resourceType: 'storage',
            resourceId: account.id,
            resourceName: account.name,
            category: 'misconfigured',
            currentCost: 0,
            estimatedSavings: 0,
            confidence: 'high',
            recommendation: 'Public blob access is enabled. Review security settings.',
            metadata: {
              location: account.location,
              issue: 'security',
            },
            detectedAt: new Date(),
          });
        }
      } catch (error) {
        // Skip this account if we can't fetch details
        continue;
      }
    }

    return opportunities;
  } catch (error) {
    throw error;
  }
}

async function hasLifecycleManagement(
  storageClient: any,
  resourceGroup: string,
  accountName: string
): Promise<boolean> {
  try {
    const policy = await storageClient.managementPolicies.get(
      resourceGroup,
      accountName,
      'default'
    );
    return policy && policy.policy && policy.policy.rules && policy.policy.rules.length > 0;
  } catch (error) {
    return false;
  }
}

function extractResourceGroup(resourceId: string): string | null {
  const match = resourceId.match(/resourceGroups\/([^\/]+)/i);
  return match ? match[1] : null;
}
