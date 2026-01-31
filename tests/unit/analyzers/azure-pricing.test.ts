import { describe, it, expect } from 'vitest';

// Azure VM Pricing Tests
describe('Azure VM Pricing', () => {
  const AZURE_VM_PRICING: Record<string, number> = {
    'Standard_B1s': 7.59,
    'Standard_B1ms': 15.33,
    'Standard_B2s': 30.37,
    'Standard_B2ms': 60.74,
    'Standard_D2s_v3': 70.08,
    'Standard_D4s_v3': 140.16,
  };

  function getVMMonthlyCost(vmSize: string): number {
    return AZURE_VM_PRICING[vmSize] || 100;
  }

  it('should return correct cost for known VM sizes', () => {
    expect(getVMMonthlyCost('Standard_B1s')).toBe(7.59);
    expect(getVMMonthlyCost('Standard_D2s_v3')).toBe(70.08);
    expect(getVMMonthlyCost('Standard_D4s_v3')).toBe(140.16);
  });

  it('should return fallback cost for unknown VM sizes', () => {
    expect(getVMMonthlyCost('Standard_Unknown')).toBe(100);
    expect(getVMMonthlyCost('invalid-size')).toBe(100);
  });
});

// Azure Disk Pricing Tests
describe('Azure Disk Pricing', () => {
  const AZURE_DISK_PRICING: Record<string, number> = {
    'Premium_LRS': 0.135,
    'StandardSSD_LRS': 0.075,
    'Standard_LRS': 0.045,
  };

  function getDiskMonthlyCost(sizeGB: number, diskType: string): number {
    const pricePerGB = AZURE_DISK_PRICING[diskType] || 0.075;
    return sizeGB * pricePerGB;
  }

  it('should calculate cost for Premium disks', () => {
    expect(getDiskMonthlyCost(128, 'Premium_LRS')).toBe(17.28); // 128 × 0.135
    expect(getDiskMonthlyCost(256, 'Premium_LRS')).toBe(34.56); // 256 × 0.135
  });

  it('should calculate cost for Standard SSD disks', () => {
    expect(getDiskMonthlyCost(100, 'StandardSSD_LRS')).toBe(7.5); // 100 × 0.075
  });

  it('should calculate cost for Standard HDD disks', () => {
    expect(getDiskMonthlyCost(500, 'Standard_LRS')).toBe(22.5); // 500 × 0.045
  });

  it('should use fallback pricing for unknown disk types', () => {
    expect(getDiskMonthlyCost(100, 'Unknown_Type')).toBe(7.5); // 100 × 0.075 (default)
  });

  it('should handle zero size', () => {
    expect(getDiskMonthlyCost(0, 'Premium_LRS')).toBe(0);
  });
});

// Azure SQL Pricing Tests
describe('Azure SQL Pricing', () => {
  const AZURE_SQL_PRICING: Record<string, number> = {
    'GP_Gen5_2': 438.29,
    'GP_Gen5_4': 876.58,
    'GP_Gen5_8': 1753.16,
    'BC_Gen5_2': 876.58,
    'BC_Gen5_4': 1753.16,
  };

  function getSQLMonthlyCost(sku: string): number {
    return AZURE_SQL_PRICING[sku] || 500;
  }

  it('should return correct cost for General Purpose SKUs', () => {
    expect(getSQLMonthlyCost('GP_Gen5_2')).toBe(438.29);
    expect(getSQLMonthlyCost('GP_Gen5_4')).toBe(876.58);
  });

  it('should return correct cost for Business Critical SKUs', () => {
    expect(getSQLMonthlyCost('BC_Gen5_2')).toBe(876.58);
    expect(getSQLMonthlyCost('BC_Gen5_4')).toBe(1753.16);
  });

  it('should return fallback cost for unknown SKUs', () => {
    expect(getSQLMonthlyCost('Unknown_SKU')).toBe(500);
  });

  it('should verify Business Critical is more expensive than General Purpose', () => {
    const gp2 = getSQLMonthlyCost('GP_Gen5_2');
    const bc2 = getSQLMonthlyCost('BC_Gen5_2');
    expect(bc2).toBeGreaterThan(gp2);
  });
});

