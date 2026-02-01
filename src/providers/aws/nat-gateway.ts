import { AWSClient } from './client';
import { SavingsOpportunity } from '../../types/opportunity';
import { DescribeNatGatewaysCommand, DescribeVpcsCommand } from '@aws-sdk/client-ec2';
import { CloudWatchClient, GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';
import dayjs from 'dayjs';

// NAT Gateway pricing (us-east-1)
const NAT_GATEWAY_HOURLY_COST = 0.045; // $0.045/hour
const NAT_GATEWAY_MONTHLY_COST = NAT_GATEWAY_HOURLY_COST * 730; // ~$32.85/month

/**
 * Analyze NAT Gateways for cost optimization opportunities
 */
export async function analyzeNATGateways(
  client: AWSClient
): Promise<SavingsOpportunity[]> {
  const ec2Client = client.getEC2Client();
  const cloudwatchClient = client.getCloudWatchClient();
  const opportunities: SavingsOpportunity[] = [];

  try {
    // List all NAT Gateways
    const command = new DescribeNatGatewaysCommand({});
    const response = await ec2Client.send(command);

    if (!response.NatGateways || response.NatGateways.length === 0) {
      return opportunities;
    }

    for (const natGateway of response.NatGateways) {
      if (!natGateway.NatGatewayId || natGateway.State !== 'available') {
        continue;
      }

      const natGatewayId = natGateway.NatGatewayId;
      const vpcId = natGateway.VpcId || 'unknown';
      const subnetId = natGateway.SubnetId || 'unknown';

      // Get bytes transferred in/out over the last 30 days
      const bytesOut = await getBytesProcessed(cloudwatchClient, natGatewayId, 30);
      const bytesIn = await getBytesReceived(cloudwatchClient, natGatewayId, 30);

      const totalGB = (bytesOut + bytesIn) / (1024 ** 3);
      const dataTransferCost = totalGB * 0.045; // $0.045 per GB processed
      const totalMonthlyCost = NAT_GATEWAY_MONTHLY_COST + dataTransferCost;

      // Opportunity 1: Unused NAT Gateway (very low traffic)
      if (totalGB < 1) { // Less than 1 GB in 30 days
        opportunities.push({
          id: `aws-natgateway-unused-${natGatewayId}`,
          provider: 'aws',
          resourceType: 'nat-gateway',
          resourceId: natGatewayId,
          resourceName: natGatewayId,
          category: 'unused',
          currentCost: totalMonthlyCost,
          estimatedSavings: totalMonthlyCost,
          confidence: 'high',
          recommendation: `Delete unused NAT Gateway (<1 GB traffic in 30 days)`,
          metadata: {
            vpcId,
            subnetId,
            trafficGB: parseFloat(totalGB.toFixed(2)),
            state: natGateway.State,
          },
          detectedAt: new Date(),
        });
      }
      // Opportunity 2: Low usage NAT Gateway
      else if (totalGB < 10) { // Less than 10 GB in 30 days
        opportunities.push({
          id: `aws-natgateway-lowusage-${natGatewayId}`,
          provider: 'aws',
          resourceType: 'nat-gateway',
          resourceId: natGatewayId,
          resourceName: natGatewayId,
          category: 'underutilized',
          currentCost: totalMonthlyCost,
          estimatedSavings: NAT_GATEWAY_MONTHLY_COST, // Can potentially replace with NAT instance
          confidence: 'medium',
          recommendation: `Consider replacing with NAT instance (low traffic: ${totalGB.toFixed(1)} GB/month)`,
          metadata: {
            vpcId,
            subnetId,
            trafficGB: parseFloat(totalGB.toFixed(2)),
            state: natGateway.State,
          },
          detectedAt: new Date(),
        });
      }
    }

    return opportunities;
  } catch (error: any) {
    console.error('Error analyzing NAT Gateways:', error.message);
    return opportunities;
  }
}

/**
 * Get bytes processed (outbound) for a NAT Gateway
 */
async function getBytesProcessed(
  cloudwatch: CloudWatchClient,
  natGatewayId: string,
  days: number
): Promise<number> {
  try {
    const command = new GetMetricStatisticsCommand({
      Namespace: 'AWS/NATGateway',
      MetricName: 'BytesOutToDestination',
      Dimensions: [
        {
          Name: 'NatGatewayId',
          Value: natGatewayId,
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
 * Get bytes received (inbound) for a NAT Gateway
 */
async function getBytesReceived(
  cloudwatch: CloudWatchClient,
  natGatewayId: string,
  days: number
): Promise<number> {
  try {
    const command = new GetMetricStatisticsCommand({
      Namespace: 'AWS/NATGateway',
      MetricName: 'BytesInFromDestination',
      Dimensions: [
        {
          Name: 'NatGatewayId',
          Value: natGatewayId,
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
