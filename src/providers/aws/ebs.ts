import { DescribeVolumesCommand, Volume } from '@aws-sdk/client-ec2';
import { AWSClient } from './client';
import { SavingsOpportunity } from '../../types/opportunity';
import { getEBSMonthlyCost } from '../../analyzers/cost-estimator';
import { daysSince } from '../../utils/formatter';

export async function analyzeEBSVolumes(
  client: AWSClient
): Promise<SavingsOpportunity[]> {
  const ec2Client = client.getEC2Client();

  const result = await ec2Client.send(
    new DescribeVolumesCommand({
      Filters: [{ Name: 'status', Values: ['available'] }],
    })
  );

  const volumes: Volume[] = result.Volumes || [];
  const opportunities: SavingsOpportunity[] = [];

  for (const volume of volumes) {
    if (!volume.VolumeId || !volume.Size || !volume.CreateTime) continue;

    const age = daysSince(volume.CreateTime);
    if (age > 7) {
      const monthlyCost = getEBSMonthlyCost(
        volume.Size,
        volume.VolumeType || 'gp3'
      );

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
        recommendation: `Snapshot and delete, or delete if redundant (age: ${age} days)`,
        metadata: {
          size: volume.Size,
          volumeType: volume.VolumeType,
          age,
        },
        detectedAt: new Date(),
      });
    }
  }

  return opportunities;
}
