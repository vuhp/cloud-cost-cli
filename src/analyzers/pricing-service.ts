import { PricingClient, GetProductsCommand } from '@aws-sdk/client-pricing';

// Cache for pricing data to avoid repeated API calls
const pricingCache: Map<string, number> = new Map();

export class PricingService {
  private pricingClient: PricingClient;
  private region: string;

  constructor(region: string = 'us-east-1') {
    this.region = region;
    // Pricing API is only available in us-east-1 and ap-south-1
    this.pricingClient = new PricingClient({ region: 'us-east-1' });
  }

  /**
   * Get EC2 instance on-demand pricing for the configured region
   */
  async getEC2Price(instanceType: string): Promise<number> {
    const cacheKey = `ec2-${this.region}-${instanceType}`;
    
    if (pricingCache.has(cacheKey)) {
      return pricingCache.get(cacheKey)!;
    }

    try {
      const response = await this.pricingClient.send(
        new GetProductsCommand({
          ServiceCode: 'AmazonEC2',
          Filters: [
            {
              Type: 'TERM_MATCH',
              Field: 'instanceType',
              Value: instanceType,
            },
            {
              Type: 'TERM_MATCH',
              Field: 'location',
              Value: this.getLocationName(this.region),
            },
            {
              Type: 'TERM_MATCH',
              Field: 'tenancy',
              Value: 'Shared',
            },
            {
              Type: 'TERM_MATCH',
              Field: 'operatingSystem',
              Value: 'Linux',
            },
            {
              Type: 'TERM_MATCH',
              Field: 'preInstalledSw',
              Value: 'NA',
            },
            {
              Type: 'TERM_MATCH',
              Field: 'capacitystatus',
              Value: 'Used',
            },
          ],
          MaxResults: 1,
        })
      );

      const hourlyPrice = this.extractPriceFromResponse(response.PriceList);
      const monthlyPrice = hourlyPrice * 730; // 730 hours per month
      
      pricingCache.set(cacheKey, monthlyPrice);
      return monthlyPrice;
    } catch (error) {
      // Fallback to estimate if API fails
      return this.getFallbackEC2Price(instanceType);
    }
  }

  /**
   * Get EBS volume pricing per GB
   */
  async getEBSPrice(volumeType: string): Promise<number> {
    const cacheKey = `ebs-${this.region}-${volumeType}`;
    
    if (pricingCache.has(cacheKey)) {
      return pricingCache.get(cacheKey)!;
    }

    try {
      const response = await this.pricingClient.send(
        new GetProductsCommand({
          ServiceCode: 'AmazonEC2',
          Filters: [
            {
              Type: 'TERM_MATCH',
              Field: 'productFamily',
              Value: 'Storage',
            },
            {
              Type: 'TERM_MATCH',
              Field: 'volumeApiName',
              Value: volumeType,
            },
            {
              Type: 'TERM_MATCH',
              Field: 'location',
              Value: this.getLocationName(this.region),
            },
          ],
          MaxResults: 1,
        })
      );

      const pricePerGB = this.extractPriceFromResponse(response.PriceList);
      pricingCache.set(cacheKey, pricePerGB);
      return pricePerGB;
    } catch (error) {
      return this.getFallbackEBSPrice(volumeType);
    }
  }

  /**
   * Get RDS instance pricing
   */
  async getRDSPrice(instanceClass: string, engine: string = 'mysql'): Promise<number> {
    const cacheKey = `rds-${this.region}-${instanceClass}-${engine}`;
    
    if (pricingCache.has(cacheKey)) {
      return pricingCache.get(cacheKey)!;
    }

    try {
      const response = await this.pricingClient.send(
        new GetProductsCommand({
          ServiceCode: 'AmazonRDS',
          Filters: [
            {
              Type: 'TERM_MATCH',
              Field: 'instanceType',
              Value: instanceClass,
            },
            {
              Type: 'TERM_MATCH',
              Field: 'location',
              Value: this.getLocationName(this.region),
            },
            {
              Type: 'TERM_MATCH',
              Field: 'databaseEngine',
              Value: this.normalizeEngine(engine),
            },
            {
              Type: 'TERM_MATCH',
              Field: 'deploymentOption',
              Value: 'Single-AZ',
            },
          ],
          MaxResults: 1,
        })
      );

      const hourlyPrice = this.extractPriceFromResponse(response.PriceList);
      const monthlyPrice = hourlyPrice * 730;
      
      pricingCache.set(cacheKey, monthlyPrice);
      return monthlyPrice;
    } catch (error) {
      return this.getFallbackRDSPrice(instanceClass);
    }
  }

