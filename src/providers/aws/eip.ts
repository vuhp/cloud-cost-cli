import { DescribeAddressesCommand, Address } from '@aws-sdk/client-ec2';
import { AWSClient } from './client';
import { SavingsOpportunity } from '../../types';
import { getEIPMonthlyCost } from '../../analyzers/cost-estimator';

export async function analyzeElasticIPs(
  client: AWSClient
): Promise<SavingsOpportunity[]> {
  const ec2Client = client.getEC2Client();

  const result = await ec2Client.send(new DescribeAddressesCommand({}));

  const addresses: Address[] = result.Addresses || [];
  const opportunities: SavingsOpportunity[] = [];

  for (const address of addresses) {
    if (!address.PublicIp) continue;

    // Check if EIP is not associated with a running instance
    if (!address.InstanceId || !address.AssociationId) {
      const monthlyCost = getEIPMonthlyCost();

      opportunities.push({
        id: `eip-unattached-${address.AllocationId || address.PublicIp}`,
        provider: 'aws',
        resourceType: 'eip',
        resourceId: address.AllocationId || address.PublicIp,
        resourceName: address.PublicIp,
        category: 'unused',
        currentCost: monthlyCost,
        estimatedSavings: monthlyCost,
        confidence: 'high',
        recommendation: `Release unattached Elastic IP`,
        metadata: {
          publicIp: address.PublicIp,
          allocationId: address.AllocationId,
          domain: address.Domain,
        },
        detectedAt: new Date(),
      });
    }
  }

  return opportunities;
}
