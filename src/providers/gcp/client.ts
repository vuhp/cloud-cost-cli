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
      if (errorMsg.includes('authentication') || 
          errorMsg.includes('credentials') || 
          errorMsg.includes('permission') ||
          errorMsg.includes('quota') ||
          error.code === 401 || 
          error.code === 403) {
        throw new Error(
          'GCP authentication failed. Choose one of these options:\n\n' +
          'Option 1 - gcloud CLI (easiest):\n' +
          '  gcloud auth application-default login\n' +
          '  gcloud config set project YOUR_PROJECT_ID\n\n' +
          'Option 2 - Service Account (recommended for automation):\n' +
          '  export GOOGLE_APPLICATION_CREDENTIALS="/path/to/keyfile.json"\n' +
          '  export GCP_PROJECT_ID="your-project-id"\n\n' +
          'Option 3 - Compute Engine (for GCP VMs):\n' +
          '  Runs automatically on GCP VMs with service account attached\n\n' +
          'See: https://cloud.google.com/docs/authentication/getting-started'
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
