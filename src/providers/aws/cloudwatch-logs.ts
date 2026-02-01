import { AWSClient } from './client';
import { SavingsOpportunity } from '../../types/opportunity';
import { CloudWatchLogsClient, DescribeLogGroupsCommand } from '@aws-sdk/client-cloudwatch-logs';
import dayjs from 'dayjs';

/**
 * Analyze CloudWatch Log Groups for cost optimization opportunities
 * 
 * CloudWatch Logs pricing (us-east-1):
 * - $0.50 per GB ingested
 * - $0.03 per GB stored per month
 */
export async function analyzeCloudWatchLogs(
  client: AWSClient
): Promise<SavingsOpportunity[]> {
  const logsClient = client.getCloudWatchLogsClient();
  const opportunities: SavingsOpportunity[] = [];

  try {
    let nextToken: string | undefined;
    
    do {
      const command = new DescribeLogGroupsCommand({
        nextToken,
        limit: 50,
      });
      
      const response = await logsClient.send(command);
      nextToken = response.nextToken;

      if (!response.logGroups || response.logGroups.length === 0) {
        break;
      }

      for (const logGroup of response.logGroups) {
        if (!logGroup.logGroupName) continue;

        const logGroupName = logGroup.logGroupName;
        const storedBytes = logGroup.storedBytes || 0;
        const retentionInDays = logGroup.retentionInDays;
        const creationTime = logGroup.creationTime;

        // Calculate age in days
        const ageInDays = creationTime 
          ? dayjs().diff(dayjs(creationTime), 'day')
          : 0;

        // Calculate storage cost
        const storedGB = storedBytes / (1024 ** 3);
        const monthlyCost = storedGB * 0.03;

        // Opportunity 1: No retention policy (data kept forever)
        if (!retentionInDays && storedGB > 1) { // More than 1 GB
          const potentialSavings = monthlyCost * 0.7; // Assume 70% could be deleted with 90-day retention

          if (potentialSavings > 5) {
            opportunities.push({
              id: `aws-cloudwatch-logs-no-retention-${logGroupName}`,
              provider: 'aws',
              resourceType: 'cloudwatch-logs',
              resourceId: logGroup.arn || logGroupName,
              resourceName: logGroupName,
              category: 'misconfigured',
              currentCost: monthlyCost,
              estimatedSavings: potentialSavings,
              confidence: 'medium',
              recommendation: `Set retention policy (currently infinite). Recommend 90 days for most logs.`,
              metadata: {
                storedGB: parseFloat(storedGB.toFixed(2)),
                retentionInDays: 'infinite',
                ageInDays,
              },
              detectedAt: new Date(),
            });
          }
        }

        // Opportunity 2: Very old log group with data
        if (ageInDays > 365 && storedGB > 0.5) {
          const savings = monthlyCost * 0.9; // Assume 90% could be archived/deleted

          if (savings > 5) {
            opportunities.push({
              id: `aws-cloudwatch-logs-old-${logGroupName}`,
              provider: 'aws',
              resourceType: 'cloudwatch-logs',
              resourceId: logGroup.arn || logGroupName,
              resourceName: logGroupName,
              category: 'unused',
              currentCost: monthlyCost,
              estimatedSavings: savings,
              confidence: 'medium',
              recommendation: `Review old log group (${ageInDays} days old). Archive to S3 Glacier or delete if no longer needed.`,
              metadata: {
                storedGB: parseFloat(storedGB.toFixed(2)),
                retentionInDays: retentionInDays || 'infinite',
                ageInDays,
              },
              detectedAt: new Date(),
            });
          }
        }

        // Opportunity 3: Large log group (potential for optimization)
        if (storedGB > 100) { // More than 100 GB
          const archivalSavings = monthlyCost * 0.9; // S3 Glacier is much cheaper

          if (archivalSavings > 10) {
            opportunities.push({
              id: `aws-cloudwatch-logs-large-${logGroupName}`,
              provider: 'aws',
              resourceType: 'cloudwatch-logs',
              resourceId: logGroup.arn || logGroupName,
              resourceName: logGroupName,
              category: 'oversized',
              currentCost: monthlyCost,
              estimatedSavings: archivalSavings,
              confidence: 'low',
              recommendation: `Large log group (${storedGB.toFixed(0)} GB). Consider exporting to S3 Glacier for long-term storage ($0.004/GB vs $0.03/GB).`,
              metadata: {
                storedGB: parseFloat(storedGB.toFixed(2)),
                retentionInDays: retentionInDays || 'infinite',
                ageInDays,
                archivalCost: parseFloat((storedGB * 0.004).toFixed(2)),
              },
              detectedAt: new Date(),
            });
          }
        }
      }
    } while (nextToken);

    return opportunities;
  } catch (error: any) {
    console.error('Error analyzing CloudWatch Logs:', error.message);
    return opportunities;
  }
}