// Azure Storage Pricing Tests
describe('Azure Storage Pricing', () => {
  const AZURE_STORAGE_PRICING = {
    hot: 0.0184,
    cool: 0.01,
    archive: 0.002,
  };

  it('should have correct pricing for storage tiers', () => {
    expect(AZURE_STORAGE_PRICING.hot).toBe(0.0184);
    expect(AZURE_STORAGE_PRICING.cool).toBe(0.01);
    expect(AZURE_STORAGE_PRICING.archive).toBe(0.002);
  });

  it('should verify archive is cheapest tier', () => {
    expect(AZURE_STORAGE_PRICING.archive).toBeLessThan(AZURE_STORAGE_PRICING.cool);
    expect(AZURE_STORAGE_PRICING.cool).toBeLessThan(AZURE_STORAGE_PRICING.hot);
  });

  it('should calculate potential savings for tier downgrade', () => {
    const sizeGB = 1000;
    const hotCost = sizeGB * AZURE_STORAGE_PRICING.hot;
    const coolCost = sizeGB * AZURE_STORAGE_PRICING.cool;
    const archiveCost = sizeGB * AZURE_STORAGE_PRICING.archive;

    expect(hotCost).toBe(18.4);
    expect(coolCost).toBe(10);
    expect(archiveCost).toBe(2);

    const hotToCoolSavings = hotCost - coolCost;
    const hotToArchiveSavings = hotCost - archiveCost;

    expect(hotToCoolSavings).toBeCloseTo(8.4, 1);
    expect(hotToArchiveSavings).toBeCloseTo(16.4, 1);
  });
});

// Azure VM Downsizing Logic Tests
describe('Azure VM Downsizing Logic', () => {
  function getSmallerVMSize(currentSize: string): string | null {
    const downsizeMap: Record<string, string> = {
      'Standard_B2ms': 'Standard_B1ms',
      'Standard_B2s': 'Standard_B1s',
      'Standard_D4s_v3': 'Standard_D2s_v3',
      'Standard_D8s_v3': 'Standard_D4s_v3',
      'Standard_E4s_v3': 'Standard_E2s_v3',
      'Standard_F4s_v2': 'Standard_F2s_v2',
    };
    return downsizeMap[currentSize] || null;
  }

  it('should suggest correct smaller VM sizes', () => {
    expect(getSmallerVMSize('Standard_B2ms')).toBe('Standard_B1ms');
    expect(getSmallerVMSize('Standard_D4s_v3')).toBe('Standard_D2s_v3');
    expect(getSmallerVMSize('Standard_D8s_v3')).toBe('Standard_D4s_v3');
  });

  it('should return null for smallest VM sizes', () => {
    expect(getSmallerVMSize('Standard_B1s')).toBeNull();
    expect(getSmallerVMSize('Standard_B1ms')).toBeNull();
  });

  it('should return null for unknown VM sizes', () => {
    expect(getSmallerVMSize('Unknown_Size')).toBeNull();
  });

  it('should verify downsize reduces cost', () => {
    const AZURE_VM_PRICING: Record<string, number> = {
      'Standard_B2ms': 60.74,
      'Standard_B1ms': 15.33,
      'Standard_D8s_v3': 280.32,
      'Standard_D4s_v3': 140.16,
    };

    const current = 'Standard_B2ms';
    const smaller = getSmallerVMSize(current);
    
    if (smaller) {
      const currentCost = AZURE_VM_PRICING[current];
      const smallerCost = AZURE_VM_PRICING[smaller];
      expect(smallerCost).toBeLessThan(currentCost);
      expect(currentCost - smallerCost).toBeGreaterThan(0);
    }
  });
});

// Resource Group Extraction Tests
describe('Azure Resource Group Extraction', () => {
  function extractResourceGroup(resourceId: string): string | null {
    const match = resourceId.match(/resourceGroups\/([^\/]+)/i);
    return match ? match[1] : null;
  }

  it('should extract resource group from valid resource IDs', () => {
    const vmId = '/subscriptions/abc-123/resourceGroups/my-rg/providers/Microsoft.Compute/virtualMachines/vm1';
    expect(extractResourceGroup(vmId)).toBe('my-rg');

    const diskId = '/subscriptions/xyz-456/resourceGroups/prod-rg/providers/Microsoft.Compute/disks/disk1';
    expect(extractResourceGroup(diskId)).toBe('prod-rg');

    const sqlId = '/subscriptions/def-789/resourceGroups/database-rg/providers/Microsoft.Sql/servers/server1';
    expect(extractResourceGroup(sqlId)).toBe('database-rg');
  });

  it('should handle case-insensitive matching', () => {
    const id1 = '/subscriptions/abc/resourcegroups/test-rg/providers/Microsoft.Compute/vms/vm1';
    const id2 = '/subscriptions/abc/RESOURCEGROUPS/test-rg/providers/Microsoft.Compute/vms/vm1';
    
    expect(extractResourceGroup(id1)).toBe('test-rg');
    expect(extractResourceGroup(id2)).toBe('test-rg');
  });

  it('should return null for invalid resource IDs', () => {
    expect(extractResourceGroup('/invalid/path')).toBeNull();
    expect(extractResourceGroup('not-a-resource-id')).toBeNull();
    expect(extractResourceGroup('')).toBeNull();
  });

  it('should handle resource groups with special characters', () => {
    const id = '/subscriptions/abc/resourceGroups/my-rg_123.test/providers/Microsoft.Compute/vms/vm1';
    expect(extractResourceGroup(id)).toBe('my-rg_123.test');
  });
});
