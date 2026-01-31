// EC2 instance pricing (us-east-1, Linux, on-demand, monthly estimate)
// Source: AWS pricing as of 2026-01, monthly = hourly × 730

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

// EBS pricing (us-east-1, per GB/month)
export const EBS_PRICING: Record<string, number> = {
  gp3: 0.08,
  gp2: 0.10,
  io1: 0.125,
  io2: 0.125,
  st1: 0.045,
  sc1: 0.015,
};

// RDS pricing (us-east-1, per month)
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

// S3 pricing (per GB/month)
export const S3_PRICING = {
  standard: 0.023,
  intelligentTiering: 0.023, // same base, but auto-transitions
  glacier: 0.004,
  glacierDeepArchive: 0.00099,
};

// ELB pricing (per month, excluding LCU charges)
export const ELB_PRICING = {
  alb: 16.43, // Application Load Balancer
  nlb: 16.43, // Network Load Balancer
  clb: 18.25, // Classic Load Balancer
};

// Elastic IP pricing (per hour when not associated)
export const EIP_PRICING_HOURLY = 0.005; // ~$3.65/month

export function getEC2MonthlyCost(instanceType: string): number {
  return EC2_PRICING[instanceType] || 0;
}

export function getEBSMonthlyCost(sizeGB: number, volumeType: string): number {
  const pricePerGB = EBS_PRICING[volumeType] || 0.08;
  return sizeGB * pricePerGB;
}

export function getRDSMonthlyCost(instanceClass: string): number {
  return RDS_PRICING[instanceClass] || 0;
}

export function getS3MonthlyCost(sizeGB: number, storageClass: string = 'standard'): number {
  const pricePerGB = S3_PRICING[storageClass as keyof typeof S3_PRICING] || S3_PRICING.standard;
  return sizeGB * pricePerGB;
}

export function getELBMonthlyCost(type: 'alb' | 'nlb' | 'clb' = 'alb'): number {
  return ELB_PRICING[type];
}

export function getEIPMonthlyCost(): number {
  return EIP_PRICING_HOURLY * 730; // ~$3.65
}
