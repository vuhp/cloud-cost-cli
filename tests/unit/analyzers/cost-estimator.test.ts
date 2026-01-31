import { describe, it, expect } from 'vitest';
import {
  getEC2MonthlyCost,
  getEBSMonthlyCost,
  getRDSMonthlyCost,
  getS3MonthlyCost,
  getELBMonthlyCost,
  getEIPMonthlyCost,
  CostEstimator,
} from '../../../src/analyzers/cost-estimator';

describe('Cost Estimator - Legacy Functions', () => {
  describe('getEC2MonthlyCost', () => {
    it('should return correct cost for known instance types', () => {
      expect(getEC2MonthlyCost('t3.micro')).toBe(7.59);
      expect(getEC2MonthlyCost('t3.small')).toBe(15.18);
      expect(getEC2MonthlyCost('t3.medium')).toBe(30.37);
      expect(getEC2MonthlyCost('m5.large')).toBe(70.08);
    });

    it('should return fallback estimate for unknown instance types', () => {
      expect(getEC2MonthlyCost('unknown.type')).toBe(50);
    });
  });

  describe('getEBSMonthlyCost', () => {
    it('should calculate cost for gp3 volumes', () => {
      expect(getEBSMonthlyCost(100, 'gp3')).toBe(8); // 100 GB × $0.08
      expect(getEBSMonthlyCost(500, 'gp3')).toBe(40); // 500 GB × $0.08
    });

    it('should calculate cost for gp2 volumes', () => {
      expect(getEBSMonthlyCost(100, 'gp2')).toBe(10); // 100 GB × $0.10
    });

    it('should use fallback for unknown volume types', () => {
      expect(getEBSMonthlyCost(100, 'unknown')).toBe(8); // 100 GB × $0.08 (default)
    });

    it('should handle zero size', () => {
      expect(getEBSMonthlyCost(0, 'gp3')).toBe(0);
    });
  });

  describe('getRDSMonthlyCost', () => {
    it('should return correct cost for known RDS instance classes', () => {
      expect(getRDSMonthlyCost('db.t3.micro')).toBe(11.01);
      expect(getRDSMonthlyCost('db.t3.small')).toBe(22.63);
      expect(getRDSMonthlyCost('db.m5.large')).toBe(127.75);
    });

    it('should return fallback for unknown instance classes', () => {
      expect(getRDSMonthlyCost('db.unknown.type')).toBe(100);
    });
  });

  describe('getS3MonthlyCost', () => {
    it('should calculate cost for standard storage', () => {
      expect(getS3MonthlyCost(1000, 'standard')).toBe(23); // 1000 GB × $0.023
    });

    it('should calculate cost for glacier storage', () => {
      expect(getS3MonthlyCost(1000, 'glacier')).toBe(4); // 1000 GB × $0.004
    });

    it('should use standard as default', () => {
      expect(getS3MonthlyCost(1000)).toBe(23);
    });

    it('should handle zero size', () => {
      expect(getS3MonthlyCost(0)).toBe(0);
    });
  });

  describe('getELBMonthlyCost', () => {
    it('should return correct cost for ALB', () => {
      expect(getELBMonthlyCost('alb')).toBe(16.43);
    });

    it('should return correct cost for NLB', () => {
      expect(getELBMonthlyCost('nlb')).toBe(16.43);
    });

    it('should return correct cost for CLB', () => {
      expect(getELBMonthlyCost('clb')).toBe(18.25);
    });

    it('should default to ALB', () => {
      expect(getELBMonthlyCost()).toBe(16.43);
    });
  });

  describe('getEIPMonthlyCost', () => {
    it('should return monthly cost for unattached EIP', () => {
      const cost = getEIPMonthlyCost();
      expect(cost).toBeCloseTo(3.65, 1); // ~$3.65/month
    });
  });
});

describe('CostEstimator Class', () => {
  describe('Estimate Mode (accurate = false)', () => {
    const estimator = new CostEstimator('us-east-1', false);

    it('should return estimated EC2 costs', async () => {
      const cost = await estimator.getEC2MonthlyCost('t3.micro');
      expect(cost).toBe(7.59);
    });

    it('should return estimated EBS costs', async () => {
      const cost = await estimator.getEBSMonthlyCost(100, 'gp3');
      expect(cost).toBe(8);
    });

    it('should return estimated RDS costs', async () => {
      const cost = await estimator.getRDSMonthlyCost('db.t3.small');
      expect(cost).toBe(22.63);
    });

    it('should return S3 costs', () => {
      const cost = estimator.getS3MonthlyCost(1000, 'standard');
      expect(cost).toBe(23);
    });

    it('should return ELB costs', () => {
      const cost = estimator.getELBMonthlyCost('alb');
      expect(cost).toBe(16.43);
    });

    it('should return EIP costs', () => {
      const cost = estimator.getEIPMonthlyCost();
      expect(cost).toBeCloseTo(3.65, 1);
    });
  });

  describe('Accurate Mode (accurate = true)', () => {
    const estimator = new CostEstimator('us-east-1', true);

    it('should initialize with pricing service', () => {
      expect(estimator).toBeDefined();
    });

    // Note: Actual Pricing API tests would require mocking AWS SDK
    // For now, these tests verify the estimator falls back to estimates
    it('should fallback to estimates when API unavailable', async () => {
      const cost = await estimator.getEC2MonthlyCost('t3.micro');
      expect(cost).toBeGreaterThan(0);
    });
  });
});
