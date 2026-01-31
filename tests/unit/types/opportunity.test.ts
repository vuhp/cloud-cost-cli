import { describe, it, expect } from 'vitest';
import { SavingsOpportunity, ScanReport } from '../../../src/types/opportunity';

describe('Opportunity Types', () => {
  describe('SavingsOpportunity', () => {
    it('should create a valid opportunity object', () => {
      const opportunity: SavingsOpportunity = {
        id: 'test-1',
        provider: 'aws',
        resourceType: 'ec2',
        resourceId: 'i-12345',
        resourceName: 'test-instance',
        category: 'idle',
        currentCost: 100,
        estimatedSavings: 80,
        confidence: 'high',
        recommendation: 'Stop or terminate instance',
        metadata: {
          instanceType: 't3.medium',
          avgCpu: 2.5,
        },
        detectedAt: new Date(),
      };

      expect(opportunity.id).toBe('test-1');
      expect(opportunity.provider).toBe('aws');
      expect(opportunity.resourceType).toBe('ec2');
      expect(opportunity.estimatedSavings).toBe(80);
      expect(opportunity.confidence).toBe('high');
    });

    it('should allow different confidence levels', () => {
      const high: SavingsOpportunity['confidence'] = 'high';
      const medium: SavingsOpportunity['confidence'] = 'medium';
      const low: SavingsOpportunity['confidence'] = 'low';

      expect(high).toBe('high');
      expect(medium).toBe('medium');
      expect(low).toBe('low');
    });

    it('should allow different categories', () => {
      const idle: SavingsOpportunity['category'] = 'idle';
      const unused: SavingsOpportunity['category'] = 'unused';
      const oversized: SavingsOpportunity['category'] = 'oversized';
      const misconfigured: SavingsOpportunity['category'] = 'misconfigured';

      expect(idle).toBe('idle');
      expect(unused).toBe('unused');
      expect(oversized).toBe('oversized');
      expect(misconfigured).toBe('misconfigured');
    });
  });

  describe('ScanReport', () => {
    it('should create a valid scan report', () => {
      const opportunities: SavingsOpportunity[] = [
        {
          id: 'opp-1',
          provider: 'aws',
          resourceType: 'ec2',
          resourceId: 'i-111',
          resourceName: 'instance-1',
          category: 'idle',
          currentCost: 100,
          estimatedSavings: 80,
          confidence: 'high',
          recommendation: 'Stop instance',
          metadata: {},
          detectedAt: new Date(),
        },
        {
          id: 'opp-2',
          provider: 'aws',
          resourceType: 'ebs',
          resourceId: 'vol-222',
          resourceName: 'volume-1',
          category: 'unused',
          currentCost: 50,
          estimatedSavings: 50,
          confidence: 'high',
          recommendation: 'Delete volume',
          metadata: {},
          detectedAt: new Date(),
        },
      ];

      const report: ScanReport = {
        provider: 'aws',
        accountId: '123456789012',
        region: 'us-east-1',
        scanPeriod: {
          start: new Date('2026-01-01'),
          end: new Date('2026-01-31'),
        },
        opportunities,
        totalPotentialSavings: 130,
        summary: {
          totalResources: 10,
          idleResources: 1,
          oversizedResources: 0,
          unusedResources: 1,
        },
      };

      expect(report.provider).toBe('aws');
      expect(report.accountId).toBe('123456789012');
      expect(report.opportunities.length).toBe(2);
      expect(report.totalPotentialSavings).toBe(130);
      expect(report.summary.totalResources).toBe(10);
      expect(report.summary.idleResources).toBe(1);
      expect(report.summary.unusedResources).toBe(1);
    });

    it('should handle empty opportunities', () => {
      const report: ScanReport = {
        provider: 'aws',
        accountId: '123456789012',
        region: 'us-east-1',
        scanPeriod: {
          start: new Date(),
          end: new Date(),
        },
        opportunities: [],
        totalPotentialSavings: 0,
        summary: {
          totalResources: 0,
          idleResources: 0,
          oversizedResources: 0,
          unusedResources: 0,
        },
      };

      expect(report.opportunities.length).toBe(0);
      expect(report.totalPotentialSavings).toBe(0);
    });

    it('should calculate total savings correctly', () => {
      const opportunities: SavingsOpportunity[] = [
        {
          id: '1',
          provider: 'aws',
          resourceType: 'ec2',
          resourceId: 'i-1',
          resourceName: 'test',
          category: 'idle',
          currentCost: 100,
          estimatedSavings: 75,
          confidence: 'high',
          recommendation: 'Test',
          metadata: {},
          detectedAt: new Date(),
        },
        {
          id: '2',
          provider: 'aws',
          resourceType: 'ebs',
          resourceId: 'vol-1',
          resourceName: 'test',
          category: 'unused',
          currentCost: 50,
          estimatedSavings: 50,
          confidence: 'high',
          recommendation: 'Test',
          metadata: {},
          detectedAt: new Date(),
        },
      ];

      const totalSavings = opportunities.reduce((sum, opp) => sum + opp.estimatedSavings, 0);

      expect(totalSavings).toBe(125);
    });
  });
});
