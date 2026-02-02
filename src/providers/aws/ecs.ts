import { AWSClient } from './client';
import { SavingsOpportunity } from '../../types/opportunity';
import { ECSClient, ListClustersCommand, DescribeClustersCommand, ListServicesCommand, DescribeServicesCommand } from '@aws-sdk/client-ecs';

/**
 * Analyze AWS ECS/Fargate for cost optimization opportunities
 * 
 * Fargate pricing (us-east-1, Jan 2026):
 * - $0.04048 per vCPU per hour
 * - $0.004445 per GB per hour
 * 
 * Note: Full implementation requires CloudWatch metrics for CPU/memory utilization
 * This is a basic implementation focusing on service-level insights
 */
export async function analyzeECS(
  client: AWSClient
): Promise<SavingsOpportunity[]> {
  const ecsClient = client.getECSClient();
  const opportunities: SavingsOpportunity[] = [];

  try {
    // List all ECS clusters
    const listClustersCommand = new ListClustersCommand({});
    const clustersResponse = await ecsClient.send(listClustersCommand);
    
    if (!clustersResponse.clusterArns || clustersResponse.clusterArns.length === 0) {
      return opportunities;
    }

    // Describe clusters
    const describeClustersCommand = new DescribeClustersCommand({
      clusters: clustersResponse.clusterArns,
      include: ['STATISTICS'],
    });
    
    const clusters = await ecsClient.send(describeClustersCommand);

    for (const cluster of clusters.clusters || []) {
      if (!cluster.clusterArn || !cluster.clusterName) continue;

      const clusterName = cluster.clusterName;
      const runningTasksCount = cluster.runningTasksCount || 0;
      const activeServicesCount = cluster.activeServicesCount || 0;

      // Opportunity 1: Empty cluster
      if (runningTasksCount === 0 && activeServicesCount === 0) {
        opportunities.push({
          id: `aws-ecs-empty-cluster-${clusterName}`,
          provider: 'aws',
          resourceType: 'ecs',
          resourceId: cluster.clusterArn,
          resourceName: clusterName,
          category: 'unused',
          currentCost: 0, // Empty clusters don't cost anything, but clean-up is good
          estimatedSavings: 0,
          confidence: 'high',
          recommendation: `Delete empty ECS cluster (0 running tasks, 0 services)`,
          metadata: {
            runningTasks: runningTasksCount,
            activeServices: activeServicesCount,
            registeredContainerInstances: cluster.registeredContainerInstancesCount || 0,
          },
          detectedAt: new Date(),
        });
        continue;
      }

      // List services in this cluster
      const listServicesCommand = new ListServicesCommand({
        cluster: cluster.clusterArn,
      });
      
      const servicesResponse = await ecsClient.send(listServicesCommand);
      
      if (!servicesResponse.serviceArns || servicesResponse.serviceArns.length === 0) {
        continue;
      }

      // Describe services
      const describeServicesCommand = new DescribeServicesCommand({
        cluster: cluster.clusterArn,
        services: servicesResponse.serviceArns,
      });
      
      const servicesDetails = await ecsClient.send(describeServicesCommand);

      for (const service of servicesDetails.services || []) {
        if (!service.serviceArn || !service.serviceName) continue;

        const serviceName = service.serviceName;
        const desiredCount = service.desiredCount || 0;
        const runningCount = service.runningCount || 0;
        const launchType = service.launchType || 'UNKNOWN';

        // Opportunity 2: Service with 0 desired tasks
        if (desiredCount === 0 && runningCount === 0) {
          opportunities.push({
            id: `aws-ecs-inactive-service-${clusterName}-${serviceName}`,
            provider: 'aws',
            resourceType: 'ecs',
            resourceId: service.serviceArn,
            resourceName: `${clusterName}/${serviceName}`,
            category: 'unused',
            currentCost: 0,
            estimatedSavings: 0,
            confidence: 'high',
            recommendation: `Delete inactive ECS service (0 desired tasks)`,
            metadata: {
              clusterName,
              serviceName,
              desiredCount,
              runningCount,
              launchType,
            },
            detectedAt: new Date(),
          });
        }

        // Opportunity 3: Over-provisioned Fargate tasks (high desired count)
        if (launchType === 'FARGATE' && desiredCount > 10) {
          const estimatedCost = estimateFargateCost(0.25, 0.5, desiredCount); // Assume 0.25 vCPU, 0.5 GB

          opportunities.push({
            id: `aws-ecs-fargate-review-${clusterName}-${serviceName}`,
            provider: 'aws',
            resourceType: 'ecs',
            resourceId: service.serviceArn,
            resourceName: `${clusterName}/${serviceName}`,
            category: 'misconfigured',
            currentCost: estimatedCost,
            estimatedSavings: estimatedCost * 0.3, // Assume 30% could be saved
            confidence: 'low',
            recommendation: `Review Fargate service with ${desiredCount} tasks. Verify scaling policy and consider auto-scaling based on load.`,
            metadata: {
              clusterName,
              serviceName,
              desiredCount,
              runningCount,
              launchType,
            },
            detectedAt: new Date(),
          });
        }
      }
    }

    return opportunities;
  } catch (error: any) {
    console.error('Error analyzing ECS:', error.message);
    return opportunities;
  }
}

/**
 * Estimate Fargate monthly cost
 * Pricing (us-east-1):
 * - $0.04048 per vCPU per hour
 * - $0.004445 per GB per hour
 */
function estimateFargateCost(vCPU: number, memoryGB: number, taskCount: number): number {
  const vCPUCost = vCPU * 0.04048 * 730; // Per month
  const memoryCost = memoryGB * 0.004445 * 730;
  return (vCPUCost + memoryCost) * taskCount;
}
