import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderJSON } from '../../../src/reporters/json';
import { ScanReport } from '../../../src/types/opportunity';

describe('JSON Reporter', () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should output valid JSON', () => {
    const report: ScanReport = {
      provider: 'aws',
      accountId: '123456789012',
      region: 'us-east-1',
      scanPeriod: {
        start: new Date('2026-01-01'),
        end: new Date('2026-01-31'),
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

    renderJSON(report);

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const output = consoleLogSpy.mock.calls[0][0];
    
    // Verify it's valid JSON
    expect(() => JSON.parse(output)).not.toThrow();
    
    const parsed = JSON.parse(output);
    expect(parsed.provider).toBe('aws');
    expect(parsed.accountId).toBe('123456789012');
    expect(parsed.region).toBe('us-east-1');
  });

  it('should include all opportunities in JSON output', () => {
    const report: ScanReport = {
      provider: 'azure',
      accountId: 'sub-123',
      region: 'eastus',
      scanPeriod: {
        start: new Date('2026-01-01'),
        end: new Date('2026-01-31'),
      },
      opportunities: [
        {
          id: 'test-1',
          provider: 'azure',
          resourceType: 'vm',
          resourceId: 'vm-1',
          resourceName: 'test-vm',
          category: 'idle',
          currentCost: 100,
          estimatedSavings: 80,
          confidence: 'high',
          recommendation: 'Stop VM',
          metadata: {},
          detectedAt: new Date('2026-01-31'),
        },
        {
          id: 'test-2',
          provider: 'azure',
          resourceType: 'disk',
          resourceId: 'disk-1',
          resourceName: 'test-disk',
          category: 'unused',
          currentCost: 50,
          estimatedSavings: 50,
          confidence: 'high',
          recommendation: 'Delete disk',
          metadata: {},
          detectedAt: new Date('2026-01-31'),
        },
      ],
      totalPotentialSavings: 130,
      summary: {
        totalResources: 2,
        idleResources: 1,
        oversizedResources: 0,
        unusedResources: 1,
      },
    };

    renderJSON(report);

    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);

    expect(parsed.opportunities).toHaveLength(2);
    expect(parsed.totalPotentialSavings).toBe(130);
    expect(parsed.summary.totalResources).toBe(2);
  });

  it('should format JSON with proper indentation', () => {
    const report: ScanReport = {
      provider: 'aws',
      accountId: '123',
      region: 'us-east-1',
      scanPeriod: {
        start: new Date('2026-01-01'),
        end: new Date('2026-01-31'),
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

    renderJSON(report);

    const output = consoleLogSpy.mock.calls[0][0];
    
    // Check for indentation (JSON.stringify with spaces=2)
    expect(output).toContain('  "provider"');
    expect(output).toContain('  "accountId"');
  });

  it('should handle empty opportunities array', () => {
    const report: ScanReport = {
      provider: 'aws',
      accountId: '123',
      region: 'us-east-1',
      scanPeriod: {
        start: new Date('2026-01-01'),
        end: new Date('2026-01-31'),
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

    renderJSON(report);

    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);

    expect(parsed.opportunities).toEqual([]);
    expect(parsed.totalPotentialSavings).toBe(0);
  });

  it('should preserve metadata in opportunities', () => {
    const report: ScanReport = {
      provider: 'aws',
      accountId: '123',
      region: 'us-east-1',
      scanPeriod: {
        start: new Date('2026-01-01'),
        end: new Date('2026-01-31'),
      },
      opportunities: [
        {
          id: 'ec2-1',
          provider: 'aws',
          resourceType: 'ec2',
          resourceId: 'i-123',
          resourceName: 'web-server',
          category: 'idle',
          currentCost: 70,
          estimatedSavings: 60,
          confidence: 'high',
          recommendation: 'Stop instance',
          metadata: {
            instanceType: 'm5.large',
            avgCpu: 2.5,
            customField: 'test-value',
          },
          detectedAt: new Date('2026-01-31'),
        },
      ],
      totalPotentialSavings: 60,
      summary: {
        totalResources: 1,
        idleResources: 1,
        oversizedResources: 0,
        unusedResources: 0,
      },
    };

    renderJSON(report);

    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);

    expect(parsed.opportunities[0].metadata).toEqual({
      instanceType: 'm5.large',
      avgCpu: 2.5,
      customField: 'test-value',
    });
  });
});
