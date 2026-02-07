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
import { analyzeCloudFrontDistributions } from '../providers/aws/cloudfront';
import { analyzeAPIGateways } from '../providers/aws/apigateway';
import { analyzeEKS } from '../providers/aws/eks';
import { AzureClient } from '../providers/azure/client';
import { analyzeAzureVMs } from '../providers/azure/vms';
import { analyzeAzureDisks } from '../providers/azure/disks';
import { analyzeAzureStorage } from '../providers/azure/storage';
import { analyzeAzureSQL } from '../providers/azure/sql';
import { analyzeAzurePublicIPs } from '../providers/azure/public-ips';
import { analyzeAppServicePlans } from '../providers/azure/app-services';
import { analyzeAzureFunctions } from '../providers/azure/functions';
import { analyzeCosmosDB } from '../providers/azure/cosmosdb';
import { analyzeAKS } from '../providers/azure/aks';
import { GCPClient } from '../providers/gcp/client';
import { analyzeGCEInstances } from '../providers/gcp/compute';
import { analyzeGCSBuckets } from '../providers/gcp/storage';
import { analyzeCloudSQLInstances } from '../providers/gcp/cloudsql';
import { analyzePersistentDisks } from '../providers/gcp/disks';
import { analyzeStaticIPs } from '../providers/gcp/static-ips';
import { analyzeLoadBalancers } from '../providers/gcp/load-balancers';
import { analyzeGKE } from '../providers/gcp/gke';
import { ScanReport, SavingsOpportunity } from '../types/opportunity';
import { renderTable } from '../reporters/table';
import { renderJSON } from '../reporters/json';
import { exportToCSV } from '../reporters/csv';
import { exportToExcel } from '../reporters/excel';
import { exportToHtml } from '../reporters/html';
import { error, info, success } from '../utils/logger';
import { AIService } from '../services/ai';
import { saveScanCache } from './ask';
import { saveReport } from './compare';
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
  detailedMetrics?: boolean;
  explain?: boolean;
  aiProvider?: string;
  aiModel?: string;
}

/**
 * Safely run an analyzer, catching errors and logging warnings without crashing
 */
async function safeAnalyze<T>(
  name: string,
  analyzerFn: () => Promise<T[]>,
  verbose?: boolean
): Promise<T[]> {
  try {
    return await analyzerFn();
  } catch (err: any) {
    console.warn(`⚠️  ${name} analyzer failed: ${err.message}`);
    if (verbose) {
      console.error(err);
    }
    return [];
  }
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

  // Run analyzers in parallel with error handling
  const results = await Promise.all([
    safeAnalyze('EC2', () => analyzeEC2Instances(client, options.detailedMetrics || false), options.verbose),
    safeAnalyze('EBS', () => analyzeEBSVolumes(client), options.verbose),
    safeAnalyze('RDS', () => analyzeRDSInstances(client), options.verbose),
    safeAnalyze('S3', () => analyzeS3Buckets(client), options.verbose),
    safeAnalyze('ELB', () => analyzeELBs(client), options.verbose),
    safeAnalyze('EIP', () => analyzeElasticIPs(client), options.verbose),
    safeAnalyze('Lambda', () => analyzeLambdaFunctions(client), options.verbose),
    safeAnalyze('NAT Gateway', () => analyzeNATGateways(client), options.verbose),
    safeAnalyze('DynamoDB', () => analyzeDynamoDBTables(client), options.verbose),
    safeAnalyze('CloudWatch Logs', () => analyzeCloudWatchLogs(client), options.verbose),
    safeAnalyze('Snapshots', () => analyzeSnapshots(client), options.verbose),
    safeAnalyze('ElastiCache', () => analyzeElastiCache(client), options.verbose),
    safeAnalyze('ECS', () => analyzeECS(client), options.verbose),
    safeAnalyze('CloudFront', () => analyzeCloudFrontDistributions(client), options.verbose),
    safeAnalyze('API Gateway', () => analyzeAPIGateways(client), options.verbose),
    safeAnalyze('EKS', () => analyzeEKS(client, options.detailedMetrics || false), options.verbose),
  ]);

  // Flatten results
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
    cloudfrontOpportunities,
    apigatewayOpportunities,
    eksOpportunities,
  ] = results;

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
    ...tagOpportunities(cloudfrontOpportunities),
    ...tagOpportunities(apigatewayOpportunities),
    ...tagOpportunities(eksOpportunities),
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
    info('Analyzing CloudFront...');
    info('Analyzing API Gateway...');

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
    const cloudfrontPromise = analyzeCloudFrontDistributions(client);
    const apigatewayPromise = analyzeAPIGateways(client);
    const eksPromise = analyzeEKS(client, options.detailedMetrics || false);

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
      cloudfrontOpportunities,
      apigatewayOpportunities,
      eksOpportunities,
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
      cloudfrontPromise,
      apigatewayPromise,
      eksPromise,
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
    success(`Found ${cloudfrontOpportunities.length} CloudFront opportunities`);
    success(`Found ${apigatewayOpportunities.length} API Gateway opportunities`);
    success(`Found ${eksOpportunities.length} EKS opportunities`);

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
      ...cloudfrontOpportunities,
      ...apigatewayOpportunities,
      ...eksOpportunities,
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

  // Save report for comparison tracking
  const savedPath = saveReport(report);
  info(`Report saved for comparison: ${path.basename(savedPath)}`);

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
  let allOpportunities: SavingsOpportunity[] = [];
  let scannedLocations: string[] = [];

  if (options.allRegions) {
    info('Scanning all Azure locations...');
    info('This may take a few minutes...\n');

    const locations = [
      'eastus', 'eastus2', 'westus', 'westus2', 'centralus',
      'westeurope', 'northeurope', 'uksouth', 'ukwest',
      'southeastasia', 'eastasia', 'australiaeast',
    ];

    info(`Scanning ${locations.length} locations: ${locations.join(', ')}\n`);

    for (const location of locations) {
      try {
        info(`Scanning location: ${location}...`);
        const opportunities = await scanSingleLocationAzure(location, options);

        if (opportunities && opportunities.length > 0) {
          success(`✓ ${location}: Found ${opportunities.length} opportunities`);
          scannedLocations.push(location);
          allOpportunities.push(...opportunities);
        }
      } catch (err: any) {
        info(`⚠️  Skipped ${location}: ${err.message}`);
      }
    }

    success(`\n✓ Completed multi-location scan across ${scannedLocations.length} locations`);

    // Output multi-location results
    const totalPotentialSavings = allOpportunities.reduce((sum, opp) => sum + opp.estimatedSavings, 0);
    const report: ScanReport = {
      opportunities: allOpportunities,
      totalPotentialSavings,
      summary: {
        totalResources: allOpportunities.length,
        idleResources: allOpportunities.filter((o) => o.category === 'idle').length,
        oversizedResources: allOpportunities.filter((o) => o.category === 'oversized').length,
        unusedResources: allOpportunities.filter((o) => o.category === 'unused').length,
      },
      provider: 'azure',
      accountId: options.subscriptionId || 'unknown',
      region: `multi-location (${scannedLocations.length} locations)`,
      scanPeriod: { start: new Date(), end: new Date() },
    };

    // Handle output format
    if (options.output === 'json') {
      renderJSON(report);
    } else {
      await renderTable(report, parseInt(options.top || '10'));
    }
    return;
  }

  // Single location scan - delegate to scanSingleLocationAzure which handles all output
  await scanSingleLocationAzure(options.location, options);
}

