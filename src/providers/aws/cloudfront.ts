import { CloudFrontClient, ListDistributionsCommand } from '@aws-sdk/client-cloudfront';
import { CloudWatchClient, GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';
import { fromIni, fromEnv } from '@aws-sdk/credential-providers';
import { AWSClient } from './client';
import { SavingsOpportunity } from '../../types/opportunity';
import { error } from '../../utils/logger';

// CloudFront pricing (approximate, varies by region)
const PRICING = {
  dataTransfer: {
    us: 0.085, // per GB for first 10TB
  },
  requests: {
    http: 0.0075, // per 10,000 HTTP requests
    https: 0.0100, // per 10,000 HTTPS requests
  },
};

export async function analyzeCloudFrontDistributions(
  awsClient: AWSClient
): Promise<SavingsOpportunity[]> {
  const opportunities: SavingsOpportunity[] = [];

  try {
    // Get credentials from the existing client
    const credentials = process.env.AWS_ACCESS_KEY_ID
      ? fromEnv()
      : fromIni({ profile: awsClient.profile || 'default' });
    
    const cloudfront = new CloudFrontClient({ 
      region: 'us-east-1', // CloudFront is global, but API is in us-east-1
      credentials 
    });

    // List all distributions
    const listCommand = new ListDistributionsCommand({});
    const listResponse = await cloudfront.send(listCommand);
    
    const distributions = listResponse.DistributionList?.Items || [];

    for (const distribution of distributions) {
      const distributionId = distribution.Id || 'unknown';
      const domainName = distribution.DomainName || 'unknown';
      const enabled = distribution.Enabled || false;
      const status = distribution.Status || 'unknown';

      // Check if distribution is disabled
      if (!enabled && status === 'Deployed') {
        opportunities.push({
          id: `cloudfront-${distributionId}`,
          provider: 'aws',
          resourceType: 'CloudFront',
          resourceId: distributionId,
          resourceName: domainName,
          category: 'unused',
          currentCost: 0,
          estimatedSavings: 0,
          confidence: 'low',
          recommendation: 'Delete disabled CloudFront distribution if no longer needed',
          metadata: { status, enabled },
          detectedAt: new Date(),
        });
        continue;
      }

      // Get CloudWatch metrics for the distribution
      try {
        const cloudwatch = new CloudWatchClient({ 
          region: 'us-east-1',
          credentials 
        });

        // Check requests in last 30 days
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - 30 * 24 * 60 * 60 * 1000);

        const requestsCommand = new GetMetricStatisticsCommand({
          Namespace: 'AWS/CloudFront',
          MetricName: 'Requests',
          Dimensions: [
            { Name: 'DistributionId', Value: distributionId },
            { Name: 'Region', Value: 'Global' },
          ],
          StartTime: startTime,
          EndTime: endTime,
          Period: 30 * 24 * 60 * 60, // 30 days in seconds
          Statistics: ['Sum'],
        });

        const requestsResponse = await cloudwatch.send(requestsCommand);
        const requestCount = requestsResponse.Datapoints?.[0]?.Sum || 0;

        // Check bytes downloaded
        const bytesCommand = new GetMetricStatisticsCommand({
          Namespace: 'AWS/CloudFront',
          MetricName: 'BytesDownloaded',
          Dimensions: [
            { Name: 'DistributionId', Value: distributionId },
            { Name: 'Region', Value: 'Global' },
          ],
          StartTime: startTime,
          EndTime: endTime,
          Period: 30 * 24 * 60 * 60,
          Statistics: ['Sum'],
        });

        const bytesResponse = await cloudwatch.send(bytesCommand);
        const bytesDownloaded = bytesResponse.Datapoints?.[0]?.Sum || 0;

        // Estimate monthly cost
        const dataTransferGB = bytesDownloaded / (1024 * 1024 * 1024);
        const estimatedMonthlyCost = 
          (dataTransferGB * PRICING.dataTransfer.us) +
          ((requestCount / 10000) * PRICING.requests.https);

        // Low usage check (< 1000 requests in 30 days)
        if (requestCount < 1000 && enabled) {
          opportunities.push({
            id: `cloudfront-low-usage-${distributionId}`,
            provider: 'aws',
            resourceType: 'CloudFront',
            resourceId: distributionId,
            resourceName: domainName,
            category: 'underutilized',
            currentCost: estimatedMonthlyCost,
            estimatedSavings: Math.max(estimatedMonthlyCost * 0.5, 5),
            confidence: 'low',
            recommendation: 'Consider if CloudFront is needed - serving <1000 requests/month directly from S3 or origin may be cheaper',
            metadata: { requestCount, dataTransferGB },
            detectedAt: new Date(),
          });
        }

        // Check for high error rates (4xx errors)
        const error4xxCommand = new GetMetricStatisticsCommand({
          Namespace: 'AWS/CloudFront',
          MetricName: '4xxErrorRate',
          Dimensions: [
            { Name: 'DistributionId', Value: distributionId },
            { Name: 'Region', Value: 'Global' },
          ],
          StartTime: startTime,
          EndTime: endTime,
          Period: 30 * 24 * 60 * 60,
          Statistics: ['Average'],
        });

        const errorResponse = await cloudwatch.send(error4xxCommand);
        const errorRate = errorResponse.Datapoints?.[0]?.Average || 0;

        if (errorRate > 10) { // More than 10% error rate
          opportunities.push({
            id: `cloudfront-errors-${distributionId}`,
            provider: 'aws',
            resourceType: 'CloudFront',
            resourceId: distributionId,
            resourceName: domainName,
            category: 'misconfigured',
            currentCost: estimatedMonthlyCost,
            estimatedSavings: 0,
            confidence: 'low',
            recommendation: 'Review CloudFront distribution settings and origin configuration - high 4xx error rate detected',
            metadata: { errorRate },
            detectedAt: new Date(),
          });
        }

      } catch (err: any) {
        // CloudWatch metrics might not be available, skip
      }
    }

  } catch (err: any) {
    if (err.name === 'AccessDenied' || err.name === 'NoCredentials') {
      error('⚠️ Skipping CloudFront - missing permission: cloudfront:ListDistributions');
    } else {
      error(`⚠️ CloudFront analysis failed: ${err.message}`);
    }
  }

  return opportunities;
}
