import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

const DB_DIR = path.join(os.homedir(), '.cloud-cost-cli');
const DB_PATH = path.join(DB_DIR, 'dashboard.db');

// Ensure directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

export const db: Database.Database = new Database(DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize schema
export function initializeSchema() {
  db.exec(`
    -- Accounts table
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      name TEXT,
      account_id TEXT,
      region TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Scans table
    CREATE TABLE IF NOT EXISTS scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT,
      provider TEXT NOT NULL,
      region TEXT,
      status TEXT DEFAULT 'running',
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      total_savings REAL DEFAULT 0,
      opportunity_count INTEGER DEFAULT 0,
      error_message TEXT
    );

    -- Opportunities table
    CREATE TABLE IF NOT EXISTS opportunities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_id INTEGER NOT NULL,
      opportunity_id TEXT,
      provider TEXT,
      resource_type TEXT,
      resource_id TEXT,
      resource_name TEXT,
      category TEXT,
      current_cost REAL,
      estimated_savings REAL,
      confidence TEXT,
      recommendation TEXT,
      metadata TEXT,
      detected_at DATETIME,
      FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_scans_started_at ON scans(started_at);
    CREATE INDEX IF NOT EXISTS idx_scans_provider ON scans(provider);
    CREATE INDEX IF NOT EXISTS idx_opportunities_scan_id ON opportunities(scan_id);
    CREATE INDEX IF NOT EXISTS idx_opportunities_confidence ON opportunities(confidence);
    CREATE INDEX IF NOT EXISTS idx_opportunities_savings ON opportunities(estimated_savings);
  `);
}

// Helper functions
export function saveScan(data: {
  provider: string;
  region?: string;
  accountId?: string;
}): number {
  const stmt = db.prepare(`
    INSERT INTO scans (provider, region, account_id, status)
    VALUES (?, ?, ?, 'running')
  `);
  
  const result = stmt.run(data.provider, data.region || null, data.accountId || null);
  return result.lastInsertRowid as number;
}

export function updateScanStatus(
  scanId: number,
  status: 'running' | 'completed' | 'failed',
  data?: {
    totalSavings?: number;
    opportunityCount?: number;
    errorMessage?: string;
  }
) {
  const stmt = db.prepare(`
    UPDATE scans
    SET status = ?,
        completed_at = CURRENT_TIMESTAMP,
        total_savings = COALESCE(?, total_savings),
        opportunity_count = COALESCE(?, opportunity_count),
        error_message = ?
    WHERE id = ?
  `);
  
  stmt.run(
    status,
    data?.totalSavings || null,
    data?.opportunityCount || null,
    data?.errorMessage || null,
    scanId
  );
}

export function updateScanAccountId(scanId: number, accountId: string) {
  const stmt = db.prepare('UPDATE scans SET account_id = ? WHERE id = ?');
  stmt.run(accountId, scanId);
}

export function saveOpportunities(scanId: number, opportunities: any[]) {
  const stmt = db.prepare(`
    INSERT INTO opportunities (
      scan_id, opportunity_id, provider, resource_type, resource_id,
      resource_name, category, current_cost, estimated_savings,
      confidence, recommendation, metadata, detected_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((opps: any[]) => {
    for (const opp of opps) {
      stmt.run(
        scanId,
        opp.id,
        opp.provider,
        opp.resourceType,
        opp.resourceId,
        opp.resourceName || null,
        opp.category,
        opp.currentCost,
        opp.estimatedSavings,
        opp.confidence,
        opp.recommendation,
        JSON.stringify(opp.metadata || {}),
        opp.detectedAt ? new Date(opp.detectedAt).toISOString() : new Date().toISOString()
      );
    }
  });

  insertMany(opportunities);
}

export function getScans(limit: number = 30) {
  const stmt = db.prepare(`
    SELECT * FROM scans
    ORDER BY started_at DESC
    LIMIT ?
  `);
  
  return stmt.all(limit);
}

export function getScan(scanId: number) {
  const stmt = db.prepare('SELECT * FROM scans WHERE id = ?');
  return stmt.get(scanId);
}

export function getOpportunities(scanId: number) {
  const stmt = db.prepare(`
    SELECT * FROM opportunities
    WHERE scan_id = ?
    ORDER BY estimated_savings DESC
  `);
  
  return stmt.all(scanId);
}

export function getStats() {
  const totalScans = db.prepare('SELECT COUNT(*) as count FROM scans').get() as any;
  
  // Get the most recent scan per provider (not per provider+region)
  // This prevents double-counting when scanning specific regions then all-regions
  const latestSavings = db.prepare(`
    SELECT SUM(total_savings) as total
    FROM (
      SELECT provider, total_savings
      FROM scans
      WHERE status = 'completed'
      GROUP BY provider
      HAVING started_at = MAX(started_at)
    )
  `).get() as any;
  
  const recentScans = db.prepare(`
    SELECT * FROM scans ORDER BY started_at DESC LIMIT 10
  `).all();

  return {
    totalScans: totalScans.count,
    totalSavings: latestSavings?.total || 0,
    recentScans,
  };
}

export function getTrendData(days: number = 30) {
  const stmt = db.prepare(`
    SELECT 
      DATE(started_at) as date,
      SUM(total_savings) as savings,
      COUNT(*) as scan_count
    FROM (
      SELECT 
        provider,
        DATE(started_at) as date,
        total_savings,
        started_at
      FROM scans
      WHERE status = 'completed'
        AND started_at >= datetime('now', '-' || ? || ' days')
      GROUP BY provider, DATE(started_at)
      HAVING started_at = MAX(started_at)
    )
    GROUP BY date
    ORDER BY date ASC
  `);
  
  return stmt.all(days);
}
