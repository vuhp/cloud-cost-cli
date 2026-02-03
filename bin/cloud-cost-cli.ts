#!/usr/bin/env node
import { Command } from 'commander';
import { scanCommand } from '../src/commands/scan.js';
import { askCommand } from '../src/commands/ask.js';
import { configCommand } from '../src/commands/config.js';
import { costsCommand } from '../src/commands/costs.js';
import { compareCommand } from '../src/commands/compare.js';

const program = new Command();

program
  .name('cloud-cost-cli')
  .description('Optimize your cloud spend in seconds')
  .version('0.6.3');

program
  .command('scan')
  .description('Scan cloud account for cost savings')
  .option('--provider <aws|azure|gcp>', 'Cloud provider', 'aws')
  .option('--region <region>', 'Cloud region (e.g., us-east-1 for AWS, us-central1 for GCP)')
  .option('--all-regions', 'Scan all AWS regions (AWS only)')
  .option('--profile <profile>', 'AWS profile name', 'default')
  .option('--subscription-id <id>', 'Azure subscription ID')
  .option('--location <location>', 'Azure location filter (e.g., eastus, westus2) - optional, scans all if omitted')
  .option('--project-id <id>', 'GCP project ID')
  .option('--top <N>', 'Show top N opportunities', '5')
  .option('--output <format>', 'Output format: table, json, csv, excel, html', 'table')
  .option('--days <N>', 'Analysis period in days', '30')
  .option('--min-savings <amount>', 'Filter by minimum savings ($/month)')
  .option('--accurate', 'Use real-time pricing from AWS (slower but more accurate)')
  .option('--explain', 'AI-powered explanations for top opportunities')
  .option('--ai-provider <openai|ollama>', 'AI provider (reads from config if not specified)')
  .option('--ai-model <model>', 'AI model (gpt-4o-mini for OpenAI, llama3.2:3b for Ollama)')
  .option('--verbose', 'Verbose logging')
  .action(scanCommand);

program
  .command('ask <query>')
  .description('Ask natural language questions about your cloud costs')
  .option('--ai-provider <openai|ollama>', 'AI provider (reads from config if not specified)')
  .option('--ai-model <model>', 'AI model to use')
  .action(askCommand);

program
  .command('config <action> [key] [value]')
  .description('Manage configuration (actions: init, show, get, set, path)')
  .action(configCommand);

program
  .command('costs')
  .description('Show AI usage costs')
  .option('--days <N>', 'Number of days to include', '30')
  .option('--clear', 'Clear cost tracking data')
  .action(costsCommand);

program
  .command('compare')
  .description('Compare two scan reports to track progress')
  .option('--from <path>', 'Path to older scan report')
  .option('--to <path>', 'Path to newer scan report')
  .option('--output <format>', 'Output format: table, json', 'table')
  .action(compareCommand);

program.parse();
