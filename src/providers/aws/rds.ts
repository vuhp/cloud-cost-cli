import { DescribeDBInstancesCommand, DBInstance } from '@aws-sdk/client-rds';
import {
  GetMetricStatisticsCommand,
  Statistic,
} from '@aws-sdk/client-cloudwatch';
import { AWSClient } from './client';
import { SavingsOpportunity } from '../../types';
import { getRDSMonthlyCost } from '../../analyzers/cost-estimator';
import dayjs from 'dayjs';

export async function analyzeRDSInstances(
  client: AWSClient
): Promise<SavingsOpportunity[]> {
  const rdsClient = client.getRDSClient();
  const cloudwatchClient = client.getCloudWatchClient();

  const result = await rdsClient.send(new DescribeDBInstancesCommand({}));

  const instances: DBInstance[] = result.DBInstances || [];
  const opportunities: SavingsOpportunity[] = [];

  for (const instance of instances) {
    if (!instance.DBInstanceIdentifier || !instance.DBInstanceClass) continue;

    // Get average CPU and connections over last 30 days
    const avgCpu = await getAvgMetric(
      cloudwatchClient,
      instance.DBInstanceIdentifier,
      'CPUUtilization',
      30
    );
    const avgConnections = await getAvgMetric(
      cloudwatchClient,
      instance.DBInstanceIdentifier,
      'DatabaseConnections',
      30
    );

    // Detect oversized: low CPU (<20%) or low connections
    if (avgCpu < 20 && avgCpu > 0) {
      const currentCost = getRDSMonthlyCost(instance.DBInstanceClass);
      
      // Estimate smaller instance class (rough heuristic)
      const smallerClass = getSmallerInstanceClass(instance.DBInstanceClass);
      const proposedCost = smallerClass ? getRDSMonthlyCost(smallerClass) : 0;
      const savings = currentCost - proposedCost;

      if (savings > 0) {
        opportunities.push({
          id: `rds-oversized-${instance.DBInstanceIdentifier}`,
          provider: 'aws',
          resourceType: 'rds',
          resourceId: instance.DBInstanceIdentifier,
          resourceName: instance.DBInstanceIdentifier,
          category: 'oversized',
          currentCost,
          estimatedSavings: savings,
          confidence: 'medium',
          recommendation: `Downsize to ${smallerClass || 'smaller instance'} (avg CPU: ${avgCpu.toFixed(1)}%, avg connections: ${avgConnections.toFixed(0)})`,
          metadata: {
            instanceClass: instance.DBInstanceClass,
            avgCpu,
            avgConnections,
            engine: instance.Engine,
          },
          detectedAt: new Date(),
        });
      }
    }
  }

  return opportunities;
}

async function getAvgMetric(
  cloudwatchClient: any,
  dbInstanceId: string,
  metricName: string,
  days: number
): Promise<number> {
  const endTime = new Date();
  const startTime = dayjs(endTime).subtract(days, 'day').toDate();

  try {
    const result = await cloudwatchClient.send(
      new GetMetricStatisticsCommand({
        Namespace: 'AWS/RDS',
        MetricName: metricName,
        Dimensions: [{ Name: 'DBInstanceIdentifier', Value: dbInstanceId }],
        StartTime: startTime,
        EndTime: endTime,
        Period: 86400, // 1 day
        Statistics: [Statistic.Average],
      })
    );

    if (!result.Datapoints || result.Datapoints.length === 0) {
      return 0;
    }

    const avg =
      result.Datapoints.reduce((sum: number, dp: any) => sum + (dp.Average || 0), 0) /
      result.Datapoints.length;
    return avg;
  } catch (error) {
    return 0;
  }
}

function getSmallerInstanceClass(currentClass: string): string | null {
  // Simple downsize heuristic: xlarge -> large, large -> medium, etc.
  const downsizeMap: Record<string, string> = {
    'db.t3.large': 'db.t3.medium',
    'db.t3.xlarge': 'db.t3.large',
    'db.m5.large': 'db.t3.large',
    'db.m5.xlarge': 'db.m5.large',
    'db.m5.2xlarge': 'db.m5.xlarge',
    'db.r5.large': 'db.t3.large',
    'db.r5.xlarge': 'db.r5.large',
    'db.r5.2xlarge': 'db.r5.xlarge',
  };

  return downsizeMap[currentClass] || null;
}
