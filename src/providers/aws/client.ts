import { EC2Client } from '@aws-sdk/client-ec2';
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';
import { CostExplorerClient } from '@aws-sdk/client-cost-explorer';
import { RDSClient } from '@aws-sdk/client-rds';
import { S3Client } from '@aws-sdk/client-s3';
import { ElasticLoadBalancingV2Client } from '@aws-sdk/client-elastic-load-balancing-v2';
import { fromIni, fromEnv } from '@aws-sdk/credential-providers';

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
  public region: string;
  public profile: string;

  constructor(options: AWSClientOptions) {
    this.region = options.region || 'us-east-1';
    this.profile = options.profile || 'default';

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
}
