import { AWSClient } from '../providers/aws/client.js';
import { analyzeEC2Instances } from '../providers/aws/ec2.js';
import { analyzeEBSVolumes } from '../providers/aws/ebs.js';
import { ScanReport, SavingsOpportunity } from '../types/opportunity.js';
import { renderTable } from '../reporters/table.js';
import { renderJSON } from '../reporters/json.js';
import { error, info, success } from '../utils/logger.js';

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

    info(`Scanning AWS account (profile: ${options.profile || 'default'}, region: ${options.region || 'us-east-1'})...`);

    const client = new AWSClient({
      region: options.region,
      profile: options.profile,
    });

    // Run analyzers
    info('Analyzing EC2 instances...');
    const ec2Opportunities = await analyzeEC2Instances(client);
    success(`Found ${ec2Opportunities.length} EC2 opportunities`);

    info('Analyzing EBS volumes...');
    const ebsOpportunities = await analyzeEBSVolumes(client);
    success(`Found ${ebsOpportunities.length} EBS opportunities`);

    // Combine opportunities
    const allOpportunities: SavingsOpportunity[] = [
      ...ec2Opportunities,
      ...ebsOpportunities,
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
