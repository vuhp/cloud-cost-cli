import { AzureClient } from './client';
import { SavingsOpportunity } from '../../types/opportunity';
import { getAzurePublicIPMonthlyCost } from '../../analyzers/cost-estimator';

export async function analyzeAzurePublicIPs(
  client: AzureClient
): Promise<SavingsOpportunity[]> {
  const networkClient = client.getNetworkClient();
  const opportunities: SavingsOpportunity[] = [];

  try {
    // List all public IP addresses
    const publicIPs = networkClient.publicIPAddresses.listAll();

    for await (const ip of publicIPs) {
      if (!ip.id || !ip.name) continue;

      // Filter by location if specified
      if (client.location && ip.location?.toLowerCase() !== client.location.toLowerCase()) {
        continue;
      }

      // Opportunity: Unassociated public IP
      if (!ip.ipConfiguration) {
        opportunities.push({
          id: `azure-ip-unassociated-${ip.name}`,
          provider: 'azure',
          resourceType: 'public-ip',
          resourceId: ip.id,
          resourceName: ip.name,
          category: 'unused',
          currentCost: getAzurePublicIPMonthlyCost(),
          estimatedSavings: getAzurePublicIPMonthlyCost(),
          confidence: 'high',
          recommendation: 'Unassociated public IP address. Delete if not needed.',
          metadata: {
            ipAddress: ip.ipAddress,
            allocationMethod: ip.publicIPAllocationMethod,
            location: ip.location,
          },
          detectedAt: new Date(),
        });
      }
    }

    return opportunities;
  } catch (error) {
    console.error('Error analyzing Azure public IPs:', error);
    return opportunities;
  }
}
