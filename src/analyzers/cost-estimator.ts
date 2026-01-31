import { PricingService } from './pricing-service';

// Fallback pricing estimates (based on us-east-1, Jan 2026)
// Used when --accurate flag is not set or Pricing API fails

export const EC2_PRICING: Record<string, number> = {
  't2.micro': 8.47,
  't2.small': 16.79,
  't2.medium': 33.87,
  't3.micro': 7.59,
  't3.small': 15.18,
  't3.medium': 30.37,
  't3.large': 60.74,
  't3.xlarge': 121.47,
  'm5.large': 70.08,
  'm5.xlarge': 140.16,
  'm5.2xlarge': 280.32,
  'm6i.large': 69.35,
  'm6i.xlarge': 138.70,
  'c5.large': 62.05,
  'c5.xlarge': 124.10,
  'r5.large': 91.25,
  'r5.xlarge': 182.50,
};

export const EBS_PRICING: Record<string, number> = {
  gp3: 0.08,
  gp2: 0.10,
  io1: 0.125,
  io2: 0.125,
  st1: 0.045,
  sc1: 0.015,
};

export const RDS_PRICING: Record<string, number> = {
  'db.t3.micro': 11.01,
  'db.t3.small': 22.63,
  'db.t3.medium': 45.26,
  'db.t3.large': 90.51,
  'db.m5.large': 127.75,
  'db.m5.xlarge': 255.50,
  'db.r5.large': 175.20,
  'db.r5.xlarge': 350.40,
  'db.r5.2xlarge': 700.80,
};

export const S3_PRICING = {
  standard: 0.023,
  intelligentTiering: 0.023,
  glacier: 0.004,
  glacierDeepArchive: 0.00099,
};

export const ELB_PRICING = {
  alb: 16.43,
  nlb: 16.43,
  clb: 18.25,
};

export const EIP_PRICING_HOURLY = 0.005;

/**
 * Cost estimator with support for both estimate and accurate modes
 */
export class CostEstimator {
  private pricingService?: PricingService;
  private useAccuratePricing: boolean;

  constructor(region: string, accurate: boolean = false) {
    this.useAccuratePricing = accurate;
    if (accurate) {
      this.pricingService = new PricingService(region);
    }
  }

  async getEC2MonthlyCost(instanceType: string): Promise<number> {
    if (this.useAccuratePricing && this.pricingService) {
      try {
        return await this.pricingService.getEC2Price(instanceType);
      } catch (error) {
        // Fallback to estimate if API fails
      }
    }
    return EC2_PRICING[instanceType] || 50; // Generic estimate if type unknown
  }

  async getEBSMonthlyCost(sizeGB: number, volumeType: string): Promise<number> {
    let pricePerGB: number;

    if (this.useAccuratePricing && this.pricingService) {
      try {
        pricePerGB = await this.pricingService.getEBSPrice(volumeType);
      } catch (error) {
        pricePerGB = EBS_PRICING[volumeType] || 0.08;
      }
    } else {
      pricePerGB = EBS_PRICING[volumeType] || 0.08;
    }

    return sizeGB * pricePerGB;
  }

  async getRDSMonthlyCost(instanceClass: string, engine?: string): Promise<number> {
    if (this.useAccuratePricing && this.pricingService && engine) {
      try {
        return await this.pricingService.getRDSPrice(instanceClass, engine);
      } catch (error) {
        // Fallback to estimate
      }
    }
    return RDS_PRICING[instanceClass] || 100;
  }

  getS3MonthlyCost(sizeGB: number, storageClass: string = 'standard'): number {
    const pricePerGB = S3_PRICING[storageClass as keyof typeof S3_PRICING] || S3_PRICING.standard;
    return sizeGB * pricePerGB;
  }

  getELBMonthlyCost(type: 'alb' | 'nlb' | 'clb' = 'alb'): number {
    return ELB_PRICING[type];
  }

  getEIPMonthlyCost(): number {
    return EIP_PRICING_HOURLY * 730; // ~$3.65
  }
}

// Legacy exports for backwards compatibility
export function getEC2MonthlyCost(instanceType: string): number {
  return EC2_PRICING[instanceType] || 50;
}

export function getEBSMonthlyCost(sizeGB: number, volumeType: string): number {
  const pricePerGB = EBS_PRICING[volumeType] || 0.08;
  return sizeGB * pricePerGB;
}

export function getRDSMonthlyCost(instanceClass: string): number {
  return RDS_PRICING[instanceClass] || 100;
}

export function getS3MonthlyCost(sizeGB: number, storageClass: string = 'standard'): number {
  const pricePerGB = S3_PRICING[storageClass as keyof typeof S3_PRICING] || S3_PRICING.standard;
  return sizeGB * pricePerGB;
}

export function getELBMonthlyCost(type: 'alb' | 'nlb' | 'clb' = 'alb'): number {
  return ELB_PRICING[type];
}

export function getEIPMonthlyCost(): number {
  return EIP_PRICING_HOURLY * 730;
}
