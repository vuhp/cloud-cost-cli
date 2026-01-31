import OpenAI from 'openai';
import { SavingsOpportunity } from '../types';

export interface AIExplanation {
  summary: string;
  whyWasteful: string;
  actionPlan: string[];
  riskLevel: 'low' | 'medium' | 'high';
  estimatedTime: string;
  script?: string;
}

export class AIService {
  private client: OpenAI | null = null;
  private enabled: boolean = false;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
      this.enabled = true;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async explainOpportunity(opportunity: SavingsOpportunity): Promise<AIExplanation> {
    if (!this.client) {
      throw new Error('AI service not configured. Set OPENAI_API_KEY environment variable.');
    }

    const prompt = this.buildPrompt(opportunity);

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a cloud cost optimization expert. Provide clear, actionable advice for reducing cloud costs. Be concise, practical, and encouraging. Focus on real-world steps users can take immediately.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content || '';
      return this.parseExplanation(content, opportunity);
    } catch (error: any) {
      throw new Error(`AI explanation failed: ${error.message}`);
    }
  }

  private buildPrompt(opportunity: SavingsOpportunity): string {
    return `
Analyze this cloud cost optimization opportunity and provide actionable guidance:

**Resource Details:**
- Type: ${opportunity.resourceType}
- ID: ${opportunity.resourceId}
- Name: ${opportunity.resourceName || 'N/A'}
- Category: ${opportunity.category}
- Current Cost: $${opportunity.currentCost}/month
- Potential Savings: $${opportunity.estimatedSavings}/month
- Recommendation: ${opportunity.recommendation}
- Metadata: ${JSON.stringify(opportunity.metadata, null, 2)}

**Please provide:**

1. **Summary** (1 sentence): Quick explanation of what's wasteful
2. **Why Wasteful** (2-3 sentences): Explain the problem in simple terms
3. **Action Plan** (numbered steps): Specific actions to take, prioritized
4. **Risk Level** (low/medium/high): How risky is this change?
5. **Estimated Time**: How long will this take to implement?

Format your response as JSON:
{
  "summary": "...",
  "whyWasteful": "...",
  "actionPlan": ["1. ...", "2. ...", "3. ..."],
  "riskLevel": "low|medium|high",
  "estimatedTime": "X minutes/hours"
}
`;
  }

  private parseExplanation(content: string, opportunity: SavingsOpportunity): AIExplanation {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || 'AI explanation unavailable',
          whyWasteful: parsed.whyWasteful || '',
          actionPlan: Array.isArray(parsed.actionPlan) ? parsed.actionPlan : [],
          riskLevel: parsed.riskLevel || 'medium',
          estimatedTime: parsed.estimatedTime || 'Unknown',
        };
      }

      // Fallback: return the raw content as summary
      return {
        summary: content.substring(0, 200),
        whyWasteful: content,
        actionPlan: [],
        riskLevel: 'medium',
        estimatedTime: 'Unknown',
      };
    } catch (error) {
      // Parsing failed, return raw content
      return {
        summary: 'AI explanation available in raw format',
        whyWasteful: content,
        actionPlan: [],
        riskLevel: 'medium',
        estimatedTime: 'Unknown',
      };
    }
  }
}
