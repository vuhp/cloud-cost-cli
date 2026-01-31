import { AzureClient } from './client';
import { SavingsOpportunity } from '../../types/opportunity';

// Azure Managed Disk pricing (per GB/month, East US)
export const AZURE_DISK_PRICING: Record<string, number> = {
  'Premium_LRS': 0.135,      // Premium SSD
  'StandardSSD_LRS': 0.075,  // Standard SSD
  'Standard_LRS': 0.045,      // Standard HDD
};

function getDiskMonthlyCost(sizeGB: number, diskType: string): number {
  const pricePerGB = AZURE_DISK_PRICING[diskType] || 0.075;
  return sizeGB * pricePerGB;
}

export async function analyzeAzureDisks(
  client: AzureClient
): Promise<SavingsOpportunity[]> {
  const computeClient = client.getComputeClient();
  const opportunities: SavingsOpportunity[] = [];

  try {
    // List all managed disks
    const disks = computeClient.disks.list();

    for await (const disk of disks) {
      if (!disk.id || !disk.name) continue;

      const sizeGB = disk.diskSizeGB || 0;
      const diskType = disk.sku?.name || 'Standard_LRS';
      const currentCost = getDiskMonthlyCost(sizeGB, diskType);

      // Opportunity 1: Unattached disk
      if (disk.diskState === 'Unattached') {
        opportunities.push({
          id: `azure-disk-unattached-${disk.name}`,
          provider: 'azure',
          resourceType: 'disk',
          resourceId: disk.id,
          resourceName: disk.name,
          category: 'unused',
          currentCost,
          estimatedSavings: currentCost,
          confidence: 'high',
          recommendation: `Unattached disk (${sizeGB} GB). Delete if no longer needed.`,
          metadata: {
            sizeGB,
            diskType,
            location: disk.location,
            diskState: disk.diskState,
          },
          detectedAt: new Date(),
        });
      }
      // Opportunity 2: Premium disk that could be Standard SSD
      else if (diskType === 'Premium_LRS' && sizeGB < 256) {
        const newType = 'StandardSSD_LRS';
        const newCost = getDiskMonthlyCost(sizeGB, newType);
        const savings = currentCost - newCost;

        if (savings > 5) {
          opportunities.push({
            id: `azure-disk-premium-${disk.name}`,
            provider: 'azure',
            resourceType: 'disk',
            resourceId: disk.id,
            resourceName: disk.name,
            category: 'oversized',
            currentCost,
            estimatedSavings: savings,
            confidence: 'medium',
            recommendation: `Consider switching from Premium SSD to Standard SSD for non-performance-critical workloads.`,
            metadata: {
              sizeGB,
              currentType: diskType,
              suggestedType: newType,
              location: disk.location,
            },
            detectedAt: new Date(),
          });
        }
      }
    }

    return opportunities;
  } catch (error) {
    console.error('Error analyzing Azure disks:', error);
    return opportunities;
  }
}
