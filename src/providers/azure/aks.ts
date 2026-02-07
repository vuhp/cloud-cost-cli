import { AzureClient } from './client';
import { SavingsOpportunity } from '../../types/opportunity';
import { MonitorClient } from '@azure/arm-monitor';
import dayjs from 'dayjs';
import { getAzureVMMonthlyCost } from '../../analyzers/cost-estimator';

interface AKSNodePoolMetrics {
    cpu: number;
    memoryPercent?: number;
}

/**
 * Analyze Azure AKS clusters for cost optimization opportunities
 *
 * AKS pricing:
 * - Control plane: Free (standard tier) or $0.10/hour (uptime SLA tier)
 * - Nodes: Charged as VMs
 */
export async function analyzeAKS(
    client: AzureClient,
    detailedMetrics: boolean = false
): Promise<SavingsOpportunity[]> {
    const containerServiceClient = client.getContainerServiceClient();
    const monitorClient = client.getMonitorClient();
    const opportunities: SavingsOpportunity[] = [];

    try {
        // List all AKS clusters in the subscription
        const clusters = containerServiceClient.managedClusters.list();

        for await (const cluster of clusters) {
            if (!cluster.id || !cluster.name) continue;

            // Filter by location if specified
            if (client.location && cluster.location?.toLowerCase() !== client.location.toLowerCase()) {
                continue;
            }

            const clusterName = cluster.name;
            const resourceGroup = extractResourceGroup(cluster.id);
            if (!resourceGroup) continue;

            const agentPoolProfiles = cluster.agentPoolProfiles || [];

            // Opportunity 1: Cluster with no node pools
            if (agentPoolProfiles.length === 0) {
                opportunities.push({
                    id: `azure-aks-empty-cluster-${clusterName}`,
                    provider: 'azure',
                    resourceType: 'aks',
                    resourceId: cluster.id,
                    resourceName: clusterName,
                    category: 'unused',
                    currentCost: 0,
                    estimatedSavings: 0,
                    confidence: 'high',
                    recommendation: `AKS cluster has no node pools configured. Delete if not in use.`,
                    metadata: {
                        clusterName,
                        location: cluster.location,
                        kubernetesVersion: cluster.kubernetesVersion,
                        provisioningState: cluster.provisioningState,
                    },
                    detectedAt: new Date(),
                });
                continue;
            }

            // Analyze each node pool
            for (const pool of agentPoolProfiles) {
                if (!pool.name) continue;

                const poolName = pool.name;
                const vmSize = pool.vmSize || 'Standard_D2s_v3';
                const nodeCount = pool.count || 0;
                const minCount = pool.minCount || nodeCount;
                const maxCount = pool.maxCount || nodeCount;
                const enableAutoScaling = pool.enableAutoScaling || false;
                const mode = pool.mode || 'User';

                const perNodeCost = getAzureVMMonthlyCost(vmSize);
                const poolCost = perNodeCost * nodeCount;

                // Opportunity 2: Node pool with 0 nodes
                if (nodeCount === 0) {
                    opportunities.push({
                        id: `azure-aks-empty-pool-${clusterName}-${poolName}`,
                        provider: 'azure',
                        resourceType: 'aks-nodepool',
                        resourceId: `${cluster.id}/agentPools/${poolName}`,
                        resourceName: `${clusterName}/${poolName}`,
                        category: 'unused',
                        currentCost: 0,
                        estimatedSavings: 0,
                        confidence: 'high',
                        recommendation: `Node pool has 0 nodes. Delete if no longer needed.`,
                        metadata: {
                            clusterName,
                            poolName,
                            vmSize,
                            mode,
                        },
                        detectedAt: new Date(),
                    });
                    continue;
                }

                // Get metrics if detailed mode is enabled
                let metrics: AKSNodePoolMetrics = { cpu: 0 };
                if (detailedMetrics && nodeCount > 0) {
                    metrics = await getNodePoolMetrics(monitorClient, cluster.id, 7);
                }

                // Opportunity 3: Idle node pool (low CPU utilization)
                if (detailedMetrics && metrics.cpu < 10 && nodeCount > 0) {
                    const confidence = metrics.cpu < 5 ? 'high' : 'medium';
                    opportunities.push({
                        id: `azure-aks-idle-pool-${clusterName}-${poolName}`,
                        provider: 'azure',
                        resourceType: 'aks-nodepool',
                        resourceId: `${cluster.id}/agentPools/${poolName}`,
                        resourceName: `${clusterName}/${poolName}`,
                        category: 'idle',
                        currentCost: poolCost,
                        estimatedSavings: poolCost * 0.8,
                        confidence,
                        recommendation: `Node pool is idle (${metrics.cpu.toFixed(1)}% avg CPU). Scale down or enable autoscaler.`,
                        metadata: {
                            clusterName,
                            poolName,
                            vmSize,
                            nodeCount,
                            avgCPU: metrics.cpu,
                            mode,
                        },
                        detectedAt: new Date(),
                    });
                }

                // Opportunity 4: No autoscaling configured
                if (!enableAutoScaling && nodeCount > 1) {
                    opportunities.push({
                        id: `azure-aks-no-autoscaling-${clusterName}-${poolName}`,
                        provider: 'azure',
                        resourceType: 'aks-nodepool',
                        resourceId: `${cluster.id}/agentPools/${poolName}`,
                        resourceName: `${clusterName}/${poolName}`,
                        category: 'misconfigured',
                        currentCost: poolCost,
                        estimatedSavings: poolCost * 0.3,
                        confidence: 'low',
                        recommendation: `Node pool has autoscaling disabled (${nodeCount} fixed nodes). Enable cluster autoscaler for cost optimization.`,
                        metadata: {
                            clusterName,
                            poolName,
                            vmSize,
                            nodeCount,
                            mode,
                        },
                        detectedAt: new Date(),
                    });
                }

                // Opportunity 5: System node pool with excess nodes
                if (mode === 'System' && nodeCount > 3) {
                    const suggestedCount = 3;
                    const savings = (nodeCount - suggestedCount) * perNodeCost;

                    if (savings > 50) {
                        opportunities.push({
                            id: `azure-aks-system-pool-oversized-${clusterName}-${poolName}`,
                            provider: 'azure',
                            resourceType: 'aks-nodepool',
                            resourceId: `${cluster.id}/agentPools/${poolName}`,
                            resourceName: `${clusterName}/${poolName}`,
                            category: 'oversized',
                            currentCost: poolCost,
                            estimatedSavings: savings,
                            confidence: 'medium',
                            recommendation: `System node pool has ${nodeCount} nodes. Consider reducing to ${suggestedCount} for HA.`,
                            metadata: {
                                clusterName,
                                poolName,
                                vmSize,
                                currentCount: nodeCount,
                                suggestedCount,
                                mode,
                            },
                            detectedAt: new Date(),
                        });
                    }
                }

                // Opportunity 6: Over-provisioned user pool (detailed metrics)
                if (detailedMetrics && metrics.cpu < 30 && nodeCount >= 5 && mode === 'User') {
                    const suggestedCount = Math.ceil(nodeCount * (metrics.cpu / 50));
                    const savings = (nodeCount - suggestedCount) * perNodeCost;

                    if (savings > 50 && suggestedCount < nodeCount) {
                        opportunities.push({
                            id: `azure-aks-oversized-pool-${clusterName}-${poolName}`,
                            provider: 'azure',
                            resourceType: 'aks-nodepool',
                            resourceId: `${cluster.id}/agentPools/${poolName}`,
                            resourceName: `${clusterName}/${poolName}`,
                            category: 'oversized',
                            currentCost: poolCost,
                            estimatedSavings: savings,
                            confidence: 'medium',
                            recommendation: `Node pool is over-provisioned (${metrics.cpu.toFixed(1)}% avg CPU, ${nodeCount} nodes). Consider reducing to ${suggestedCount} nodes.`,
                            metadata: {
                                clusterName,
                                poolName,
                                vmSize,
                                currentCount: nodeCount,
                                suggestedCount,
                                avgCPU: metrics.cpu,
                                mode,
                            },
                            detectedAt: new Date(),
                        });
                    }
                }
            }
        }

        return opportunities;
    } catch (error: any) {
        console.error('Error analyzing AKS:', error.message);
        return opportunities;
    }
}

