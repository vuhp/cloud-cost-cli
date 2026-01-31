import { ScanReport } from './opportunity';

export interface CloudProvider {
  name: string;
  scan(options: ScanOptions): Promise<ScanReport>;
}

export interface ScanOptions {
  region?: string;
  profile?: string;
  startDate?: Date;
  endDate?: Date;
  thresholds?: {
    idleCpuPercent?: number;
    minAgeDays?: number;
  };
}