async function scanSingleLocationAzure(location: string | undefined, options: ScanCommandOptions) {
  const client = new AzureClient({
    subscriptionId: options.subscriptionId,
    location: location,
  });

  // Only show detailed info for single location scans
  if (!options.allRegions) {
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
  }

  // Run analyzers in parallel with error handling
  info('Analyzing Azure resources...');
  const results = await Promise.all([
    safeAnalyze('Azure VMs', () => analyzeAzureVMs(client, options.detailedMetrics || false), options.verbose),
    safeAnalyze('Azure Disks', () => analyzeAzureDisks(client), options.verbose),
    safeAnalyze('Azure Storage', () => analyzeAzureStorage(client), options.verbose),
    safeAnalyze('Azure SQL', () => analyzeAzureSQL(client), options.verbose),
    safeAnalyze('Azure Public IPs', () => analyzeAzurePublicIPs(client), options.verbose),
    safeAnalyze('App Service Plans', () => analyzeAppServicePlans(client), options.verbose),
    safeAnalyze('Azure Functions', () => analyzeAzureFunctions(client), options.verbose),
    safeAnalyze('CosmosDB', () => analyzeCosmosDB(client), options.verbose),
    safeAnalyze('AKS', () => analyzeAKS(client, options.detailedMetrics || false), options.verbose),
  ]);

  // Extract results
  const [
    vmOpportunities,
    diskOpportunities,
    storageOpportunities,
    sqlOpportunities,
    ipOpportunities,
    appServiceOpportunities,
    functionsOpportunities,
    cosmosdbOpportunities,
    aksOpportunities,
  ] = results;

  success(`Found ${vmOpportunities.length} VM opportunities`);
  success(`Found ${diskOpportunities.length} Disk opportunities`);
  success(`Found ${storageOpportunities.length} Storage opportunities`);
  success(`Found ${sqlOpportunities.length} SQL opportunities`);
  success(`Found ${ipOpportunities.length} Public IP opportunities`);
  success(`Found ${appServiceOpportunities.length} App Service opportunities`);
  success(`Found ${functionsOpportunities.length} Azure Functions opportunities`);
  success(`Found ${cosmosdbOpportunities.length} CosmosDB opportunities`);
  success(`Found ${aksOpportunities.length} AKS opportunities`);

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
    ...aksOpportunities,
  ];

  // Tag opportunities with location if in multi-location scan
  if (options.allRegions && location) {
    const locationTag = `[${location}] `;
    allOpportunities.forEach(opp => {
      opp.resourceId = locationTag + opp.resourceId;
    });
  }

  // If in multi-location mode, just return the opportunities
  if (options.allRegions) {
    return allOpportunities;
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
  let allOpportunities: SavingsOpportunity[] = [];
  let scannedRegions: string[] = [];

  if (options.allRegions) {
    info('Scanning all GCP regions...');
    info('This may take a few minutes...\n');

    const regions = [
      'us-central1', 'us-east1', 'us-west1', 'us-west2',
      'europe-west1', 'europe-west2', 'europe-west3',
      'asia-southeast1', 'asia-northeast1', 'asia-east1',
    ];

    info(`Scanning ${regions.length} regions: ${regions.join(', ')}\n`);

    for (const region of regions) {
      try {
        info(`Scanning region: ${region}...`);
        const opportunities = await scanSingleRegionGCP(region, options);

        if (opportunities && opportunities.length > 0) {
          success(`✓ ${region}: Found ${opportunities.length} opportunities`);
          scannedRegions.push(region);
          allOpportunities.push(...opportunities);
        }
      } catch (err: any) {
        info(`⚠️  Skipped ${region}: ${err.message}`);
      }
    }

    success(`\n✓ Completed multi-region scan across ${scannedRegions.length} regions`);

    // Output multi-region results
    const totalPotentialSavings = allOpportunities.reduce((sum, opp) => sum + opp.estimatedSavings, 0);
    const report: ScanReport = {
      opportunities: allOpportunities,
      totalPotentialSavings,
      summary: {
        totalResources: allOpportunities.length,
        idleResources: allOpportunities.filter((o) => o.category === 'idle').length,
        oversizedResources: allOpportunities.filter((o) => o.category === 'oversized').length,
        unusedResources: allOpportunities.filter((o) => o.category === 'unused').length,
      },
      provider: 'gcp',
      accountId: options.projectId || 'unknown',
      region: `multi-region (${scannedRegions.length} regions)`,
      scanPeriod: { start: new Date(), end: new Date() },
    };

    // Handle output format
    if (options.output === 'json') {
      renderJSON(report);
    } else {
      await renderTable(report, parseInt(options.top || '10'));
    }
    return;
  }

  // Single region scan
  await scanSingleRegionGCP(options.region, options);
}

