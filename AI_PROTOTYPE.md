# AI-Powered Explanations (Prototype)

**Status:** 🚧 Experimental prototype  
**Added:** 2026-01-31

## Overview

The `--explain` flag adds AI-powered contextual explanations to your cost optimization scan results. Instead of just seeing "Stop idle instance", you get:

- **Why** it's wasteful (in plain English)
- **Action plan** (step-by-step what to do)
- **Risk assessment** (low/medium/high)
- **Time estimate** (how long will this take)

## Usage

### Setup

1. **Get an OpenAI API key:**
   - Go to https://platform.openai.com/api-keys
   - Create a new API key
   - Copy it (starts with `sk-...`)

2. **Set the environment variable:**
   ```bash
   export OPENAI_API_KEY="sk-your-api-key-here"
   ```

3. **Run scan with --explain:**
   ```bash
   cloud-cost-cli scan --provider aws --region us-east-1 --explain
   ```

### Example Output

**Without --explain:**
```
┌───┬─────┬──────────────┬─────────────────────┬────────────┐
│ 1 │ EC2 │ i-abc123     │ Stop idle instance  │ $65.00     │
└───┴─────┴──────────────┴─────────────────────┴────────────┘
```

**With --explain:**
```
┌───┬─────┬──────────────┬─────────────────────┬────────────┐
│ 1 │ EC2 │ i-abc123     │ Stop idle instance  │ $65.00     │
└───┴─────┴──────────────┴─────────────────────┴────────────┘

🤖 AI-Powered Insights:

💡 Opportunity #1: i-abc123
────────────────────────────────────────────────────────────────
This m5.large instance has been running with minimal activity for weeks.

Why this is wasteful:
The instance has averaged 1.8% CPU usage over the past 30 days and shows
no SSH connections since December. This appears to be a forgotten development
environment that's costing $65/month with zero utility.

Action plan:
  1. Create an AMI backup for safety (5 minutes)
  2. Stop the instance and monitor for 7 days
  3. If no complaints, terminate to fully save the cost
  4. If needed later, launch from AMI

Risk: ✅ LOW
Time: ⏱️  10 minutes

[Analyzing remaining opportunities...]
```

## Features

✅ **Top 3 opportunities analyzed** (configurable)  
✅ **Contextual explanations** based on resource metadata  
✅ **Action-oriented** guidance  
✅ **Risk assessment** for each recommendation  
✅ **Time estimates** for implementation  

## Cost

- Uses **gpt-4o-mini** (cost-effective model)
- ~500 tokens per explanation
- Approximately **$0.01 per scan** (for 3 opportunities)
- OpenAI API costs paid by you directly

## Configuration

Currently reads from environment variable only:
```bash
export OPENAI_API_KEY="sk-..."
```

Future: will support config file:
```json
{
  "ai": {
    "provider": "openai",
    "apiKey": "sk-...",
    "model": "gpt-4o-mini",
    "maxExplanations": 3
  }
}
```

## Limitations

⚠️ **Prototype stage:**
- Only explains top 3 opportunities (to control costs)
- No local model support yet (OpenAI only)
- No caching (every scan makes fresh API calls)
- JSON parsing may occasionally fail (falls back to raw text)

⚠️ **AI accuracy:**
- Explanations are AI-generated and may not always be perfect
- Always verify recommendations before taking action
- Treat as advisory, not definitive

⚠️ **Privacy:**
- Resource metadata is sent to OpenAI's API
- Do NOT use with highly sensitive environments
- Future: local model support for full privacy

## Roadmap

**v0.3.0:**
- [ ] Support local models (Ollama integration)
- [ ] Cache common explanations
- [ ] Generate remediation scripts
- [ ] Configurable number of explanations
- [ ] Cost tracking (show API spend)

**v0.4.0:**
- [ ] Natural language queries: `cloud-cost-cli ask "what's costing me the most?"`
- [ ] Multi-turn conversations
- [ ] Historical learning (remember your preferences)

**v1.0.0:**
- [ ] Auto-fix mode (AI generates and executes scripts)
- [ ] Anomaly detection
- [ ] Predictive forecasting

## Development

### Testing locally

Create a test opportunity:
```typescript
const testOpp: SavingsOpportunity = {
  id: '1',
  provider: 'aws',
  resourceType: 'ec2',
  resourceId: 'i-test123',
  resourceName: 'test-instance',
  category: 'idle',
  currentCost: 65,
  estimatedSavings: 65,
  confidence: 'high',
  recommendation: 'Stop idle instance',
  metadata: { avgCpu: 2, runningHours: 720 },
  detectedAt: new Date(),
};

const aiService = new AIService(process.env.OPENAI_API_KEY);
const explanation = await aiService.explainOpportunity(testOpp);
console.log(explanation);
```

### Adding new AI features

1. Update `src/services/ai.ts` with new methods
2. Update prompt templates
3. Add corresponding CLI flags
4. Update this README

## Feedback

This is an experimental feature! Please share feedback:
- What works well?
- What's confusing?
- What other AI features would you like?

Open an issue: https://github.com/vuhp/cloud-cost-cli/issues

## Privacy & Security

**What data is sent to OpenAI:**
- Resource type, ID, name
- Cost information
- Metadata (CPU usage, size, etc.)
- Recommendation text

**What's NOT sent:**
- Your AWS/Azure credentials
- Account details beyond what's in the opportunity
- Historical scan data
- Your API keys

**Best practices:**
- Use a separate OpenAI account for work vs personal
- Monitor your OpenAI API usage
- Don't use --explain in production CI/CD (costs add up)
- Set OpenAI API usage limits in their dashboard

---

**Questions?** Open an issue or discussion on GitHub!
