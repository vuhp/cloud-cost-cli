import { GCPClient } from './client';
import { SavingsOpportunity } from '../../types/opportunity';
import dayjs from 'dayjs';
import { getGCEMonthlyCost } from '../../analyzers/cost-estimator';

/**
 * Analyze GCP GKE clusters for cost optimization opportunities
 *
 * GKE pricing:
 * - Autopilot: $0.10 per pod vCPU per hour
 * - Standard: $0.10/hour cluster fee + node costs (GCE VMs)
 */
export async function analyzeGKE(
    client: GCPClient,
    detailedMetrics: boolean = false
): Promise<SavingsOpportunity[]> {
    const containerClient = client.getContainerClient();
    const monitoringClient = client.getMonitoringClient();
    const opportunities: SavingsOpportunity[] = [];

    try {
        // List all GKE clusters in the project location
        const parent = `projects/${client.projectId}/locations/-`;
        const [response] = await containerClient.listClusters({ parent });
        const clusters = response.clusters || [];

        for (const cluster of clusters) {
            if (!cluster.name) continue;

            // Filter by region if specified
            const clusterLocation = cluster.location || '';
            if (client.region && !clusterLocation.startsWith(client.region)) {
                continue;
            }

            const clusterName = cluster.name;
            const nodePools = cluster.nodePools || [];
            const isAutopilot = cluster.autopilot?.enabled || false;

            // Opportunity 1: Empty cluster (no node pools) - only for Standard mode
            if (!isAutopilot && nodePools.length === 0) {
                opportunities.push({
                    id: `gcp-gke-empty-cluster-${clusterName}`,
                    provider: 'gcp',
                    resourceType: 'gke',
                    resourceId: cluster.selfLink || clusterName,
                    resourceName: clusterName,
                    category: 'unused',
                    currentCost: 73, // $0.10/hour cluster fee
                    estimatedSavings: 73,
                    confidence: 'high',
                    recommendation: `GKE cluster has no node pools. Delete if not in use.`,
                    metadata: {
                        clusterName,
                        location: clusterLocation,
                        currentNodeVersion: cluster.currentNodeVersion,
                        status: cluster.status,
                        isAutopilot,
                    },
                    detectedAt: new Date(),
                });
                continue;
            }

            // Opportunity 2: Standard mode cluster - suggest Autopilot
            if (!isAutopilot) {
                const totalNodes = nodePools.reduce((sum, pool) => sum + (pool.initialNodeCount || 0), 0);

                if (totalNodes <= 10) {
                    opportunities.push({
                        id: `gcp-gke-consider-autopilot-${clusterName}`,
                        provider: 'gcp',
                        resourceType: 'gke',
                        resourceId: cluster.selfLink || clusterName,
                        resourceName: clusterName,
                        category: 'misconfigured',
                        currentCost: 73, // Base cluster management fee
                        estimatedSavings: 73 * 0.2, // Autopilot can save ~20% for small clusters
                        confidence: 'low',
                        recommendation: `Standard mode cluster with ${totalNodes} nodes. Consider Autopilot for automatic scaling and reduced management overhead.`,
                        metadata: {
                            clusterName,
                            location: clusterLocation,
                            totalNodes,
                            mode: 'Standard',
                            nodePools: nodePools.length,
                        },
                        detectedAt: new Date(),
                    });
                }
            }

            // Analyze each node pool (Standard mode only)
            if (!isAutopilot) {
                for (const pool of nodePools) {
                    if (!pool.name) continue;

                    const poolName = pool.name;
                    const machineType = pool.config?.machineType || 'e2-medium';
                    const nodeCount = pool.initialNodeCount || 0;
                    const autoscaling = pool.autoscaling || {};
                    const hasAutoscaling = autoscaling.enabled || false;
                    const minNodeCount = autoscaling.minNodeCount || nodeCount;
                    const maxNodeCount = autoscaling.maxNodeCount || nodeCount;

                    const perNodeCost = getGCEMonthlyCost(machineType);
                    const poolCost = perNodeCost * nodeCount;

                    // Opportunity 3: Empty node pool
                    if (nodeCount === 0) {
                        opportunities.push({
                            id: `gcp-gke-empty-pool-${clusterName}-${poolName}`,
                            provider: 'gcp',
                            resourceType: 'gke-nodepool',
                            resourceId: `${cluster.selfLink}/nodePools/${poolName}`,
                            resourceName: `${clusterName}/${poolName}`,
                            category: 'unused',
                            currentCost: 0,
                            estimatedSavings: 0,
                            confidence: 'high',
                            recommendation: `Node pool has 0 nodes. Delete if no longer needed.`,
                            metadata: {
                                clusterName,
                                poolName,
                                machineType,
                            },
                            detectedAt: new Date(),
                        });
                        continue;
                    }

                    // Get metrics if detailed mode is enabled
                    let avgCPU = 0;
                    if (detailedMetrics && nodeCount > 0) {
                        avgCPU = await getNodePoolCPU(monitoringClient, client.projectId, clusterName, clusterLocation, 7);
                    }

                    // Opportunity 4: Idle node pool
                    if (detailedMetrics && avgCPU < 10 && nodeCount > 0) {
                        const confidence = avgCPU < 5 ? 'high' : 'medium';
                        opportunities.push({
                            id: `gcp-gke-idle-pool-${clusterName}-${poolName}`,
                            provider: 'gcp',
                            resourceType: 'gke-nodepool',
                            resourceId: `${cluster.selfLink}/nodePools/${poolName}`,
                            resourceName: `${clusterName}/${poolName}`,
                            category: 'idle',
                            currentCost: poolCost,
                            estimatedSavings: poolCost * 0.8,
                            confidence,
                            recommendation: `Node pool is idle (${avgCPU.toFixed(1)}% avg CPU). Scale down or enable autoscaler.`,
                            metadata: {
                                clusterName,
                                poolName,
                                machineType,
                                nodeCount,
                                avgCPU,
                            },
                            detectedAt: new Date(),
                        });
                    }

                    // Opportunity 5: No autoscaling configured
                    if (!hasAutoscaling && nodeCount > 1) {
                        opportunities.push({
                            id: `gcp-gke-no-autoscaling-${clusterName}-${poolName}`,
                            provider: 'gcp',
                            resourceType: 'gke-nodepool',
                            resourceId: `${cluster.selfLink}/nodePools/${poolName}`,
                            resourceName: `${clusterName}/${poolName}`,
                            category: 'misconfigured',
                            currentCost: poolCost,
                            estimatedSavings: poolCost * 0.3,
                            confidence: 'low',
                            recommendation: `Node pool has autoscaling disabled (${nodeCount} fixed nodes). Enable cluster autoscaler for cost optimization.`,
                            metadata: {
                                clusterName,
                                poolName,
                                machineType,
                                nodeCount,
                            },
                            detectedAt: new Date(),
                        });
                    }

                    // Opportunity 6: Over-provisioned pool
                    if (detailedMetrics && avgCPU < 30 && nodeCount >= 5) {
                        const suggestedCount = Math.max(1, Math.ceil(nodeCount * (avgCPU / 50)));
                        const savings = (nodeCount - suggestedCount) * perNodeCost;

                        if (savings > 50 && suggestedCount < nodeCount) {
                            opportunities.push({
                                id: `gcp-gke-oversized-pool-${clusterName}-${poolName}`,
                                provider: 'gcp',
                                resourceType: 'gke-nodepool',
                                resourceId: `${cluster.selfLink}/nodePools/${poolName}`,
                                resourceName: `${clusterName}/${poolName}`,
                                category: 'oversized',
                                currentCost: poolCost,
                                estimatedSavings: savings,
                                confidence: 'medium',
                                recommendation: `Node pool is over-provisioned (${avgCPU.toFixed(1)}% avg CPU, ${nodeCount} nodes). Consider reducing to ${suggestedCount} nodes.`,
                                metadata: {
                                    clusterName,
                                    poolName,
                                    machineType,
                                    currentCount: nodeCount,
                                    suggestedCount,
                                    avgCPU,
                                },
                                detectedAt: new Date(),
                            });
                        }
                    }
                }
            }
        }

        return opportunities;
    } catch (error: any) {
        // Re-throw so the scanner wrapper can capture it as a warning
        throw error;
    }
}

