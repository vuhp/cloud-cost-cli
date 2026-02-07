import { AzureClient } from './client';
import { SavingsOpportunity } from '../../types/opportunity';

/**
 * Analyze Azure Functions for cost optimization opportunities
 * 
 * Azure Functions pricing (East US):
 * Consumption Plan:
 * - $0.20 per million executions
 * - $0.000016 per GB-s
 * 
 * Premium Plan:
 * - EP1: $175.20/month
 * - EP2: $350.40/month
 * - EP3: $700.80/month
 */
export async function analyzeAzureFunctions(
  client: AzureClient
): Promise<SavingsOpportunity[]> {
  const opportunities: SavingsOpportunity[] = [];

  try {
    const webClient = client.getWebSiteManagementClient();
    const monitorClient = client.getMonitorClient();

    // List all function apps
    const functionApps = [];
    for await (const app of webClient.webApps.list()) {
      // Check if it's a function app (kind includes 'functionapp')
      if (app.kind?.toLowerCase().includes('functionapp')) {
        functionApps.push(app);
      }
    }

    for (const app of functionApps) {
      if (!app.id || !app.name) continue;

      const appName = app.name;
      const state = app.state;
      const serverFarmId = app.serverFarmId;

      if (state !== 'Running') continue;

      // Get the App Service Plan to determine pricing tier
      let tier = 'Consumption';
      let monthlyCost = 0;

      if (serverFarmId) {
        try {
          const plan = await webClient.appServicePlans.get(
            serverFarmId.split('/')[4], // resource group
            serverFarmId.split('/')[8]  // plan name
          );

          tier = plan.sku?.tier || 'Consumption';

          // Estimate cost for Premium plans
          if (tier.startsWith('Elastic')) {
            const skuName = plan.sku?.name || 'EP1';
            monthlyCost = estimatePremiumCost(skuName);
          }
        } catch (error) {
          // If we can't get the plan, assume Consumption
          tier = 'Consumption';
        }
      }

      // Opportunity 1: Premium plan with potentially low usage
      if (tier.startsWith('Elastic') && monthlyCost > 0) {
        // Premium plans are expensive - recommend review
        const consumptionEstimate = 20; // Assume moderate usage costs $20 on consumption
        const savings = monthlyCost - consumptionEstimate;

        if (savings > 50) {
          opportunities.push({
            id: `azure-functions-premium-${appName}`,
            provider: 'azure',
            resourceType: 'azure-functions',
            resourceId: app.id,
            resourceName: appName,
            category: 'oversized',
            currentCost: monthlyCost,
            estimatedSavings: savings,
            confidence: 'low',
            recommendation: `Review Premium plan usage. Consider Consumption plan if traffic is low/sporadic. Premium: $${monthlyCost}/mo vs Consumption: pay-per-use.`,
            metadata: {
              tier,
              location: app.location,
              state,
            },
            detectedAt: new Date(),
          });
        }
      }

      // Opportunity 2: Stopped or disabled function app
      if (state !== 'Running' && monthlyCost > 0) {
        opportunities.push({
          id: `azure-functions-stopped-${appName}`,
          provider: 'azure',
          resourceType: 'azure-functions',
          resourceId: app.id,
          resourceName: appName,
          category: 'unused',
          currentCost: monthlyCost,
          estimatedSavings: monthlyCost,
          confidence: 'high',
          recommendation: `Delete stopped Function App (state: ${state})`,
          metadata: {
            tier,
            location: app.location,
            state,
          },
          detectedAt: new Date(),
        });
      }
    }

    return opportunities;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Estimate monthly cost for Premium (Elastic) plans
 */
function estimatePremiumCost(skuName: string): number {
  const costs: Record<string, number> = {
    'EP1': 175.20,
    'EP2': 350.40,
    'EP3': 700.80,
  };

  return costs[skuName] || 175.20;
}
