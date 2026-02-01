import { AWSClient } from '../providers/aws/client';
import { analyzeEC2Instances } from '../providers/aws/ec2';
import { analyzeEBSVolumes } from '../providers/aws/ebs';
import { analyzeRDSInstances } from '../providers/aws/rds';
import { analyzeS3Buckets } from '../providers/aws/s3';
import { analyzeELBs } from '../providers/aws/elb';
import { analyzeElasticIPs } from '../providers/aws/eip';
import { analyzeLambdaFunctions } from '../providers/aws/lambda';
import { analyzeNATGateways } from '../providers/aws/nat-gateway';
import { analyzeDynamoDBTables } from '../providers/aws/dynamodb';
import { analyzeCloudWatchLogs } from '../providers/aws/cloudwatch-logs';
import { AzureClient } from '../providers/azure/client';
import { analyzeAzureVMs } from '../providers/azure/vms';
import { analyzeAzureDisks } from '../providers/azure/disks';
import { analyzeAzureStorage } from '../providers/azure/storage';
import { analyzeAzureSQL } from '../providers/azure/sql';
import { analyzeAzurePublicIPs } from '../providers/azure/public-ips';
import { GCPClient } from '../providers/gcp/client';
import { analyzeGCEInstances } from '../providers/gcp/compute';
import { analyzeGCSBuckets } from '../providers/gcp/storage';
import { analyzeCloudSQLInstances } from '../providers/gcp/cloudsql';
import { analyzePersistentDisks } from '../providers/gcp/disks';
import { analyzeStaticIPs } from '../providers/gcp/static-ips';
import { analyzeLoadBalancers } from '../providers/gcp/load-balancers';
import { ScanReport, SavingsOpportunity } from '../types/opportunity';
import { renderTable } from '../reporters/table';
import { renderJSON } from '../reporters/json';
import { error, info, success } from '../utils/logger';
import { AIService } from '../services/ai';
import { saveScanCache } from './ask';
import { ConfigLoader } from '../utils/config';

interface ScanCommandOptions {
  provider: string;
  region?: string;
  profile?: string;
  subscriptionId?: string;
  location?: string;
  projectId?: string;
  top?: string;
  output?: string;
  days?: string;
  minSavings?: string;
  verbose?: boolean;
  accurate?: boolean;
  explain?: boolean;
  aiProvider?: string;
  aiModel?: string;
}

export async function scanCommand(options: ScanCommandOptions) {
  try {
    if (options.provider === 'aws') {
      await scanAWS(options);
    } else if (options.provider === 'azure') {
      await scanAzure(options);
    } else if (options.provider === 'gcp') {
      await scanGCP(options);
    } else {
      error(`Provider "${options.provider}" not yet supported. Use --provider aws, azure, or gcp`);
      process.exit(1);
    }
  } catch (err: any) {
    error(`Scan failed: ${err.message}`);
    if (options.verbose) {
      console.error(err);
    }
    process.exit(1);
  }
}

