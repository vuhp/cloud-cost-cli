import { DefaultAzureCredential } from '@azure/identity';
import { ComputeManagementClient } from '@azure/arm-compute';
import { StorageManagementClient } from '@azure/arm-storage';
import { SqlManagementClient } from '@azure/arm-sql';
import { NetworkManagementClient } from '@azure/arm-network';
import { MonitorClient } from '@azure/arm-monitor';
import { WebSiteManagementClient } from '@azure/arm-appservice';
import { CosmosDBManagementClient } from '@azure/arm-cosmosdb';
import { ContainerServiceClient } from '@azure/arm-containerservice';

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

  // Test Azure credentials by making a lightweight API call
  async testConnection(): Promise<void> {
    try {
      const computeClient = this.getComputeClient();
      // Try to list VMs (we'll just get an iterator, not actually iterate)
      const vmsIterator = computeClient.virtualMachines.listAll();
      // Get first page to test auth
      await vmsIterator.next();
    } catch (error: any) {
      const errorMsg = error.message || '';
      if (errorMsg.includes('No subscriptions found') ||
        errorMsg.includes('authentication') ||
        errorMsg.includes('credentials') ||
        errorMsg.includes('login') ||
        error.statusCode === 401 ||
        error.code === 'CredentialUnavailableError') {
        throw new Error(
          'Azure authentication failed. Choose one of these options:\n\n' +
          'Option 1 - Azure CLI (easiest):\n' +
          '  az login\n\n' +
          'Option 2 - Service Principal (recommended for automation):\n' +
          '  export AZURE_CLIENT_ID="your-app-id"\n' +
          '  export AZURE_CLIENT_SECRET="your-secret"\n' +
          '  export AZURE_TENANT_ID="your-tenant-id"\n\n' +
          'Option 3 - Managed Identity (for Azure VMs):\n' +
          '  Runs automatically on Azure VMs with managed identity enabled\n\n' +
          'See: https://learn.microsoft.com/en-us/javascript/api/overview/azure/identity-readme'
        );
      }
      throw error;
    }
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

  getWebSiteManagementClient(): WebSiteManagementClient {
    return new WebSiteManagementClient(this.credential, this.subscriptionId);
  }

  getCosmosDBManagementClient(): CosmosDBManagementClient {
    return new CosmosDBManagementClient(this.credential, this.subscriptionId);
  }

  getContainerServiceClient(): ContainerServiceClient {
    return new ContainerServiceClient(this.credential, this.subscriptionId);
  }
}
