type PriceEstimate = {
  monthly: number;
  breakdown: {
    compute: number;
    storage: number;
  };
  currency: string;
};

// Very small SKU price table (USD/month) for common examples. Expand as needed.
const skuPriceTable: Record<string, number> = {
  // General Purpose Gen5 vCore examples (approximate $/vCore-hour * 730h)
  'GP_Gen5_2': 200, // placeholder
  'GP_Gen5_4': 400,
  'GP_Gen5_8': 800,
  // Business Critical examples
  'BC_Gen5_2': 350,
  'BC_Gen5_4': 700,
};

// Default storage price per GB-month (USD) if not region-mapped
const defaultStoragePerGBMonth = 0.10; // $0.10/GB-month as fallback

export function getSqlPriceEstimate(options: { skuName: string; region?: string; sizeGB?: number }): PriceEstimate {
  const { skuName, region, sizeGB } = options;

  // Compute base price from SKU table if available
  let computeMonthly = 0;
  if (skuName && skuPriceTable[skuName]) {
    computeMonthly = skuPriceTable[skuName];
  } else {
    // Try to infer vCore from sku name like "GP_Gen5_2" -> 2
    const m = skuName.match(/(\d+)$/);
    if (m) {
      const v = parseInt(m[1], 10);
      // crude per-vCore price estimate
      computeMonthly = v * 100; // $100 per vCore-month default
    } else {
      // unknown sku
      computeMonthly = 0;
    }
  }

  const storageMonthly = (sizeGB && sizeGB > 0) ? +(sizeGB * defaultStoragePerGBMonth).toFixed(2) : 0;

  return {
    monthly: +(computeMonthly + storageMonthly).toFixed(2),
    breakdown: {
      compute: +computeMonthly.toFixed(2),
      storage: +storageMonthly.toFixed(2),
    },
    currency: 'USD',
  };
}
