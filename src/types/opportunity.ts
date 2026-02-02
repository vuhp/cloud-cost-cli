export interface SavingsOpportunity {
  id: string;
  provider: 'aws' | 'gcp' | 'azure';
  resourceType: string;
  resourceId: string;
  resourceName?: string;
  category: 'idle' | 'oversized' | 'unused' | 'misconfigured' | 'underutilized';
  currentCost: number;
  estimatedSavings: number;
  confidence: 'high' | 'medium' | 'low';
  recommendation: string;
  metadata: Record<string, any>;
  detectedAt: Date;
}

export interface ScanReport {
  provider: string;
  accountId: string;
  region: string;
  scanPeriod: {
    start: Date;
    end: Date;
  };
  opportunities: SavingsOpportunity[];
  totalPotentialSavings: number;
  summary: {
    totalResources: number;
    idleResources: number;
    oversizedResources: number;
    unusedResources: number;
  };
}
