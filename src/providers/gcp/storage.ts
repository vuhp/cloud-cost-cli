import { GCPClient } from './client';
import { SavingsOpportunity } from '../../types/opportunity';
import { getGCSMonthlyCost } from '../../analyzers/cost-estimator';

export async function analyzeGCSBuckets(
  client: GCPClient
): Promise<SavingsOpportunity[]> {
  const storageClient = client.getStorageClient();

  const [buckets] = await storageClient.getBuckets({
    project: client.projectId,
  });

  const opportunities: SavingsOpportunity[] = [];

  for (const bucket of buckets) {
    try {
      // Check if bucket has lifecycle management rules
      const [metadata] = await bucket.getMetadata();
      const lifecycleRules = metadata.lifecycle?.rule;

      if (!lifecycleRules || lifecycleRules.length === 0) {
        // Estimate bucket size from metadata or use placeholder
        // In production, you'd integrate with Cloud Monitoring for accurate size
        const estimatedSizeGB = 100; // Placeholder

        const currentCost = getGCSMonthlyCost(estimatedSizeGB, 'standard');
        const nearlineCost = getGCSMonthlyCost(estimatedSizeGB * 0.5, 'nearline'); // 50% to Nearline
        const savings = currentCost - nearlineCost - (estimatedSizeGB * 0.5 * 0.020); // Remaining in standard

        if (savings > 5) {
          opportunities.push({
            id: `gcs-no-lifecycle-${bucket.name}`,
            provider: 'gcp',
            resourceType: 'cloud-storage',
            resourceId: bucket.name,
            resourceName: bucket.name,
            category: 'misconfigured',
            currentCost,
            estimatedSavings: savings,
            confidence: 'low',
            recommendation: `Enable lifecycle policy (Nearline or Coldline transition)`,
            metadata: {
              bucketName: bucket.name,
              storageClass: metadata.storageClass,
              location: metadata.location,
              estimatedSizeGB,
            },
            detectedAt: new Date(),
          });
        }
      }
    } catch (error) {
      // Skip buckets with permission issues
      continue;
    }
  }

  return opportunities;
}
