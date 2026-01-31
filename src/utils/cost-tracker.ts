import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface CostEntry {
  timestamp: number;
  provider: 'openai' | 'ollama';
  model: string;
  operation: 'explanation' | 'query';
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
}

export interface CostSummary {
  totalCost: number;
  totalOperations: number;
  byProvider: {
    [key: string]: {
      cost: number;
      operations: number;
    };
  };
  byModel: {
    [key: string]: {
      cost: number;
      operations: number;
    };
  };
}

export class CostTracker {
  private logPath: string;

  constructor() {
    const logDir = path.join(os.homedir(), '.cloud-cost-cli', 'costs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    this.logPath = path.join(logDir, 'usage.jsonl');
  }

  track(entry: Omit<CostEntry, 'timestamp' | 'estimatedCost'>): void {
    const cost = this.calculateCost(entry.provider, entry.model, entry.inputTokens, entry.outputTokens);
    
    const fullEntry: CostEntry = {
      ...entry,
      timestamp: Date.now(),
      estimatedCost: cost,
    };

    try {
      fs.appendFileSync(this.logPath, JSON.stringify(fullEntry) + '\n', 'utf-8');
    } catch (error) {
      // Failed to log, not critical
    }
  }

  getSummary(daysBack: number = 30): CostSummary {
    const cutoff = Date.now() - (daysBack * 24 * 60 * 60 * 1000);
    
    const summary: CostSummary = {
      totalCost: 0,
      totalOperations: 0,
      byProvider: {},
      byModel: {},
    };

    if (!fs.existsSync(this.logPath)) {
      return summary;
    }

    try {
      const content = fs.readFileSync(this.logPath, 'utf-8');
      const lines = content.trim().split('\n').filter(l => l.length > 0);

      for (const line of lines) {
        try {
          const entry: CostEntry = JSON.parse(line);
          
          if (entry.timestamp < cutoff) {
            continue;
          }

          summary.totalCost += entry.estimatedCost;
          summary.totalOperations++;

          // By provider
          if (!summary.byProvider[entry.provider]) {
            summary.byProvider[entry.provider] = { cost: 0, operations: 0 };
          }
          summary.byProvider[entry.provider].cost += entry.estimatedCost;
          summary.byProvider[entry.provider].operations++;

          // By model
          if (!summary.byModel[entry.model]) {
            summary.byModel[entry.model] = { cost: 0, operations: 0 };
          }
          summary.byModel[entry.model].cost += entry.estimatedCost;
          summary.byModel[entry.model].operations++;
        } catch (e) {
          // Skip invalid lines
        }
      }
    } catch (error) {
      // Failed to read log
    }

    return summary;
  }

  clear(): void {
    try {
      if (fs.existsSync(this.logPath)) {
        fs.unlinkSync(this.logPath);
      }
    } catch (error) {
      // Failed to clear
    }
  }

  private calculateCost(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    if (provider === 'ollama') {
      return 0; // Local, free
    }

    // OpenAI pricing (as of 2024)
    // https://openai.com/pricing
    const pricing: { [key: string]: { input: number; output: number } } = {
      'gpt-4o': { input: 2.50 / 1_000_000, output: 10.00 / 1_000_000 },
      'gpt-4o-mini': { input: 0.150 / 1_000_000, output: 0.600 / 1_000_000 },
      'gpt-4-turbo': { input: 10.00 / 1_000_000, output: 30.00 / 1_000_000 },
      'gpt-4': { input: 30.00 / 1_000_000, output: 60.00 / 1_000_000 },
      'gpt-3.5-turbo': { input: 0.50 / 1_000_000, output: 1.50 / 1_000_000 },
    };

    const modelPricing = pricing[model] || pricing['gpt-4o-mini']; // Default fallback

    return (inputTokens * modelPricing.input) + (outputTokens * modelPricing.output);
  }
}
