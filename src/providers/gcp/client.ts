import { InstancesClient, DisksClient, AddressesClient, GlobalAddressesClient } from '@google-cloud/compute';
import { Storage } from '@google-cloud/storage';
import { MetricServiceClient } from '@google-cloud/monitoring';
import { SqlInstancesServiceClient } from '@google-cloud/sql';

export interface GCPClientConfig {
  projectId?: string;
  region?: string;
  keyFilename?: string;
}

export class GCPClient {
  public projectId: string;
  public region: string;
  private computeClient: InstancesClient;
  private disksClient: DisksClient;
  private addressesClient: AddressesClient;
  private globalAddressesClient: GlobalAddressesClient;
  private storageClient: Storage;
  private monitoringClient: MetricServiceClient;
  private sqlClient: SqlInstancesServiceClient;

  constructor(config: GCPClientConfig = {}) {
    // Get project ID from config, env, or default credentials
    this.projectId = 
      config.projectId || 
      process.env.GCP_PROJECT_ID || 
      process.env.GOOGLE_CLOUD_PROJECT || 
      process.env.GCLOUD_PROJECT || 
      '';

    if (!this.projectId) {
      throw new Error(
        'GCP project ID not found. Set GCP_PROJECT_ID environment variable or use --project-id flag.'
      );
    }

    this.region = config.region || process.env.GCP_REGION || 'us-central1';

    // Initialize clients with optional keyFilename
    const clientConfig = config.keyFilename 
      ? { keyFilename: config.keyFilename }
      : {};

    this.computeClient = new InstancesClient(clientConfig);
    this.disksClient = new DisksClient(clientConfig);
    this.addressesClient = new AddressesClient(clientConfig);
    this.globalAddressesClient = new GlobalAddressesClient(clientConfig);
    this.storageClient = new Storage(clientConfig);
    this.monitoringClient = new MetricServiceClient(clientConfig);
    this.sqlClient = new SqlInstancesServiceClient(clientConfig);
  }

  // Test GCP credentials by making a lightweight API call
  async testConnection(): Promise<void> {
    try {
      // Try to list instances in a single zone (limited scope)
      const zone = `${this.region}-a`;
      const request = {
        project: this.projectId,
        zone: zone,
        maxResults: 1,
      };
      await this.computeClient.list(request);
    } catch (error: any) {
      const errorMsg = error.message || '';
      
      // Show the actual error for debugging
      if (process.env.DEBUG) {
        console.error('GCP API Error:', error);
      }
      
      // Check for credential errors first (before API calls)
      if (errorMsg.includes('Could not load the default credentials') ||
          errorMsg.includes('NO_ADC_FOUND') ||
          errorMsg.includes('GOOGLE_APPLICATION_CREDENTIALS')) {
        throw new Error(
          'GCP credentials not found. Choose one of these options:\n\n' +
          'Option 1 - gcloud CLI (easiest for local development):\n' +
          '  gcloud auth application-default login\n' +
          '  gcloud config set project ' + this.projectId + '\n\n' +
          'Option 2 - Service Account (recommended for CI/CD and automation):\n' +
          '  export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"\n' +
          '  export GCP_PROJECT_ID="' + this.projectId + '"\n\n' +
          'Option 3 - Compute Engine (automatic on GCP VMs):\n' +
          '  Runs automatically on GCP VMs with default service account\n\n' +
          'For service account keys, see:\n' +
          'https://cloud.google.com/iam/docs/keys-create-delete'
        );
      }
      
      if (errorMsg.includes('authentication') || 
          errorMsg.includes('credentials') || 
          errorMsg.includes('permission') ||
          errorMsg.includes('quota') ||
          errorMsg.includes('Compute Engine API has not been used') ||
          error.code === 401 || 
          error.code === 403 ||
          error.code === 7) {  // gRPC PERMISSION_DENIED
        
        // Provide specific error context
        let specificError = '';
        if (errorMsg.includes('Compute Engine API has not been used')) {
          specificError = '\n⚠️  Compute Engine API is not enabled for this project.\n' +
                         'Enable it at: https://console.cloud.google.com/apis/library/compute.googleapis.com\n\n';
        } else if (errorMsg.includes('permission')) {
          specificError = `\n⚠️  Permission denied. Actual error: ${errorMsg}\n\n`;
        }
        
        throw new Error(
          specificError +
          'GCP authentication or permissions issue. Choose one of these options:\n\n' +
          'Option 1 - gcloud CLI (easiest):\n' +
          '  gcloud auth application-default login\n' +
          '  gcloud config set project YOUR_PROJECT_ID\n\n' +
          'Option 2 - Service Account (recommended for automation):\n' +
          '  export GOOGLE_APPLICATION_CREDENTIALS="/path/to/keyfile.json"\n' +
          '  export GCP_PROJECT_ID="your-project-id"\n\n' +
          'Option 3 - Compute Engine (for GCP VMs):\n' +
          '  Runs automatically on GCP VMs with service account attached\n\n' +
          'If authenticated, ensure Compute Engine API is enabled:\n' +
          'https://console.cloud.google.com/apis/library/compute.googleapis.com?project=' + this.projectId
        );
      }
      throw error;
    }
  }

  getComputeClient(): InstancesClient {
    return this.computeClient;
  }

  getDisksClient(): DisksClient {
    return this.disksClient;
  }

  getAddressesClient(): AddressesClient {
    return this.addressesClient;
  }

  getGlobalAddressesClient(): GlobalAddressesClient {
    return this.globalAddressesClient;
  }

  getStorageClient(): Storage {
    return this.storageClient;
  }

  getMonitoringClient(): MetricServiceClient {
    return this.monitoringClient;
  }

  getCloudSQLClient(): SqlInstancesServiceClient {
    return this.sqlClient;
  }
}
