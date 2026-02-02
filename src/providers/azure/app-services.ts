import { AzureClient } from './client';
import { SavingsOpportunity } from '../../types/opportunity';

/**
 * Analyze Azure App Service Plans for cost optimization opportunities
 * 
 * App Service pricing (East US):
 * - Basic B1: $13.14/month
 * - Standard S1: $69.35/month
 * - Premium P1v2: $146/month
 */
export async function analyzeAppServicePlans(
  client: AzureClient
): Promise<SavingsOpportunity[]> {
  const opportunities: SavingsOpportunity[] = [];

  try {
    const webClient = client.getWebSiteManagementClient();
    const monitorClient = client.getMonitorClient();
    const subscriptionId = client.subscriptionId;

    // List all App Service Plans
    const plans = [];
    for await (const plan of webClient.appServicePlans.list()) {
      plans.push(plan);
    }

    for (const plan of plans) {
      if (!plan.id || !plan.name) continue;

      const planName = plan.name;
      const sku = plan.sku;
      const tier = sku?.tier || 'Unknown';
      const capacity = sku?.capacity || 1;
      const numberOfWorkers = plan.numberOfWorkers || 0;
      const status = plan.status;

      if (status !== 'Ready') continue;

      // Get apps using this plan
      const apps = [];
      for await (const app of webClient.webApps.list()) {
        if (app.serverFarmId === plan.id) {
          apps.push(app);
        }
      }

      const numberOfApps = apps.length;

      // Calculate monthly cost (rough estimates)
      const monthlyCost = estimateAppServiceCost(tier, capacity);

      // Opportunity 1: Empty App Service Plan (no apps)
      if (numberOfApps === 0) {
        opportunities.push({
          id: `azure-appservice-empty-${planName}`,
          provider: 'azure',
          resourceType: 'app-service-plan',
          resourceId: plan.id,
          resourceName: planName,
          category: 'unused',
          currentCost: monthlyCost,
          estimatedSavings: monthlyCost,
          confidence: 'high',
          recommendation: `Delete empty App Service Plan (0 apps deployed)`,
          metadata: {
            tier,
            capacity,
            numberOfApps,
            location: plan.location,
          },
          detectedAt: new Date(),
        });
      }
      // Opportunity 2: Oversized plan (Premium/Standard with only 1 app)
      else if ((tier === 'Premium' || tier === 'PremiumV2' || tier === 'PremiumV3') && numberOfApps === 1) {
        const recommendedTier = 'Standard';
        const recommendedCost = estimateAppServiceCost(recommendedTier, 1);
        const savings = monthlyCost - recommendedCost;

        if (savings > 20) {
          opportunities.push({
            id: `azure-appservice-oversized-${planName}`,
            provider: 'azure',
            resourceType: 'app-service-plan',
            resourceId: plan.id,
            resourceName: planName,
            category: 'oversized',
            currentCost: monthlyCost,
            estimatedSavings: savings,
            confidence: 'medium',
            recommendation: `Downgrade from ${tier} to ${recommendedTier} (only 1 app, likely over-provisioned)`,
            metadata: {
              currentTier: tier,
              recommendedTier,
              capacity,
              numberOfApps,
              location: plan.location,
            },
            detectedAt: new Date(),
          });
        }
      }
      // Opportunity 3: Multiple workers but low app count
      else if (capacity > 1 && numberOfApps === 1) {
        const recommendedCapacity = 1;
        const recommendedCost = estimateAppServiceCost(tier, recommendedCapacity);
        const savings = monthlyCost - recommendedCost;

        if (savings > 20) {
          opportunities.push({
            id: `azure-appservice-overcapacity-${planName}`,
            provider: 'azure',
            resourceType: 'app-service-plan',
            resourceId: plan.id,
            resourceName: planName,
            category: 'oversized',
            currentCost: monthlyCost,
            estimatedSavings: savings,
            confidence: 'medium',
            recommendation: `Reduce capacity from ${capacity} to ${recommendedCapacity} instance(s) (only ${numberOfApps} app)`,
            metadata: {
              tier,
              currentCapacity: capacity,
              recommendedCapacity,
              numberOfApps,
              location: plan.location,
            },
            detectedAt: new Date(),
          });
        }
      }
    }

    return opportunities;
  } catch (error: any) {
    console.error('Error analyzing App Service Plans:', error.message);
    return opportunities;
  }
}

/**
 * Estimate monthly cost for App Service Plan
 * Pricing based on East US region (Jan 2026)
 */
function estimateAppServiceCost(tier: string, capacity: number): number {
  const baseCosts: Record<string, number> = {
    'Free': 0,
    'Shared': 9.49,
    'Basic': 13.14,      // B1
    'Standard': 69.35,   // S1
    'Premium': 146,      // P1
    'PremiumV2': 146,    // P1v2
    'PremiumV3': 204,    // P1v3
    'Isolated': 730,     // I1
    'IsolatedV2': 730,   // I1v2
  };

  const baseCost = baseCosts[tier] || 50;
  return baseCost * capacity;
}
