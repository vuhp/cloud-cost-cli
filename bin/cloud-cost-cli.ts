#!/usr/bin/env node
import { Command } from 'commander';
import { scanCommand } from '../src/commands/scan.js';

const program = new Command();

program
  .name('cloud-cost-cli')
  .description('Optimize your cloud spend in seconds')
  .version('0.1.0');

program
  .command('scan')
  .description('Scan cloud account for cost savings')
  .option('--provider <aws|gcp|azure>', 'Cloud provider', 'aws')
  .option('--region <region>', 'Cloud region (e.g., us-east-1)')
  .option('--profile <profile>', 'AWS profile name', 'default')
  .option('--top <N>', 'Show top N opportunities', '5')
  .option('--output <table|json|markdown>', 'Output format', 'table')
  .option('--days <N>', 'Analysis period in days', '30')
  .option('--min-savings <amount>', 'Filter by minimum savings ($/month)')
  .option('--verbose', 'Verbose logging')
  .action(scanCommand);

program.parse();
