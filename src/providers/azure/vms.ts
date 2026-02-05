import { AzureClient } from './client';
import { SavingsOpportunity } from '../../types/opportunity';
import { MonitorClient } from '@azure/arm-monitor';
import dayjs from 'dayjs';
import { getAzureVMMonthlyCost } from '../../analyzers/cost-estimator';

interface AzureVMMetrics {
  cpu: number;
  memoryAvailable?: number; // bytes
  networkIn?: number; // bytes
  networkOut?: number; // bytes
  diskReadOps?: number;
  diskWriteOps?: number;
}

export async function analyzeAzureVMs(
  client: AzureClient,
  detailedMetrics: boolean = false
): Promise<SavingsOpportunity[]> {
  const computeClient = client.getComputeClient();
  const monitorClient = client.getMonitorClient();
  const opportunities: SavingsOpportunity[] = [];

  try {
    // List all VMs in the subscription
    const vms = computeClient.virtualMachines.listAll();

    for await (const vm of vms) {
      if (!vm.id || !vm.name) continue;

      // Filter by location if specified
      if (client.location && vm.location?.toLowerCase() !== client.location.toLowerCase()) {
        continue;
      }

      const vmSize = vm.hardwareProfile?.vmSize || 'Unknown';
      const powerState = await getVMPowerState(computeClient, vm);
      
      // Skip stopped/deallocated VMs (no compute cost)
      if (powerState === 'stopped' || powerState === 'deallocated') {
        continue;
      }

      const currentCost = getAzureVMMonthlyCost(vmSize);

      // Get metrics based on mode
      const metrics = detailedMetrics
        ? await getDetailedMetrics(monitorClient, vm.id, 7)
        : await getBasicMetrics(monitorClient, vm.id, 7);

      // Determine if VM is idle/underutilized
      const isIdle = metrics.cpu < 5;
      const isUnderutilized = metrics.cpu < 20;

      // Calculate confidence based on available metrics
      let confidence: 'high' | 'medium' | 'low' = 'low';
      let reasoning = '';

      if (detailedMetrics) {
        const metricsLow = [
          metrics.cpu < 20,
          metrics.networkIn !== undefined && metrics.networkIn < 1000000, // < 1MB/s
          metrics.networkOut !== undefined && metrics.networkOut < 1000000,
          metrics.diskReadOps !== undefined && metrics.diskReadOps < 100,
          metrics.diskWriteOps !== undefined && metrics.diskWriteOps < 100,
        ].filter(Boolean).length;

        if (metricsLow >= 4) {
          confidence = 'high';
          reasoning = 'All metrics low';
        } else if (metricsLow >= 2) {
          confidence = 'medium';
          reasoning = 'Multiple metrics low';
        } else {
          confidence = 'low';
          reasoning = 'Mixed metric signals';
        }

        // Check memory if available
        if (metrics.memoryAvailable !== undefined) {
          // Azure reports "Available Memory Bytes"
          // If available memory is very low (< 500 MB), that means high usage
          const availableMemoryGB = metrics.memoryAvailable / (1024 * 1024 * 1024);
          if (availableMemoryGB < 0.5) {
            confidence = 'low';
            reasoning = 'High memory usage detected (low available memory)';
          }
        } else {
          reasoning += ' (memory data unavailable)';
        }
      } else {
        confidence = 'low';
        reasoning = 'CPU only - verify memory/disk before downsizing';
      }

      // Opportunity 1: Idle VM (low CPU usage)
      if (isIdle) {
        let recommendation = `VM is idle (${metrics.cpu.toFixed(1)}% avg CPU). Consider stopping or downsizing.`;
        if (detailedMetrics) {
          recommendation = buildDetailedRecommendation(metrics, vmSize, true);
        }

        opportunities.push({
          id: `azure-vm-idle-${vm.name}`,
          provider: 'azure',
          resourceType: 'vm',
          resourceId: vm.id,
          resourceName: vm.name,
          category: 'idle',
          currentCost,
          estimatedSavings: currentCost * 0.9,
          confidence,
          recommendation,
          metadata: {
            vmSize,
            metrics,
            reasoning,
            location: vm.location,
            powerState,
          },
          detectedAt: new Date(),
        });
      }
      // Opportunity 2: Underutilized VM (only if detailed metrics and high confidence)
      else if (isUnderutilized && detailedMetrics && confidence === 'high') {
        const smallerSize = getSmallerVMSize(vmSize);
        if (smallerSize) {
          const newCost = getAzureVMMonthlyCost(smallerSize);
          const savings = currentCost - newCost;

          if (savings > 10) {
            const recommendation = buildDetailedRecommendation(metrics, vmSize, false);

            opportunities.push({
              id: `azure-vm-underutilized-${vm.name}`,
              provider: 'azure',
              resourceType: 'vm',
              resourceId: vm.id,
              resourceName: vm.name,
              category: 'oversized',
              currentCost,
              estimatedSavings: savings,
              confidence,
              recommendation,
              metadata: {
                vmSize,
                suggestedSize: smallerSize,
                metrics,
                reasoning,
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

// Basic metrics: CPU only (fast)
async function getBasicMetrics(
  monitorClient: MonitorClient,
  resourceId: string,
  days: number
): Promise<AzureVMMetrics> {
  const cpu = await getAverageCPU(monitorClient, resourceId, days);
  return { cpu };
}

// Detailed metrics: CPU + Memory + Network + Disk (comprehensive)
async function getDetailedMetrics(
  monitorClient: MonitorClient,
  resourceId: string,
  days: number
): Promise<AzureVMMetrics> {
  try {
    const endTime = new Date();
    const startTime = dayjs().subtract(days, 'days').toDate();
    const timespan = `${startTime.toISOString()}/${endTime.toISOString()}`;

    // Fetch multiple metrics in one call
    const metricNames = [
      'Percentage CPU',
      'Available Memory Bytes',
      'Network In Total',
      'Network Out Total',
      'Disk Read Operations/Sec',
      'Disk Write Operations/Sec',
    ].join(',');

    const metricsResponse = await monitorClient.metrics.list(resourceId, {
      timespan,
      interval: 'PT1H',
      metricnames: metricNames,
      aggregation: 'Average',
    });

    const metrics: AzureVMMetrics = { cpu: 0 };

    for (const metric of metricsResponse.value || []) {
      const timeseries = metric.timeseries?.[0]?.data || [];
      const values = timeseries
        .map((d: any) => d.average)
        .filter((v: any) => v !== null && v !== undefined);

      if (values.length === 0) continue;

      const avg = values.reduce((a: number, b: number) => a + b, 0) / values.length;

      switch (metric.name?.value) {
        case 'Percentage CPU':
          metrics.cpu = avg;
          break;
        case 'Available Memory Bytes':
          metrics.memoryAvailable = avg;
          break;
        case 'Network In Total':
          metrics.networkIn = avg;
          break;
        case 'Network Out Total':
          metrics.networkOut = avg;
          break;
        case 'Disk Read Operations/Sec':
          metrics.diskReadOps = avg;
          break;
        case 'Disk Write Operations/Sec':
          metrics.diskWriteOps = avg;
          break;
      }
    }

    return metrics;
  } catch (error) {
    console.error('Error fetching detailed metrics:', error);
    // Fallback to basic metrics
    const cpu = await getAverageCPU(monitorClient, resourceId, days);
    return { cpu };
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

function buildDetailedRecommendation(
  metrics: AzureVMMetrics,
  vmSize: string,
  isIdle: boolean
): string {
  const parts = [];
  
  parts.push(`CPU: ${metrics.cpu.toFixed(1)}%`);
  
  if (metrics.memoryAvailable !== undefined) {
    const memoryGB = (metrics.memoryAvailable / (1024 * 1024 * 1024)).toFixed(1);
    parts.push(`Memory Available: ${memoryGB} GB`);
  }
  
  if (metrics.networkIn !== undefined && metrics.networkOut !== undefined) {
    const totalMB = ((metrics.networkIn + metrics.networkOut) / 1024 / 1024).toFixed(1);
    parts.push(`Network: ${totalMB} MB/s`);
  }
  
  if (metrics.diskReadOps !== undefined && metrics.diskWriteOps !== undefined) {
    const totalIOPS = (metrics.diskReadOps + metrics.diskWriteOps).toFixed(0);
    parts.push(`Disk: ${totalIOPS} IOPS`);
  }

  const metricsSummary = parts.join(' | ');
  
  if (isIdle) {
    return `VM is idle (${metricsSummary}) - consider stopping or terminating`;
  } else {
    return `Low utilization (${metricsSummary}) - consider downsizing to smaller VM size`;
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
