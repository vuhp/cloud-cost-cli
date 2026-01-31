# Contributing to Cloud Cost CLI

Thank you for your interest in contributing! This project welcomes contributions of all kinds.

## Ways to Contribute

- 🐛 Report bugs or issues
- 💡 Suggest new features or analyzers
- 📝 Improve documentation
- 🧪 Add tests
- 💻 Submit code improvements or new cloud providers

---

## Development Setup

### Prerequisites

- Node.js >= 18
- Git
- AWS account (for testing)

### Clone and Install

```bash
git clone https://github.com/vuhp/cloud-cost-cli.git
cd cloud-cost-cli
npm install
```

### Run Locally

```bash
npm run dev -- scan --profile your-aws-profile
```

### Build

```bash
npm run build
```

Output will be in `dist/` directory.

### Run Tests

```bash
npm test
```

---

## Project Structure

```
cloud-cost-cli/
├── bin/                     # CLI entry point
├── src/
│   ├── commands/            # Command implementations (scan, etc.)
│   ├── providers/           # Cloud provider integrations
│   │   └── aws/             # AWS-specific analyzers
│   ├── analyzers/           # Shared analysis logic
│   ├── reporters/           # Output formatters (table, JSON, markdown)
│   ├── types/               # TypeScript type definitions
│   └── utils/               # Helper functions
├── docs/                    # Documentation
└── tests/                   # Unit and integration tests
```

---

## Adding a New Analyzer

Example: Add a Lambda cost analyzer for AWS.

### 1. Create analyzer file

`src/providers/aws/lambda.ts`

```typescript
import { AWSClient } from './client';
import { SavingsOpportunity } from '../../types';

export async function analyzeLambdaFunctions(
  client: AWSClient
): Promise<SavingsOpportunity[]> {
  // Implementation here
  return [];
}
```

### 2. Update scan command

`src/commands/scan.ts`

```typescript
import { analyzeLambdaFunctions } from '../providers/aws/lambda';

// In scanCommand function, add:
const lambdaOpportunities = await analyzeLambdaFunctions(client);
```

### 3. Add tests

`tests/unit/providers/aws/lambda.test.ts`

### 4. Update README

Document the new analyzer and what it checks.

---

## Adding a New Cloud Provider

Example: Add GCP support.

### 1. Create provider directory

```
src/providers/gcp/
├── client.ts
├── compute.ts
├── storage.ts
└── ...
```

### 2. Implement analyzers

Follow the same pattern as AWS analyzers.

### 3. Update scan command

Add GCP-specific logic to `src/commands/scan.ts`.

### 4. Update CLI options

Add `gcp` to `--provider` flag in `bin/cloud-cost-cli.ts`.

---

## Code Style

- **TypeScript**: Use strict mode, explicit types
- **Formatting**: Run `npm run format` before committing
- **Linting**: Run `npm run lint` to catch issues
- **Naming**: Use descriptive variable and function names

---

## Commit Messages

Follow conventional commits:

- `feat: add Lambda analyzer`
- `fix: correct RDS cost calculation`
- `docs: update installation guide`
- `test: add EBS analyzer tests`
- `chore: update dependencies`

---

## Pull Request Process

1. **Fork** the repository
2. **Create a branch**: `git checkout -b feature/my-feature`
3. **Make changes** and commit with clear messages
4. **Test** locally: `npm run build && npm test`
5. **Push** to your fork: `git push origin feature/my-feature`
6. **Open a PR** with:
   - Clear description of changes
   - Screenshots (if UI-related)
   - Test results

---

## Reporting Issues

When reporting bugs, please include:

- CLI version (`cloud-cost-cli --version`)
- Node.js version (`node --version`)
- Cloud provider and region
- Command you ran
- Full error message
- Expected vs actual behavior

---

## Questions?

- Open a discussion: https://github.com/vuhp/cloud-cost-cli/discussions
- Join Discord: (link if available)
- Email: vuhuuphuong@gmail.com

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

Thank you for making cloud cost optimization better for everyone! 🚀
