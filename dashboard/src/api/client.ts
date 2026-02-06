const API_BASE = '/api';

export interface Scan {
  id: number;
  provider: string;
  region?: string;
  status: 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
  total_savings: number;
  opportunity_count: number;
  error_message?: string;
}

export interface Opportunity {
  id: number;
  scan_id: number;
  opportunity_id: string;
  provider: string;
  resource_type: string;
  resource_id: string;
  resource_name?: string;
  category: string;
  current_cost: number;
  estimated_savings: number;
  confidence: 'high' | 'medium' | 'low';
  recommendation: string;
  metadata: string;
  detected_at: string;
}

export interface ScanDetail extends Scan {
  opportunities: Opportunity[];
}

export interface Stats {
  totalScans: number;
  totalSavings: number;
  recentScans: Scan[];
}

export interface TrendData {
  date: string;
  savings: number;
  scan_count: number;
}

export const api = {
  async getStats(): Promise<Stats> {
    const res = await fetch(`${API_BASE}/stats`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  },

  async getTrends(days: number = 30): Promise<TrendData[]> {
    const res = await fetch(`${API_BASE}/trends?days=${days}`);
    if (!res.ok) throw new Error('Failed to fetch trends');
    return res.json();
  },

  async getScans(limit: number = 30): Promise<Scan[]> {
    const res = await fetch(`${API_BASE}/scans?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch scans');
    return res.json();
  },

  async getScan(id: number): Promise<ScanDetail> {
    const res = await fetch(`${API_BASE}/scans/${id}`);
    if (!res.ok) throw new Error('Failed to fetch scan');
    return res.json();
  },

  async triggerScan(provider: string, region?: string): Promise<{ scanId: number }> {
    const res = await fetch(`${API_BASE}/scans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, region }),
    });
    if (!res.ok) throw new Error('Failed to trigger scan');
    return res.json();
  },

  connectWebSocket(onMessage: (data: any) => void): WebSocket {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessage(data);
    };
    return ws;
  },
};
