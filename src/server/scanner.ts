import { SavingsOpportunity } from '../types/opportunity.js';

// Import existing scan logic
import { AWSClient } from '../providers/aws/client.js';
import { AzureClient } from '../providers/azure/client.js';
import { GCPClient } from '../providers/gcp/client.js';

// AWS analyzers
import { analyzeEC2Instances } from '../providers/aws/ec2.js';
import { analyzeEBSVolumes } from '../providers/aws/ebs.js';
import { analyzeRDSInstances } from '../providers/aws/rds.js';
import { analyzeElastiCache } from '../providers/aws/elasticache.js';
import { analyzeS3Buckets } from '../providers/aws/s3.js';
import { analyzeLambdaFunctions } from '../providers/aws/lambda.js';
import { analyzeDynamoDBTables } from '../providers/aws/dynamodb.js';
import { analyzeSnapshots } from '../providers/aws/snapshots.js';
import { analyzeCloudWatchLogs } from '../providers/aws/cloudwatch-logs.js';

// Azure analyzers
import { analyzeAzureVMs } from '../providers/azure/vms.js';
import { analyzeAzureDisks } from '../providers/azure/disks.js';
import { analyzeAzureStorage } from '../providers/azure/storage.js';
import { analyzeAzureSQL } from '../providers/azure/sql.js';
import { analyzeAzureFunctions } from '../providers/azure/functions.js';
import { analyzeCosmosDB } from '../providers/azure/cosmosdb.js';

// GCP analyzers
import { analyzeGCEInstances } from '../providers/gcp/compute.js';
import { analyzeGCSBuckets } from '../providers/gcp/storage.js';
import { analyzeCloudSQLInstances } from '../providers/gcp/cloudsql.js';
import { analyzePersistentDisks } from '../providers/gcp/disks.js';

interface ScanResult {
  totalSavings: number;
  opportunities: SavingsOpportunity[];
}

export async function runScan(
  scanId: number,
  provider: string,
  region?: string,
  detailedMetrics: boolean = false
): Promise<ScanResult> {
  const opportunities: SavingsOpportunity[] = [];

  try {
    // Check for demo mode (environment variable)
    if (process.env.DEMO_MODE === 'true') {
      console.log('Running in DEMO mode - generating mock data');
      return generateMockScanResult(provider);
    }

    if (provider === 'aws') {
      const client = new AWSClient({ region: region || 'us-east-1' });

      // Run all AWS analyzers in parallel
      const results = await Promise.all([
        analyzeEC2Instances(client, detailedMetrics),
        analyzeEBSVolumes(client),
        analyzeRDSInstances(client),
        analyzeElastiCache(client),
        analyzeS3Buckets(client),
        analyzeLambdaFunctions(client),
        analyzeDynamoDBTables(client),
        analyzeSnapshots(client),
        analyzeCloudWatchLogs(client),
      ]);

      results.forEach((result: SavingsOpportunity[]) => opportunities.push(...result));
    } else if (provider === 'azure') {
      const client = new AzureClient({ location: region });

      // Run all Azure analyzers in parallel
      const results = await Promise.all([
        analyzeAzureVMs(client, detailedMetrics),
        analyzeAzureDisks(client),
        analyzeAzureStorage(client),
        analyzeAzureSQL(client),
        analyzeAzureFunctions(client),
        analyzeCosmosDB(client),
      ]);

      results.forEach((result: SavingsOpportunity[]) => opportunities.push(...result));
    } else if (provider === 'gcp') {
      const client = new GCPClient({ region: region || 'us-central1' });

      // Run all GCP analyzers in parallel
      const results = await Promise.all([
        analyzeGCEInstances(client, detailedMetrics),
        analyzeGCSBuckets(client),
        analyzeCloudSQLInstances(client),
        analyzePersistentDisks(client),
      ]);

      results.forEach((result: SavingsOpportunity[]) => opportunities.push(...result));
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    const totalSavings = opportunities.reduce(
      (sum, opp) => sum + opp.estimatedSavings,
      0
    );

    return {
      totalSavings,
      opportunities,
    };
  } catch (error: any) {
    console.error(`Scan ${scanId} failed:`, error);
    throw error;
  }
}

// Mock data generator for testing dashboard without real cloud credentials
function generateMockScanResult(provider: string): ScanResult {
  const mockOpportunities: SavingsOpportunity[] = [
    {
      id: 'mock-1',
      provider: provider as 'aws' | 'azure' | 'gcp',
      resourceType: 'ec2-instance',
      resourceId: 'i-1234567890abcdef0',
      resourceName: 'demo-server',
      category: 'underutilized',
      currentCost: 73.00,
      estimatedSavings: 58.40,
      confidence: 'high',
      recommendation: 'Instance running at 5% CPU - consider downsizing from t3.large to t3.small',
      metadata: { currentType: 't3.large', recommendedType: 't3.small', region: 'us-east-1' },
      detectedAt: new Date(),
    },
    {
      id: 'mock-2',
      provider: provider as 'aws' | 'azure' | 'gcp',
      resourceType: 'ebs-volume',
      resourceId: 'vol-0abcd1234efgh5678',
      resourceName: 'unused-volume',
      category: 'unused',
      currentCost: 20.00,
      estimatedSavings: 20.00,
      confidence: 'high',
      recommendation: 'Unattached EBS volume - delete if no longer needed',
      metadata: { size: 200, type: 'gp3', region: 'us-east-1' },
      detectedAt: new Date(),
    },
    {
      id: 'mock-3',
      provider: provider as 'aws' | 'azure' | 'gcp',
      resourceType: 's3-bucket',
      resourceId: 'old-backup-bucket-2023',
      category: 'unused',
      currentCost: 45.00,
      estimatedSavings: 33.75,
      confidence: 'medium',
      recommendation: 'Move 90% of objects to S3 Glacier for long-term storage',
      metadata: { storageClass: 'STANDARD', objects: 15000, region: 'us-west-2' },
      detectedAt: new Date(),
    },
  ];

  const totalSavings = mockOpportunities.reduce(
    (sum, opp) => sum + opp.estimatedSavings,
    0
  );

  return {
    totalSavings,
    opportunities: mockOpportunities,
  };
}
