import { APIGatewayClient, GetRestApisCommand, GetStagesCommand, GetApiKeysCommand } from '@aws-sdk/client-api-gateway';
import { CloudWatchClient, GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';
import { fromIni, fromEnv } from '@aws-sdk/credential-providers';
import { AWSClient } from './client';
import { SavingsOpportunity } from '../../types/opportunity';
import { error } from '../../utils/logger';

// API Gateway pricing (us-east-1)
const PRICING = {
  rest: {
    tier1: 0.00000350, // First 333M requests
    tier2: 0.00000280, // Next 667M
    tier3: 0.00000189, // Over 1B
  },
  cache: {
    small: 0.020,  // per hour
    medium: 0.038, // per hour
    large: 0.076,  // per hour
  },
};

export async function analyzeAPIGateways(
  awsClient: AWSClient
): Promise<SavingsOpportunity[]> {
  const opportunities: SavingsOpportunity[] = [];

  try {
    const credentials = process.env.AWS_ACCESS_KEY_ID
      ? fromEnv()
      : fromIni({ profile: awsClient.profile || 'default' });
    
    const apigateway = new APIGatewayClient({ 
      region: awsClient.region,
      credentials 
    });

    // List all REST APIs
    const listCommand = new GetRestApisCommand({ limit: 500 });
    const listResponse = await apigateway.send(listCommand);
    
    const apis = listResponse.items || [];

    for (const api of apis) {
      const apiId = api.id || 'unknown';
      const apiName = api.name || 'unnamed';

      // Get stages for this API
      try {
        const stagesCommand = new GetStagesCommand({ restApiId: apiId });
        const stagesResponse = await apigateway.send(stagesCommand);
        const stages = stagesResponse.item || [];

        for (const stage of stages) {
          const stageName = stage.stageName || 'unknown';

          // Check CloudWatch metrics for usage
          try {
            const cloudwatch = new CloudWatchClient({ 
              region: awsClient.region,
              credentials 
            });

            const endTime = new Date();
            const startTime = new Date(endTime.getTime() - 30 * 24 * 60 * 60 * 1000);

            // Check Count metric (requests)
            const countCommand = new GetMetricStatisticsCommand({
              Namespace: 'AWS/ApiGateway',
              MetricName: 'Count',
              Dimensions: [
                { Name: 'ApiName', Value: apiName },
                { Name: 'Stage', Value: stageName },
              ],
              StartTime: startTime,
              EndTime: endTime,
              Period: 30 * 24 * 60 * 60,
              Statistics: ['Sum'],
            });

            const countResponse = await cloudwatch.send(countCommand);
            const requestCount = countResponse.Datapoints?.[0]?.Sum || 0;

            // Check for low usage
            if (requestCount < 1000) {
              const estimatedMonthlyCost = (requestCount / 1000000) * 3.50;
              
              opportunities.push({
                id: `apigateway-low-usage-${apiId}-${stageName}`,
                provider: 'aws',
                resourceType: 'API Gateway',
                resourceId: apiId,
                resourceName: `${apiName}/${stageName}`,
                category: 'underutilized',
                currentCost: estimatedMonthlyCost,
                estimatedSavings: Math.max(estimatedMonthlyCost, 10),
                confidence: 'low',
                recommendation: 'Consider if API Gateway is needed - very low usage may not justify the cost',
                metadata: { requestCount, stageName },
                detectedAt: new Date(),
              });
            }

            // Check for 4xx errors
            const error4xxCommand = new GetMetricStatisticsCommand({
              Namespace: 'AWS/ApiGateway',
              MetricName: '4XXError',
              Dimensions: [
                { Name: 'ApiName', Value: apiName },
                { Name: 'Stage', Value: stageName },
              ],
              StartTime: startTime,
              EndTime: endTime,
              Period: 30 * 24 * 60 * 60,
              Statistics: ['Sum'],
            });

            const errorResponse = await cloudwatch.send(error4xxCommand);
            const errorCount = errorResponse.Datapoints?.[0]?.Sum || 0;
            const errorRate = requestCount > 0 ? (errorCount / requestCount) * 100 : 0;

            if (errorRate > 10) {
              opportunities.push({
                id: `apigateway-errors-${apiId}-${stageName}`,
                provider: 'aws',
                resourceType: 'API Gateway',
                resourceId: apiId,
                resourceName: `${apiName}/${stageName}`,
                category: 'misconfigured',
                currentCost: 0,
                estimatedSavings: 0,
                confidence: 'low',
                recommendation: 'Review API Gateway configuration - high 4xx error rate indicates client issues or misconfiguration',
                metadata: { errorRate, errorCount },
                detectedAt: new Date(),
              });
            }

            // Check cache settings
            if (stage.cacheClusterEnabled && stage.cacheClusterSize) {
              const cacheSize = stage.cacheClusterSize;
              const cacheEnabled = stage.cacheClusterEnabled;
              
              // Check if caching is actually being used
              const cacheHitCommand = new GetMetricStatisticsCommand({
                Namespace: 'AWS/ApiGateway',
                MetricName: 'CacheHitCount',
                Dimensions: [
                  { Name: 'ApiName', Value: apiName },
                  { Name: 'Stage', Value: stageName },
                ],
                StartTime: startTime,
                EndTime: endTime,
                Period: 30 * 24 * 60 * 60,
                Statistics: ['Sum'],
              });

              const cacheHitResponse = await cloudwatch.send(cacheHitCommand);
              const cacheHits = cacheHitResponse.Datapoints?.[0]?.Sum || 0;

              if (cacheHits === 0 && cacheEnabled) {
                const hourlyRate = PRICING.cache[cacheSize as keyof typeof PRICING.cache] || 0.020;
                const monthlyCost = hourlyRate * 24 * 30;

                opportunities.push({
                  id: `apigateway-unused-cache-${apiId}-${stageName}`,
                  provider: 'aws',
                  resourceType: 'API Gateway',
                  resourceId: apiId,
                  resourceName: `${apiName}/${stageName}`,
                  category: 'unused',
                  currentCost: monthlyCost,
                  estimatedSavings: monthlyCost,
                  confidence: 'medium',
                  recommendation: `Disable unused API Gateway cache (${cacheSize}) to save ~$${monthlyCost.toFixed(2)}/month`,
                  metadata: { cacheSize, cacheHits },
                  detectedAt: new Date(),
                });
              }
            }

          } catch (err: any) {
            // CloudWatch metrics might not be available
          }
        }
      } catch (err: any) {
        // Skip this API if we can't get stages
      }
    }

    // Check for unused API keys
    try {
      const keysCommand = new GetApiKeysCommand({ limit: 500, includeValues: false });
      const keysResponse = await apigateway.send(keysCommand);
      const keys = keysResponse.items || [];

      for (const key of keys) {
        if (key.enabled === false) {
          opportunities.push({
            id: `apigateway-disabled-key-${key.id}`,
            provider: 'aws',
            resourceType: 'API Gateway',
            resourceId: key.id || 'unknown',
            resourceName: key.name,
            category: 'unused',
            currentCost: 0,
            estimatedSavings: 0,
            confidence: 'low',
            recommendation: 'Delete disabled API keys if no longer needed',
            metadata: {},
            detectedAt: new Date(),
          });
        }
      }
    } catch (err: any) {
      // Skip API key analysis if permissions issue
    }

  } catch (err: any) {
    if (err.name === 'AccessDenied' || err.name === 'NoCredentials') {
      error('⚠️ Skipping API Gateway - missing permission: apigateway:GetRestApis');
    } else {
      error(`⚠️ API Gateway analysis failed: ${err.message}`);
    }
  }

  return opportunities;
}
