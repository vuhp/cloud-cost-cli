import { GCPClient } from './client';
import { SavingsOpportunity } from '../../types/opportunity';

export async function analyzePersistentDisks(
  client: GCPClient
): Promise<SavingsOpportunity[]> {
  const computeClient = client.getComputeClient();

  const opportunities: SavingsOpportunity[] = [];

  // GCP disks are zone-specific
  const zones = await getZonesInRegion(client.region);

  for (const zone of zones) {
    try {
      const disksClient = client.getDisksClient();
      const [disks] = await disksClient.list({
        project: client.projectId,
        zone: zone,
      });

      for await (const disk of disks) {
        if (!disk.name || !disk.sizeGb) continue;

        // Disk is unattached if users array is empty or undefined
        const isUnattached = !disk.users || disk.users.length === 0;

        if (isUnattached) {
          const sizeGB = parseInt(disk.sizeGb.toString());
          const diskType = disk.type?.split('/').pop() || 'pd-standard';
          const pricePerGB = getDiskPricePerGB(diskType);
          const monthlyCost = sizeGB * pricePerGB;

          opportunities.push({
            id: `disk-unattached-${disk.name}`,
            provider: 'gcp',
            resourceType: 'persistent-disk',
            resourceId: disk.name,
            resourceName: disk.name,
            category: 'unused',
            currentCost: monthlyCost,
            estimatedSavings: monthlyCost,
            confidence: 'high',
            recommendation: `Delete unattached disk or create snapshot and delete`,
            metadata: {
              sizeGB,
              diskType,
              zone,
              creationTimestamp: disk.creationTimestamp,
            },
            detectedAt: new Date(),
          });
        }
      }
    } catch (error) {
      // Skip zones with permission issues or API errors
      continue;
    }
  }

  return opportunities;
}

function getDiskPricePerGB(diskType: string): number {
  // GCP disk pricing per GB/month (us-central1, Jan 2026)
  const pricing: Record<string, number> = {
    'pd-standard': 0.040,
    'pd-balanced': 0.100,
    'pd-ssd': 0.170,
    'pd-extreme': 0.125,
  };

  return pricing[diskType] || 0.040; // Default to standard
}

function getZonesInRegion(region: string): string[] {
  // Common GCP zones per region
  return [
    `${region}-a`,
    `${region}-b`,
    `${region}-c`,
    `${region}-f`,
  ];
}
