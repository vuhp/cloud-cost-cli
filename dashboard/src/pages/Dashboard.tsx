import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { api } from '../api/client';
import type { Stats, TrendData } from '../api/client';
import { Link } from 'react-router-dom';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    loadData();
    
    // Connect to WebSocket for real-time updates
    const ws = api.connectWebSocket((data) => {
      if (data.type === 'scan_completed') {
        loadData();
        setScanning(false);
      } else if (data.type === 'scan_started') {
        setScanning(true);
      }
    });

    return () => ws.close();
  }, []);

  async function loadData() {
    try {
      const [statsData, trendsData] = await Promise.all([
        api.getStats(),
        api.getTrends(30),
      ]);
      setStats(statsData);
      setTrends(trendsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleScan(provider: string) {
    try {
      setScanning(true);
      // Use latest credentials for this provider (backend will handle it)
      await api.triggerScan(provider);
    } catch (error: any) {
      console.error('Failed to trigger scan:', error);
      alert(error.message || 'Failed to start scan. Make sure credentials are configured in Settings.');
      setScanning(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const chartData = {
    labels: trends.map((t) => new Date(t.date).toLocaleDateString()),
    datasets: [
      {
        label: 'Potential Savings',
        data: trends.map((t) => t.savings),
        fill: true,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderColor: 'rgb(59, 130, 246)',
        tension: 0.4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#e2e8f0',
        bodyColor: '#cbd5e1',
        borderColor: '#475569',
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        callbacks: {
          label: (context: any) => {
            return `$${context.parsed.y.toFixed(2)}/month`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: '#1e293b',
        },
        ticks: {
          color: '#94a3b8',
          callback: (value: any) => '$' + value,
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#94a3b8',
        },
      },
    },
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-slate-400">Cloud cost optimization overview</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="text-sm text-slate-400 mb-1">Total Scans</div>
          <div className="text-3xl font-bold text-white">{stats?.totalScans || 0}</div>
        </div>
        
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="text-sm text-slate-400 mb-1">Potential Savings</div>
          <div className="text-3xl font-bold text-green-400">
            ${(stats?.totalSavings || 0).toFixed(2)}
            <span className="text-sm text-slate-400">/month</span>
          </div>
        </div>
        
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="text-sm text-slate-400 mb-1">Yearly Savings</div>
          <div className="text-3xl font-bold text-green-400">
            ${((stats?.totalSavings || 0) * 12).toFixed(2)}
            <span className="text-sm text-slate-400">/year</span>
          </div>
        </div>
      </div>

      {/* Scan Buttons */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">Run New Scan</h2>
        <div className="flex gap-4">
          <button
            onClick={() => handleScan('aws')}
            disabled={scanning}
            className="px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {scanning ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Scanning...
              </>
            ) : (
              <>AWS</>
            )}
          </button>
          
          <button
            onClick={() => handleScan('azure')}
            disabled={scanning}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            Azure
          </button>
          
          <button
            onClick={() => handleScan('gcp')}
            disabled={scanning}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            GCP
          </button>
        </div>
      </div>

      {/* Trend Chart */}
      {trends.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Savings Over Time</h2>
          <div className="h-80">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>
      )}

      {/* Recent Scans */}
      {stats && stats.recentScans.length > 0 && (
        <div className="bg-slate-800 rounded-lg border border-slate-700">
          <div className="p-6 border-b border-slate-700">
            <h2 className="text-xl font-semibold text-white">Recent Scans</h2>
          </div>
          <div className="divide-y divide-slate-700">
            {stats.recentScans.slice(0, 5).map((scan) => (
              <Link
                key={scan.id}
                to={`/scans/${scan.id}`}
                className="block p-6 hover:bg-slate-700/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-white font-medium">{scan.provider.toUpperCase()}</span>
                      {scan.region && (
                        <span className="text-slate-400 text-sm">{scan.region}</span>
                      )}
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          scan.status === 'completed'
                            ? 'bg-green-900/50 text-green-300'
                            : scan.status === 'running'
                            ? 'bg-blue-900/50 text-blue-300'
                            : 'bg-red-900/50 text-red-300'
                        }`}
                      >
                        {scan.status}
                      </span>
                    </div>
                    <div className="text-sm text-slate-400 mt-1">
                      {new Date(scan.started_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-400">
                      ${scan.total_savings.toFixed(2)}
                    </div>
                    <div className="text-sm text-slate-400">
                      {scan.opportunity_count} opportunities
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="p-4 text-center border-t border-slate-700">
            <Link to="/scans" className="text-blue-400 hover:text-blue-300 text-sm font-medium">
              View all scans →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
