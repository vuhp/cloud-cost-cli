import { GCPClient } from './client';
import { SavingsOpportunity } from '../../types/opportunity';
import { ZonesClient } from '@google-cloud/compute';

// Cache zones per region to avoid repeated API calls (shared with compute.ts if needed)
const zonesCache = new Map<string, string[]>();

async function getZonesInRegion(client: GCPClient, region: string): Promise<string[]> {
  // Check cache first
  if (zonesCache.has(region)) {
    return zonesCache.get(region)!;
  }

  try {
    const zonesClient = new ZonesClient();
    const [zones] = await zonesClient.list({
      project: client.projectId,
      filter: `name:${region}-*`,
    });

    const zoneNames = zones
      .filter(z => z.name && z.status === 'UP')
      .map(z => z.name!);

    // Cache the result
    if (zoneNames.length > 0) {
      zonesCache.set(region, zoneNames);
      return zoneNames;
    }
  } catch (error) {
    console.error(`Failed to fetch zones for region ${region}, using fallback:`, error);
  }
  
  // Fallback to common zones if API call fails or returns empty
  const fallbackZones = [`${region}-a`, `${region}-b`, `${region}-c`];
  zonesCache.set(region, fallbackZones);
  return fallbackZones;
}

export async function analyzePersistentDisks(
  client: GCPClient
): Promise<SavingsOpportunity[]> {
  const computeClient = client.getComputeClient();

  const opportunities: SavingsOpportunity[] = [];

  // GCP disks are zone-specific
  const zones = await getZonesInRegion(client, client.region);

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
