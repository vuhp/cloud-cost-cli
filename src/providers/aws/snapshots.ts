import { AWSClient } from './client';
import { SavingsOpportunity } from '../../types/opportunity';
import { DescribeSnapshotsCommand, DescribeImagesCommand } from '@aws-sdk/client-ec2';
import { DescribeDBSnapshotsCommand } from '@aws-sdk/client-rds';
import dayjs from 'dayjs';

/**
 * Analyze EBS and RDS snapshots for cost optimization opportunities
 * 
 * EBS Snapshot pricing (us-east-1):
 * - $0.05 per GB-month
 * 
 * RDS Snapshot pricing (us-east-1):
 * - $0.095 per GB-month (varies by engine)
 */
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

    for (const snapshot of ebsSnapshots) {
      if (!snapshot.SnapshotId || !snapshot.StartTime) continue;

      const snapshotId = snapshot.SnapshotId;
      const ageInDays = dayjs().diff(dayjs(snapshot.StartTime), 'day');
      const sizeGB = snapshot.VolumeSize || 0;
      const monthlyCost = sizeGB * 0.05;

      // Opportunity 1: Very old snapshots (>365 days)
      if (ageInDays > 365 && monthlyCost > 5) {
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
          recommendation: `Review old EBS snapshot (${ageInDays} days old, ${sizeGB} GB). Delete if no longer needed.`,
          metadata: {
            type: 'EBS',
            snapshotId,
            volumeId: snapshot.VolumeId,
            sizeGB,
            ageInDays,
            startTime: snapshot.StartTime.toISOString(),
          },
          detectedAt: new Date(),
        });
      }

      // Opportunity 2: Large snapshots (>500 GB)
      if (sizeGB > 500 && monthlyCost > 25) {
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
          recommendation: `Large EBS snapshot (${sizeGB} GB). Review if full size is needed or consolidate with lifecycle policy.`,
          metadata: {
            type: 'EBS',
            snapshotId,
            volumeId: snapshot.VolumeId,
            sizeGB,
            ageInDays,
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
          recommendation: `Review old RDS snapshot (${ageInDays} days old, ${sizeGB} GB). Delete if no longer needed.`,
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
