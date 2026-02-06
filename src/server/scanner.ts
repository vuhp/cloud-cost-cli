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
  credentials?: Record<string, string>,
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

    // Empty region means "all regions"
    const scanAllRegions = !region || region === '';

    if (provider === 'aws') {
      // Get AWS account ID from first client
      let awsAccountId: string | undefined;
      
      if (scanAllRegions) {
        // Scan all AWS regions
        console.error('[AWS] Scanning all enabled regions...');
        const regions = await AWSClient.getAllRegionsStatic();
        console.error(`[AWS] Found ${regions.length} enabled regions`);

        for (const r of regions) {
          try {
            console.error(`[AWS] Scanning region: ${r}`);
            const clientConfig: any = { region: r };
            if (credentials) {
              clientConfig.credentials = {
                accessKeyId: credentials.accessKeyId,
                secretAccessKey: credentials.secretAccessKey,
              };
            }
            const client = new AWSClient(clientConfig);

            // Get account ID from first region
            if (!awsAccountId) {
              awsAccountId = await client.getAccountId();
              // Update scan with real account ID
              const { updateScanAccountId } = await import('./db.js');
              updateScanAccountId(scanId, awsAccountId);
            }

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

            // Tag opportunities with region
            const regionTag = `[${r}] `;
            results.forEach((result: SavingsOpportunity[]) => {
              result.forEach(opp => {
                opp.resourceId = regionTag + opp.resourceId;
              });
              opportunities.push(...result);
            });
            console.error(`[AWS] ${r}: Found ${opportunities.length} total opportunities so far`);
          } catch (error: any) {
            console.error(`[AWS] Skipped ${r}: ${error.message}`);
          }
        }
      } else {
        // Single region scan
        const clientConfig: any = { region };
        if (credentials) {
          clientConfig.credentials = {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
          };
        }
        const client = new AWSClient(clientConfig);

        // Get and update account ID
        const awsAccountId = await client.getAccountId();
        const { updateScanAccountId } = await import('./db.js');
        updateScanAccountId(scanId, awsAccountId);

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
      }
    } else if (provider === 'azure') {
      // Azure locations for all-regions scan
      const allLocations = [
        'eastus', 'eastus2', 'westus', 'westus2', 'centralus',
        'westeurope', 'northeurope', 'uksouth', 'ukwest',
        'southeastasia', 'eastasia', 'australiaeast',
      ];

      if (scanAllRegions) {
        console.error('[Azure] Scanning all locations...');
        for (const loc of allLocations) {
          try {
            console.error(`[Azure] Scanning location: ${loc}`);
            const clientConfig: any = { location: loc };
            if (credentials) {
              clientConfig.subscriptionId = credentials.subscriptionId;
              clientConfig.tenantId = credentials.tenantId;
              clientConfig.clientId = credentials.clientId;
              clientConfig.clientSecret = credentials.clientSecret;
            }
            const client = new AzureClient(clientConfig);

            const results = await Promise.all([
              analyzeAzureVMs(client, detailedMetrics),
              analyzeAzureDisks(client),
              analyzeAzureStorage(client),
              analyzeAzureSQL(client),
              analyzeAzureFunctions(client),
              analyzeCosmosDB(client),
            ]);

            // Tag opportunities with location
            const locationTag = `[${loc}] `;
            results.forEach((result: SavingsOpportunity[]) => {
              result.forEach(opp => {
                opp.resourceId = locationTag + opp.resourceId;
              });
              opportunities.push(...result);
            });
            console.error(`[Azure] ${loc}: Found ${opportunities.length} total opportunities so far`);
          } catch (error: any) {
            console.error(`[Azure] Skipped ${loc}: ${error.message}`);
          }
        }
      } else {
        const clientConfig: any = { location: region };
        if (credentials) {
          clientConfig.subscriptionId = credentials.subscriptionId;
          clientConfig.tenantId = credentials.tenantId;
          clientConfig.clientId = credentials.clientId;
          clientConfig.clientSecret = credentials.clientSecret;
        }
        const client = new AzureClient(clientConfig);

        const results = await Promise.all([
          analyzeAzureVMs(client, detailedMetrics),
          analyzeAzureDisks(client),
          analyzeAzureStorage(client),
          analyzeAzureSQL(client),
          analyzeAzureFunctions(client),
          analyzeCosmosDB(client),
        ]);

        results.forEach((result: SavingsOpportunity[]) => opportunities.push(...result));
      }
    } else if (provider === 'gcp') {
      // GCP regions for all-regions scan
      const allGCPRegions = [
        'us-central1', 'us-east1', 'us-west1', 'us-west2',
        'europe-west1', 'europe-west2', 'europe-west3',
        'asia-southeast1', 'asia-northeast1', 'asia-east1',
      ];

      if (scanAllRegions) {
        console.error('[GCP] Scanning all regions...');
        for (const r of allGCPRegions) {
          try {
            console.error(`[GCP] Scanning region: ${r}`);
            const clientConfig: any = { region: r };
            if (credentials) {
              clientConfig.projectId = credentials.projectId;
              clientConfig.keyFile = credentials.keyFile;
            }
            const client = new GCPClient(clientConfig);

            const results = await Promise.all([
              analyzeGCEInstances(client, detailedMetrics),
              analyzeGCSBuckets(client),
              analyzeCloudSQLInstances(client),
              analyzePersistentDisks(client),
            ]);

            // Tag opportunities with region
            const regionTag = `[${r}] `;
            results.forEach((result: SavingsOpportunity[]) => {
              result.forEach(opp => {
                opp.resourceId = regionTag + opp.resourceId;
              });
              opportunities.push(...result);
            });
            console.error(`[GCP] ${r}: Found ${opportunities.length} total opportunities so far`);
          } catch (error: any) {
            console.error(`[GCP] Skipped ${r}: ${error.message}`);
          }
        }
      } else {
        const clientConfig: any = { region: region || 'us-central1' };
        if (credentials) {
          clientConfig.projectId = credentials.projectId;
          clientConfig.keyFile = credentials.keyFile;
        }
        const client = new GCPClient(clientConfig);

        const results = await Promise.all([
          analyzeGCEInstances(client, detailedMetrics),
          analyzeGCSBuckets(client),
          analyzeCloudSQLInstances(client),
          analyzePersistentDisks(client),
        ]);

        results.forEach((result: SavingsOpportunity[]) => opportunities.push(...result));
      }
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
    
    // Improve error messages for common issues
    let errorMessage = error.message;
    
    if (errorMessage.includes('Compute Engine API has not been used') || 
        errorMessage.includes('API has not been enabled')) {
      errorMessage = `API not enabled: ${errorMessage}. Please enable the required APIs in your GCP project.`;
    } else if (errorMessage.includes('CredentialsError') || 
               errorMessage.includes('authentication') || 
               errorMessage.includes('credentials')) {
      errorMessage = `Authentication failed: ${errorMessage}. Please check your credentials in Settings.`;
    } else if (errorMessage.includes('permission') || 
               errorMessage.includes('access denied') || 
               errorMessage.includes('forbidden')) {
      errorMessage = `Permission denied: ${errorMessage}. Please ensure your account has the necessary permissions.`;
    }
    
    throw new Error(errorMessage);
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
