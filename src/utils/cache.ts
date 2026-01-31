import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { AIExplanation } from '../services/ai';

export interface CachedExplanation {
  opportunityHash: string;
  explanation: AIExplanation;
  timestamp: number;
  provider: string;
  model: string;
}

export class ExplanationCache {
  private cacheDir: string;
  private cacheDuration: number; // in milliseconds

  constructor(cacheDuration: number = 7 * 24 * 60 * 60 * 1000) {  // 7 days default
    this.cacheDir = path.join(process.env.HOME || '/tmp', '.cloud-cost-cli', 'cache');
    this.cacheDuration = cacheDuration;
    this.ensureCacheDir();
  }

  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private hashOpportunity(data: any): string {
    const str = JSON.stringify({
      provider: data.provider,
      resourceType: data.resourceType,
      category: data.category,
      recommendation: data.recommendation,
      // Include key metadata that affects the explanation
      metadata: {
        avgCpu: data.metadata?.avgCpu,
        size: data.metadata?.size,
        tier: data.metadata?.tier,
      },
    });
    return crypto.createHash('sha256').update(str).digest('hex').substring(0, 16);
  }

  private getCachePath(hash: string): string {
    return path.join(this.cacheDir, `${hash}.json`);
  }

  get(opportunityData: any, provider: string, model: string): AIExplanation | null {
    const hash = this.hashOpportunity(opportunityData);
    const cachePath = this.getCachePath(hash);

    if (!fs.existsSync(cachePath)) {
      return null;
    }

    try {
      const data = fs.readFileSync(cachePath, 'utf-8');
      const cached: CachedExplanation = JSON.parse(data);

      // Check if cache is expired
      const age = Date.now() - cached.timestamp;
      if (age > this.cacheDuration) {
        // Cache expired, delete it
        fs.unlinkSync(cachePath);
        return null;
      }

      // Check if provider/model match
      if (cached.provider !== provider || cached.model !== model) {
        return null;
      }

      return cached.explanation;
    } catch (error) {
      // Invalid cache file, delete it
      try {
        fs.unlinkSync(cachePath);
      } catch (e) {
        // Ignore deletion errors
      }
      return null;
    }
  }

  set(opportunityData: any, provider: string, model: string, explanation: AIExplanation): void {
    const hash = this.hashOpportunity(opportunityData);
    const cachePath = this.getCachePath(hash);

    const cached: CachedExplanation = {
      opportunityHash: hash,
      explanation,
      timestamp: Date.now(),
      provider,
      model,
    };

    try {
      fs.writeFileSync(cachePath, JSON.stringify(cached, null, 2), 'utf-8');
    } catch (error) {
      // Failed to write cache, not critical - continue without caching
    }
  }

  clear(): number {
    let count = 0;
    try {
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          fs.unlinkSync(path.join(this.cacheDir, file));
          count++;
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }
    return count;
  }

  clearExpired(): number {
    let count = 0;
    try {
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(this.cacheDir, file);
        try {
          const data = fs.readFileSync(filePath, 'utf-8');
          const cached: CachedExplanation = JSON.parse(data);
          const age = Date.now() - cached.timestamp;

          if (age > this.cacheDuration) {
            fs.unlinkSync(filePath);
            count++;
          }
        } catch (error) {
          // Invalid file, delete it
          fs.unlinkSync(filePath);
          count++;
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }
    return count;
  }

  getStats(): { total: number; size: number; oldest: number | null } {
    let total = 0;
    let size = 0;
    let oldest: number | null = null;

    try {
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(this.cacheDir, file);
        try {
          const stats = fs.statSync(filePath);
          size += stats.size;
          total++;

          const data = fs.readFileSync(filePath, 'utf-8');
          const cached: CachedExplanation = JSON.parse(data);

          if (oldest === null || cached.timestamp < oldest) {
            oldest = cached.timestamp;
          }
        } catch (error) {
          // Skip invalid files
        }
      }
    } catch (error) {
      // Directory doesn't exist
    }

    return { total, size, oldest };
  }
}
