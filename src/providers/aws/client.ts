import { EC2Client, DescribeRegionsCommand } from '@aws-sdk/client-ec2';
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';
import { CostExplorerClient } from '@aws-sdk/client-cost-explorer';
import { RDSClient } from '@aws-sdk/client-rds';
import { S3Client } from '@aws-sdk/client-s3';
import { ElasticLoadBalancingV2Client } from '@aws-sdk/client-elastic-load-balancing-v2';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';
import { ElastiCacheClient } from '@aws-sdk/client-elasticache';
import { ECSClient } from '@aws-sdk/client-ecs';
import { CloudFrontClient } from '@aws-sdk/client-cloudfront';
import { APIGatewayClient } from '@aws-sdk/client-api-gateway';
import { EKSClient } from '@aws-sdk/client-eks';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
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
  private elasticache: ElastiCacheClient;
  private ecs: ECSClient;
  private cloudfront: CloudFrontClient;
  private apigateway: APIGatewayClient;
  private eks: EKSClient;
  private sts: STSClient;
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
    this.elasticache = new ElastiCacheClient({ region: this.region, credentials });
    this.ecs = new ECSClient({ region: this.region, credentials });
    this.cloudfront = new CloudFrontClient({ region: 'us-east-1', credentials });
    this.apigateway = new APIGatewayClient({ region: this.region, credentials });
    this.eks = new EKSClient({ region: this.region, credentials });
    this.sts = new STSClient({ region: this.region, credentials });
  }

  async getAccountId(): Promise<string> {
    try {
      const command = new GetCallerIdentityCommand({});
      const response = await this.sts.send(command);
      return response.Account || 'unknown';
    } catch (error) {
      console.error('Failed to get AWS account ID:', error);
      return 'unknown';
    }
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

  getElastiCacheClient() {
    return this.elasticache;
  }

  getECSClient() {
    return this.ecs;
  }

  getCloudFrontClient() {
    return this.cloudfront;
  }

  getAPIGatewayClient() {
    return this.apigateway;
  }

  getEKSClient() {
    return this.eks;
  }

  // Get all enabled AWS regions
  async getAllRegions(): Promise<string[]> {
    try {
      const command = new DescribeRegionsCommand({
        AllRegions: false, // Only enabled regions
      });
      const response = await this.ec2.send(command);
      return (response.Regions || [])
        .map(r => r.RegionName)
        .filter((name): name is string => !!name)
        .sort();
    } catch (error) {
      // Fallback to common regions if API fails
      return [
        'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
        'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1',
        'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1',
        'ca-central-1', 'sa-east-1'
      ];
    }
  }

  // Static method to get regions without an instance
  static async getAllRegionsStatic(profile?: string): Promise<string[]> {
    const credentials = process.env.AWS_ACCESS_KEY_ID
      ? fromEnv()
      : fromIni({ profile: profile || 'default' });

    const ec2 = new EC2Client({ region: 'us-east-1', credentials });

    try {
      const command = new DescribeRegionsCommand({
        AllRegions: false,
      });
      const response = await ec2.send(command);
      return (response.Regions || [])
        .map(r => r.RegionName)
        .filter((name): name is string => !!name)
        .sort();
    } catch (error) {
      return [
        'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
        'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1',
        'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1',
        'ca-central-1', 'sa-east-1'
      ];
    }
  }
}
