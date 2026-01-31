import {
  ListBucketsCommand,
  GetBucketLocationCommand,
  GetBucketLifecycleConfigurationCommand,
} from '@aws-sdk/client-s3';
import { AWSClient } from './client';
import { SavingsOpportunity } from '../../types';
import { getS3MonthlyCost } from '../../analyzers/cost-estimator';

export async function analyzeS3Buckets(
  client: AWSClient
): Promise<SavingsOpportunity[]> {
  const s3Client = client.getS3Client();

  const result = await s3Client.send(new ListBucketsCommand({}));

  const buckets = result.Buckets || [];
  const opportunities: SavingsOpportunity[] = [];

  for (const bucket of buckets) {
    if (!bucket.Name) continue;

    try {
      // Check if bucket has lifecycle policy
      await s3Client.send(
        new GetBucketLifecycleConfigurationCommand({ Bucket: bucket.Name })
      );
      // If we get here, lifecycle exists — skip this bucket
    } catch (error: any) {
      // NoSuchLifecycleConfiguration means no lifecycle policy
      if (error.name === 'NoSuchLifecycleConfiguration') {
        // Estimate bucket size (we can't get exact size without CloudWatch or S3 Storage Lens)
        // For MVP, assume buckets without lifecycle are worth flagging
        // In production, integrate with CloudWatch GetMetricStatistics for BucketSizeBytes
        
        const estimatedSizeGB = 100; // Placeholder: assume 100 GB for flagged buckets
        const currentCost = getS3MonthlyCost(estimatedSizeGB, 'standard');
        const glacierCost = getS3MonthlyCost(estimatedSizeGB * 0.5, 'glacier'); // Assume 50% can move to Glacier
        const savings = currentCost - glacierCost - (estimatedSizeGB * 0.5 * 0.023); // Remaining in standard

        if (savings > 5) {
          // Only flag if savings > $5/month
          opportunities.push({
            id: `s3-no-lifecycle-${bucket.Name}`,
            provider: 'aws',
            resourceType: 's3',
            resourceId: bucket.Name,
            resourceName: bucket.Name,
            category: 'misconfigured',
            currentCost,
            estimatedSavings: savings,
            confidence: 'low',
            recommendation: `Enable lifecycle policy (Intelligent-Tiering or Glacier transition)`,
            metadata: {
              bucketName: bucket.Name,
              estimatedSizeGB,
              creationDate: bucket.CreationDate,
            },
            detectedAt: new Date(),
          });
        }
      }
    }
  }

  return opportunities;
}
