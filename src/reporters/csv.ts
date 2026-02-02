import { SavingsOpportunity } from '../types/opportunity';
import { unparse } from 'papaparse';

export interface CSVExportOptions {
  includeMetadata?: boolean;
  flattenMetadata?: boolean;
}

/**
 * Export opportunities to CSV format
 */
export function exportToCSV(
  opportunities: SavingsOpportunity[],
  options: CSVExportOptions = {}
): string {
  const { includeMetadata = false, flattenMetadata = true } = options;

  // Transform opportunities into flat objects for CSV
  const rows = opportunities.map((opp, index) => {
    const baseRow: Record<string, any> = {
      rank: index + 1,
      provider: opp.provider.toUpperCase(),
      resource_type: opp.resourceType,
      resource_id: opp.resourceId,
      resource_name: opp.resourceName || '',
      category: opp.category,
      recommendation: opp.recommendation,
      current_cost_monthly: opp.currentCost.toFixed(2),
      estimated_savings_monthly: opp.estimatedSavings.toFixed(2),
      estimated_savings_yearly: (opp.estimatedSavings * 12).toFixed(2),
      confidence: opp.confidence,
      detected_at: opp.detectedAt.toISOString(),
    };

    // Optionally include metadata
    if (includeMetadata && opp.metadata) {
      if (flattenMetadata) {
        // Flatten metadata into columns
        Object.entries(opp.metadata).forEach(([key, value]) => {
          baseRow[`metadata_${key}`] = formatMetadataValue(value);
        });
      } else {
        // Keep metadata as JSON string
        baseRow.metadata = JSON.stringify(opp.metadata);
      }
    }

    return baseRow;
  });

  // Generate CSV using papaparse
  const csv = unparse(rows, {
    header: true,
    columns: includeMetadata && flattenMetadata 
      ? undefined // Auto-detect all columns
      : [
          'rank',
          'provider',
          'resource_type',
          'resource_id',
          'resource_name',
          'category',
          'recommendation',
          'current_cost_monthly',
          'estimated_savings_monthly',
          'estimated_savings_yearly',
          'confidence',
          'detected_at',
          ...(includeMetadata && !flattenMetadata ? ['metadata'] : []),
        ],
  });

  return csv;
}

/**
 * Format metadata values for CSV export
 */
function formatMetadataValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Generate summary statistics row for CSV
 */
export function generateCSVSummary(opportunities: SavingsOpportunity[]): string {
  const totalSavings = opportunities.reduce((sum, opp) => sum + opp.estimatedSavings, 0);
  const totalCurrent = opportunities.reduce((sum, opp) => sum + opp.currentCost, 0);

  const summary = [
    {
      metric: 'Total Opportunities',
      value: opportunities.length,
    },
    {
      metric: 'Total Current Cost (monthly)',
      value: `$${totalCurrent.toFixed(2)}`,
    },
    {
      metric: 'Total Potential Savings (monthly)',
      value: `$${totalSavings.toFixed(2)}`,
    },
    {
      metric: 'Total Potential Savings (yearly)',
      value: `$${(totalSavings * 12).toFixed(2)}`,
    },
    {
      metric: 'Potential Cost Reduction',
      value: `${((totalSavings / totalCurrent) * 100).toFixed(1)}%`,
    },
  ];

  return unparse(summary);
}
