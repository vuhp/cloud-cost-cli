import { SavingsOpportunity } from '../types';
import { ScriptGenerator } from '../services/script-generator';
import { info, error, success } from '../utils/logger';
import chalk from 'chalk';

interface ScriptCommandOptions {
  opportunity: string;  // Index or resource ID
  output?: string;      // file path to save script
}

export async function scriptCommand(options: ScriptCommandOptions) {
  info('Script generation is currently only available after running a scan.');
  info('Usage: cloud-cost-cli scan --provider aws --region us-east-1');
  info('Then use the displayed resource IDs to generate scripts.');
  
  // This is a placeholder - in a real implementation, we'd:
  // 1. Load scan results from a cache/temp file
  // 2. Find the opportunity by index or ID
  // 3. Generate the script
  // 4. Output to file or stdout
  
  error('Script generation requires a recent scan. Run "scan" first.');
  process.exit(1);
}

// Helper function to generate script for a single opportunity
export function generateScriptForOpportunity(opportunity: SavingsOpportunity): string | null {
  const generator = new ScriptGenerator();
  const script = generator.generateRemediation(opportunity);
  
  if (!script) {
    return null;
  }
  
  return generator.renderScript(script);
}
