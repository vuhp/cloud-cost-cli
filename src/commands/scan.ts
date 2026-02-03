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
import { analyzeSnapshots } from '../providers/aws/snapshots';
import { analyzeElastiCache } from '../providers/aws/elasticache';
import { analyzeECS } from '../providers/aws/ecs';
import { AzureClient } from '../providers/azure/client';
import { analyzeAzureVMs } from '../providers/azure/vms';
import { analyzeAzureDisks } from '../providers/azure/disks';
import { analyzeAzureStorage } from '../providers/azure/storage';
import { analyzeAzureSQL } from '../providers/azure/sql';
import { analyzeAzurePublicIPs } from '../providers/azure/public-ips';
import { analyzeAppServicePlans } from '../providers/azure/app-services';
import { analyzeAzureFunctions } from '../providers/azure/functions';
import { analyzeCosmosDB } from '../providers/azure/cosmosdb';
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
import { exportToCSV } from '../reporters/csv';
import { exportToExcel } from '../reporters/excel';
import { exportToHtml } from '../reporters/html';
import { error, info, success } from '../utils/logger';
import { AIService } from '../services/ai';
import { saveScanCache } from './ask';
import { ConfigLoader } from '../utils/config';
import * as fs from 'fs';
import * as path from 'path';

interface ScanCommandOptions {
  provider: string;
  region?: string;
  allRegions?: boolean;
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

async function scanSingleRegionAWS(region: string, options: ScanCommandOptions): Promise<SavingsOpportunity[]> {
  const client = new AWSClient({
    region: region,
    profile: options.profile,
  });

  info(`Scanning region: ${region}...`);

  // Run analyzers in parallel
  const ec2Promise = analyzeEC2Instances(client);
  const ebsPromise = analyzeEBSVolumes(client);
  const rdsPromise = analyzeRDSInstances(client);
  const s3Promise = analyzeS3Buckets(client);
  const elbPromise = analyzeELBs(client);
  const eipPromise = analyzeElasticIPs(client);
  const lambdaPromise = analyzeLambdaFunctions(client);
  const natGatewayPromise = analyzeNATGateways(client);
  const dynamodbPromise = analyzeDynamoDBTables(client);
  const cloudwatchLogsPromise = analyzeCloudWatchLogs(client);
  const snapshotsPromise = analyzeSnapshots(client);
  const elasticachePromise = analyzeElastiCache(client);
  const ecsPromise = analyzeECS(client);

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
    snapshotsOpportunities,
    elasticacheOpportunities,
    ecsOpportunities,
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
    snapshotsPromise,
    elasticachePromise,
    ecsPromise,
  ]);

  // Tag each opportunity with its region
  const regionTag = `[${region}] `;
  const tagOpportunities = (opps: SavingsOpportunity[]): SavingsOpportunity[] =>
    opps.map(opp => ({
      ...opp,
      resourceId: regionTag + opp.resourceId,
    }));

  return [
    ...tagOpportunities(ec2Opportunities),
    ...tagOpportunities(ebsOpportunities),
    ...tagOpportunities(rdsOpportunities),
    ...tagOpportunities(s3Opportunities),
    ...tagOpportunities(elbOpportunities),
    ...tagOpportunities(eipOpportunities),
    ...tagOpportunities(lambdaOpportunities),
    ...tagOpportunities(natGatewayOpportunities),
    ...tagOpportunities(dynamodbOpportunities),
    ...tagOpportunities(cloudwatchLogsOpportunities),
    ...tagOpportunities(snapshotsOpportunities),
    ...tagOpportunities(elasticacheOpportunities),
    ...tagOpportunities(ecsOpportunities),
  ];
}

