# Test Coverage

**Test Suite:** 84 tests passing ✅

This document provides an overview of our testing approach and current coverage.

## Test Organization

```
tests/
├── unit/
│   ├── analyzers/      # Cost calculation and pricing logic
│   ├── commands/       # Business logic and workflow
│   ├── reporters/      # Output formatting
│   ├── types/          # Type definitions and validation
│   └── utils/          # Formatting and helper functions
└── README.md
```

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run with interactive UI
npm run test:ui

# Watch mode for development
npm test -- --watch
```

## Current Coverage

### Core Utilities (100%)
- ✅ Currency formatting
- ✅ Bytes formatting (B, KB, MB, GB, TB)
- ✅ Percentage formatting
- ✅ Date utilities

### Pricing Calculations (100%)
- ✅ AWS pricing (EC2, EBS, RDS, S3, ELB, EIP)
- ✅ Azure pricing (VMs, Disks, SQL, Storage)
- ✅ Cost estimator class
- ✅ Downsize recommendation logic

### Business Logic (100%)
- ✅ Opportunity filtering by minimum savings
- ✅ Total savings calculation
- ✅ Summary statistics by category
- ✅ Sorting and ranking

### Output Formatting
- ✅ JSON reporter
- 🔜 Table reporter (planned)

### Type Safety (100%)
- ✅ SavingsOpportunity validation
- ✅ ScanReport structure
- ✅ Category and confidence enums

## Contributing Tests

We welcome test contributions! Please ensure:

1. All new features include unit tests
2. Tests follow existing patterns (see `tests/unit/`)
3. Use descriptive test names
4. Tests run fast (<5 seconds total)

Example:
```typescript
import { describe, it, expect } from 'vitest';

describe('MyFeature', () => {
  it('should handle expected input correctly', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });
});
```

## Continuous Integration

Tests run automatically on every push via GitHub Actions. All tests must pass before merging.

## Quality Standards

- ✅ 100% pass rate required
- ✅ Fast execution (<5 seconds)
- ✅ Type-safe test code
- ✅ Clear, descriptive assertions
