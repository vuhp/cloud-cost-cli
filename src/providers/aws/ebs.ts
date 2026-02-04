import { DescribeVolumesCommand, DescribeInstancesCommand, Volume } from '@aws-sdk/client-ec2';
import { AWSClient } from './client';
import { SavingsOpportunity } from '../../types/opportunity';
import { getEBSMonthlyCost } from '../../analyzers/cost-estimator';
import { daysSince } from '../../utils/formatter';

export async function analyzeEBSVolumes(
  client: AWSClient
): Promise<SavingsOpportunity[]> {
  const ec2Client = client.getEC2Client();

  // Get all volumes (both available and in-use)
  const result = await ec2Client.send(new DescribeVolumesCommand({}));
  const volumes: Volume[] = result.Volumes || [];
  const opportunities: SavingsOpportunity[] = [];

  // Get all instance states for checking stopped instances
  const instanceIds = new Set<string>();
  for (const volume of volumes) {
    if (volume.Attachments && volume.Attachments.length > 0) {
      for (const attachment of volume.Attachments) {
        if (attachment.InstanceId) {
          instanceIds.add(attachment.InstanceId);
        }
      }
    }
  }

  // Fetch instance states
  const instanceStates = new Map<string, string>();
  if (instanceIds.size > 0) {
    const instancesResult = await ec2Client.send(
      new DescribeInstancesCommand({
        InstanceIds: Array.from(instanceIds),
      })
    );

    for (const reservation of instancesResult.Reservations || []) {
      for (const instance of reservation.Instances || []) {
        if (instance.InstanceId && instance.State?.Name) {
          instanceStates.set(instance.InstanceId, instance.State.Name);
        }
      }
    }
  }

  // Analyze volumes
  for (const volume of volumes) {
    if (!volume.VolumeId || !volume.Size || !volume.CreateTime) continue;

    const age = daysSince(volume.CreateTime);
    const monthlyCost = getEBSMonthlyCost(
      volume.Size,
      volume.VolumeType || 'gp3'
    );

    // Check unattached volumes (available state)
    if (volume.State === 'available' && age > 7) {
      opportunities.push({
        id: `ebs-unattached-${volume.VolumeId}`,
        provider: 'aws',
        resourceType: 'ebs',
        resourceId: volume.VolumeId,
        resourceName: volume.Tags?.find((t) => t.Key === 'Name')?.Value,
        category: 'unused',
        currentCost: monthlyCost,
        estimatedSavings: monthlyCost,
        confidence: 'high',
        recommendation: `Unattached volume - snapshot and delete, or delete if redundant (age: ${age} days)`,
        metadata: {
          size: volume.Size,
          volumeType: volume.VolumeType,
          age,
        },
        detectedAt: new Date(),
      });
    }

    // Check volumes attached to stopped instances
    if (volume.State === 'in-use' && volume.Attachments && volume.Attachments.length > 0) {
      for (const attachment of volume.Attachments) {
        if (attachment.InstanceId) {
          const instanceState = instanceStates.get(attachment.InstanceId);
          if (instanceState === 'stopped') {
            opportunities.push({
              id: `ebs-stopped-instance-${volume.VolumeId}`,
              provider: 'aws',
              resourceType: 'ebs',
              resourceId: volume.VolumeId,
              resourceName: volume.Tags?.find((t) => t.Key === 'Name')?.Value,
              category: 'unused',
              currentCost: monthlyCost,
              estimatedSavings: monthlyCost,
              confidence: 'high',
              recommendation: `Attached to stopped instance ${attachment.InstanceId} - terminate instance or snapshot and delete volume`,
              metadata: {
                size: volume.Size,
                volumeType: volume.VolumeType,
                attachedInstanceId: attachment.InstanceId,
                instanceState: 'stopped',
              },
              detectedAt: new Date(),
            });
          }
        }
      }
    }
  }

  return opportunities;
}
