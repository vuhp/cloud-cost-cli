import { db } from './db.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.cloud-cost-cli');
const KEY_FILE = path.join(CONFIG_DIR, 'encryption.key');

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Get or create persistent encryption key
function getEncryptionKey(): string {
  if (fs.existsSync(KEY_FILE)) {
    // Read existing key
    return fs.readFileSync(KEY_FILE, 'utf8').trim();
  } else {
    // Generate new key and save it
    const key = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(KEY_FILE, key, { mode: 0o600 }); // Owner read/write only
    return key;
  }
}

const ENCRYPTION_KEY = getEncryptionKey();
const ALGORITHM = 'aes-256-gcm';

interface CloudCredentials {
  id?: number;
  provider: 'aws' | 'azure' | 'gcp';
  name: string;
  credentials: Record<string, string>;
  created_at?: string;
}

// Encrypt sensitive data
function encrypt(text: string): { encrypted: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex'),
  };
}

// Decrypt sensitive data
function decrypt(encrypted: string, iv: string, tag: string): string {
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// Initialize credentials table
export function initializeCredentialsSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      name TEXT NOT NULL,
      encrypted_data TEXT NOT NULL,
      iv TEXT NOT NULL,
      tag TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// Save credentials
export function saveCredentials(creds: CloudCredentials): number {
  const encrypted = encrypt(JSON.stringify(creds.credentials));
  
  const stmt = db.prepare(`
    INSERT INTO credentials (provider, name, encrypted_data, iv, tag)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run(
    creds.provider,
    creds.name,
    encrypted.encrypted,
    encrypted.iv,
    encrypted.tag
  );
  
  return result.lastInsertRowid as number;
}

// Get all credentials (without sensitive data)
export function listCredentials(): Array<{ id: number; provider: string; name: string; created_at: string }> {
  const stmt = db.prepare(`
    SELECT id, provider, name, created_at
    FROM credentials
    ORDER BY created_at DESC
  `);
  
  return stmt.all() as any[];
}

// Get credentials by ID (decrypted)
export function getCredentials(id: number): CloudCredentials | null {
  const stmt = db.prepare(`
    SELECT id, provider, name, encrypted_data, iv, tag, created_at
    FROM credentials
    WHERE id = ?
  `);
  
  const row = stmt.get(id) as any;
  if (!row) return null;
  
  const decrypted = decrypt(row.encrypted_data, row.iv, row.tag);
  
  return {
    id: row.id,
    provider: row.provider,
    name: row.name,
    credentials: JSON.parse(decrypted),
    created_at: row.created_at,
  };
}

// Delete credentials
export function deleteCredentials(id: number): void {
  const stmt = db.prepare('DELETE FROM credentials WHERE id = ?');
  stmt.run(id);
}

// Get credentials for a provider
export function getCredentialsByProvider(provider: string): CloudCredentials | null {
  const stmt = db.prepare(`
    SELECT id, provider, name, encrypted_data, iv, tag, created_at
    FROM credentials
    WHERE provider = ?
    ORDER BY created_at DESC
    LIMIT 1
  `);
  
  const row = stmt.get(provider) as any;
  if (!row) return null;
  
  const decrypted = decrypt(row.encrypted_data, row.iv, row.tag);
  
  return {
    id: row.id,
    provider: row.provider,
    name: row.name,
    credentials: JSON.parse(decrypted),
    created_at: row.created_at,
  };
}
