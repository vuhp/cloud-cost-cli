import { DefaultAzureCredential } from '@azure/identity';
import { ComputeManagementClient } from '@azure/arm-compute';
import { StorageManagementClient } from '@azure/arm-storage';
import { SqlManagementClient } from '@azure/arm-sql';
import { NetworkManagementClient } from '@azure/arm-network';
import { MonitorClient } from '@azure/arm-monitor';

export interface AzureClientConfig {
  subscriptionId?: string;
  location?: string;
}

export class AzureClient {
  private credential: DefaultAzureCredential;
  public subscriptionId: string;
  public location: string;

  constructor(config: AzureClientConfig = {}) {
    // Use Azure SDK's default credential chain (env vars, CLI, managed identity)
    this.credential = new DefaultAzureCredential();
    
    // Get subscription ID from env or config
    this.subscriptionId = config.subscriptionId || process.env.AZURE_SUBSCRIPTION_ID || '';
    
    if (!this.subscriptionId) {
      throw new Error(
        'Azure subscription ID not found. Set AZURE_SUBSCRIPTION_ID environment variable or use --subscription-id flag.'
      );
    }

    // Default to East US if no location specified
    this.location = config.location || '';
  }

  getComputeClient(): ComputeManagementClient {
    return new ComputeManagementClient(this.credential, this.subscriptionId);
  }

  getStorageClient(): StorageManagementClient {
    return new StorageManagementClient(this.credential, this.subscriptionId);
  }

  getSqlClient(): SqlManagementClient {
    return new SqlManagementClient(this.credential, this.subscriptionId);
  }

  getNetworkClient(): NetworkManagementClient {
    return new NetworkManagementClient(this.credential, this.subscriptionId);
  }

  getMonitorClient(): MonitorClient {
    return new MonitorClient(this.credential, this.subscriptionId);
  }
}
