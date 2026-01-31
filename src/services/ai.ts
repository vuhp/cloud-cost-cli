import OpenAI from 'openai';
import { Ollama } from 'ollama';
import { SavingsOpportunity } from '../types';
import { ScriptGenerator } from './script-generator';
import { ExplanationCache } from '../utils/cache';

export interface AIExplanation {
  summary: string;
  whyWasteful: string;
  actionPlan: string[];
  riskLevel: 'low' | 'medium' | 'high';
  estimatedTime: string;
  script?: string;
  cached?: boolean;
}

export type AIProvider = 'openai' | 'ollama';

export interface AIConfig {
  provider: AIProvider;
  apiKey?: string;
  model?: string;
  maxExplanations?: number;
}

export class AIService {
  private openaiClient: OpenAI | null = null;
  private ollamaClient: Ollama | null = null;
  private provider: AIProvider;
  private model: string = 'gpt-4o-mini';
  private enabled: boolean = false;
  private maxExplanations: number = 3;
  private cache: ExplanationCache;
  private useCache: boolean = true;

  constructor(config?: AIConfig) {
    this.cache = new ExplanationCache();
    
    if (!config) {
      // Try to auto-detect from environment
      if (process.env.OPENAI_API_KEY) {
        config = { provider: 'openai', apiKey: process.env.OPENAI_API_KEY };
      } else {
        // Default to ollama (local, no API key needed)
        config = { provider: 'ollama' };
      }
    }

    this.provider = config.provider;
    this.maxExplanations = config.maxExplanations || 3;

    if (config.provider === 'openai') {
      if (!config.apiKey) {
        throw new Error('OpenAI API key required');
      }
      this.openaiClient = new OpenAI({ apiKey: config.apiKey });
      this.model = config.model || 'gpt-4o-mini';
      this.enabled = true;
    } else if (config.provider === 'ollama') {
      this.ollamaClient = new Ollama({ host: 'http://localhost:11434' });
      this.model = config.model || 'llama3.2:3b';
      this.enabled = true;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getMaxExplanations(): number {
    return this.maxExplanations;
  }

  async explainOpportunity(opportunity: SavingsOpportunity): Promise<AIExplanation> {
    // Check cache first
    if (this.useCache) {
      const cached = this.cache.get(opportunity, this.provider, this.model);
      if (cached) {
        return { ...cached, cached: true };
      }
    }

    const prompt = this.buildPrompt(opportunity);

    try {
      let content: string;

      if (this.provider === 'openai' && this.openaiClient) {
        const response = await this.openaiClient.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are a cloud cost optimization expert. Provide clear, actionable advice for reducing cloud costs. Be concise, practical, and encouraging. Focus on real-world steps users can take immediately. Always respond with valid JSON.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 500,
        });
        content = response.choices[0]?.message?.content || '';
      } else if (this.provider === 'ollama' && this.ollamaClient) {
        const response = await this.ollamaClient.chat({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are a cloud cost optimization expert. Provide clear, actionable advice for reducing cloud costs. Be concise, practical, and encouraging. Focus on real-world steps users can take immediately. Always respond with valid JSON.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          options: {
            temperature: 0.7,
            num_predict: 500,
          },
        });
        content = response.message.content;
      } else {
        throw new Error('No AI provider configured');
      }

      const explanation = this.parseExplanation(content, opportunity);
      
      // Cache the result
      if (this.useCache) {
        this.cache.set(opportunity, this.provider, this.model, explanation);
      }
      
      return { ...explanation, cached: false };
    } catch (error: any) {
      throw new Error(`AI explanation failed: ${error.message}`);
    }
  }

  async generateRemediationScript(opportunity: SavingsOpportunity): Promise<string | null> {
    const generator = new ScriptGenerator();
    const script = generator.generateRemediation(opportunity);
    
    if (!script) {
      return null;
    }
    
    return generator.renderScript(script);
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