/**
 * Get average CPU utilization for a GKE cluster's nodes
 */
async function getNodePoolCPU(
    monitoringClient: any,
    projectId: string,
    clusterName: string,
    location: string,
    days: number
): Promise<number> {
    try {
        const endTime = new Date();
        const startTime = dayjs().subtract(days, 'days').toDate();

        const request = {
            name: `projects/${projectId}`,
            filter:
                `metric.type="kubernetes.io/node/cpu/allocatable_utilization" ` +
                `AND resource.type="k8s_node" ` +
                `AND resource.labels.cluster_name="${clusterName}"`,
            interval: {
                startTime: { seconds: Math.floor(startTime.getTime() / 1000) },
                endTime: { seconds: Math.floor(endTime.getTime() / 1000) },
            },
            aggregation: {
                alignmentPeriod: { seconds: 86400 },
                perSeriesAligner: 'ALIGN_MEAN',
                crossSeriesReducer: 'REDUCE_MEAN',
            },
        };

        const [timeSeries] = await monitoringClient.listTimeSeries(request);

        if (!timeSeries || timeSeries.length === 0) {
            return 0;
        }

        let sum = 0;
        let count = 0;

        for (const series of timeSeries) {
            for (const point of series.points || []) {
                if (point.value?.doubleValue !== undefined) {
                    sum += point.value.doubleValue * 100; // Convert to percentage
                    count++;
                }
            }
        }

        return count > 0 ? sum / count : 0;
    } catch (error) {
        // GKE metrics may not be available
        return 0;
    }
}
