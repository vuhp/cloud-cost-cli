const API_BASE = '/api';

export interface Scan {
  id: number;
  provider: string;
  region?: string;
  account_id?: string;
  status: 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
  total_savings: number;
  opportunity_count: number;
  error_message?: string;
  warnings?: string;  // JSON stringified array of warnings
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

export interface CloudCredential {
  id: number;
  provider: string;
  name: string;
  created_at: string;
}

export interface SaveCredentialsRequest {
  provider: string;
  name: string;
  credentials: Record<string, string>;
}

export const api = {
  async getStats(): Promise<Stats> {
    const res = await fetch(`${API_BASE}/stats`);
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to fetch stats' }));
      throw new Error(error.error || 'Failed to fetch stats');
    }
    return res.json();
  },

  async getTrends(days: number = 30): Promise<TrendData[]> {
    const res = await fetch(`${API_BASE}/trends?days=${days}`);
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to fetch trends' }));
      throw new Error(error.error || 'Failed to fetch trends');
    }
    return res.json();
  },

  async getScans(limit: number = 30): Promise<Scan[]> {
    const res = await fetch(`${API_BASE}/scans?limit=${limit}`);
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to fetch scans' }));
      throw new Error(error.error || 'Failed to fetch scans');
    }
    return res.json();
  },

  async getScan(id: number): Promise<ScanDetail> {
    const res = await fetch(`${API_BASE}/scans/${id}`);
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to fetch scan' }));
      throw new Error(error.error || 'Failed to fetch scan');
    }
    return res.json();
  },

  async triggerScan(provider: string, credentialsId?: number, region?: string, detailedMetrics?: boolean): Promise<{ scanId: number }> {
    const res = await fetch(`${API_BASE}/scans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, credentialsId, region, detailedMetrics }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to trigger scan' }));
      throw new Error(error.error || 'Failed to trigger scan');
    }
    return res.json();
  },

  async getCredentials(): Promise<CloudCredential[]> {
    const res = await fetch(`${API_BASE}/credentials`);
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to fetch credentials' }));
      throw new Error(error.error || 'Failed to fetch credentials');
    }
    return res.json();
  },

  async saveCredentials(data: SaveCredentialsRequest): Promise<{ id: number }> {
    const res = await fetch(`${API_BASE}/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to save credentials' }));
      throw new Error(error.error || 'Failed to save credentials');
    }
    return res.json();
  },

  async deleteCredentials(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/credentials/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to delete credentials' }));
      throw new Error(error.error || 'Failed to delete credentials');
    }
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
