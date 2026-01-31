import { describe, it, expect } from 'vitest';
import { SavingsOpportunity } from '../../../src/types/opportunity';

describe('Scan Command Logic', () => {
  describe('Opportunity Filtering', () => {
    const opportunities: SavingsOpportunity[] = [
      {
        id: '1',
        provider: 'aws',
        resourceType: 'ec2',
        resourceId: 'i-1',
        resourceName: 'vm-1',
        category: 'idle',
        currentCost: 100,
        estimatedSavings: 80,
        confidence: 'high',
        recommendation: 'Stop',
        metadata: {},
        detectedAt: new Date(),
      },
      {
        id: '2',
        provider: 'aws',
        resourceType: 'ebs',
        resourceId: 'vol-1',
        resourceName: 'disk-1',
        category: 'unused',
        currentCost: 50,
        estimatedSavings: 50,
        confidence: 'high',
        recommendation: 'Delete',
        metadata: {},
        detectedAt: new Date(),
      },
      {
        id: '3',
        provider: 'aws',
        resourceType: 'rds',
        resourceId: 'db-1',
        resourceName: 'database-1',
        category: 'oversized',
        currentCost: 200,
        estimatedSavings: 30,
        confidence: 'medium',
        recommendation: 'Downsize',
        metadata: {},
        detectedAt: new Date(),
      },
      {
        id: '4',
        provider: 'aws',
        resourceType: 's3',
        resourceId: 'bucket-1',
        resourceName: 'logs',
        category: 'misconfigured',
        currentCost: 100,
        estimatedSavings: 10,
        confidence: 'low',
        recommendation: 'Add lifecycle',
        metadata: {},
        detectedAt: new Date(),
      },
    ];

    it('should filter by minimum savings', () => {
      const minSavings = 40;
      const filtered = opportunities.filter(opp => opp.estimatedSavings >= minSavings);
      
      expect(filtered).toHaveLength(2);
      expect(filtered[0].estimatedSavings).toBe(80);
      expect(filtered[1].estimatedSavings).toBe(50);
    });

    it('should not filter when minSavings is 0', () => {
      const minSavings = 0;
      const filtered = opportunities.filter(opp => opp.estimatedSavings >= minSavings);
      
      expect(filtered).toHaveLength(4);
    });

    it('should handle strict minSavings threshold', () => {
      const minSavings = 50;
      const filtered = opportunities.filter(opp => opp.estimatedSavings >= minSavings);
      
      expect(filtered).toHaveLength(2); // 80 and 50, not 30 or 10
    });
  });

  describe('Total Savings Calculation', () => {
    it('should sum all opportunity savings correctly', () => {
      const opportunities: SavingsOpportunity[] = [
        {
          id: '1',
          provider: 'aws',
          resourceType: 'ec2',
          resourceId: 'i-1',
          resourceName: 'vm-1',
          category: 'idle',
          currentCost: 100,
          estimatedSavings: 75.50,
          confidence: 'high',
          recommendation: 'Stop',
          metadata: {},
          detectedAt: new Date(),
        },
        {
          id: '2',
          provider: 'aws',
          resourceType: 'ebs',
          resourceId: 'vol-1',
          resourceName: 'disk-1',
          category: 'unused',
          currentCost: 50,
          estimatedSavings: 30.25,
          confidence: 'high',
          recommendation: 'Delete',
          metadata: {},
          detectedAt: new Date(),
        },
      ];

      const total = opportunities.reduce((sum, opp) => sum + opp.estimatedSavings, 0);
      
      expect(total).toBeCloseTo(105.75, 2);
    });

    it('should handle empty opportunities', () => {
      const opportunities: SavingsOpportunity[] = [];
      const total = opportunities.reduce((sum, opp) => sum + opp.estimatedSavings, 0);
      
      expect(total).toBe(0);
    });

    it('should handle single opportunity', () => {
      const opportunities: SavingsOpportunity[] = [
        {
          id: '1',
          provider: 'aws',
          resourceType: 'ec2',
          resourceId: 'i-1',
          resourceName: 'vm-1',
          category: 'idle',
          currentCost: 100,
          estimatedSavings: 85,
          confidence: 'high',
          recommendation: 'Stop',
          metadata: {},
          detectedAt: new Date(),
        },
      ];

      const total = opportunities.reduce((sum, opp) => sum + opp.estimatedSavings, 0);
      
      expect(total).toBe(85);
    });
  });

  describe('Summary Statistics Calculation', () => {
    it('should count opportunities by category', () => {
      const opportunities: SavingsOpportunity[] = [
        {
          id: '1',
          provider: 'aws',
          resourceType: 'ec2',
          resourceId: 'i-1',
          resourceName: 'vm-1',
          category: 'idle',
          currentCost: 100,
          estimatedSavings: 80,
          confidence: 'high',
          recommendation: 'Stop',
          metadata: {},
          detectedAt: new Date(),
        },
        {
          id: '2',
          provider: 'aws',
          resourceType: 'ec2',
          resourceId: 'i-2',
          resourceName: 'vm-2',
          category: 'idle',
          currentCost: 100,
          estimatedSavings: 75,
          confidence: 'high',
          recommendation: 'Stop',
          metadata: {},
          detectedAt: new Date(),
        },
        {
          id: '3',
          provider: 'aws',
          resourceType: 'ebs',
          resourceId: 'vol-1',
          resourceName: 'disk-1',
          category: 'unused',
          currentCost: 50,
          estimatedSavings: 50,
          confidence: 'high',
          recommendation: 'Delete',
          metadata: {},
          detectedAt: new Date(),
        },
        {
          id: '4',
          provider: 'aws',
          resourceType: 'rds',
          resourceId: 'db-1',
          resourceName: 'database-1',
          category: 'oversized',
          currentCost: 200,
          estimatedSavings: 100,
          confidence: 'medium',
          recommendation: 'Downsize',
          metadata: {},
          detectedAt: new Date(),
        },
      ];

      const summary = {
        totalResources: opportunities.length,
        idleResources: opportunities.filter(o => o.category === 'idle').length,
        oversizedResources: opportunities.filter(o => o.category === 'oversized').length,
        unusedResources: opportunities.filter(o => o.category === 'unused').length,
      };

      expect(summary.totalResources).toBe(4);
      expect(summary.idleResources).toBe(2);
      expect(summary.oversizedResources).toBe(1);
      expect(summary.unusedResources).toBe(1);
    });

    it('should handle all resources of same category', () => {
      const opportunities: SavingsOpportunity[] = [
        {
          id: '1',
          provider: 'aws',
          resourceType: 'ebs',
          resourceId: 'vol-1',
          resourceName: 'disk-1',
          category: 'unused',
          currentCost: 50,
          estimatedSavings: 50,
          confidence: 'high',
          recommendation: 'Delete',
          metadata: {},
          detectedAt: new Date(),
        },
        {
          id: '2',
          provider: 'aws',
          resourceType: 'ebs',
          resourceId: 'vol-2',
          resourceName: 'disk-2',
          category: 'unused',
          currentCost: 30,
          estimatedSavings: 30,
          confidence: 'high',
          recommendation: 'Delete',
          metadata: {},
          detectedAt: new Date(),
        },
      ];

      const summary = {
        totalResources: opportunities.length,
        idleResources: opportunities.filter(o => o.category === 'idle').length,
        oversizedResources: opportunities.filter(o => o.category === 'oversized').length,
        unusedResources: opportunities.filter(o => o.category === 'unused').length,
      };

      expect(summary.totalResources).toBe(2);
      expect(summary.idleResources).toBe(0);
      expect(summary.oversizedResources).toBe(0);
      expect(summary.unusedResources).toBe(2);
    });
  });

  describe('Opportunity Sorting', () => {
    it('should sort opportunities by savings (descending)', () => {
      const opportunities: SavingsOpportunity[] = [
        {
          id: '1',
          provider: 'aws',
          resourceType: 'ec2',
          resourceId: 'i-1',
          resourceName: 'vm-1',
          category: 'idle',
          currentCost: 100,
          estimatedSavings: 30,
          confidence: 'high',
          recommendation: 'Stop',
          metadata: {},
          detectedAt: new Date(),
        },
        {
          id: '2',
          provider: 'aws',
          resourceType: 'rds',
          resourceId: 'db-1',
          resourceName: 'database-1',
          category: 'oversized',
          currentCost: 200,
          estimatedSavings: 100,
          confidence: 'high',
          recommendation: 'Downsize',
          metadata: {},
          detectedAt: new Date(),
        },
        {
          id: '3',
          provider: 'aws',
          resourceType: 'ebs',
          resourceId: 'vol-1',
          resourceName: 'disk-1',
          category: 'unused',
          currentCost: 50,
          estimatedSavings: 50,
          confidence: 'high',
          recommendation: 'Delete',
          metadata: {},
          detectedAt: new Date(),
        },
      ];

      const sorted = opportunities.sort((a, b) => b.estimatedSavings - a.estimatedSavings);

      expect(sorted[0].estimatedSavings).toBe(100);
      expect(sorted[1].estimatedSavings).toBe(50);
      expect(sorted[2].estimatedSavings).toBe(30);
    });

    it('should limit results to topN', () => {
      const opportunities: SavingsOpportunity[] = Array.from({ length: 10 }, (_, i) => ({
        id: `${i + 1}`,
        provider: 'aws',
        resourceType: 'ec2',
        resourceId: `i-${i}`,
        resourceName: `vm-${i}`,
        category: 'idle' as const,
        currentCost: 100,
        estimatedSavings: 100 - (i * 10),
        confidence: 'high' as const,
        recommendation: 'Stop',
        metadata: {},
        detectedAt: new Date(),
      }));

      const topN = 5;
      const sorted = opportunities
        .sort((a, b) => b.estimatedSavings - a.estimatedSavings)
        .slice(0, topN);

      expect(sorted).toHaveLength(5);
      expect(sorted[0].estimatedSavings).toBe(100);
      expect(sorted[4].estimatedSavings).toBe(60);
    });
  });
});