async function scanSingleRegionGCP(region: string | undefined, options: ScanCommandOptions) {
  const client = new GCPClient({
    projectId: options.projectId,
    region: region,
  });

  // Only show detailed info for single region scans
  if (!options.allRegions) {
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
  }

  // Run analyzers in parallel with error handling
  info('Analyzing GCP resources...');
  const results = await Promise.all([
    safeAnalyze('GCE', () => analyzeGCEInstances(client, options.detailedMetrics || false), options.verbose),
    safeAnalyze('GCS', () => analyzeGCSBuckets(client), options.verbose),
    safeAnalyze('Cloud SQL', () => analyzeCloudSQLInstances(client), options.verbose),
    safeAnalyze('Persistent Disks', () => analyzePersistentDisks(client), options.verbose),
    safeAnalyze('Static IPs', () => analyzeStaticIPs(client), options.verbose),
    safeAnalyze('Load Balancers', () => analyzeLoadBalancers(client), options.verbose),
    safeAnalyze('GKE', () => analyzeGKE(client, options.detailedMetrics || false), options.verbose),
  ]);

  // Extract results
  const [
    gceOpportunities,
    gcsOpportunities,
    cloudsqlOpportunities,
    disksOpportunities,
    ipsOpportunities,
    lbOpportunities,
    gkeOpportunities,
  ] = results;

  success(`Found ${gceOpportunities.length} Compute Engine opportunities`);
  success(`Found ${gcsOpportunities.length} Cloud Storage opportunities`);
  success(`Found ${cloudsqlOpportunities.length} Cloud SQL opportunities`);
  success(`Found ${disksOpportunities.length} Persistent Disk opportunities`);
  success(`Found ${ipsOpportunities.length} Static IP opportunities`);
  success(`Found ${lbOpportunities.length} Load Balancer opportunities`);
  success(`Found ${gkeOpportunities.length} GKE opportunities`);

  // Combine opportunities
  const allOpportunities: SavingsOpportunity[] = [
    ...gceOpportunities,
    ...gcsOpportunities,
    ...cloudsqlOpportunities,
    ...disksOpportunities,
    ...ipsOpportunities,
    ...lbOpportunities,
    ...gkeOpportunities,
  ];

  // Tag opportunities with region if in multi-region scan
  if (options.allRegions && region) {
    const regionTag = `[${region}] `;
    allOpportunities.forEach(opp => {
      opp.resourceId = regionTag + opp.resourceId;
    });
  }

  // If in multi-region mode, just return the opportunities
  if (options.allRegions) {
    return allOpportunities;
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
