import { AWSClient } from '../providers/aws/client';
import { analyzeEC2Instances } from '../providers/aws/ec2';
import { analyzeEBSVolumes } from '../providers/aws/ebs';
import { analyzeRDSInstances } from '../providers/aws/rds';
import { analyzeS3Buckets } from '../providers/aws/s3';
import { analyzeELBs } from '../providers/aws/elb';
import { analyzeElasticIPs } from '../providers/aws/eip';
import { ScanReport, SavingsOpportunity } from '../types/opportunity';
import { renderTable } from '../reporters/table';
import { renderJSON } from '../reporters/json';
import { error, info, success } from '../utils/logger';

interface ScanCommandOptions {
  provider: string;
  region?: string;
  profile?: string;
  top?: string;
  output?: string;
  days?: string;
  minSavings?: string;
  verbose?: boolean;
}

export async function scanCommand(options: ScanCommandOptions) {
  try {
    if (options.provider !== 'aws') {
      error(`Provider "${options.provider}" not yet supported. Use --provider aws`);
      process.exit(1);
    }

    const client = new AWSClient({
      region: options.region,
      profile: options.profile,
    });

    info(`Scanning AWS account (profile: ${options.profile || 'default'}, region: ${client.region})...`);

    // Run analyzers in parallel
    info('Analyzing EC2 instances...');
    const ec2Promise = analyzeEC2Instances(client);

    info('Analyzing EBS volumes...');
    const ebsPromise = analyzeEBSVolumes(client);

    info('Analyzing RDS instances...');
    const rdsPromise = analyzeRDSInstances(client);

    info('Analyzing S3 buckets...');
    const s3Promise = analyzeS3Buckets(client);

    info('Analyzing Load Balancers...');
    const elbPromise = analyzeELBs(client);

    info('Analyzing Elastic IPs...');
    const eipPromise = analyzeElasticIPs(client);

    // Wait for all analyzers to complete
    const [
      ec2Opportunities,
      ebsOpportunities,
      rdsOpportunities,
      s3Opportunities,
      elbOpportunities,
      eipOpportunities,
    ] = await Promise.all([
      ec2Promise,
      ebsPromise,
      rdsPromise,
      s3Promise,
      elbPromise,
      eipPromise,
    ]);

    success(`Found ${ec2Opportunities.length} EC2 opportunities`);
    success(`Found ${ebsOpportunities.length} EBS opportunities`);
    success(`Found ${rdsOpportunities.length} RDS opportunities`);
    success(`Found ${s3Opportunities.length} S3 opportunities`);
    success(`Found ${elbOpportunities.length} ELB opportunities`);
    success(`Found ${eipOpportunities.length} EIP opportunities`);

    // Combine opportunities
    const allOpportunities: SavingsOpportunity[] = [
      ...ec2Opportunities,
      ...ebsOpportunities,
      ...rdsOpportunities,
      ...s3Opportunities,
      ...elbOpportunities,
      ...eipOpportunities,
    ];

    // Filter by minimum savings if specified
    const minSavings = options.minSavings ? parseFloat(options.minSavings) : 0;
    const filteredOpportunities = allOpportunities.filter(
      (opp) => opp.estimatedSavings >= minSavings
    );

    // Calculate totals
    const totalPotentialSavings = filteredOpportunities.reduce(
      (sum, opp) => sum + opp.estimatedSavings,
      0
    );

    const summary = {
      totalResources: filteredOpportunities.length,
      idleResources: filteredOpportunities.filter((o) => o.category === 'idle').length,
      oversizedResources: filteredOpportunities.filter((o) => o.category === 'oversized').length,
      unusedResources: filteredOpportunities.filter((o) => o.category === 'unused').length,
    };

    const report: ScanReport = {
      provider: 'aws',
      accountId: 'N/A', // Will fetch from STS in future
      region: client.region,
      scanPeriod: {
        start: new Date(Date.now() - (parseInt(options.days || '30') * 24 * 60 * 60 * 1000)),
        end: new Date(),
      },
      opportunities: filteredOpportunities,
      totalPotentialSavings,
      summary,
    };

    // Render output
    const topN = parseInt(options.top || '5');
    if (options.output === 'json') {
      renderJSON(report);
    } else {
      renderTable(report, topN);
    }

  } catch (err: any) {
    if (err.name === 'CredentialsProviderError' || err.message?.includes('credentials')) {
      error('AWS credentials not found or invalid.');
      console.log('\nTo configure AWS credentials:');
      console.log('1. Run: aws configure');
      console.log('2. Or set environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY');
      console.log('3. Or use --profile flag with a configured profile');
      console.log('\nSee: https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html');
    } else {
      error(`Scan failed: ${err.message}`);
      if (options.verbose) {
        console.error(err);
      }
    }
    process.exit(1);
  }
}
