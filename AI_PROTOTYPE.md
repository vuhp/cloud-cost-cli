# AI-Powered Explanations

**Status:** ✅ Stable (as of v0.3.0)  
**Added:** 2026-01-31

## Overview

The `--explain` flag adds AI-powered explanations to your cost optimization results. Get contextual insights about why resources are wasteful and how to fix them.

## Quick Start

```bash
# OpenAI (cloud)
export OPENAI_API_KEY="sk-..."
cloud-cost-cli scan --provider aws --explain

# Ollama (local, private)
cloud-cost-cli scan --provider aws --explain --ai-provider ollama
```

See the main README for full AI feature documentation.

## Development

For implementation details, see:
- `src/services/ai.ts` - Core AI service
- `src/commands/scan.ts` - Integration with scan command
- `src/commands/ask.ts` - Natural language queries

## Contributing

Contributions welcome! For AI-related features:
1. Ensure both OpenAI and Ollama support
2. Add tests for prompt templates
3. Update main README documentation

Open an issue to discuss major changes first.