async function scanAWS(options: ScanCommandOptions) {

    const client = new AWSClient({
      region: options.region,
      profile: options.profile,
    });

    info(`Scanning AWS account (profile: ${options.profile || 'default'}, region: ${client.region})...`);
    
    if (options.accurate) {
      info('Note: --accurate flag is not yet implemented. Using estimated pricing.');
      info('Real-time pricing will be available in a future release.');
    }

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

    info('Analyzing Lambda functions...');
    const lambdaPromise = analyzeLambdaFunctions(client);

    info('Analyzing NAT Gateways...');
    const natGatewayPromise = analyzeNATGateways(client);

    info('Analyzing DynamoDB tables...');
    const dynamodbPromise = analyzeDynamoDBTables(client);

    info('Analyzing CloudWatch Logs...');
    const cloudwatchLogsPromise = analyzeCloudWatchLogs(client);

    // Wait for all analyzers to complete
    const [
      ec2Opportunities,
      ebsOpportunities,
      rdsOpportunities,
      s3Opportunities,
      elbOpportunities,
      eipOpportunities,
      lambdaOpportunities,
      natGatewayOpportunities,
      dynamodbOpportunities,
      cloudwatchLogsOpportunities,
    ] = await Promise.all([
      ec2Promise,
      ebsPromise,
      rdsPromise,
      s3Promise,
      elbPromise,
      eipPromise,
      lambdaPromise,
      natGatewayPromise,
      dynamodbPromise,
      cloudwatchLogsPromise,
    ]);

    success(`Found ${ec2Opportunities.length} EC2 opportunities`);
    success(`Found ${ebsOpportunities.length} EBS opportunities`);
    success(`Found ${rdsOpportunities.length} RDS opportunities`);
    success(`Found ${s3Opportunities.length} S3 opportunities`);
    success(`Found ${elbOpportunities.length} ELB opportunities`);
    success(`Found ${eipOpportunities.length} EIP opportunities`);
    success(`Found ${lambdaOpportunities.length} Lambda opportunities`);
    success(`Found ${natGatewayOpportunities.length} NAT Gateway opportunities`);
    success(`Found ${dynamodbOpportunities.length} DynamoDB opportunities`);
    success(`Found ${cloudwatchLogsOpportunities.length} CloudWatch Logs opportunities`);

    // Combine opportunities
    const allOpportunities: SavingsOpportunity[] = [
      ...ec2Opportunities,
      ...ebsOpportunities,
      ...rdsOpportunities,
      ...s3Opportunities,
      ...elbOpportunities,
      ...eipOpportunities,
      ...lambdaOpportunities,
      ...natGatewayOpportunities,
      ...dynamodbOpportunities,
      ...cloudwatchLogsOpportunities,
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
    let aiService: AIService | undefined;
    
    if (options.explain) {
      // Load config file to get defaults
      const fileConfig = ConfigLoader.load();
      
      // CLI flags override config file
      const provider = (options.aiProvider as 'openai' | 'ollama') || fileConfig.ai?.provider || 'openai';
      const model = options.aiModel || fileConfig.ai?.model;
      const maxExplanations = fileConfig.ai?.maxExplanations;
      
      // Debug logging
      if (process.env.DEBUG) {
        console.error('options.aiProvider:', options.aiProvider, '(type:', typeof options.aiProvider, ')');
        console.error('fileConfig.ai?.provider:', fileConfig.ai?.provider);
        console.error('Provider detected:', provider);
        console.error('Has API key in config:', !!fileConfig.ai?.apiKey);
        console.error('Has env API key:', !!process.env.OPENAI_API_KEY);
      }
      
      if (provider === 'openai' && !process.env.OPENAI_API_KEY && !fileConfig.ai?.apiKey) {
        error('--explain with OpenAI requires OPENAI_API_KEY environment variable or config file');
        info('Set it with: export OPENAI_API_KEY="sk-..."');
        info('Or use --ai-provider ollama for local AI (requires Ollama installed)');
        process.exit(1);
      }
      
      try {
        aiService = new AIService({
          provider,
          apiKey: provider === 'openai' ? (process.env.OPENAI_API_KEY || fileConfig.ai?.apiKey) : undefined,
          model,
          maxExplanations,
        });
        
        if (provider === 'ollama') {
          info('Using local Ollama for AI explanations (privacy-first, no API costs)');
        }
      } catch (error: any) {
        error(`Failed to initialize AI service: ${error.message}`);
        process.exit(1);
      }
    }
    
    // Save scan cache for natural language queries
    saveScanCache(options.provider, options.region, report);
    
    if (options.output === 'json') {
      renderJSON(report);
    } else {
      await renderTable(report, topN, aiService);
    }
}

async function scanAzure(options: ScanCommandOptions) {
  const client = new AzureClient({
    subscriptionId: options.subscriptionId,
    location: options.location,
  });

  info(`Scanning Azure subscription (${client.subscriptionId})...`);
  if (client.location) {
    info(`Filtering resources by location: ${client.location}`);
  } else {
    info('Scanning all locations (no filter specified)');
  }
  
  // Test Azure credentials before scanning
  try {
    await client.testConnection();
  } catch (err: any) {
    error(err.message);
    process.exit(1);
  }
  
  if (options.accurate) {
    info('Note: --accurate flag is not yet implemented. Using estimated pricing.');
  }

  // Run analyzers in parallel
  info('Analyzing Virtual Machines...');
  const vmPromise = analyzeAzureVMs(client);

  info('Analyzing Managed Disks...');
  const diskPromise = analyzeAzureDisks(client);

  info('Analyzing Storage Accounts...');
  const storagePromise = analyzeAzureStorage(client);

  info('Analyzing SQL Databases...');
  const sqlPromise = analyzeAzureSQL(client);

  info('Analyzing Public IP Addresses...');
  const ipPromise = analyzeAzurePublicIPs(client);

  // Wait for all analyzers to complete
  const [
    vmOpportunities,
    diskOpportunities,
    storageOpportunities,
    sqlOpportunities,
    ipOpportunities,
  ] = await Promise.all([
    vmPromise,
    diskPromise,
    storagePromise,
    sqlPromise,
    ipPromise,
  ]);

  success(`Found ${vmOpportunities.length} VM opportunities`);
  success(`Found ${diskOpportunities.length} Disk opportunities`);
  success(`Found ${storageOpportunities.length} Storage opportunities`);
  success(`Found ${sqlOpportunities.length} SQL opportunities`);
  success(`Found ${ipOpportunities.length} Public IP opportunities`);

  // Combine opportunities
  const allOpportunities: SavingsOpportunity[] = [
    ...vmOpportunities,
    ...diskOpportunities,
    ...storageOpportunities,
    ...sqlOpportunities,
    ...ipOpportunities,
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
    provider: 'azure',
    accountId: client.subscriptionId,
    region: client.location || 'all',
    scanPeriod: {
      start: new Date(Date.now() - (parseInt(options.days || '7') * 24 * 60 * 60 * 1000)),
      end: new Date(),
    },
    opportunities: filteredOpportunities,
    totalPotentialSavings,
    summary,
  };

  // Render output
  const topN = parseInt(options.top || '5');
  let aiService: AIService | undefined;
  
  if (options.explain) {
    // Load config file to get defaults
    const fileConfig = ConfigLoader.load();
    
    // CLI flags override config file
    const provider = (options.aiProvider as 'openai' | 'ollama') || fileConfig.ai?.provider || 'openai';
    const model = options.aiModel || fileConfig.ai?.model;
    const maxExplanations = fileConfig.ai?.maxExplanations;
    
    // Debug logging
    if (process.env.DEBUG) {
      console.error('options.aiProvider:', options.aiProvider, '(type:', typeof options.aiProvider, ')');
      console.error('fileConfig.ai?.provider:', fileConfig.ai?.provider);
      console.error('Provider detected:', provider);
      console.error('Has API key in config:', !!fileConfig.ai?.apiKey);
      console.error('Has env API key:', !!process.env.OPENAI_API_KEY);
    }
    
    if (provider === 'openai' && !process.env.OPENAI_API_KEY && !fileConfig.ai?.apiKey) {
      error('--explain with OpenAI requires OPENAI_API_KEY environment variable or config file');
      info('Set it with: export OPENAI_API_KEY="sk-..."');
      info('Or use --ai-provider ollama for local AI (requires Ollama installed)');
      process.exit(1);
    }
    
    try {
      aiService = new AIService({
        provider,
        apiKey: provider === 'openai' ? (process.env.OPENAI_API_KEY || fileConfig.ai?.apiKey) : undefined,
        model,
        maxExplanations,
      });
      
      if (provider === 'ollama') {
        info('Using local Ollama for AI explanations (privacy-first, no API costs)');
      }
    } catch (error: any) {
      error(`Failed to initialize AI service: ${error.message}`);
      process.exit(1);
    }
  }
  
  // Save scan cache for natural language queries
  saveScanCache('azure', client.location, report);
  
  if (options.output === 'json') {
    renderJSON(report);
  } else {
    await renderTable(report, topN, aiService);
  }
}

async function scanGCP(options: ScanCommandOptions) {
  const client = new GCPClient({
    projectId: options.projectId,
    region: options.region,
  });

  info(`Scanning GCP project (${client.projectId}, region: ${client.region})...`);

  // Test connection before scanning
  info('Testing GCP credentials...');
  await client.testConnection();
  success('GCP credentials verified ✓');

  // Run analyzers in parallel
  info('Analyzing Compute Engine instances...');
  const gcePromise = analyzeGCEInstances(client);

  info('Analyzing Cloud Storage buckets...');
  const gcsPromise = analyzeGCSBuckets(client);

  info('Analyzing Cloud SQL instances...');
  const cloudsqlPromise = analyzeCloudSQLInstances(client);

  info('Analyzing Persistent Disks...');
  const disksPromise = analyzePersistentDisks(client);

  info('Analyzing Static IPs...');
  const ipsPromise = analyzeStaticIPs(client);

  info('Analyzing Load Balancers...');
  const lbPromise = analyzeLoadBalancers(client);

  // Wait for all analyzers to complete
  const [
    gceOpportunities,
    gcsOpportunities,
    cloudsqlOpportunities,
    disksOpportunities,
    ipsOpportunities,
    lbOpportunities,
  ] = await Promise.all([
    gcePromise,
    gcsPromise,
    cloudsqlPromise,
    disksPromise,
    ipsPromise,
    lbPromise,
  ]);

  success(`Found ${gceOpportunities.length} Compute Engine opportunities`);
  success(`Found ${gcsOpportunities.length} Cloud Storage opportunities`);
  success(`Found ${cloudsqlOpportunities.length} Cloud SQL opportunities`);
  success(`Found ${disksOpportunities.length} Persistent Disk opportunities`);
  success(`Found ${ipsOpportunities.length} Static IP opportunities`);
  success(`Found ${lbOpportunities.length} Load Balancer opportunities`);

  // Combine opportunities
  const allOpportunities: SavingsOpportunity[] = [
    ...gceOpportunities,
    ...gcsOpportunities,
    ...cloudsqlOpportunities,
    ...disksOpportunities,
    ...ipsOpportunities,
    ...lbOpportunities,
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
    oversizedResources: filteredOpportunities.filter((o) => o.category === 'oversized')
      .length,
    unusedResources: filteredOpportunities.filter((o) => o.category === 'unused').length,
  };

  const report: ScanReport = {
    provider: 'gcp',
    accountId: client.projectId,
    region: client.region,
    scanPeriod: {
      start: new Date(
        Date.now() - parseInt(options.days || '30') * 24 * 60 * 60 * 1000
      ),
      end: new Date(),
    },
    opportunities: filteredOpportunities,
    totalPotentialSavings,
    summary,
  };

  // Render output
  const topN = parseInt(options.top || '5');
  let aiService: AIService | undefined;

  if (options.explain) {
    // Load config file to get defaults
    const fileConfig = ConfigLoader.load();

    // CLI flags override config file
    const provider =
      (options.aiProvider as 'openai' | 'ollama') ||
      fileConfig.ai?.provider ||
      'openai';
    const model = options.aiModel || fileConfig.ai?.model;
    const maxExplanations = fileConfig.ai?.maxExplanations;

    if (
      provider === 'openai' &&
      !process.env.OPENAI_API_KEY &&
      !fileConfig.ai?.apiKey
    ) {
      error(
        '--explain with OpenAI requires OPENAI_API_KEY environment variable or config file'
      );
      info('Set it with: export OPENAI_API_KEY="sk-..."');
      info('Or use --ai-provider ollama for local AI (requires Ollama installed)');
      process.exit(1);
    }

    try {
      aiService = new AIService({
        provider,
        apiKey:
          provider === 'openai'
            ? process.env.OPENAI_API_KEY || fileConfig.ai?.apiKey
            : undefined,
        model,
        maxExplanations,
      });

      if (provider === 'ollama') {
        info('Using local Ollama for AI explanations (privacy-first, no API costs)');
      }
    } catch (error: any) {
      error(`Failed to initialize AI service: ${error.message}`);
      process.exit(1);
    }
  }

  // Save scan cache for natural language queries
  saveScanCache('gcp', client.region, report);

  if (options.output === 'json') {
    renderJSON(report);
  } else {
    await renderTable(report, topN, aiService);
  }
}
