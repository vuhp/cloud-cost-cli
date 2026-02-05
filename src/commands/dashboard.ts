import { Command } from 'commander';
import { startDashboardServer } from '../server/index.js';

export const dashboardCommand = new Command('dashboard')
  .description('Start the web dashboard')
  .option('-p, --port <number>', 'Port to run the server on', '9090')
  .option('--no-open', 'Do not auto-open browser')
  .action(async (options) => {
    console.log('Starting cloud-cost-cli dashboard...');
    console.log(`Opening browser at http://localhost:${options.port}`);
    
    try {
      startDashboardServer();
    } catch (error: any) {
      console.error('Failed to start dashboard:', error.message);
      process.exit(1);
    }

    // Keep process running
    process.on('SIGINT', () => {
      console.log('\nShutting down dashboard...');
      process.exit(0);
    });
  });
