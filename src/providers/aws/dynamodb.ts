import { AWSClient } from './client';
import { SavingsOpportunity } from '../../types/opportunity';
import { DynamoDBClient, ListTablesCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { CloudWatchClient, GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';
import dayjs from 'dayjs';

/**
 * Analyze DynamoDB tables for cost optimization opportunities
 */
export async function analyzeDynamoDBTables(
  client: AWSClient
): Promise<SavingsOpportunity[]> {
  const dynamoClient = client.getDynamoDBClient();
  const cloudwatchClient = client.getCloudWatchClient();
  const opportunities: SavingsOpportunity[] = [];

  try {
    // List all DynamoDB tables
    const listCommand = new ListTablesCommand({});
    const listResponse = await dynamoClient.send(listCommand);

    if (!listResponse.TableNames || listResponse.TableNames.length === 0) {
      return opportunities;
    }

    for (const tableName of listResponse.TableNames) {
      // Get table details
      const describeCommand = new DescribeTableCommand({ TableName: tableName });
      const table = await dynamoClient.send(describeCommand);

      if (!table.Table) continue;

      const billingMode = table.Table.BillingModeSummary?.BillingMode || 'PROVISIONED';
      const tableStatus = table.Table.TableStatus;

      if (tableStatus !== 'ACTIVE') continue;

      // Only analyze provisioned tables
      if (billingMode === 'PROVISIONED') {
        const readCapacity = table.Table.ProvisionedThroughput?.ReadCapacityUnits || 0;
        const writeCapacity = table.Table.ProvisionedThroughput?.WriteCapacityUnits || 0;

        // Get actual usage metrics
        const actualReads = await getConsumedReadCapacity(cloudwatchClient, tableName, 30);
        const actualWrites = await getConsumedWriteCapacity(cloudwatchClient, tableName, 30);

        const avgReadUsage = actualReads / 30; // Average per day
        const avgWriteUsage = actualWrites / 30;

        // Calculate costs
        const currentCost = calculateProvisionedCost(readCapacity, writeCapacity);

        // Opportunity 1: No usage (should delete or switch to on-demand)
        if (avgReadUsage === 0 && avgWriteUsage === 0) {
          opportunities.push({
            id: `aws-dynamodb-unused-${tableName}`,
            provider: 'aws',
            resourceType: 'dynamodb',
            resourceId: table.Table.TableArn || tableName,
            resourceName: tableName,
            category: 'unused',
            currentCost,
            estimatedSavings: currentCost,
            confidence: 'high',
            recommendation: `Delete unused DynamoDB table (no reads/writes in 30 days)`,
            metadata: {
              billingMode,
              readCapacity,
              writeCapacity,
              itemCount: table.Table.ItemCount,
            },
            detectedAt: new Date(),
          });
        }
        // Opportunity 2: Low usage (should use on-demand pricing)
        else if (avgReadUsage < readCapacity * 0.2 || avgWriteUsage < writeCapacity * 0.2) {
          const onDemandCost = estimateOnDemandCost(avgReadUsage * 30, avgWriteUsage * 30);
          const savings = currentCost - onDemandCost;

          if (savings > 10) { // At least $10/month savings
            opportunities.push({
              id: `aws-dynamodb-overprovisioned-${tableName}`,
              provider: 'aws',
              resourceType: 'dynamodb',
              resourceId: table.Table.TableArn || tableName,
              resourceName: tableName,
              category: 'oversized',
              currentCost,
              estimatedSavings: savings,
              confidence: 'high',
              recommendation: `Switch to on-demand pricing (low utilization: ${((avgReadUsage / readCapacity) * 100).toFixed(0)}% reads, ${((avgWriteUsage / writeCapacity) * 100).toFixed(0)}% writes)`,
              metadata: {
                billingMode,
                provisionedReads: readCapacity,
                provisionedWrites: writeCapacity,
                avgDailyReads: parseFloat(avgReadUsage.toFixed(2)),
                avgDailyWrites: parseFloat(avgWriteUsage.toFixed(2)),
                readUtilization: parseFloat(((avgReadUsage / readCapacity) * 100).toFixed(1)),
                writeUtilization: parseFloat(((avgWriteUsage / writeCapacity) * 100).toFixed(1)),
              },
              detectedAt: new Date(),
            });
          }
        }
      }
    }

    return opportunities;
  } catch (error: any) {
    console.error('Error analyzing DynamoDB tables:', error.message);
    return opportunities;
  }
}

/**
 * Get consumed read capacity units over period
 */
async function getConsumedReadCapacity(
  cloudwatch: CloudWatchClient,
  tableName: string,
  days: number
): Promise<number> {
  try {
    const command = new GetMetricStatisticsCommand({
      Namespace: 'AWS/DynamoDB',
      MetricName: 'ConsumedReadCapacityUnits',
      Dimensions: [
        {
          Name: 'TableName',
          Value: tableName,
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
 * Get consumed write capacity units over period
 */
async function getConsumedWriteCapacity(
  cloudwatch: CloudWatchClient,
  tableName: string,
  days: number
): Promise<number> {
  try {
    const command = new GetMetricStatisticsCommand({
      Namespace: 'AWS/DynamoDB',
      MetricName: 'ConsumedWriteCapacityUnits',
      Dimensions: [
        {
          Name: 'TableName',
          Value: tableName,
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
 * Calculate monthly cost for provisioned capacity
 * Pricing (us-east-1):
 * - $0.00065 per hour per read capacity unit ($0.47/month)
 * - $0.00065 per hour per write capacity unit ($0.47/month)
 */
function calculateProvisionedCost(readCapacity: number, writeCapacity: number): number {
  const readCost = readCapacity * 0.00065 * 730; // ~$0.47 per RCU/month
  const writeCost = writeCapacity * 0.00065 * 730; // ~$0.47 per WCU/month
  return readCost + writeCost;
}

/**
 * Estimate on-demand cost
 * Pricing (us-east-1):
 * - $0.25 per million read request units
 * - $1.25 per million write request units
 */
function estimateOnDemandCost(totalReads: number, totalWrites: number): number {
  const readCost = (totalReads / 1000000) * 0.25;
  const writeCost = (totalWrites / 1000000) * 1.25;
  return readCost + writeCost;
}