async function scanAWS(options: ScanCommandOptions) {
  let allOpportunities: SavingsOpportunity[] = [];
  let scannedRegions: string[] = [];

  if (options.allRegions) {
    info(`Scanning all AWS regions (profile: ${options.profile || 'default'})...`);
    info('This may take a few minutes...\n');

    const regions = await AWSClient.getAllRegionsStatic(options.profile);
    info(`Found ${regions.length} enabled regions: ${regions.join(', ')}\n`);

    // Scan regions in batches of 5 to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < regions.length; i += batchSize) {
      const batch = regions.slice(i, i + batchSize);
      info(`Scanning batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(regions.length / batchSize)}: ${batch.join(', ')}`);
      
      const batchResults = await Promise.all(
        batch.map(region => scanSingleRegionAWS(region, options).catch(err => {
          info(`⚠️  Skipped ${region}: ${err.message}`);
          return [] as SavingsOpportunity[];
        }))
      );
      
      batchResults.forEach((results, idx) => {
        if (results.length > 0) {
          success(`✓ ${batch[idx]}: Found ${results.length} opportunities`);
          scannedRegions.push(batch[idx]);
        }
      });
      
      allOpportunities = allOpportunities.concat(...batchResults);
    }

    success(`\n✓ Completed multi-region scan across ${scannedRegions.length} regions`);
  } else {
    const client = new AWSClient({
      region: options.region,
      profile: options.profile,
    });

    info(`Scanning AWS account (profile: ${options.profile || 'default'}, region: ${client.region})...`);
    
    if (options.accurate) {
      info('Note: --accurate flag is not yet implemented. Using estimated pricing.');
      info('Real-time pricing will be available in a future release.');
    }

    info('Analyzing EC2 instances...');
    info('Analyzing EBS volumes...');
    info('Analyzing RDS instances...');
    info('Analyzing S3 buckets...');
    info('Analyzing Load Balancers...');
    info('Analyzing Elastic IPs...');
    info('Analyzing Lambda functions...');
    info('Analyzing NAT Gateways...');
    info('Analyzing DynamoDB tables...');
    info('Analyzing CloudWatch Logs...');
    info('Analyzing Snapshots...');
    info('Analyzing ElastiCache clusters...');
    info('Analyzing ECS/Fargate...');

    // Run analyzers in parallel
    const ec2Promise = analyzeEC2Instances(client);
    const ebsPromise = analyzeEBSVolumes(client);
    const rdsPromise = analyzeRDSInstances(client);
    const s3Promise = analyzeS3Buckets(client);
    const elbPromise = analyzeELBs(client);
    const eipPromise = analyzeElasticIPs(client);
    const lambdaPromise = analyzeLambdaFunctions(client);
    const natGatewayPromise = analyzeNATGateways(client);
    const dynamodbPromise = analyzeDynamoDBTables(client);
    const cloudwatchLogsPromise = analyzeCloudWatchLogs(client);
    const snapshotsPromise = analyzeSnapshots(client);
    const elasticachePromise = analyzeElastiCache(client);
    const ecsPromise = analyzeECS(client);

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
      snapshotsOpportunities,
      elasticacheOpportunities,
      ecsOpportunities,
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
      snapshotsPromise,
      elasticachePromise,
      ecsPromise,
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
    success(`Found ${snapshotsOpportunities.length} Snapshot opportunities`);
    success(`Found ${elasticacheOpportunities.length} ElastiCache opportunities`);
    success(`Found ${ecsOpportunities.length} ECS/Fargate opportunities`);

    allOpportunities = [
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
      ...snapshotsOpportunities,
      ...elasticacheOpportunities,
      ...ecsOpportunities,
    ];
  }

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
      region: options.allRegions ? `multi-region (${scannedRegions.length} regions)` : (options.region || 'us-east-1'),
      scanPeriod: {
        start: new Date(Date.now() - (parseInt(options.days || '30') * 24 * 60 * 60 * 1000)),
        end: new Date(),
      },
      opportunities: filteredOpportunities,
      totalPotentialSavings,
      summary,
    };

    // Show region breakdown for multi-region scans
    if (options.allRegions) {
      info('\n📊 Region Breakdown:');
      const regionGroups = filteredOpportunities.reduce((acc, opp) => {
        const match = opp.resourceId.match(/^\[([^\]]+)\]/);
        const region = match ? match[1] : 'unknown';
        acc[region] = (acc[region] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      Object.entries(regionGroups)
        .sort(([, a], [, b]) => b - a)
        .forEach(([region, count]) => {
          const regionSavings = filteredOpportunities
            .filter(o => o.resourceId.startsWith(`[${region}]`))
            .reduce((sum, o) => sum + o.estimatedSavings, 0);
          info(`  ${region}: ${count} opportunities, $${regionSavings.toFixed(2)}/month`);
        });
      info('');
    }

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
    
    // Handle output format
    if (options.output === 'json') {
      renderJSON(report);
    } else if (options.output === 'csv') {
      const csv = exportToCSV(report.opportunities, { includeMetadata: true });
      const filename = `cloud-cost-report-${options.provider}-${Date.now()}.csv`;
      fs.writeFileSync(filename, csv);
      success(`Report saved to ${filename}`);
      console.log(`\nTotal opportunities: ${report.opportunities.length}`);
      console.log(`Total potential savings: $${report.totalPotentialSavings.toFixed(2)}/month`);
    } else if (options.output === 'excel' || options.output === 'xlsx') {
      const buffer = exportToExcel(report.opportunities, { 
        includeMetadata: true,
        includeSummarySheet: true,
      });
      const filename = `cloud-cost-report-${options.provider}-${Date.now()}.xlsx`;
      fs.writeFileSync(filename, buffer);
      success(`Report saved to ${filename}`);
      console.log(`\nTotal opportunities: ${report.opportunities.length}`);
      console.log(`Total potential savings: $${report.totalPotentialSavings.toFixed(2)}/month`);
    } else if (options.output === 'html') {
      const html = exportToHtml(report.opportunities, {
        provider: options.provider,
        region: options.region,
        totalSavings: report.totalPotentialSavings,
        scanDate: new Date(),
      }, {
        includeCharts: true,
        theme: 'light',
      });
      const filename = `cloud-cost-report-${options.provider}-${Date.now()}.html`;
      fs.writeFileSync(filename, html);
      success(`Report saved to ${filename}`);
      console.log(`\nTotal opportunities: ${report.opportunities.length}`);
      console.log(`Total potential savings: $${report.totalPotentialSavings.toFixed(2)}/month`);
      
      // Try to open in browser
      try {
        const open = await import('open');
        await open.default(filename);
        info(`Opening report in your browser...`);
      } catch (err) {
        info(`Open the file manually: ${filename}`);
      }
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

  info('Analyzing App Service Plans...');
  const appServicePromise = analyzeAppServicePlans(client);

  info('Analyzing Azure Functions...');
  const functionsPromise = analyzeAzureFunctions(client);

  info('Analyzing CosmosDB...');
  const cosmosdbPromise = analyzeCosmosDB(client);

  // Wait for all analyzers to complete
  const [
    vmOpportunities,
    diskOpportunities,
    storageOpportunities,
    sqlOpportunities,
    ipOpportunities,
    appServiceOpportunities,
    functionsOpportunities,
    cosmosdbOpportunities,
  ] = await Promise.all([
    vmPromise,
    diskPromise,
    storagePromise,
    sqlPromise,
    ipPromise,
    appServicePromise,
    functionsPromise,
    cosmosdbPromise,
  ]);

  success(`Found ${vmOpportunities.length} VM opportunities`);
  success(`Found ${diskOpportunities.length} Disk opportunities`);
  success(`Found ${storageOpportunities.length} Storage opportunities`);
  success(`Found ${sqlOpportunities.length} SQL opportunities`);
  success(`Found ${ipOpportunities.length} Public IP opportunities`);
  success(`Found ${appServiceOpportunities.length} App Service opportunities`);
  success(`Found ${functionsOpportunities.length} Azure Functions opportunities`);
  success(`Found ${cosmosdbOpportunities.length} CosmosDB opportunities`);

  // Combine opportunities
  const allOpportunities: SavingsOpportunity[] = [
    ...vmOpportunities,
    ...diskOpportunities,
    ...storageOpportunities,
    ...sqlOpportunities,
    ...ipOpportunities,
    ...appServiceOpportunities,
    ...functionsOpportunities,
    ...cosmosdbOpportunities,
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
  
  // Handle output format
  if (options.output === 'json') {
    renderJSON(report);
  } else if (options.output === 'csv') {
    const csv = exportToCSV(report.opportunities, { includeMetadata: true });
    const filename = `cloud-cost-report-azure-${Date.now()}.csv`;
    fs.writeFileSync(filename, csv);
    success(`Report saved to ${filename}`);
    console.log(`\nTotal opportunities: ${report.opportunities.length}`);
    console.log(`Total potential savings: $${report.totalPotentialSavings.toFixed(2)}/month`);
  } else if (options.output === 'excel' || options.output === 'xlsx') {
    const buffer = exportToExcel(report.opportunities, { 
      includeMetadata: true,
      includeSummarySheet: true,
    });
    const filename = `cloud-cost-report-azure-${Date.now()}.xlsx`;
    fs.writeFileSync(filename, buffer);
    success(`Report saved to ${filename}`);
    console.log(`\nTotal opportunities: ${report.opportunities.length}`);
    console.log(`Total potential savings: $${report.totalPotentialSavings.toFixed(2)}/month`);
  } else if (options.output === 'html') {
    const html = exportToHtml(report.opportunities, {
      provider: 'azure',
      region: client.location,
      totalSavings: report.totalPotentialSavings,
      scanDate: new Date(),
    }, {
      includeCharts: true,
      theme: 'light',
    });
    const filename = `cloud-cost-report-azure-${Date.now()}.html`;
    fs.writeFileSync(filename, html);
    success(`Report saved to ${filename}`);
    console.log(`\nTotal opportunities: ${report.opportunities.length}`);
    console.log(`Total potential savings: $${report.totalPotentialSavings.toFixed(2)}/month`);
    
    // Try to open in browser
    try {
      const open = await import('open');
      await open.default(filename);
      info(`Opening report in your browser...`);
    } catch (err) {
      info(`Open the file manually: ${filename}`);
    }
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
  try {
    await client.testConnection();
    success('GCP credentials verified ✓');
  } catch (err: any) {
    error(err.message);
    process.exit(1);
  }

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

  // Handle output format
  if (options.output === 'json') {
    renderJSON(report);
  } else if (options.output === 'csv') {
    const csv = exportToCSV(report.opportunities, { includeMetadata: true });
    const filename = `cloud-cost-report-gcp-${Date.now()}.csv`;
    fs.writeFileSync(filename, csv);
    success(`Report saved to ${filename}`);
    console.log(`\nTotal opportunities: ${report.opportunities.length}`);
    console.log(`Total potential savings: $${report.totalPotentialSavings.toFixed(2)}/month`);
  } else if (options.output === 'excel' || options.output === 'xlsx') {
    const buffer = exportToExcel(report.opportunities, { 
      includeMetadata: true,
      includeSummarySheet: true,
    });
    const filename = `cloud-cost-report-gcp-${Date.now()}.xlsx`;
    fs.writeFileSync(filename, buffer);
    success(`Report saved to ${filename}`);
    console.log(`\nTotal opportunities: ${report.opportunities.length}`);
    console.log(`Total potential savings: $${report.totalPotentialSavings.toFixed(2)}/month`);
  } else if (options.output === 'html') {
    const html = exportToHtml(report.opportunities, {
      provider: 'gcp',
      region: client.region,
      totalSavings: report.totalPotentialSavings,
      scanDate: new Date(),
    }, {
      includeCharts: true,
      theme: 'light',
    });
    const filename = `cloud-cost-report-gcp-${Date.now()}.html`;
    fs.writeFileSync(filename, html);
    success(`Report saved to ${filename}`);
    console.log(`\nTotal opportunities: ${report.opportunities.length}`);
    console.log(`Total potential savings: $${report.totalPotentialSavings.toFixed(2)}/month`);
    
    // Try to open in browser
    try {
      const open = await import('open');
      await open.default(filename);
      info(`Opening report in your browser...`);
    } catch (err) {
      info(`Open the file manually: ${filename}`);
    }
  } else {
    await renderTable(report, topN, aiService);
  }
}
