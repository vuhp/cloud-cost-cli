import { describe, it, expect } from 'vitest';
import { formatCurrency, formatBytes, formatPercent } from '../../../src/utils/formatter';

describe('Formatter Utilities', () => {
  describe('formatCurrency', () => {
    it('should format whole numbers', () => {
      expect(formatCurrency(100)).toBe('$100.00');
      expect(formatCurrency(1000)).toBe('$1,000.00');
      expect(formatCurrency(1234567)).toBe('$1,234,567.00');
    });

    it('should format decimals', () => {
      expect(formatCurrency(10.50)).toBe('$10.50');
      expect(formatCurrency(99.99)).toBe('$99.99');
      expect(formatCurrency(1234.567)).toBe('$1,234.57');
    });

    it('should handle zero', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('should handle negative numbers', () => {
      expect(formatCurrency(-50)).toBe('-$50.00');
    });

    it('should round to 2 decimal places', () => {
      expect(formatCurrency(10.999)).toBe('$11.00');
      expect(formatCurrency(10.001)).toBe('$10.00');
    });
  });

  describe('formatBytes', () => {
    it('should format bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(100)).toBe('100 B');
      expect(formatBytes(1023)).toBe('1023 B');
    });

    it('should format kilobytes', () => {
      expect(formatBytes(1024)).toBe('1.00 KB');
      expect(formatBytes(1536)).toBe('1.50 KB');
      expect(formatBytes(2048)).toBe('2.00 KB');
    });

    it('should format megabytes', () => {
      expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
      expect(formatBytes(5 * 1024 * 1024)).toBe('5.00 MB');
    });

    it('should format gigabytes', () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
      expect(formatBytes(100 * 1024 * 1024 * 1024)).toBe('100.00 GB');
    });

    it('should format terabytes', () => {
      expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1.00 TB');
      expect(formatBytes(5.5 * 1024 * 1024 * 1024 * 1024)).toBe('5.50 TB');
    });

    it('should handle custom decimal places', () => {
      expect(formatBytes(1536, 0)).toBe('2 KB');
      expect(formatBytes(1536, 1)).toBe('1.5 KB');
      expect(formatBytes(1536, 3)).toBe('1.500 KB');
    });
  });

  describe('formatPercent', () => {
    it('should format percentages', () => {
      expect(formatPercent(0.5)).toBe('50.0%');
      expect(formatPercent(0.75)).toBe('75.0%');
      expect(formatPercent(1.0)).toBe('100.0%');
    });

    it('should handle zero', () => {
      expect(formatPercent(0)).toBe('0.0%');
    });

    it('should handle values over 100%', () => {
      expect(formatPercent(1.5)).toBe('150.0%');
      expect(formatPercent(2.0)).toBe('200.0%');
    });

    it('should round to 1 decimal place by default', () => {
      expect(formatPercent(0.123)).toBe('12.3%');
      expect(formatPercent(0.999)).toBe('99.9%');
    });

    it('should handle custom decimal places', () => {
      expect(formatPercent(0.12345, 0)).toBe('12%');
      expect(formatPercent(0.12345, 2)).toBe('12.35%');
      expect(formatPercent(0.12345, 3)).toBe('12.345%');
    });
  });
});
