#!/usr/bin/env node
/**
 * Test script to generate a sample HTML report
 * Run with: node test-html-export.js
 */

import { exportToHtml } from '../dist/src/reporters/html.js';
import fs from 'fs';

// Sample opportunities data
const sampleOpportunities = [
  {
    provider: 'aws',
    resourceType: 'EC2',
    resourceId: 'i-0abc123def456789',
    recommendation: 'Stop idle EC2 instance (0% CPU utilization over 30 days)',
    estimatedSavings: 65.50,
    confidence: 'high',
  },
  {
    provider: 'aws',
    resourceType: 'EBS',
    resourceId: 'vol-0xyz789abc123456',
    recommendation: 'Delete unattached EBS volume (detached for 45 days)',
    estimatedSavings: 40.00,
    confidence: 'high',
  },
  {
    provider: 'aws',
    resourceType: 'RDS',
    resourceId: 'mydb-production',
    recommendation: 'Downsize RDS instance from db.m5.large to db.t3.medium (avg CPU: 15%)',
    estimatedSavings: 180.00,
    confidence: 'medium',
  },
  {
    provider: 'aws',
    resourceType: 'Lambda',
    resourceId: 'process-orders',
    recommendation: 'Reduce Lambda memory from 3008MB to 1024MB (avg usage: 512MB)',
    estimatedSavings: 125.00,
    confidence: 'high',
  },
  {
    provider: 'aws',
    resourceType: 'DynamoDB',
    resourceId: 'sessions-table',
    recommendation: 'Switch to on-demand pricing (provisioned capacity unused 85% of time)',
    estimatedSavings: 92.00,
    confidence: 'medium',
  },
  {
    provider: 'aws',
    resourceType: 'NAT Gateway',
    resourceId: 'nat-0123456789abcdef',
    recommendation: 'Remove unused NAT Gateway (0 GB data processed in 30 days)',
    estimatedSavings: 32.40,
    confidence: 'high',
  },
  {
    provider: 'aws',
    resourceType: 'ElastiCache',
    resourceId: 'redis-cluster-prod',
    recommendation: 'Downsize from cache.r5.large to cache.t3.medium (avg CPU: 12%)',
    estimatedSavings: 156.00,
    confidence: 'medium',
  },
  {
    provider: 'azure',
    resourceType: 'App Service Plan',
    resourceId: 'ASP-production-premium',
    recommendation: 'Delete empty App Service Plan (0 apps deployed)',
    estimatedSavings: 292.00,
    confidence: 'high',
  },
  {
    provider: 'azure',
    resourceType: 'CosmosDB',
    resourceId: 'cosmosdb-analytics',
    recommendation: 'Reduce provisioned throughput from 5000 RU/s to 1000 RU/s (avg usage: 800 RU/s)',
    estimatedSavings: 520.00,
    confidence: 'high',
  },
  {
    provider: 'azure',
    resourceType: 'Virtual Machine',
    resourceId: 'vm-staging-server',
    recommendation: 'Stop VM outside business hours (runs 24/7, only needed 9-5)',
    estimatedSavings: 240.00,
    confidence: 'medium',
  },
  {
    provider: 'gcp',
    resourceType: 'Compute Engine',
    resourceId: 'instance-test-server',
    recommendation: 'Delete idle VM (0% CPU for 60 days)',
    estimatedSavings: 73.00,
    confidence: 'high',
  },
  {
    provider: 'aws',
    resourceType: 'S3',
    resourceId: 'logs-bucket-2023',
    recommendation: 'Apply lifecycle policy to transition old logs to Glacier (2TB of logs > 90 days old)',
    estimatedSavings: 48.00,
    confidence: 'high',
  },
  {
    provider: 'aws',
    resourceType: 'ELB',
    resourceId: 'elb-old-staging',
    recommendation: 'Delete unused load balancer (0 requests in 30 days)',
    estimatedSavings: 18.00,
    confidence: 'high',
  },
  {
    provider: 'aws',
    resourceType: 'EIP',
    resourceId: '54.123.45.67',
    recommendation: 'Release unattached Elastic IP',
    estimatedSavings: 3.60,
    confidence: 'high',
  },
  {
    provider: 'azure',
    resourceType: 'Public IP',
    resourceId: 'pip-unused-eastus',
    recommendation: 'Delete unattached public IP address',
    estimatedSavings: 4.00,
    confidence: 'high',
  },
];

// Calculate total savings
const totalSavings = sampleOpportunities.reduce((sum, opp) => sum + opp.estimatedSavings, 0);

console.log('Generating sample HTML report...');
console.log(`Total opportunities: ${sampleOpportunities.length}`);
console.log(`Total potential savings: $${totalSavings.toFixed(2)}/month`);

// Generate HTML
const html = exportToHtml(sampleOpportunities, {
  provider: 'aws',
  region: 'us-east-1',
  totalSavings: totalSavings,
  scanDate: new Date(),
}, {
  includeCharts: true,
  theme: 'light',
});

// Save to file
const filename = `cloud-cost-report-sample-${Date.now()}.html`;
fs.writeFileSync(filename, html);

console.log(`✓ Report saved to ${filename}`);
console.log(`\nOpen it in your browser to see the result!`);
console.log(`\nYou can also:`);
console.log(`  - Email the file as an attachment`);
console.log(`  - Print to PDF from your browser`);
console.log(`  - Host on GitHub Pages or S3`);
