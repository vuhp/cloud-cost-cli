import { AIService } from '../services/ai';
import { info, error, success } from '../utils/logger';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

interface AskCommandOptions {
  provider?: string;
  aiProvider?: string;
  aiModel?: string;
  region?: string;
  location?: string;
  subscriptionId?: string;
}

interface ScanCache {
  timestamp: number;
  provider: string;
  region?: string;
  report: any;
}

export async function askCommand(query: string, options: AskCommandOptions) {
  info(`Analyzing: "${query}"`);
  
  // Load most recent scan results
  const scanData = loadRecentScan();
  
  if (!scanData) {
    error('No recent scan found. Please run a scan first:');
    info('  cloud-cost-cli scan --provider aws --region us-east-1');
    process.exit(1);
  }
  
  const ageMinutes = Math.floor((Date.now() - scanData.timestamp) / 60000);
  info(`Using scan from ${ageMinutes} minutes ago (${scanData.provider}${scanData.region ? ', ' + scanData.region : ''})`);
  
  // Initialize AI service
  const provider = (options.aiProvider as 'openai' | 'ollama') || 'openai';
  
  if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
    error('Natural language queries require OPENAI_API_KEY or --ai-provider ollama');
    info('Set it with: export OPENAI_API_KEY="sk-..."');
    process.exit(1);
  }
  
  try {
    const aiService = new AIService({
      provider,
      apiKey: process.env.OPENAI_API_KEY,
      model: options.aiModel,
    });
    
    console.log(chalk.cyan('\n🤔 Thinking...\n'));
    
    const answer = await aiService.answerQuery(query, scanData.report);
    
    console.log(chalk.bold('💡 Answer:\n'));
    console.log(chalk.white(answer.response));
    
    if (answer.suggestions && answer.suggestions.length > 0) {
      console.log(chalk.bold('\n📋 Suggestions:\n'));
      answer.suggestions.forEach((suggestion, i) => {
        console.log(chalk.green(`  ${i + 1}. ${suggestion}`));
      });
    }
    
    if (answer.relatedOpportunities && answer.relatedOpportunities.length > 0) {
      console.log(chalk.bold('\n🎯 Related Opportunities:\n'));
      answer.relatedOpportunities.forEach((opp, i) => {
        console.log(chalk.yellow(`  ${i + 1}. ${opp.resourceId}: ${opp.recommendation} (Save $${opp.estimatedSavings.toFixed(2)}/mo)`));
      });
    }
    
    console.log();
    
  } catch (err: any) {
    error(`Query failed: ${err.message}`);
    process.exit(1);
  }
}

function loadRecentScan(): ScanCache | null {
  const cacheDir = path.join(process.env.HOME || '/tmp', '.cloud-cost-cli', 'scans');
  
  if (!fs.existsSync(cacheDir)) {
    return null;
  }
  
  try {
    const files = fs.readdirSync(cacheDir)
      .filter(f => f.endsWith('.json'))
      .map(f => ({
        path: path.join(cacheDir, f),
        stat: fs.statSync(path.join(cacheDir, f)),
      }))
      .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
    
    if (files.length === 0) {
      return null;
    }
    
    // Get most recent scan (max 24 hours old)
    const mostRecent = files[0];
    const ageMs = Date.now() - mostRecent.stat.mtimeMs;
    
    if (ageMs > 24 * 60 * 60 * 1000) {
      return null; // Too old
    }
    
    const data = fs.readFileSync(mostRecent.path, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return null;
  }
}

export function saveScanCache(provider: string, region: string | undefined, report: any): void {
  const cacheDir = path.join(process.env.HOME || '/tmp', '.cloud-cost-cli', 'scans');
  
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  
  const cache: ScanCache = {
    timestamp: Date.now(),
    provider,
    region,
    report,
  };
  
  const filename = `scan-${provider}-${Date.now()}.json`;
  const filepath = path.join(cacheDir, filename);
  
  try {
    fs.writeFileSync(filepath, JSON.stringify(cache, null, 2), 'utf-8');
    
    // Clean up old scans (keep only last 10)
    const files = fs.readdirSync(cacheDir)
      .filter(f => f.endsWith('.json'))
      .map(f => ({
        path: path.join(cacheDir, f),
        stat: fs.statSync(path.join(cacheDir, f)),
      }))
      .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
    
    // Delete all but the 10 most recent
    files.slice(10).forEach(f => {
      try {
        fs.unlinkSync(f.path);
      } catch (err) {
        // Ignore deletion errors
      }
    });
  } catch (err) {
    // Failed to save cache, not critical
  }
}
