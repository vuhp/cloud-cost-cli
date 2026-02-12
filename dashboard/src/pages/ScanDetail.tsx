import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import type { ScanDetail } from '../api/client';

export default function ScanDetail() {
  const { id } = useParams<{ id: string }>();
  const [scan, setScan] = useState<ScanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [search, setSearch] = useState('');
  const [isWarningsExpanded, setIsWarningsExpanded] = useState(false);

  useEffect(() => {
    if (id) {
      loadScan(parseInt(id));
    }
  }, [id]);

  async function loadScan(scanId: number) {
    try {
      const data = await api.getScan(scanId);
      setScan(data);
    } catch (error) {
      console.error('Failed to load scan:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400 mb-4">Scan not found</p>
        <Link to="/scans" className="text-blue-400 hover:text-blue-300">
          ← Back to scans
        </Link>
      </div>
    );
  }

  const filteredOpportunities = scan.opportunities.filter((opp) => {
    const matchesFilter = filter === 'all' || opp.confidence === filter;
    const matchesSearch =
      search === '' ||
      opp.resource_id.toLowerCase().includes(search.toLowerCase()) ||
      opp.resource_type.toLowerCase().includes(search.toLowerCase()) ||
      opp.recommendation.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Extract region from resource_id if it has [region] prefix
  const extractRegion = (resourceId: string): { region: string | null; cleanId: string } => {
    const match = resourceId.match(/^\[([^\]]+)\]\s*(.+)$/);
    if (match) {
      return { region: match[1], cleanId: match[2] };
    }
    return { region: null, cleanId: resourceId };
  };

  const confidenceColors = {
    high: 'bg-green-900/50 text-green-300',
    medium: 'bg-yellow-900/50 text-yellow-300',
    low: 'bg-red-900/50 text-red-300',
  };

  return (
    <div>
      <div className="mb-6">
        <Link to="/scans" className="text-blue-400 hover:text-blue-300 text-sm mb-2 inline-block">
          ← Back to all scans
        </Link>
        <h1 className="text-3xl font-bold text-white mb-2">
          Scan #{scan.id} - {scan.provider.toUpperCase()}
        </h1>
        <div className="flex gap-4 text-slate-400 text-sm">
          <span>📅 {new Date(scan.started_at).toLocaleString()}</span>
          {scan.account_id && <span>👤 Account: {scan.account_id}</span>}
          {scan.region && <span>🌍 {scan.region}</span>}
        </div>
        <div className="mt-4">
          <button
            onClick={async () => {
              try {
                const resp = await fetch(`/api/scans/${scan.id}/export?format=excel`);
                if (!resp.ok) throw new Error('Failed to export');
                const blob = await resp.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `scan-${scan.id}-opportunities.xlsx`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
              } catch (err) {
                console.error('Export failed', err);
                alert('Export failed. Check server logs.');
              }
            }}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
          >
            Export Excel
          </button>
        </div>
      </div>

      {/* Warnings Banner */}
      {scan.warnings && (() => {
        try {
          const warnings = JSON.parse(scan.warnings) as string[];
          if (warnings.length > 0) {
            return (
              <div className="mb-6 bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="text-yellow-400 text-xl">⚠️</span>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-2">
                      <div className="font-medium text-yellow-300">
                        {warnings.length} analyzers encountered permission issues
                      </div>
                      <button
                        onClick={() => setIsWarningsExpanded(!isWarningsExpanded)}
                        className="text-xs bg-yellow-900/50 hover:bg-yellow-900 text-yellow-200 px-2 py-1 rounded border border-yellow-700 transition-colors cursor-pointer"
                      >
                        {isWarningsExpanded ? 'Hide Details' : 'Show Details'}
                      </button>
                    </div>

                    {isWarningsExpanded && (
                      <div className="mt-3 max-h-60 overflow-y-auto pr-2">
                        <ul className="text-sm text-yellow-200/80 space-y-1">
                          {warnings.map((w, i) => (
                            <li key={i}>• {w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          }
        } catch {
          // Invalid JSON, ignore
        }
        return null;
      })()}

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="text-sm text-slate-400 mb-1">Total Savings</div>
          <div className="text-3xl font-bold text-green-400">
            ${scan.total_savings.toFixed(2)}
            <span className="text-sm text-slate-400">/month</span>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="text-sm text-slate-400 mb-1">Opportunities</div>
          <div className="text-3xl font-bold text-white">{scan.opportunity_count}</div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="text-sm text-slate-400 mb-1">Yearly Savings</div>
          <div className="text-3xl font-bold text-green-400">
            ${(scan.total_savings * 12).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-4">
        <input
          type="text"
          placeholder="Search resources..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Confidence</option>
          <option value="high">High Only</option>
          <option value="medium">Medium Only</option>
          <option value="low">Low Only</option>
        </select>
      </div>

      {/* Opportunities */}
      <div className="bg-slate-800 rounded-lg border border-slate-700">
        {filteredOpportunities.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            No opportunities found matching your criteria
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {filteredOpportunities.map((opp) => {
              const { region, cleanId } = extractRegion(opp.resource_id);

              return (
                <div key={opp.id} className="p-6 hover:bg-slate-700/30 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className="text-white font-medium">{opp.resource_type.toUpperCase()}</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${confidenceColors[opp.confidence]}`}>
                          {opp.confidence.toUpperCase()}
                        </span>
                        <span className="text-xs text-slate-500">{opp.category}</span>
                        {region && (
                          <span className="px-2 py-1 rounded text-xs font-medium bg-blue-900/50 text-blue-300">
                            🌍 {region}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-400 font-mono mb-2">{cleanId}</div>
                      <div className="text-slate-300">{opp.recommendation}</div>
                    </div>
                    <div className="text-right ml-6">
                      <div className="text-2xl font-bold text-green-400">
                        ${opp.estimated_savings.toFixed(2)}
                      </div>
                      <div className="text-sm text-slate-500">/month</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
