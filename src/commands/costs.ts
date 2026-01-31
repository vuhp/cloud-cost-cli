import { CostTracker } from '../utils/cost-tracker';
import { info } from '../utils/logger';
import chalk from 'chalk';

interface CostsCommandOptions {
  days?: string;
  clear?: boolean;
}

export async function costsCommand(options: CostsCommandOptions) {
  const tracker = new CostTracker();
  
  if (options.clear) {
    tracker.clear();
    info('Cost tracking data cleared');
    return;
  }
  
  const days = parseInt(options.days || '30');
  const summary = tracker.getSummary(days);
  
  console.log(chalk.bold(`\n💰 AI Cost Summary (last ${days} days):\n`));
  
  if (summary.totalOperations === 0) {
    console.log(chalk.dim('No AI operations tracked yet.'));
    console.log(chalk.dim('Use --explain or ask commands to generate AI insights.\n'));
    return;
  }
  
  console.log(chalk.bold('Total:'));
  console.log(`  Operations: ${summary.totalOperations}`);
  console.log(`  Cost: $${summary.totalCost.toFixed(4)}`);
  console.log();
  
  console.log(chalk.bold('By Provider:'));
  Object.entries(summary.byProvider).forEach(([provider, stats]) => {
    const icon = provider === 'openai' ? '☁️ ' : '🏠';
    console.log(`  ${icon} ${provider}:`);
    console.log(`    Operations: ${stats.operations}`);
    console.log(`    Cost: $${stats.cost.toFixed(4)}`);
  });
  console.log();
  
  console.log(chalk.bold('By Model:'));
  Object.entries(summary.byModel).forEach(([model, stats]) => {
    console.log(`  ${model}:`);
    console.log(`    Operations: ${stats.operations}`);
    console.log(`    Cost: $${stats.cost.toFixed(4)}`);
  });
  console.log();
  
  // Show average cost per operation
  const avgCost = summary.totalCost / summary.totalOperations;
  console.log(chalk.dim(`Average cost per operation: $${avgCost.toFixed(4)}`));
  
  // Estimate monthly cost at current rate
  const daysElapsed = days;
  const monthlyEstimate = (summary.totalCost / daysElapsed) * 30;
  if (daysElapsed >= 7) {
    console.log(chalk.dim(`Estimated monthly cost: $${monthlyEstimate.toFixed(2)}`));
  }
  
  console.log();
}
