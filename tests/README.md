# Tests

This directory contains unit and integration tests for cloud-cost-cli.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Test Structure

```
tests/
├── unit/
│   ├── analyzers/         # Cost estimator and pricing tests
│   ├── utils/             # Formatter and helper utilities
│   └── types/             # TypeScript type validation
└── integration/           # End-to-end CLI tests (coming soon)
```

## Writing Tests

We use [Vitest](https://vitest.dev/) for testing.

### Example Test

```typescript
import { describe, it, expect } from 'vitest';
import { formatCurrency } from '../../../src/utils/formatter';

describe('formatCurrency', () => {
  it('should format whole numbers', () => {
    expect(formatCurrency(100)).toBe('$100.00');
  });
});
```

### Running Specific Tests

```bash
# Run tests matching a pattern
npm test -- formatter

# Run a specific file
npm test -- cost-estimator.test.ts
```

## Coverage

Current test coverage:
- **Cost Estimator**: 100% (all pricing functions)
- **Formatters**: 100% (currency, bytes, percent)
- **Types**: 100% (opportunity structures)
- **Analyzers**: 0% (AWS integration tests TBD)

Target: 80% overall coverage before v1.0.0

## TODO

- [ ] Add AWS SDK mocking for analyzer tests
- [ ] Add integration tests for CLI commands
- [ ] Add snapshot tests for output formats
- [ ] Set up CI coverage reporting