  /**
   * Extract price from AWS Pricing API response
   */
  private extractPriceFromResponse(priceList: string[] | undefined): number {
    if (!priceList || priceList.length === 0) {
      return 0;
    }

    try {
      const product = JSON.parse(priceList[0]);
      const terms = product.terms?.OnDemand;
      
      if (!terms) return 0;

      const termKey = Object.keys(terms)[0];
      const priceDimensions = terms[termKey]?.priceDimensions;
      
      if (!priceDimensions) return 0;

      const dimensionKey = Object.keys(priceDimensions)[0];
      const pricePerUnit = priceDimensions[dimensionKey]?.pricePerUnit?.USD;

      return parseFloat(pricePerUnit || '0');
    } catch (error) {
      return 0;
    }
  }

  /**
   * Convert AWS region code to location name used in Pricing API
   */
  private getLocationName(region: string): string {
    const locationMap: Record<string, string> = {
      'us-east-1': 'US East (N. Virginia)',
      'us-east-2': 'US East (Ohio)',
      'us-west-1': 'US West (N. California)',
      'us-west-2': 'US West (Oregon)',
      'eu-west-1': 'EU (Ireland)',
      'eu-central-1': 'EU (Frankfurt)',
      'ap-southeast-1': 'Asia Pacific (Singapore)',
      'ap-southeast-2': 'Asia Pacific (Sydney)',
      'ap-northeast-1': 'Asia Pacific (Tokyo)',
      // Add more as needed
    };

    return locationMap[region] || 'US East (N. Virginia)';
  }

  /**
   * Normalize RDS engine name for Pricing API
   */
  private normalizeEngine(engine: string): string {
    const engineMap: Record<string, string> = {
      'mysql': 'MySQL',
      'postgres': 'PostgreSQL',
      'mariadb': 'MariaDB',
      'aurora': 'Aurora MySQL',
      'aurora-mysql': 'Aurora MySQL',
      'aurora-postgresql': 'Aurora PostgreSQL',
    };

    return engineMap[engine.toLowerCase()] || 'MySQL';
  }

  /**
   * Fallback estimates when API calls fail (based on us-east-1)
   */
  private getFallbackEC2Price(instanceType: string): number {
    const estimates: Record<string, number> = {
      't3.micro': 7.59,
      't3.small': 15.18,
      't3.medium': 30.37,
      't3.large': 60.74,
      'm5.large': 70.08,
      'm5.xlarge': 140.16,
    };
    return estimates[instanceType] || 50; // Generic estimate
  }

  private getFallbackEBSPrice(volumeType: string): number {
    const estimates: Record<string, number> = {
      'gp3': 0.08,
      'gp2': 0.10,
      'io1': 0.125,
      'io2': 0.125,
    };
    return estimates[volumeType] || 0.08;
  }

  private getFallbackRDSPrice(instanceClass: string): number {
    const estimates: Record<string, number> = {
      'db.t3.micro': 11.01,
      'db.t3.small': 22.63,
      'db.t3.medium': 45.26,
      'db.t3.large': 90.51,
    };
    return estimates[instanceClass] || 100;
  }
}

// Simple estimates for services where Pricing API is complex (S3, ELB, EIP)
export function getS3MonthlyCost(sizeGB: number, storageClass: string = 'standard'): number {
  const pricing: Record<string, number> = {
    'STANDARD': 0.023,
    'INTELLIGENT_TIERING': 0.023,
    'GLACIER': 0.004,
    'DEEP_ARCHIVE': 0.00099,
  };
  const pricePerGB = pricing[storageClass] || 0.023;
  return sizeGB * pricePerGB;
}

export function getELBMonthlyCost(type: 'alb' | 'nlb' | 'clb' = 'alb'): number {
  // ELB pricing is relatively consistent across regions (~$16-18/month base)
  return type === 'clb' ? 18.25 : 16.43;
}

export function getEIPMonthlyCost(): number {
  // ~$3.65/month when unattached (consistent across regions)
  return 3.65;
}
