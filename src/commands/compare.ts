import { ScanReport, SavingsOpportunity } from '../types/opportunity';
import * as fs from 'fs';
import * as path from 'path';
import { info, success, warn } from '../utils/logger';

interface CompareOptions {
  from?: string;
  to?: string;
  output?: string;
}

interface ComparisonResult {
  newOpportunities: SavingsOpportunity[];
  resolvedOpportunities: SavingsOpportunity[];
  improvedOpportunities: SavingsOpportunity[];
  worsenedOpportunities: SavingsOpportunity[];
  unchangedOpportunities: SavingsOpportunity[];
  summary: {
    fromSavings: number;
    toSavings: number;
    netChange: number;
    newCount: number;
    resolvedCount: number;
  };
}

export function saveReport(report: ScanReport): string {
  const reportsDir = getReportsDirectory();
  
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `scan-${report.provider}-${report.region.replace(/\s+/g, '-')}-${timestamp}.json`;
  const filepath = path.join(reportsDir, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
  
  return filepath;
}

export async function compareCommand(options: CompareOptions) {
  try {
    const reportsDir = getReportsDirectory();
    
    // Find reports to compare
    let fromReport: ScanReport;
    let toReport: ScanReport;
    
    if (options.from && options.to) {
      // Use specific reports
      fromReport = loadReport(options.from);
      toReport = loadReport(options.to);
    } else {
      // Use most recent two reports
      const reports = findRecentReports(reportsDir);
      if (reports.length < 2) {
        throw new Error('Need at least 2 saved reports to compare. Run "cloud-cost-cli scan" at least twice.');
      }
      
      toReport = loadReport(reports[0]); // Most recent
      fromReport = loadReport(reports[1]); // Second most recent
      
      info(`Comparing latest reports:`);
      info(`  From: ${reports[1]} (${new Date(fromReport.scanPeriod.end).toLocaleDateString()})`);
      info(`  To: ${reports[0]} (${new Date(toReport.scanPeriod.end).toLocaleDateString()})`);
    }
    
    // Perform comparison
    const result = compareScans(fromReport, toReport);
    
    // Output results
    outputComparison(result, options.output);
    
  } catch (err: any) {
    console.error(`Comparison failed: ${err.message}`);
    process.exit(1);
  }
}

function getReportsDirectory(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
  return path.join(homeDir, '.cloud-cost-cli', 'reports');
}

function findRecentReports(reportsDir: string): string[] {
  if (!fs.existsSync(reportsDir)) {
    return [];
  }
  
  return fs.readdirSync(reportsDir)
    .filter(f => f.endsWith('.json'))
    .map(f => path.join(reportsDir, f))
    .sort((a, b) => {
      return fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime();
    });
}

function loadReport(reportPath: string): ScanReport {
  const fullPath = path.isAbsolute(reportPath) 
    ? reportPath 
    : path.join(getReportsDirectory(), reportPath);
    
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Report not found: ${fullPath}`);
  }
  
  return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
}

function compareScans(from: ScanReport, to: ScanReport): ComparisonResult {
  const fromMap = new Map(from.opportunities.map(o => [getOpportunityKey(o), o]));
  const toMap = new Map(to.opportunities.map(o => [getOpportunityKey(o), o]));
  
  const newOpportunities: SavingsOpportunity[] = [];
  const resolvedOpportunities: SavingsOpportunity[] = [];
  const improvedOpportunities: SavingsOpportunity[] = [];
  const worsenedOpportunities: SavingsOpportunity[] = [];
  const unchangedOpportunities: SavingsOpportunity[] = [];
  
  // Find new opportunities (in 'to' but not in 'from')
  for (const [key, opp] of toMap) {
    if (!fromMap.has(key)) {
      newOpportunities.push(opp);
    }
  }
  
  // Find resolved opportunities (in 'from' but not in 'to')
  for (const [key, opp] of fromMap) {
    if (!toMap.has(key)) {
      resolvedOpportunities.push(opp);
    }
  }
  
  // Find changed opportunities (in both, but different savings)
  for (const [key, fromOpp] of fromMap) {
    const toOpp = toMap.get(key);
    if (toOpp) {
      const savingsDiff = toOpp.estimatedSavings - fromOpp.estimatedSavings;
      const percentChange = fromOpp.estimatedSavings > 0 
        ? (savingsDiff / fromOpp.estimatedSavings) * 100 
        : 0;
      
      if (Math.abs(percentChange) > 5) { // More than 5% change
        if (savingsDiff > 0) {
          worsenedOpportunities.push({
            ...toOpp,
            estimatedSavings: savingsDiff, // Show the increase
          });
        } else {
          improvedOpportunities.push({
            ...toOpp,
            estimatedSavings: Math.abs(savingsDiff), // Show the decrease
          });
        }
      } else {
        unchangedOpportunities.push(toOpp);
      }
    }
  }
  
  return {
    newOpportunities,
    resolvedOpportunities,
    improvedOpportunities,
    worsenedOpportunities,
    unchangedOpportunities,
    summary: {
      fromSavings: from.totalPotentialSavings,
      toSavings: to.totalPotentialSavings,
      netChange: to.totalPotentialSavings - from.totalPotentialSavings,
      newCount: newOpportunities.length,
      resolvedCount: resolvedOpportunities.length,
    },
  };
}

function getOpportunityKey(opp: SavingsOpportunity): string {
  // Create a unique key based on resource type and ID
  return `${opp.provider}:${opp.resourceType}:${opp.resourceId}`;
}

function outputComparison(result: ComparisonResult, outputFormat?: string) {
  if (outputFormat === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  
  // Terminal output
  console.log('\n📊 Cost Optimization Comparison Report\n');
  
  // Summary
  console.log('Summary:');
  console.log(`  Previous potential savings: $${result.summary.fromSavings.toFixed(2)}/month`);
  console.log(`  Current potential savings:  $${result.summary.toSavings.toFixed(2)}/month`);
  
  const changeEmoji = result.summary.netChange > 0 ? '📈' : result.summary.netChange < 0 ? '📉' : '➡️';
  const changeSign = result.summary.netChange > 0 ? '+' : '';
  console.log(`  Net change: ${changeEmoji} $${changeSign}${result.summary.netChange.toFixed(2)}/month`);
  
  if (result.summary.netChange > 0) {
    warn('\n  ⚠️  Potential savings INCREASED - review new opportunities');
  } else if (result.summary.netChange < 0) {
    success('\n  ✅ Potential savings DECREASED - great progress!');
  }
  
  console.log('\n' + '─'.repeat(70));
  
  // New opportunities
  if (result.newOpportunities.length > 0) {
    console.log(`\n🆕 New Opportunities (${result.newOpportunities.length}):`);
    result.newOpportunities
      .sort((a, b) => b.estimatedSavings - a.estimatedSavings)
      .slice(0, 5)
      .forEach(opp => {
        console.log(`  • ${opp.resourceType}: ${opp.resourceId.substring(0, 50)}`);
        console.log(`    $${opp.estimatedSavings.toFixed(2)}/month - ${opp.recommendation.substring(0, 60)}`);
      });
    if (result.newOpportunities.length > 5) {
      console.log(`  ... and ${result.newOpportunities.length - 5} more`);
    }
  }
  
  // Resolved opportunities
  if (result.resolvedOpportunities.length > 0) {
    console.log(`\n✅ Resolved Opportunities (${result.resolvedOpportunities.length}):`);
    const totalSavings = result.resolvedOpportunities.reduce((sum, o) => sum + o.estimatedSavings, 0);
    console.log(`   Total savings achieved: $${totalSavings.toFixed(2)}/month`);
    
    result.resolvedOpportunities
      .sort((a, b) => b.estimatedSavings - a.estimatedSavings)
      .slice(0, 3)
      .forEach(opp => {
        console.log(`  • ${opp.resourceType}: ${opp.resourceId.substring(0, 50)} ($${opp.estimatedSavings.toFixed(2)}/month saved)`);
      });
  }
  
  // Improved opportunities
  if (result.improvedOpportunities.length > 0) {
    const totalImprovement = result.improvedOpportunities.reduce((sum, o) => sum + o.estimatedSavings, 0);
    console.log(`\n📉 Improved Opportunities (${result.improvedOpportunities.length}):`);
    console.log(`   Savings reduced by: $${totalImprovement.toFixed(2)}/month`);
    result.improvedOpportunities.slice(0, 3).forEach(opp => {
      console.log(`  • ${opp.resourceType}: ${opp.resourceId.substring(0, 50)} ($${opp.estimatedSavings.toFixed(2)}/month improvement)`);
    });
  }
  
  // Worsened opportunities
  if (result.worsenedOpportunities.length > 0) {
    const totalWorsening = result.worsenedOpportunities.reduce((sum, o) => sum + o.estimatedSavings, 0);
    console.log(`\n📈 Worsened Opportunities (${result.worsenedOpportunities.length}):`);
    console.log(`   Additional waste: $${totalWorsening.toFixed(2)}/month`);
    result.worsenedOpportunities.slice(0, 3).forEach(opp => {
      console.log(`  • ${opp.resourceType}: ${opp.resourceId.substring(0, 50)} ($${opp.estimatedSavings.toFixed(2)}/month increase)`);
    });
  }
  
  console.log('\n' + '─'.repeat(70));
  console.log(`\n💡 Total: ${result.summary.newCount} new, ${result.summary.resolvedCount} resolved`);
  console.log(`\nNext scan will show if improvements continue...\n`);
}
