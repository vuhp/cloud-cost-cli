import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { CloudCredential } from '../api/client';

type Provider = 'aws' | 'azure' | 'gcp';

export default function Settings() {
  const [credentials, setCredentials] = useState<CloudCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider>('aws');
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCredentials();
  }, []);

  async function loadCredentials() {
    try {
      const data = await api.getCredentials();
      setCredentials(data);
    } catch (error) {
      console.error('Failed to load credentials:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      await api.saveCredentials({
        provider: selectedProvider,
        name: formData.name || `${selectedProvider.toUpperCase()} Account`,
        credentials: { ...formData },
      });
      setShowForm(false);
      setFormData({});
      await loadCredentials();
    } catch (error: any) {
      alert('Failed to save credentials: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete these credentials? This cannot be undone.')) return;
    
    try {
      await api.deleteCredentials(id);
      await loadCredentials();
    } catch (error: any) {
      alert('Failed to delete credentials: ' + error.message);
    }
  }

  const providerFields: Record<Provider, Array<{ key: string; label: string; type?: string; placeholder?: string }>> = {
    aws: [
      { key: 'name', label: 'Account Name', placeholder: 'e.g., Work AWS' },
      { key: 'accessKeyId', label: 'Access Key ID', placeholder: 'AKIA...' },
      { key: 'secretAccessKey', label: 'Secret Access Key', type: 'password', placeholder: 'wJalrXUtn...' },
      { key: 'region', label: 'Default Region (optional)', placeholder: 'us-east-1' },
    ],
    azure: [
      { key: 'name', label: 'Account Name', placeholder: 'e.g., Work Azure' },
      { key: 'subscriptionId', label: 'Subscription ID', placeholder: 'xxxxxxxx-xxxx-...' },
      { key: 'tenantId', label: 'Tenant ID', placeholder: 'xxxxxxxx-xxxx-...' },
      { key: 'clientId', label: 'Client ID', placeholder: 'xxxxxxxx-xxxx-...' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: 'xxxxx~xxxxx...' },
    ],
    gcp: [
      { key: 'name', label: 'Account Name', placeholder: 'e.g., Work GCP' },
      { key: 'projectId', label: 'Project ID', placeholder: 'my-project-123456' },
      { key: 'keyFile', label: 'Service Account JSON', placeholder: 'Paste entire JSON content here' },
    ],
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
          <p className="text-slate-400">Manage cloud provider credentials</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          + Add Credentials
        </button>
      </div>

      {/* Add Credentials Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-700">
            <div className="p-6 border-b border-slate-700">
              <h2 className="text-2xl font-bold text-white">Add Credentials</h2>
            </div>
            
            <div className="p-6">
              {/* Provider Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Cloud Provider
                </label>
                <div className="flex gap-3">
                  {(['aws', 'azure', 'gcp'] as Provider[]).map((provider) => (
                    <button
                      key={provider}
                      onClick={() => {
                        setSelectedProvider(provider);
                        setFormData({});
                      }}
                      className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                        selectedProvider === provider
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {provider.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Form Fields */}
              <div className="space-y-4">
                {providerFields[selectedProvider].map((field) => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      {field.label}
                    </label>
                    {field.key === 'keyFile' ? (
                      <textarea
                        value={formData[field.key] || ''}
                        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                        placeholder={field.placeholder}
                        rows={6}
                        className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-sm"
                      />
                    ) : (
                      <input
                        type={field.type || 'text'}
                        value={formData[field.key] || ''}
                        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                        placeholder={field.placeholder}
                        className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-slate-700 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowForm(false);
                  setFormData({});
                }}
                className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.name}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {saving ? 'Saving...' : 'Save Credentials'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credentials List */}
      {credentials.length === 0 ? (
        <div className="bg-slate-800 rounded-lg p-12 border border-slate-700 text-center">
          <svg
            className="w-16 h-16 text-slate-600 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
            />
          </svg>
          <p className="text-slate-400 text-lg mb-4">No credentials configured</p>
          <p className="text-slate-500 mb-6">Add your cloud provider credentials to start scanning</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Add Your First Credentials
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {credentials.map((cred) => (
            <div key={cred.id} className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">{cred.name}</h3>
                  <p className="text-sm text-slate-400 mt-1">{cred.provider.toUpperCase()}</p>
                </div>
                <button
                  onClick={() => handleDelete(cred.id)}
                  className="text-red-400 hover:text-red-300 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              <div className="text-xs text-slate-500">
                Added {new Date(cred.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
