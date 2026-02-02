import { AWSClient } from './client';
import { SavingsOpportunity } from '../../types/opportunity';
import { ElastiCacheClient, DescribeCacheClustersCommand } from '@aws-sdk/client-elasticache';
import { CloudWatchClient, GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';
import dayjs from 'dayjs';

/**
 * Analyze ElastiCache clusters for cost optimization opportunities
 * 
 * ElastiCache pricing (us-east-1, Jan 2026):
 * Redis/Memcached:
 * - cache.t3.micro: $0.017/hour (~$12.41/month)
 * - cache.t3.small: $0.034/hour (~$24.82/month)
 * - cache.m5.large: $0.136/hour (~$99.28/month)
 * - cache.r5.large: $0.188/hour (~$137.24/month)
 */
export async function analyzeElastiCache(
  client: AWSClient
): Promise<SavingsOpportunity[]> {
  const elasticacheClient = client.getElastiCacheClient();
  const cloudwatchClient = client.getCloudWatchClient();
  const opportunities: SavingsOpportunity[] = [];

  try {
    const command = new DescribeCacheClustersCommand({
      ShowCacheNodeInfo: true,
    });
    
    const response = await elasticacheClient.send(command);
    const clusters = response.CacheClusters || [];

    for (const cluster of clusters) {
      if (!cluster.CacheClusterId || cluster.CacheClusterStatus !== 'available') {
        continue;
      }

      const clusterId = cluster.CacheClusterId;
      const nodeType = cluster.CacheNodeType || 'unknown';
      const engine = cluster.Engine || 'unknown';
      const numNodes = cluster.NumCacheNodes || 1;

      // Calculate monthly cost
      const monthlyCost = estimateElastiCacheCost(nodeType, numNodes);

      // Get CPU utilization
      const avgCPU = await getCPUUtilization(cloudwatchClient, clusterId, 30);

      // Get evictions (cache pressure indicator)
      const evictions = await getEvictions(cloudwatchClient, clusterId, 30);

      // Get connections
      const connections = await getCurrentConnections(cloudwatchClient, clusterId, 30);

      // Opportunity 1: Low CPU utilization (<10%)
      if (avgCPU < 10 && avgCPU > 0) {
        const recommendedType = getRecommendedSmallerInstance(nodeType);
        const recommendedCost = estimateElastiCacheCost(recommendedType, numNodes);
        const savings = monthlyCost - recommendedCost;

        if (savings > 20) {
          opportunities.push({
            id: `aws-elasticache-underutilized-${clusterId}`,
            provider: 'aws',
            resourceType: 'elasticache',
            resourceId: cluster.ARN || clusterId,
            resourceName: clusterId,
            category: 'underutilized',
            currentCost: monthlyCost,
            estimatedSavings: savings,
            confidence: 'high',
            recommendation: `Low CPU usage (${avgCPU.toFixed(1)}%). Consider downsizing from ${nodeType} to ${recommendedType}.`,
            metadata: {
              engine,
              currentNodeType: nodeType,
              recommendedNodeType: recommendedType,
              numNodes,
              avgCPU: parseFloat(avgCPU.toFixed(1)),
              connections,
            },
            detectedAt: new Date(),
          });
        }
      }

      // Opportunity 2: No connections (unused cache)
      if (connections === 0 && monthlyCost > 10) {
        opportunities.push({
          id: `aws-elasticache-unused-${clusterId}`,
          provider: 'aws',
          resourceType: 'elasticache',
          resourceId: cluster.ARN || clusterId,
          resourceName: clusterId,
          category: 'unused',
          currentCost: monthlyCost,
          estimatedSavings: monthlyCost,
          confidence: 'high',
          recommendation: `No active connections in 30 days. Delete unused ${engine} cluster.`,
          metadata: {
            engine,
            nodeType,
            numNodes,
            connections,
            avgCPU: parseFloat(avgCPU.toFixed(1)),
          },
          detectedAt: new Date(),
        });
      }
    }

    return opportunities;
  } catch (error: any) {
    console.error('Error analyzing ElastiCache:', error.message);
    return opportunities;
  }
}

/**
 * Get average CPU utilization for a cache cluster
 */
async function getCPUUtilization(
  cloudwatch: CloudWatchClient,
  clusterId: string,
  days: number
): Promise<number> {
  try {
    const command = new GetMetricStatisticsCommand({
      Namespace: 'AWS/ElastiCache',
      MetricName: 'CPUUtilization',
      Dimensions: [
        {
          Name: 'CacheClusterId',
          Value: clusterId,
        },
      ],
      StartTime: dayjs().subtract(days, 'day').toDate(),
      EndTime: new Date(),
      Period: 86400, // 1 day
      Statistics: ['Average'],
    });

    const response = await cloudwatch.send(command);
    const datapoints = response.Datapoints || [];
    
    if (datapoints.length === 0) return 0;
    
    const avgCPU = datapoints.reduce((sum, dp) => sum + (dp.Average || 0), 0) / datapoints.length;
    return avgCPU;
  } catch (error) {
    return 0;
  }
}

/**
 * Get total evictions for a cache cluster
 */
async function getEvictions(
  cloudwatch: CloudWatchClient,
  clusterId: string,
  days: number
): Promise<number> {
  try {
    const command = new GetMetricStatisticsCommand({
      Namespace: 'AWS/ElastiCache',
      MetricName: 'Evictions',
      Dimensions: [
        {
          Name: 'CacheClusterId',
          Value: clusterId,
        },
      ],
      StartTime: dayjs().subtract(days, 'day').toDate(),
      EndTime: new Date(),
      Period: 86400, // 1 day
      Statistics: ['Sum'],
    });

    const response = await cloudwatch.send(command);
    const datapoints = response.Datapoints || [];
    return datapoints.reduce((sum, dp) => sum + (dp.Sum || 0), 0);
  } catch (error) {
    return 0;
  }
}

/**
 * Get current connections for a cache cluster
 */
async function getCurrentConnections(
  cloudwatch: CloudWatchClient,
  clusterId: string,
  days: number
): Promise<number> {
  try {
    const command = new GetMetricStatisticsCommand({
      Namespace: 'AWS/ElastiCache',
      MetricName: 'CurrConnections',
      Dimensions: [
        {
          Name: 'CacheClusterId',
          Value: clusterId,
        },
      ],
      StartTime: dayjs().subtract(days, 'day').toDate(),
      EndTime: new Date(),
      Period: 86400, // 1 day
      Statistics: ['Average'],
    });

    const response = await cloudwatch.send(command);
    const datapoints = response.Datapoints || [];
    
    if (datapoints.length === 0) return 0;
    
    const avgConnections = datapoints.reduce((sum, dp) => sum + (dp.Average || 0), 0) / datapoints.length;
    return avgConnections;
  } catch (error) {
    return 0;
  }
}

/**
 * Estimate monthly ElastiCache cost
 * Pricing based on us-east-1 (Jan 2026)
 */
function estimateElastiCacheCost(nodeType: string, numNodes: number): number {
  const hourlyCosts: Record<string, number> = {
    'cache.t3.micro': 0.017,
    'cache.t3.small': 0.034,
    'cache.t3.medium': 0.068,
    'cache.t4g.micro': 0.016,
    'cache.t4g.small': 0.032,
    'cache.t4g.medium': 0.064,
    'cache.m5.large': 0.136,
    'cache.m5.xlarge': 0.272,
    'cache.m5.2xlarge': 0.544,
    'cache.r5.large': 0.188,
    'cache.r5.xlarge': 0.376,
    'cache.r5.2xlarge': 0.752,
  };

  const hourlyCost = hourlyCosts[nodeType] || 0.136; // Default to m5.large
  return hourlyCost * 730 * numNodes; // 730 hours/month
}

/**
 * Recommend a smaller instance type
 */
function getRecommendedSmallerInstance(currentType: string): string {
  const downsizeMap: Record<string, string> = {
    'cache.m5.2xlarge': 'cache.m5.xlarge',
    'cache.m5.xlarge': 'cache.m5.large',
    'cache.m5.large': 'cache.t3.medium',
    'cache.t3.medium': 'cache.t3.small',
    'cache.t3.small': 'cache.t3.micro',
    'cache.r5.2xlarge': 'cache.r5.xlarge',
    'cache.r5.xlarge': 'cache.r5.large',
    'cache.r5.large': 'cache.m5.large',
  };

  return downsizeMap[currentType] || 'cache.t3.small';
}
