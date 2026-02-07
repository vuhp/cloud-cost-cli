import { AWSClient } from './client';
import { SavingsOpportunity } from '../../types/opportunity';
import {
    EKSClient,
    ListClustersCommand,
    DescribeClusterCommand,
    ListNodegroupsCommand,
    DescribeNodegroupCommand,
} from '@aws-sdk/client-eks';
import { CloudWatchClient, GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';
import dayjs from 'dayjs';
import { getEC2MonthlyCost } from '../../analyzers/cost-estimator';

/**
 * Analyze AWS EKS clusters for cost optimization opportunities
 *
 * EKS pricing (Feb 2026):
 * - Cluster: $0.10 per hour ($73/month)
 * - Nodes: Charged as EC2 instances
 * - Fargate: $0.04048 per vCPU per hour + $0.004445 per GB per hour
 */
export async function analyzeEKS(
    client: AWSClient,
    detailedMetrics: boolean = false
): Promise<SavingsOpportunity[]> {
    const eksClient = client.getEKSClient();
    const cloudwatchClient = client.getCloudWatchClient();
    const opportunities: SavingsOpportunity[] = [];

    try {
        // List all EKS clusters
        const listClustersCommand = new ListClustersCommand({});
        const clustersResponse = await eksClient.send(listClustersCommand);

        if (!clustersResponse.clusters || clustersResponse.clusters.length === 0) {
            return opportunities;
        }

        for (const clusterName of clustersResponse.clusters) {
            // Get cluster details
            const describeClusterCommand = new DescribeClusterCommand({ name: clusterName });
            const clusterDetails = await eksClient.send(describeClusterCommand);
            const cluster = clusterDetails.cluster;

            if (!cluster) continue;

            // List node groups for this cluster
            const listNodegroupsCommand = new ListNodegroupsCommand({ clusterName });
            const nodegroupsResponse = await eksClient.send(listNodegroupsCommand);

            const nodegroups = nodegroupsResponse.nodegroups || [];

            // Opportunity 1: Empty cluster (no node groups)
            if (nodegroups.length === 0) {
                opportunities.push({
                    id: `aws-eks-empty-cluster-${clusterName}`,
                    provider: 'aws',
                    resourceType: 'eks',
                    resourceId: cluster.arn || clusterName,
                    resourceName: clusterName,
                    category: 'unused',
                    currentCost: 73, // $0.10/hour * 730 hours
                    estimatedSavings: 73,
                    confidence: 'high',
                    recommendation: `EKS cluster has no node groups. Delete if not in use.`,
                    metadata: {
                        clusterName,
                        status: cluster.status,
                        version: cluster.version,
                        endpoint: cluster.endpoint,
                    },
                    detectedAt: new Date(),
                });
                continue;
            }

            // Analyze each node group
            for (const nodegroupName of nodegroups) {
                const describeNodegroupCommand = new DescribeNodegroupCommand({
                    clusterName,
                    nodegroupName,
                });
                const nodegroupDetails = await eksClient.send(describeNodegroupCommand);
                const nodegroup = nodegroupDetails.nodegroup;

                if (!nodegroup) continue;

                const instanceTypes = nodegroup.instanceTypes || ['unknown'];
                const desiredSize = nodegroup.scalingConfig?.desiredSize || 0;
                const minSize = nodegroup.scalingConfig?.minSize || 0;
                const maxSize = nodegroup.scalingConfig?.maxSize || 0;
                const capacityType = nodegroup.capacityType || 'ON_DEMAND';

                // Calculate cost based on instance types
                const primaryInstanceType = instanceTypes[0];
                const perNodeCost = getEC2MonthlyCost(primaryInstanceType);
                const nodegroupCost = perNodeCost * desiredSize;

                // Opportunity 2: Node group with 0 desired size
                if (desiredSize === 0) {
                    opportunities.push({
                        id: `aws-eks-empty-nodegroup-${clusterName}-${nodegroupName}`,
                        provider: 'aws',
                        resourceType: 'eks-nodegroup',
                        resourceId: nodegroup.nodegroupArn || `${clusterName}/${nodegroupName}`,
                        resourceName: `${clusterName}/${nodegroupName}`,
                        category: 'unused',
                        currentCost: 0,
                        estimatedSavings: 0,
                        confidence: 'high',
                        recommendation: `Node group has 0 nodes. Delete if no longer needed.`,
                        metadata: {
                            clusterName,
                            nodegroupName,
                            instanceTypes,
                            scalingConfig: nodegroup.scalingConfig,
                        },
                        detectedAt: new Date(),
                    });
                    continue;
                }

                // Get metrics if detailed mode is enabled
                let avgCPU = 0;
                if (detailedMetrics && desiredSize > 0) {
                    avgCPU = await getNodeGroupCPU(cloudwatchClient, clusterName, nodegroupName, 7);
                }

                // Opportunity 3: Idle node group (low CPU utilization)
                if (detailedMetrics && avgCPU < 10 && desiredSize > 0) {
                    const confidence = avgCPU < 5 ? 'high' : 'medium';
                    opportunities.push({
                        id: `aws-eks-idle-nodegroup-${clusterName}-${nodegroupName}`,
                        provider: 'aws',
                        resourceType: 'eks-nodegroup',
                        resourceId: nodegroup.nodegroupArn || `${clusterName}/${nodegroupName}`,
                        resourceName: `${clusterName}/${nodegroupName}`,
                        category: 'idle',
                        currentCost: nodegroupCost,
                        estimatedSavings: nodegroupCost * 0.8, // Assume 80% savings by scaling down
                        confidence,
                        recommendation: `Node group is idle (${avgCPU.toFixed(1)}% avg CPU). Scale down or use Cluster Autoscaler.`,
                        metadata: {
                            clusterName,
                            nodegroupName,
                            instanceTypes,
                            desiredSize,
                            avgCPU,
                            capacityType,
                        },
                        detectedAt: new Date(),
                    });
                }

                // Opportunity 4: No autoscaling configured (min == max)
                if (minSize === maxSize && minSize > 1) {
                    opportunities.push({
                        id: `aws-eks-no-autoscaling-${clusterName}-${nodegroupName}`,
                        provider: 'aws',
                        resourceType: 'eks-nodegroup',
                        resourceId: nodegroup.nodegroupArn || `${clusterName}/${nodegroupName}`,
                        resourceName: `${clusterName}/${nodegroupName}`,
                        category: 'misconfigured',
                        currentCost: nodegroupCost,
                        estimatedSavings: nodegroupCost * 0.3, // Assume 30% savings with autoscaling
                        confidence: 'low',
                        recommendation: `Node group has fixed size (min=${minSize}, max=${maxSize}). Enable autoscaling for cost optimization.`,
                        metadata: {
                            clusterName,
                            nodegroupName,
                            instanceTypes,
                            scalingConfig: nodegroup.scalingConfig,
                            capacityType,
                        },
                        detectedAt: new Date(),
                    });
                }

                // Opportunity 5: Over-provisioned (large desired size with low utilization)
                if (detailedMetrics && avgCPU < 30 && desiredSize >= 5) {
                    const suggestedSize = Math.ceil(desiredSize * (avgCPU / 50)); // Target 50% utilization
                    const savings = (desiredSize - suggestedSize) * perNodeCost;

                    if (savings > 50) {
                        opportunities.push({
                            id: `aws-eks-oversized-nodegroup-${clusterName}-${nodegroupName}`,
                            provider: 'aws',
                            resourceType: 'eks-nodegroup',
                            resourceId: nodegroup.nodegroupArn || `${clusterName}/${nodegroupName}`,
                            resourceName: `${clusterName}/${nodegroupName}`,
                            category: 'oversized',
                            currentCost: nodegroupCost,
                            estimatedSavings: savings,
                            confidence: 'medium',
                            recommendation: `Node group is over-provisioned (${avgCPU.toFixed(1)}% avg CPU, ${desiredSize} nodes). Consider reducing to ${suggestedSize} nodes.`,
                            metadata: {
                                clusterName,
                                nodegroupName,
                                instanceTypes,
                                currentSize: desiredSize,
                                suggestedSize,
                                avgCPU,
                                capacityType,
                            },
                            detectedAt: new Date(),
                        });
                    }
                }
            }
        }

        return opportunities;
    } catch (error: any) {
        console.error('Error analyzing EKS:', error.message);
        return opportunities;
    }
}

/**
 * Get average CPU utilization for a node group over the past N days
 */
async function getNodeGroupCPU(
    cloudwatchClient: CloudWatchClient,
    clusterName: string,
    nodegroupName: string,
    days: number
): Promise<number> {
    try {
        const endTime = new Date();
        const startTime = dayjs().subtract(days, 'days').toDate();

        const command = new GetMetricStatisticsCommand({
            Namespace: 'ContainerInsights',
            MetricName: 'node_cpu_utilization',
            Dimensions: [
                { Name: 'ClusterName', Value: clusterName },
                { Name: 'NodeGroup', Value: nodegroupName },
            ],
            StartTime: startTime,
            EndTime: endTime,
            Period: 3600, // 1 hour
            Statistics: ['Average'],
        });

        const response = await cloudwatchClient.send(command);
        const datapoints = response.Datapoints || [];

        if (datapoints.length === 0) {
            return 0;
        }

        const sum = datapoints.reduce((acc, dp) => acc + (dp.Average || 0), 0);
        return sum / datapoints.length;
    } catch (error) {
        // Container Insights may not be enabled
        return 0;
    }
}
