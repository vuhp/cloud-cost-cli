import { SavingsOpportunity } from '../types/opportunity';
import * as XLSX from 'xlsx';

export interface ExcelExportOptions {
  includeMetadata?: boolean;
  includeSummarySheet?: boolean;
  includeCharts?: boolean;
}

/**
 * Export opportunities to Excel format (XLSX)
 */
export function exportToExcel(
  opportunities: SavingsOpportunity[],
  options: ExcelExportOptions = {}
): Buffer {
  const { includeMetadata = true, includeSummarySheet = true } = options;

  // Create a new workbook
  const workbook = XLSX.utils.book_new();

  // Add Opportunities sheet
  const opportunitiesData = createOpportunitiesSheet(opportunities, includeMetadata);
  const opportunitiesSheet = XLSX.utils.json_to_sheet(opportunitiesData);
  
  // Auto-size columns
  const maxWidth = 50;
  const columnWidths = Object.keys(opportunitiesData[0] || {}).map((key) => {
    const maxLength = Math.max(
      key.length,
      ...opportunitiesData.map((row: any) => String(row[key] || '').length)
    );
    return { wch: Math.min(maxLength + 2, maxWidth) };
  });
  opportunitiesSheet['!cols'] = columnWidths;

  XLSX.utils.book_append_sheet(workbook, opportunitiesSheet, 'Opportunities');

  // Add Summary sheet
  if (includeSummarySheet) {
    const summaryData = createSummarySheet(opportunities);
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    summarySheet['!cols'] = [{ wch: 35 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
  }

  // Add Breakdown by Category sheet
  const categoryData = createCategoryBreakdown(opportunities);
  const categorySheet = XLSX.utils.json_to_sheet(categoryData);
  categorySheet['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, categorySheet, 'By Category');

  // Add Breakdown by Provider sheet
  const providerData = createProviderBreakdown(opportunities);
  const providerSheet = XLSX.utils.json_to_sheet(providerData);
  providerSheet['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, providerSheet, 'By Provider');

  // Write to buffer
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}

/**
 * Create opportunities sheet data
 */
function createOpportunitiesSheet(
  opportunities: SavingsOpportunity[],
  includeMetadata: boolean
): any[] {
  return opportunities.map((opp, index) => {
    const row: any = {
      Rank: index + 1,
      Provider: opp.provider.toUpperCase(),
      'Resource Type': opp.resourceType,
      'Resource ID': opp.resourceId,
      'Resource Name': opp.resourceName || '',
      Category: opp.category,
      Recommendation: opp.recommendation,
      'Current Cost ($/mo)': parseFloat(opp.currentCost.toFixed(2)),
      'Est. Savings ($/mo)': parseFloat(opp.estimatedSavings.toFixed(2)),
      'Est. Savings ($/yr)': parseFloat((opp.estimatedSavings * 12).toFixed(2)),
      Confidence: opp.confidence,
      'Detected At': opp.detectedAt.toISOString().split('T')[0],
    };

    // Add metadata columns if requested
    if (includeMetadata && opp.metadata) {
      Object.entries(opp.metadata).forEach(([key, value]) => {
        const columnName = `Meta: ${key}`;
        row[columnName] = formatMetadataValue(value);
      });
    }

    return row;
  });
}

/**
 * Create summary sheet data
 */
function createSummarySheet(opportunities: SavingsOpportunity[]): any[] {
  const totalSavings = opportunities.reduce((sum, opp) => sum + opp.estimatedSavings, 0);
  const totalCurrent = opportunities.reduce((sum, opp) => sum + opp.currentCost, 0);
  const savingsPercentage = totalCurrent > 0 ? (totalSavings / totalCurrent) * 100 : 0;

  const highConfidence = opportunities.filter((o) => o.confidence === 'high').length;
  const mediumConfidence = opportunities.filter((o) => o.confidence === 'medium').length;
  const lowConfidence = opportunities.filter((o) => o.confidence === 'low').length;

  return [
    { Metric: 'Total Opportunities Found', Value: opportunities.length },
    { Metric: 'Total Current Cost (monthly)', Value: `$${totalCurrent.toFixed(2)}` },
    { Metric: 'Total Potential Savings (monthly)', Value: `$${totalSavings.toFixed(2)}` },
    { Metric: 'Total Potential Savings (yearly)', Value: `$${(totalSavings * 12).toFixed(2)}` },
    { Metric: 'Potential Cost Reduction', Value: `${savingsPercentage.toFixed(1)}%` },
    { Metric: '', Value: '' },
    { Metric: 'High Confidence Opportunities', Value: highConfidence },
    { Metric: 'Medium Confidence Opportunities', Value: mediumConfidence },
    { Metric: 'Low Confidence Opportunities', Value: lowConfidence },
  ];
}

/**
 * Create category breakdown sheet
 */
function createCategoryBreakdown(opportunities: SavingsOpportunity[]): any[] {
  const categoryMap = new Map<string, { count: number; savings: number; cost: number }>();

  opportunities.forEach((opp) => {
    const existing = categoryMap.get(opp.category) || { count: 0, savings: 0, cost: 0 };
    categoryMap.set(opp.category, {
      count: existing.count + 1,
      savings: existing.savings + opp.estimatedSavings,
      cost: existing.cost + opp.currentCost,
    });
  });

  return Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      Category: category,
      'Opportunities': data.count,
      'Total Savings ($/mo)': parseFloat(data.savings.toFixed(2)),
      'Total Cost ($/mo)': parseFloat(data.cost.toFixed(2)),
    }))
    .sort((a, b) => b['Total Savings ($/mo)'] - a['Total Savings ($/mo)']);
}

/**
 * Create provider breakdown sheet
 */
function createProviderBreakdown(opportunities: SavingsOpportunity[]): any[] {
  const providerMap = new Map<string, { count: number; savings: number; cost: number }>();

  opportunities.forEach((opp) => {
    const provider = opp.provider.toUpperCase();
    const existing = providerMap.get(provider) || { count: 0, savings: 0, cost: 0 };
    providerMap.set(provider, {
      count: existing.count + 1,
      savings: existing.savings + opp.estimatedSavings,
      cost: existing.cost + opp.currentCost,
    });
  });

  return Array.from(providerMap.entries())
    .map(([provider, data]) => ({
      Provider: provider,
      'Opportunities': data.count,
      'Total Savings ($/mo)': parseFloat(data.savings.toFixed(2)),
      'Total Cost ($/mo)': parseFloat(data.cost.toFixed(2)),
    }))
    .sort((a, b) => b['Total Savings ($/mo)'] - a['Total Savings ($/mo)']);
}

/**
 * Format metadata value for display
 */
function formatMetadataValue(value: any): string | number {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}
