#!/usr/bin/env node
import { Command } from 'commander';
import { scanCommand } from '../src/commands/scan.js';

const program = new Command();

program
  .name('cloud-cost-cli')
  .description('Optimize your cloud spend in seconds')
  .version('0.2.0');

program
  .command('scan')
  .description('Scan cloud account for cost savings')
  .option('--provider <aws|azure>', 'Cloud provider', 'aws')
  .option('--region <region>', 'AWS region (e.g., us-east-1)')
  .option('--profile <profile>', 'AWS profile name', 'default')
  .option('--subscription-id <id>', 'Azure subscription ID')
  .option('--location <location>', 'Azure location filter (e.g., eastus, westus2) - optional, scans all if omitted')
  .option('--top <N>', 'Show top N opportunities', '5')
  .option('--output <table|json|markdown>', 'Output format', 'table')
  .option('--days <N>', 'Analysis period in days', '30')
  .option('--min-savings <amount>', 'Filter by minimum savings ($/month)')
  .option('--accurate', 'Use real-time pricing from AWS (slower but more accurate)')
  .option('--explain', 'AI-powered explanations for top opportunities')
  .option('--ai-provider <openai|ollama>', 'AI provider (default: openai)', 'openai')
  .option('--ai-model <model>', 'AI model (gpt-4o-mini for OpenAI, llama3.2:3b for Ollama)')
  .option('--verbose', 'Verbose logging')
  .action(scanCommand);

program.parse();
