import { AzureClient } from './client';
import { SavingsOpportunity } from '../../types/opportunity';
import { MonitorClient } from '@azure/arm-monitor';
import dayjs from 'dayjs';

// Azure VM pricing (East US, pay-as-you-go, monthly estimate)
// Source: Azure pricing as of 2026-01, monthly = hourly × 730
export const AZURE_VM_PRICING: Record<string, number> = {
  'Standard_B1s': 7.59,
  'Standard_B1ms': 15.33,
  'Standard_B2s': 30.37,
  'Standard_B2ms': 60.74,
  'Standard_D2s_v3': 70.08,
  'Standard_D4s_v3': 140.16,
  'Standard_D8s_v3': 280.32,
  'Standard_E2s_v3': 109.50,
  'Standard_E4s_v3': 219.00,
  'Standard_F2s_v2': 62.05,
  'Standard_F4s_v2': 124.10,
};

function getVMMonthlyCost(vmSize: string): number {
  return AZURE_VM_PRICING[vmSize] || 100; // Fallback estimate
}

export async function analyzeAzureVMs(
  client: AzureClient
): Promise<SavingsOpportunity[]> {
  const computeClient = client.getComputeClient();
  const monitorClient = client.getMonitorClient();
  const opportunities: SavingsOpportunity[] = [];

  try {
    // List all VMs in the subscription
    const vms = computeClient.virtualMachines.listAll();

    for await (const vm of vms) {
      if (!vm.id || !vm.name) continue;

      const vmSize = vm.hardwareProfile?.vmSize || 'Unknown';
      const powerState = await getVMPowerState(computeClient, vm);
      
      // Skip stopped/deallocated VMs (no compute cost)
      if (powerState === 'stopped' || powerState === 'deallocated') {
        continue;
      }

      const currentCost = getVMMonthlyCost(vmSize);

      // Get CPU metrics for the last 7 days
      const avgCpu = await getAverageCPU(monitorClient, vm.id, 7);

      // Opportunity 1: Idle VM (low CPU usage)
      if (avgCpu < 5) {
        opportunities.push({
          id: `azure-vm-idle-${vm.name}`,
          provider: 'azure',
          resourceType: 'vm',
          resourceId: vm.id,
          resourceName: vm.name,
          category: 'idle',
          currentCost,
          estimatedSavings: currentCost * 0.9, // Could stop or downsize
          confidence: 'high',
          recommendation: `VM is idle (${avgCpu.toFixed(1)}% avg CPU). Consider stopping or downsizing.`,
          metadata: {
            vmSize,
            avgCpu,
            location: vm.location,
            powerState,
          },
          detectedAt: new Date(),
        });
      }
      // Opportunity 2: Underutilized VM (medium CPU usage)
      else if (avgCpu < 20) {
        const smallerSize = getSmallerVMSize(vmSize);
        if (smallerSize) {
          const newCost = getVMMonthlyCost(smallerSize);
          const savings = currentCost - newCost;

          if (savings > 10) { // At least $10/month savings
            opportunities.push({
              id: `azure-vm-underutilized-${vm.name}`,
              provider: 'azure',
              resourceType: 'vm',
              resourceId: vm.id,
              resourceName: vm.name,
              category: 'oversized',
              currentCost,
              estimatedSavings: savings,
              confidence: 'medium',
              recommendation: `Downsize from ${vmSize} to ${smallerSize} (${avgCpu.toFixed(1)}% avg CPU).`,
              metadata: {
                vmSize,
                suggestedSize: smallerSize,
                avgCpu,
                location: vm.location,
              },
              detectedAt: new Date(),
            });
          }
        }
      }
    }

    return opportunities;
  } catch (error) {
    console.error('Error analyzing Azure VMs:', error);
    return opportunities;
  }
}

async function getVMPowerState(computeClient: any, vm: any): Promise<string> {
  try {
    const resourceGroup = extractResourceGroup(vm.id);
    if (!resourceGroup || !vm.name) return 'unknown';

    const instanceView = await computeClient.virtualMachines.instanceView(
      resourceGroup,
      vm.name
    );

    const powerState = instanceView.statuses?.find((s: any) =>
      s.code?.startsWith('PowerState/')
    );

    return powerState?.code?.replace('PowerState/', '').toLowerCase() || 'unknown';
  } catch (error) {
    return 'unknown';
  }
}

async function getAverageCPU(
  monitorClient: MonitorClient,
  resourceId: string,
  days: number
): Promise<number> {
  try {
    const endTime = new Date();
    const startTime = dayjs().subtract(days, 'days').toDate();

    const metrics = await monitorClient.metrics.list(resourceId, {
      timespan: `${startTime.toISOString()}/${endTime.toISOString()}`,
      interval: 'PT1H',
      metricnames: 'Percentage CPU',
      aggregation: 'Average',
    });

    const timeseries = metrics.value?.[0]?.timeseries?.[0]?.data || [];
    
    if (timeseries.length === 0) {
      return 0;
    }

    const values = timeseries
      .map((d: any) => d.average)
      .filter((v: any) => v !== null && v !== undefined);

    if (values.length === 0) {
      return 0;
    }

    const sum = values.reduce((a: number, b: number) => a + b, 0);
    return sum / values.length;
  } catch (error) {
    console.error('Error fetching CPU metrics:', error);
    return 0;
  }
}

function getSmallerVMSize(currentSize: string): string | null {
  const downsizeMap: Record<string, string> = {
    'Standard_B2ms': 'Standard_B1ms',
    'Standard_B2s': 'Standard_B1s',
    'Standard_D4s_v3': 'Standard_D2s_v3',
    'Standard_D8s_v3': 'Standard_D4s_v3',
    'Standard_E4s_v3': 'Standard_E2s_v3',
    'Standard_F4s_v2': 'Standard_F2s_v2',
  };

  return downsizeMap[currentSize] || null;
}

function extractResourceGroup(resourceId: string): string | null {
  const match = resourceId.match(/resourceGroups\/([^\/]+)/i);
  return match ? match[1] : null;
}
