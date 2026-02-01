import { GCPClient } from './client';
import { SavingsOpportunity } from '../../types/opportunity';

export async function analyzeStaticIPs(
  client: GCPClient
): Promise<SavingsOpportunity[]> {
  const computeClient = client.getComputeClient();

  const opportunities: SavingsOpportunity[] = [];

  try {
    const addressesClient = client.getAddressesClient();
    
    // Check regional addresses
    const [regionalAddresses] = await addressesClient.list({
      project: client.projectId,
      region: client.region,
    });

    for await (const address of regionalAddresses) {
      if (!address.name) continue;

      // Address is unused if status is RESERVED (not IN_USE)
      const isUnused = address.status === 'RESERVED';

      if (isUnused) {
        // GCP charges $0.010/hour for unused static IPs
        const monthlyCost = 0.010 * 730; // ~$7.30/month

        opportunities.push({
          id: `static-ip-unused-${address.name}`,
          provider: 'gcp',
          resourceType: 'static-ip',
          resourceId: address.name,
          resourceName: address.name,
          category: 'unused',
          currentCost: monthlyCost,
          estimatedSavings: monthlyCost,
          confidence: 'high',
          recommendation: `Release unused static IP address`,
          metadata: {
            ipAddress: address.address,
            region: client.region,
            status: address.status,
          },
          detectedAt: new Date(),
        });
      }
    }

    // Also check global addresses
    const globalAddressesClient = client.getGlobalAddressesClient();
    const [globalAddresses] = await globalAddressesClient.list({
      project: client.projectId,
    });

    for await (const address of globalAddresses) {
      if (!address.name) continue;

      const isUnused = address.status === 'RESERVED';

      if (isUnused) {
        const monthlyCost = 0.010 * 730;

        opportunities.push({
          id: `global-static-ip-unused-${address.name}`,
          provider: 'gcp',
          resourceType: 'static-ip',
          resourceId: address.name,
          resourceName: address.name,
          category: 'unused',
          currentCost: monthlyCost,
          estimatedSavings: monthlyCost,
          confidence: 'high',
          recommendation: `Release unused global static IP address`,
          metadata: {
            ipAddress: address.address,
            addressType: 'GLOBAL',
            status: address.status,
          },
          detectedAt: new Date(),
        });
      }
    }
  } catch (error) {
    // Skip if Compute API errors
  }

  return opportunities;
}