/**
 * Get CPU metrics for an AKS cluster's nodes
 */
async function getNodePoolMetrics(
    monitorClient: MonitorClient,
    resourceId: string,
    days: number
): Promise<AKSNodePoolMetrics> {
    try {
        const endTime = new Date();
        const startTime = dayjs().subtract(days, 'days').toDate();
        const timespan = `${startTime.toISOString()}/${endTime.toISOString()}`;

        // AKS node metrics are available through Container Insights
        const metricsResponse = await monitorClient.metrics.list(resourceId, {
            timespan,
            interval: 'PT1H',
            metricnames: 'node_cpu_usage_percentage,node_memory_working_set_percentage',
            aggregation: 'Average',
        });

        const metrics: AKSNodePoolMetrics = { cpu: 0 };

        for (const metric of metricsResponse.value || []) {
            const timeseries = metric.timeseries?.[0]?.data || [];
            const values = timeseries
                .map((d: any) => d.average)
                .filter((v: any) => v !== null && v !== undefined);

            if (values.length === 0) continue;

            const avg = values.reduce((a: number, b: number) => a + b, 0) / values.length;

            if (metric.name?.value?.includes('cpu')) {
                metrics.cpu = avg;
            } else if (metric.name?.value?.includes('memory')) {
                metrics.memoryPercent = avg;
            }
        }

        return metrics;
    } catch (error) {
        // Container Insights may not be enabled
        return { cpu: 0 };
    }
}

function extractResourceGroup(resourceId: string): string | null {
    const match = resourceId.match(/resourceGroups\/([^\/]+)/i);
    return match ? match[1] : null;
}
