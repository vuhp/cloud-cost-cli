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
