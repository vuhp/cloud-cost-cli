import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { CloudCredential } from '../api/client';

interface ScanDialogProps {
  isOpen: boolean;
  provider: string;
  onClose: () => void;
  onScan: (credentialsId: number | undefined, region: string | undefined, detailedMetrics: boolean) => void;
}

const REGIONS = {
  aws: [
    { value: '', label: 'All Regions' },
    { value: 'us-east-1', label: 'US East (N. Virginia)' },
    { value: 'us-east-2', label: 'US East (Ohio)' },
    { value: 'us-west-1', label: 'US West (N. California)' },
    { value: 'us-west-2', label: 'US West (Oregon)' },
    { value: 'eu-west-1', label: 'EU (Ireland)' },
    { value: 'eu-central-1', label: 'EU (Frankfurt)' },
    { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
    { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
  ],
  azure: [
    { value: '', label: 'All Locations' },
    { value: 'eastus', label: 'East US' },
    { value: 'eastus2', label: 'East US 2' },
    { value: 'westus', label: 'West US' },
    { value: 'westus2', label: 'West US 2' },
    { value: 'westeurope', label: 'West Europe' },
    { value: 'northeurope', label: 'North Europe' },
    { value: 'southeastasia', label: 'Southeast Asia' },
  ],
  gcp: [
    { value: '', label: 'All Regions' },
    { value: 'us-central1', label: 'US Central (Iowa)' },
    { value: 'us-east1', label: 'US East (South Carolina)' },
    { value: 'us-west1', label: 'US West (Oregon)' },
    { value: 'europe-west1', label: 'Europe West (Belgium)' },
    { value: 'asia-southeast1', label: 'Asia Southeast (Singapore)' },
    { value: 'asia-northeast1', label: 'Asia Northeast (Tokyo)' },
  ],
};

export default function ScanDialog({ isOpen, provider, onClose, onScan }: ScanDialogProps) {
  const [accounts, setAccounts] = useState<CloudCredential[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<number | undefined>();
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [detailedMetrics, setDetailedMetrics] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadAccounts();
    }
  }, [isOpen, provider]);

  async function loadAccounts() {
    try {
      setLoading(true);
      const creds = await api.getCredentials();
      const filtered = creds.filter(c => c.provider === provider);
      setAccounts(filtered);
      
      // Auto-select first account if only one exists
      if (filtered.length === 1) {
        setSelectedAccount(filtered[0].id);
      } else {
        setSelectedAccount(undefined);
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleScan() {
    onScan(selectedAccount, selectedRegion || undefined, detailedMetrics);
    onClose();
  }

  if (!isOpen) return null;

  const regions = REGIONS[provider as keyof typeof REGIONS] || [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg max-w-md w-full border border-slate-700">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-2xl font-bold text-white">Scan {provider.toUpperCase()}</h2>
        </div>

        {loading ? (
          <div className="p-6 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {/* Account Selector */}
            {accounts.length === 0 ? (
              <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
                <p className="text-yellow-200 text-sm">
                  No {provider.toUpperCase()} accounts configured. 
                  <a href="/settings" className="underline ml-1">Add one in Settings</a>
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Account {accounts.length > 1 ? '' : '(auto-selected)'}
                </label>
                <select
                  value={selectedAccount || ''}
                  onChange={(e) => setSelectedAccount(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  disabled={accounts.length === 1}
                >
                  {accounts.length > 1 && (
                    <option value="">Use latest account</option>
                  )}
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Region Selector */}
            {regions.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Region
                </label>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  {regions.map((region) => (
                    <option key={region.value} value={region.value}>
                      {region.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Scan Options */}
            <div className="border-t border-slate-700 pt-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={detailedMetrics}
                  onChange={(e) => setDetailedMetrics(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-slate-900 border-slate-700 rounded focus:ring-blue-500"
                />
                <div>
                  <div className="text-sm font-medium text-slate-300">Detailed Metrics</div>
                  <div className="text-xs text-slate-500">
                    Analyze CPU, memory, network usage (slower, requires CloudWatch/Monitor)
                  </div>
                </div>
              </label>
            </div>
          </div>
        )}

        <div className="p-6 border-t border-slate-700 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleScan}
            disabled={loading || accounts.length === 0}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            Start Scan
          </button>
        </div>
      </div>
    </div>
  );
}
