import { AWSClient } from './client';
import { SavingsOpportunity } from '../../types/opportunity';
import { DescribeSnapshotsCommand, DescribeImagesCommand } from '@aws-sdk/client-ec2';
import { DescribeDBSnapshotsCommand } from '@aws-sdk/client-rds';
import { GetCostAndUsageCommand } from '@aws-sdk/client-cost-explorer';
import dayjs from 'dayjs';

/**
 * Analyze EBS and RDS snapshots for cost optimization opportunities
 * 
 * Uses Cost Explorer API to get actual snapshot costs (not just volume size estimates)
 */

/**
 * Get actual snapshot costs from Cost Explorer API
 * Returns a map of snapshotId -> monthly cost
 */
async function getSnapshotCosts(
  client: AWSClient,
  snapshotIds: string[]
): Promise<Map<string, number>> {
  const costMap = new Map<string, number>();
  
  if (snapshotIds.length === 0) return costMap;

  try {
    const costExplorer = client.getCostExplorerClient();
    const startDate = dayjs().subtract(30, 'day').format('YYYY-MM-DD');
    const endDate = dayjs().format('YYYY-MM-DD');

    // Query Cost Explorer for snapshot costs
    const command = new GetCostAndUsageCommand({
      TimePeriod: {
        Start: startDate,
        End: endDate,
      },
      Granularity: 'MONTHLY',
      Metrics: ['UnblendedCost'],
      GroupBy: [
        {
          Type: 'DIMENSION',
          Key: 'RESOURCE_ID',
        },
      ],
      Filter: {
        And: [
          {
            Dimensions: {
              Key: 'SERVICE',
              Values: ['Amazon Elastic Compute Cloud - Compute', 'Amazon Relational Database Service'],
            },
          },
          {
            Dimensions: {
              Key: 'USAGE_TYPE_GROUP',
              Values: ['EC2: EBS - Snapshots', 'RDS: Storage Snapshot'],
            },
          },
        ],
      },
    });

    const response = await costExplorer.send(command);
    
    if (response.ResultsByTime && response.ResultsByTime.length > 0) {
      const results = response.ResultsByTime[0];
      
      if (results.Groups) {
        for (const group of results.Groups) {
          const resourceId = group.Keys?.[0] || '';
          const cost = parseFloat(group.Metrics?.UnblendedCost?.Amount || '0');
          
          // Extract snapshot ID from resource ARN or ID
          const snapshotMatch = resourceId.match(/snap-[a-z0-9]+/i);
          if (snapshotMatch) {
            costMap.set(snapshotMatch[0], cost);
          }
        }
      }
    }
  } catch (error: any) {
    console.error('Warning: Could not fetch snapshot costs from Cost Explorer:', error.message);
    // Fall back to volume size estimation if Cost Explorer fails
  }

  return costMap;
}
export async function analyzeSnapshots(
  client: AWSClient
): Promise<SavingsOpportunity[]> {
  const ec2Client = client.getEC2Client();
  const rdsClient = client.getRDSClient();
  const opportunities: SavingsOpportunity[] = [];

  try {
    // Analyze EBS Snapshots
    const ebsCommand = new DescribeSnapshotsCommand({
      OwnerIds: ['self'], // Only snapshots owned by this account
    });
    
    const ebsResponse = await ec2Client.send(ebsCommand);
    const ebsSnapshots = ebsResponse.Snapshots || [];

    // Get actual costs from Cost Explorer
    const snapshotIds = ebsSnapshots.map(s => s.SnapshotId).filter(Boolean) as string[];
    const costMap = await getSnapshotCosts(client, snapshotIds);

    for (const snapshot of ebsSnapshots) {
      if (!snapshot.SnapshotId || !snapshot.StartTime) continue;

      const snapshotId = snapshot.SnapshotId;
      const ageInDays = dayjs().diff(dayjs(snapshot.StartTime), 'day');
      const sizeGB = snapshot.VolumeSize || 0;
      
      // Use actual cost from Cost Explorer if available, otherwise estimate
      const actualCost = costMap.get(snapshotId);
      const monthlyCost = actualCost !== undefined ? actualCost : sizeGB * 0.05;
      const costSource = actualCost !== undefined ? 'actual' : 'estimated';

      // Opportunity 1: Very old snapshots (>365 days)
      if (ageInDays > 365 && monthlyCost > 5) {
        const recommendation = actualCost !== undefined
          ? `Review old EBS snapshot (${ageInDays} days old, $${monthlyCost.toFixed(2)}/month actual cost). Delete if no longer needed.`
          : `Review old EBS snapshot (${ageInDays} days old, ${sizeGB} GB volume size, ~$${monthlyCost.toFixed(2)}/month estimated). Delete if no longer needed.`;
        
        opportunities.push({
          id: `aws-snapshot-old-ebs-${snapshotId}`,
          provider: 'aws',
          resourceType: 'snapshot',
          resourceId: snapshot.SnapshotId,
          resourceName: snapshot.Description || snapshotId,
          category: 'unused',
          currentCost: monthlyCost,
          estimatedSavings: monthlyCost,
          confidence: 'medium',
          recommendation,
          metadata: {
            type: 'EBS',
            snapshotId,
            volumeId: snapshot.VolumeId,
            sizeGB,
            ageInDays,
            startTime: snapshot.StartTime.toISOString(),
            costSource,
          },
          detectedAt: new Date(),
        });
      }

      // Opportunity 2: Large snapshots (>500 GB volume size or >$25/month actual)
      if ((sizeGB > 500 || monthlyCost > 25) && monthlyCost > 25) {
        const recommendation = actualCost !== undefined
          ? `Large EBS snapshot ($${monthlyCost.toFixed(2)}/month actual cost). Review if full retention is needed or consolidate with lifecycle policy.`
          : `Large EBS snapshot (${sizeGB} GB volume size, ~$${monthlyCost.toFixed(2)}/month estimated). Review if full retention is needed or consolidate with lifecycle policy.`;
        
        opportunities.push({
          id: `aws-snapshot-large-ebs-${snapshotId}`,
          provider: 'aws',
          resourceType: 'snapshot',
          resourceId: snapshot.SnapshotId,
          resourceName: snapshot.Description || snapshotId,
          category: 'oversized',
          currentCost: monthlyCost,
          estimatedSavings: monthlyCost * 0.5, // Assume 50% could be cleaned
          confidence: 'low',
          recommendation,
          metadata: {
            type: 'EBS',
            snapshotId,
            volumeId: snapshot.VolumeId,
            sizeGB,
            ageInDays,
            costSource,
          },
          detectedAt: new Date(),
        });
      }
    }

    // Analyze RDS Snapshots
    const rdsCommand = new DescribeDBSnapshotsCommand({
      SnapshotType: 'manual', // Only manual snapshots (automated are managed)
    });
    
    const rdsResponse = await rdsClient.send(rdsCommand);
    const rdsSnapshots = rdsResponse.DBSnapshots || [];

    for (const snapshot of rdsSnapshots) {
      if (!snapshot.DBSnapshotIdentifier || !snapshot.SnapshotCreateTime) continue;

      const snapshotId = snapshot.DBSnapshotIdentifier;
      const ageInDays = dayjs().diff(dayjs(snapshot.SnapshotCreateTime), 'day');
      const sizeGB = snapshot.AllocatedStorage || 0;
      const monthlyCost = sizeGB * 0.095; // RDS snapshots slightly more expensive

      // Opportunity 1: Very old RDS snapshots (>180 days)
      if (ageInDays > 180 && monthlyCost > 5) {
        opportunities.push({
          id: `aws-snapshot-old-rds-${snapshotId}`,
          provider: 'aws',
          resourceType: 'snapshot',
          resourceId: snapshot.DBSnapshotArn || snapshotId,
          resourceName: snapshotId,
          category: 'unused',
          currentCost: monthlyCost,
          estimatedSavings: monthlyCost,
          confidence: 'medium',
          recommendation: `Review old RDS snapshot (${ageInDays} days old, ${sizeGB} GB allocated). Delete if no longer needed. Note: Actual cost may be lower (snapshots are incremental).`,
          metadata: {
            type: 'RDS',
            snapshotId,
            dbInstanceId: snapshot.DBInstanceIdentifier,
            engine: snapshot.Engine,
            sizeGB,
            ageInDays,
            createTime: snapshot.SnapshotCreateTime.toISOString(),
          },
          detectedAt: new Date(),
        });
      }

      // Opportunity 2: Large RDS snapshots (>1000 GB)
      if (sizeGB > 1000 && monthlyCost > 95) {
        opportunities.push({
          id: `aws-snapshot-large-rds-${snapshotId}`,
          provider: 'aws',
          resourceType: 'snapshot',
          resourceId: snapshot.DBSnapshotArn || snapshotId,
          resourceName: snapshotId,
          category: 'oversized',
          currentCost: monthlyCost,
          estimatedSavings: monthlyCost * 0.5,
          confidence: 'low',
          recommendation: `Large RDS snapshot (${sizeGB} GB). Review retention policy or export to S3 for archival.`,
          metadata: {
            type: 'RDS',
            snapshotId,
            dbInstanceId: snapshot.DBInstanceIdentifier,
            engine: snapshot.Engine,
            sizeGB,
            ageInDays,
          },
          detectedAt: new Date(),
        });
      }
    }

    return opportunities;
  } catch (error: any) {
    console.error('Error analyzing Snapshots:', error.message);
    return opportunities;
  }
}
