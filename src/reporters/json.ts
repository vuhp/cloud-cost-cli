import { SavingsOpportunity, ScanReport } from '../types';

export function renderJSON(report: ScanReport): void {
  console.log(JSON.stringify(report, null, 2));
}
