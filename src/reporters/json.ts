import { ScanReport } from '../../types/opportunity.js';

export function renderJSON(report: ScanReport): void {
  console.log(JSON.stringify(report, null, 2));
}
