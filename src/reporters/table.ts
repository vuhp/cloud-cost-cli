import { ScanReport } from '../../types/opportunity.js';
import Table from 'cli-table3';
import chalk from 'chalk';
import { formatCurrency } from '../../utils/formatter.js';

export function renderTable(report: ScanReport, topN: number = 5): void {
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
    .sort((a, b) => b.estimatedSavings - a.estimatedSavings)
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
    head: ['#', 'Type', 'Resource ID', 'Recommendation', 'Savings/mo'],
    colWidths: [5, 10, 25, 50, 15],
    style: {
      head: ['cyan'],
    },
  });

  opportunities.forEach((opp, index) => {
    table.push([
      (index + 1).toString(),
      opp.resourceType.toUpperCase(),
      opp.resourceId,
      opp.recommendation,
      chalk.green(formatCurrency(opp.estimatedSavings)),
    ]);
  });

  console.log(table.toString());

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
    `\nSummary: ${report.summary.totalResources} resources analyzed | ${report.summary.idleResources} idle | ${report.summary.oversizedResources} oversized | ${report.summary.unusedResources} unused\n`
  );
}
