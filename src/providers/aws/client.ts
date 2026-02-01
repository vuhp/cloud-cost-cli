import { EC2Client } from '@aws-sdk/client-ec2';
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';
import { CostExplorerClient } from '@aws-sdk/client-cost-explorer';
import { RDSClient } from '@aws-sdk/client-rds';
import { S3Client } from '@aws-sdk/client-s3';
import { ElasticLoadBalancingV2Client } from '@aws-sdk/client-elastic-load-balancing-v2';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';
import { fromIni, fromEnv } from '@aws-sdk/credential-providers';
import * as fs from 'fs';
import * as path from 'path';
import * as ini from 'ini';

export interface AWSClientOptions {
  region?: string;
  profile?: string;
}

export class AWSClient {
  private ec2: EC2Client;
  private cloudwatch: CloudWatchClient;
  private costExplorer: CostExplorerClient;
  private rds: RDSClient;
  private s3: S3Client;
  private elb: ElasticLoadBalancingV2Client;
  private lambda: LambdaClient;
  private dynamodb: DynamoDBClient;
  private cloudwatchLogs: CloudWatchLogsClient;
  public region: string;
  public profile: string;

  constructor(options: AWSClientOptions) {
    this.profile = options.profile || 'default';
    
    // Determine region: CLI option > profile config > default
    this.region = options.region || this.getProfileRegion(this.profile) || 'us-east-1';

    // Use environment credentials if available, otherwise fall back to profile
    const credentials = process.env.AWS_ACCESS_KEY_ID
      ? fromEnv()
      : fromIni({ profile: this.profile });

    this.ec2 = new EC2Client({ region: this.region, credentials });
    this.cloudwatch = new CloudWatchClient({ region: this.region, credentials });
    this.costExplorer = new CostExplorerClient({ region: 'us-east-1', credentials });
    this.rds = new RDSClient({ region: this.region, credentials });
    this.s3 = new S3Client({ region: this.region, credentials });
    this.elb = new ElasticLoadBalancingV2Client({ region: this.region, credentials });
    this.lambda = new LambdaClient({ region: this.region, credentials });
    this.dynamodb = new DynamoDBClient({ region: this.region, credentials });
    this.cloudwatchLogs = new CloudWatchLogsClient({ region: this.region, credentials });
  }

  private getProfileRegion(profileName: string): string | null {
    try {
      const configPath = path.join(
        process.env.HOME || process.env.USERPROFILE || '',
        '.aws',
        'config'
      );

      if (!fs.existsSync(configPath)) {
        return null;
      }

      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config = ini.parse(configContent);

      // Profile names in config are prefixed with "profile " except for "default"
      const profileKey = profileName === 'default' ? 'default' : `profile ${profileName}`;
      
      const profileConfig = config[profileKey];
      
      // Handle both regular objects and null prototype objects
      if (profileConfig && typeof profileConfig === 'object') {
        return profileConfig.region || null;
      }
      
      return null;
    } catch (error) {
      // If we can't read the config, just return null
      return null;
    }
  }

  getEC2Client() {
    return this.ec2;
  }

  getCloudWatchClient() {
    return this.cloudwatch;
  }

  getCostExplorerClient() {
    return this.costExplorer;
  }

  getRDSClient() {
    return this.rds;
  }

  getS3Client() {
    return this.s3;
  }

  getELBClient() {
    return this.elb;
  }

  getLambdaClient() {
    return this.lambda;
  }

  getDynamoDBClient() {
    return this.dynamodb;
  }

  getCloudWatchLogsClient() {
    return this.cloudwatchLogs;
  }
}
