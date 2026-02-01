import { AWSClient } from './client';
import { SavingsOpportunity } from '../../types/opportunity';
import { CloudWatchClient, GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';
import { LambdaClient, ListFunctionsCommand, GetFunctionCommand } from '@aws-sdk/client-lambda';
import dayjs from 'dayjs';

/**
 * Analyze Lambda functions for cost optimization opportunities
 */
export async function analyzeLambdaFunctions(
  client: AWSClient
): Promise<SavingsOpportunity[]> {
  const lambdaClient = client.getLambdaClient();
  const cloudwatchClient = client.getCloudWatchClient();
  const opportunities: SavingsOpportunity[] = [];

  try {
    // List all Lambda functions
    const listCommand = new ListFunctionsCommand({});
    const response = await lambdaClient.send(listCommand);

    if (!response.Functions || response.Functions.length === 0) {
      return opportunities;
    }

    for (const func of response.Functions) {
      if (!func.FunctionName || !func.FunctionArn) continue;

      const functionName = func.FunctionName;
      const memorySize = func.MemorySize || 128;
      const runtime = func.Runtime || 'unknown';

      // Get invocation metrics for the last 30 days
      const invocations = await getInvocationCount(cloudwatchClient, functionName, 30);
      const errors = await getErrorCount(cloudwatchClient, functionName, 30);
      const duration = await getAverageDuration(cloudwatchClient, functionName, 30);

      // Opportunity 1: Unused function (no invocations in 30 days)
      if (invocations === 0) {
        const estimatedCost = estimateMonthlyCost(memorySize, 0, 0);
        opportunities.push({
          id: `aws-lambda-unused-${functionName}`,
          provider: 'aws',
          resourceType: 'lambda',
          resourceId: func.FunctionArn,
          resourceName: functionName,
          category: 'unused',
          currentCost: estimatedCost,
          estimatedSavings: estimatedCost,
          confidence: 'high',
          recommendation: `Delete unused Lambda function (0 invocations in 30 days)`,
          metadata: {
            memorySize,
            runtime,
            invocations,
            lastModified: func.LastModified,
          },
          detectedAt: new Date(),
        });
        continue;
      }

      // Opportunity 2: Over-provisioned memory
      // If average duration is low and memory is high, we can downsize
      if (memorySize >= 1024 && duration < 1000) { // Less than 1 second average
        const recommendedMemory = 512;
        const currentCost = estimateMonthlyCost(memorySize, invocations, duration);
        const newCost = estimateMonthlyCost(recommendedMemory, invocations, duration);
        const savings = currentCost - newCost;

        if (savings > 5) { // At least $5/month savings
          opportunities.push({
            id: `aws-lambda-overprovisioned-${functionName}`,
            provider: 'aws',
            resourceType: 'lambda',
            resourceId: func.FunctionArn,
            resourceName: functionName,
            category: 'oversized',
            currentCost,
            estimatedSavings: savings,
            confidence: 'medium',
            recommendation: `Reduce memory from ${memorySize}MB to ${recommendedMemory}MB`,
            metadata: {
              currentMemory: memorySize,
              recommendedMemory,
              avgDuration: duration,
              invocations,
              runtime,
            },
            detectedAt: new Date(),
          });
        }
      }

      // Opportunity 3: High error rate
      const errorRate = invocations > 0 ? (errors / invocations) * 100 : 0;
      if (errorRate > 10 && invocations > 100) { // More than 10% errors
        const currentCost = estimateMonthlyCost(memorySize, invocations, duration);
        const wastedCost = currentCost * (errorRate / 100);

        if (wastedCost > 5) {
          opportunities.push({
            id: `aws-lambda-errors-${functionName}`,
            provider: 'aws',
            resourceType: 'lambda',
            resourceId: func.FunctionArn,
            resourceName: functionName,
            category: 'misconfigured',
            currentCost,
            estimatedSavings: wastedCost,
            confidence: 'medium',
            recommendation: `Fix errors (${errorRate.toFixed(1)}% error rate) to reduce wasted invocations`,
            metadata: {
              memorySize,
              invocations,
              errors,
              errorRate: parseFloat(errorRate.toFixed(1)),
              runtime,
            },
            detectedAt: new Date(),
          });
        }
      }
    }

    return opportunities;
  } catch (error: any) {
    console.error('Error analyzing Lambda functions:', error.message);
    return opportunities;
  }
}

/**
 * Get total invocation count for a function
 */
async function getInvocationCount(
  cloudwatch: CloudWatchClient,
  functionName: string,
  days: number
): Promise<number> {
  try {
    const command = new GetMetricStatisticsCommand({
      Namespace: 'AWS/Lambda',
      MetricName: 'Invocations',
      Dimensions: [
        {
          Name: 'FunctionName',
          Value: functionName,
        },
      ],
      StartTime: dayjs().subtract(days, 'day').toDate(),
      EndTime: new Date(),
      Period: 86400, // 1 day
      Statistics: ['Sum'],
    });

    const response = await cloudwatch.send(command);
    const datapoints = response.Datapoints || [];
    return datapoints.reduce((sum, dp) => sum + (dp.Sum || 0), 0);
  } catch (error) {
    return 0;
  }
}

/**
 * Get total error count for a function
 */
async function getErrorCount(
  cloudwatch: CloudWatchClient,
  functionName: string,
  days: number
): Promise<number> {
  try {
    const command = new GetMetricStatisticsCommand({
      Namespace: 'AWS/Lambda',
      MetricName: 'Errors',
      Dimensions: [
        {
          Name: 'FunctionName',
          Value: functionName,
        },
      ],
      StartTime: dayjs().subtract(days, 'day').toDate(),
      EndTime: new Date(),
      Period: 86400, // 1 day
      Statistics: ['Sum'],
    });

    const response = await cloudwatch.send(command);
    const datapoints = response.Datapoints || [];
    return datapoints.reduce((sum, dp) => sum + (dp.Sum || 0), 0);
  } catch (error) {
    return 0;
  }
}

/**
 * Get average duration for a function
 */
async function getAverageDuration(
  cloudwatch: CloudWatchClient,
  functionName: string,
  days: number
): Promise<number> {
  try {
    const command = new GetMetricStatisticsCommand({
      Namespace: 'AWS/Lambda',
      MetricName: 'Duration',
      Dimensions: [
        {
          Name: 'FunctionName',
          Value: functionName,
        },
      ],
      StartTime: dayjs().subtract(days, 'day').toDate(),
      EndTime: new Date(),
      Period: 86400, // 1 day
      Statistics: ['Average'],
    });

    const response = await cloudwatch.send(command);
    const datapoints = response.Datapoints || [];
    if (datapoints.length === 0) return 0;

    const avgDuration = datapoints.reduce((sum, dp) => sum + (dp.Average || 0), 0) / datapoints.length;
    return avgDuration;
  } catch (error) {
    return 0;
  }
}

/**
 * Estimate monthly cost for Lambda function
 * Based on AWS Lambda pricing (us-east-1, Jan 2026)
 * 
 * Pricing:
 * - $0.20 per 1M requests
 * - $0.0000166667 per GB-second
 */
function estimateMonthlyCost(
  memoryMB: number,
  invocations: number,
  avgDurationMs: number
): number {
  const requestCost = (invocations / 1000000) * 0.20;
  
  const memoryGB = memoryMB / 1024;
  const durationSeconds = avgDurationMs / 1000;
  const gbSeconds = memoryGB * durationSeconds * invocations;
  const computeCost = gbSeconds * 0.0000166667;
  
  // Monthly estimate (30 days worth)
  return requestCost + computeCost;
}
