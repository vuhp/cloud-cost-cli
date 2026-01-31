import {
  DescribeLoadBalancersCommand,
  DescribeTargetGroupsCommand,
  DescribeTargetHealthCommand,
  LoadBalancer,
} from '@aws-sdk/client-elastic-load-balancing-v2';
import { AWSClient } from './client';
import { SavingsOpportunity } from '../../types';
import { getELBMonthlyCost } from '../../analyzers/cost-estimator';

export async function analyzeELBs(
  client: AWSClient
): Promise<SavingsOpportunity[]> {
  const elbClient = client.getELBClient();

  const result = await elbClient.send(new DescribeLoadBalancersCommand({}));

  const loadBalancers: LoadBalancer[] = result.LoadBalancers || [];
  const opportunities: SavingsOpportunity[] = [];

  for (const lb of loadBalancers) {
    if (!lb.LoadBalancerArn || !lb.LoadBalancerName) continue;

    // Check if load balancer has active targets
    const hasActiveTargets = await checkActiveTargets(elbClient, lb.LoadBalancerArn);

    if (!hasActiveTargets) {
      const lbType = lb.Type === 'application' ? 'alb' : lb.Type === 'network' ? 'nlb' : 'alb';
      const monthlyCost = getELBMonthlyCost(lbType);

      opportunities.push({
        id: `elb-unused-${lb.LoadBalancerName}`,
        provider: 'aws',
        resourceType: 'elb',
        resourceId: lb.LoadBalancerArn,
        resourceName: lb.LoadBalancerName,
        category: 'unused',
        currentCost: monthlyCost,
        estimatedSavings: monthlyCost,
        confidence: 'high',
        recommendation: `Delete unused load balancer (no active targets)`,
        metadata: {
          loadBalancerName: lb.LoadBalancerName,
          type: lb.Type,
          scheme: lb.Scheme,
          createdTime: lb.CreatedTime,
        },
        detectedAt: new Date(),
      });
    }
  }

  return opportunities;
}

async function checkActiveTargets(
  elbClient: any,
  loadBalancerArn: string
): Promise<boolean> {
  try {
    // Get target groups for this load balancer
    const tgResult = await elbClient.send(
      new DescribeTargetGroupsCommand({ LoadBalancerArn: loadBalancerArn })
    );

    const targetGroups = tgResult.TargetGroups || [];

    if (targetGroups.length === 0) {
      return false; // No target groups = unused
    }

    // Check if any target group has healthy targets
    for (const tg of targetGroups) {
      if (!tg.TargetGroupArn) continue;

      const healthResult = await elbClient.send(
        new DescribeTargetHealthCommand({ TargetGroupArn: tg.TargetGroupArn })
      );

      const healthyTargets = (healthResult.TargetHealthDescriptions || []).filter(
        (t: any) => t.TargetHealth?.State === 'healthy'
      );

      if (healthyTargets.length > 0) {
        return true; // Has at least one healthy target
      }
    }

    return false; // No healthy targets found
  } catch (error) {
    // If we can't determine, assume it's in use (conservative)
    return true;
  }
}
