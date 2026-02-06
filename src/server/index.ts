import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import {
  initializeSchema,
  saveScan,
  updateScanStatus,
  saveOpportunities,
  getScans,
  getScan,
  getOpportunities,
  getStats,
  getTrendData,
} from './db.js';
import {
  initializeCredentialsSchema,
  saveCredentials,
  listCredentials,
  getCredentials,
  deleteCredentials,
} from './credentials.js';

const PORT = 9090;
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
initializeSchema();
initializeCredentialsSchema();

// WebSocket for real-time updates
const clients = new Set<any>();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('WebSocket client connected');

  ws.on('close', () => {
    clients.delete(ws);
    console.log('WebSocket client disconnected');
  });
});

function broadcast(message: any) {
  const data = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(data);
    }
  });
}

// API Routes

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Get dashboard stats
app.get('/api/stats', (req: Request, res: Response) => {
  try {
    const stats = getStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get trend data
app.get('/api/trends', (req: Request, res: Response) => {
  try {
    const daysParam = req.query.days;
    const days = typeof daysParam === 'string' ? parseInt(daysParam) : 30;
    const trends = getTrendData(days);
    res.json(trends);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// List all scans
app.get('/api/scans', (req: Request, res: Response) => {
  try {
    const limitParam = req.query.limit;
    const limit = typeof limitParam === 'string' ? parseInt(limitParam) : 30;
    const scans = getScans(limit);
    res.json(scans);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific scan with opportunities
app.get('/api/scans/:id', (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    const scanId = parseInt(typeof idParam === 'string' ? idParam : idParam[0]);
    const scan = getScan(scanId);
    
    if (!scan) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    const opportunities = getOpportunities(scanId);
    
    res.json({
      ...scan,
      opportunities,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger a new scan
app.post('/api/scans', async (req: Request, res: Response) => {
  try {
    const { provider, region, credentialsId } = req.body;

    if (!provider) {
      return res.status(400).json({ error: 'Provider is required' });
    }

    // Get credentials if credentialsId provided, or use latest for provider
    let credentials: Record<string, string> | undefined;
    if (credentialsId) {
      const creds = getCredentials(credentialsId);
      if (!creds) {
        return res.status(404).json({ error: 'Credentials not found' });
      }
      credentials = creds.credentials;
    } else {
      // Try to find latest credentials for this provider
      const { getCredentialsByProvider } = await import('./credentials.js');
      const creds = getCredentialsByProvider(provider);
      if (creds) {
        credentials = creds.credentials;
      }
    }

    // Create scan record
    const scanId = saveScan({ provider, region });

    // Broadcast scan started
    broadcast({ type: 'scan_started', scanId, provider, region });

    // Import scan function dynamically
    const { runScan } = await import('./scanner.js');

    // Run scan in background with credentials
    runScan(scanId, provider, credentials, region)
      .then((result) => {
        updateScanStatus(scanId, 'completed', {
          totalSavings: result.totalSavings,
          opportunityCount: result.opportunities.length,
        });
        saveOpportunities(scanId, result.opportunities);
        
        broadcast({
          type: 'scan_completed',
          scanId,
          totalSavings: result.totalSavings,
          opportunityCount: result.opportunities.length,
        });
      })
      .catch((error) => {
        updateScanStatus(scanId, 'failed', {
          errorMessage: error.message,
        });
        
        broadcast({
          type: 'scan_failed',
          scanId,
          error: error.message,
        });
      });

    res.json({ scanId, status: 'started' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Credentials API endpoints

// List all credentials (without sensitive data)
app.get('/api/credentials', (req: Request, res: Response) => {
  try {
    const creds = listCredentials();
    res.json(creds);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Save new credentials
app.post('/api/credentials', (req: Request, res: Response) => {
  try {
    const { provider, name, credentials } = req.body;
    
    if (!provider || !name || !credentials) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const id = saveCredentials({ provider, name, credentials });
    res.json({ id, message: 'Credentials saved successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete credentials
app.delete('/api/credentials/:id', (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    const id = parseInt(typeof idParam === 'string' ? idParam : idParam[0]);
    deleteCredentials(id);
    res.json({ message: 'Credentials deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Serve static files (React app will be here)
const dashboardPath = path.join(__dirname, '../../dashboard/dist');

// Only serve static files if dist exists (production mode)
import { existsSync } from 'fs';
if (existsSync(dashboardPath)) {
  app.use(express.static(dashboardPath));
  
  // Catch-all route for React Router (must be LAST, after all API routes)
  // Use a function handler without specific path pattern to avoid path-to-regexp issues
  app.use((req: Request, res: Response, next) => {
    // Only handle GET requests that aren't API calls
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      res.sendFile(path.join(dashboardPath, 'index.html'));
    } else {
      next();
    }
  });
} else {
  // Development mode - just show a message for non-API routes
  app.use((req: Request, res: Response, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      res.json({
        message: 'Dashboard UI not built yet. Run "cd dashboard && npm run build" first.',
        api: 'API is available at /api/*',
      });
    } else {
      next();
    }
  });
}

export function startDashboardServer() {
  server.listen(PORT, () => {
    console.log(`Dashboard server running at http://localhost:${PORT}`);
    
    // Open browser automatically
    const open = async () => {
      try {
        const openModule = await import('open');
        await openModule.default(`http://localhost:${PORT}`);
      } catch (error) {
        console.log('Could not auto-open browser. Please visit http://localhost:9090');
      }
    };
    
    open();
  });

  return server;
}
