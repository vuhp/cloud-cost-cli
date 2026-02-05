import { SavingsOpportunity, ScanReport } from '../types';
import Table from 'cli-table3';
import chalk from 'chalk';
import { formatCurrency } from '../utils';
import { AIService, AIExplanation } from '../services/ai';

export async function renderTable(
  report: ScanReport,
  topN: number = 5,
  aiService?: AIService
): Promise<void> {
  console.log(chalk.bold('\nCloud Cost Optimization Report'));
  console.log(
    `Provider: ${report.provider} | Region: ${report.region} | Account: ${report.accountId}`
  );
  console.log(
    `Analyzed: ${report.scanPeriod.start.toISOString().split('T')[0]} to ${
      report.scanPeriod.end.toISOString().split('T')[0]
    }\n`
  );

  const opportunities = report.opportunities
    .sort((a: SavingsOpportunity, b: SavingsOpportunity) => b.estimatedSavings - a.estimatedSavings)
    .slice(0, topN);

  if (opportunities.length === 0) {
    console.log(chalk.green('✓ No cost optimization opportunities found!'));
    return;
  }

  console.log(
    chalk.bold(
      `Top ${opportunities.length} Savings Opportunities (est. ${formatCurrency(
        report.totalPotentialSavings
      )}/month):\n`
    )
  );

  const table = new Table({
    head: ['#', 'Type', 'Resource ID', 'Recommendation', 'Confidence', 'Savings/mo'],
    colWidths: [5, 12, 40, 50, 12, 15],
    wordWrap: true,
    style: {
      head: ['cyan'],
    },
  });

  opportunities.forEach((opp: SavingsOpportunity, index: number) => {
    const confidenceColor = 
      opp.confidence === 'high' ? chalk.green :
      opp.confidence === 'medium' ? chalk.yellow :
      chalk.red;
    
    table.push([
      (index + 1).toString(),
      opp.resourceType.toUpperCase(),
      opp.resourceId,
      opp.recommendation,
      confidenceColor(opp.confidence.toUpperCase()),
      chalk.green(formatCurrency(opp.estimatedSavings)),
    ]);
  });

  console.log(table.toString());

  // Show AI explanations if enabled
  if (aiService && aiService.isEnabled()) {
    console.log(chalk.bold('\n🤖 AI-Powered Insights:\n'));
    
    const maxExplanations = aiService.getMaxExplanations();
    const opportunitiesToExplain = opportunities.slice(0, Math.min(maxExplanations, opportunities.length));
    
    for (let i = 0; i < opportunitiesToExplain.length; i++) {
      const opp = opportunitiesToExplain[i];
      try {
        console.log(chalk.cyan(`Analyzing opportunity #${i + 1}...`));
        const explanation = await aiService.explainOpportunity(opp);
        
        const cacheIndicator = explanation.cached ? chalk.dim(' (cached)') : '';
        console.log(chalk.bold(`\n💡 Opportunity #${i + 1}: ${opp.resourceId}${cacheIndicator}`));
        console.log(chalk.dim('─'.repeat(80)));
        console.log(chalk.white(explanation.summary));
        console.log();
        console.log(chalk.bold('Why this is wasteful:'));
        console.log(explanation.whyWasteful);
        
        if (explanation.actionPlan.length > 0) {
          console.log();
          console.log(chalk.bold('Action plan:'));
          explanation.actionPlan.forEach((step) => {
            console.log(chalk.green(`  ${step}`));
          });
        }
        
        console.log();
        console.log(`Risk: ${getRiskEmoji(explanation.riskLevel)} ${explanation.riskLevel.toUpperCase()}`);
        console.log(`Time: ⏱️  ${explanation.estimatedTime}`);
        
        // Try to generate remediation script
        try {
          const script = await aiService.generateRemediationScript(opp);
          if (script) {
            console.log();
            console.log(chalk.bold('🔧 Remediation Script:'));
            console.log(chalk.dim('─'.repeat(80)));
            console.log(chalk.gray(script));
          }
        } catch (error: any) {
          // Script generation failed, skip silently
        }
        
        console.log();
      } catch (error: any) {
        console.log(chalk.yellow(`⚠️  AI explanation failed: ${error.message}`));
      }
    }
  }

  // Show total count if there are more opportunities
  if (report.opportunities.length > topN) {
    console.log(
      chalk.dim(`\n... and ${report.opportunities.length - topN} more opportunities (use --top ${report.opportunities.length} to see all)`)
    );
  }

  console.log(
    chalk.bold(
      `\nTotal potential savings: ${chalk.green(
        formatCurrency(report.totalPotentialSavings)
      )}/month (${chalk.green(
        formatCurrency(report.totalPotentialSavings * 12)
      )}/year)`
    )
  );

  console.log(
    `\nSummary: ${report.summary.totalResources} resources analyzed | ${report.summary.idleResources} idle | ${report.summary.oversizedResources} oversized | ${report.summary.unusedResources} unused`
  );

  console.log(
    chalk.dim(`\n💡 Note: Cost estimates based on us-east-1 pricing and may vary by region.`)
  );
  console.log(chalk.dim(`   For more accurate estimates, actual costs depend on your usage and region.\n`));
}

function getRiskEmoji(risk: string): string {
  switch (risk) {
    case 'low':
      return '✅';
    case 'medium':
      return '⚠️';
    case 'high':
      return '🚨';
    default:
      return '❓';
  }
}
