# Test Coverage Review & Plan

## Current Coverage (47 tests)

### ✅ Covered (100%)
- Cost estimators (AWS pricing functions)
- Formatters (currency, bytes, percent)
- Type definitions (SavingsOpportunity, ScanReport)

### ❌ Not Covered (0%)
- **AWS Analyzers**: EC2, EBS, RDS, S3, ELB, EIP
- **Azure Analyzers**: VMs, Disks, Storage, SQL, Public IPs
- **Clients**: AWSClient, AzureClient
- **Commands**: scanCommand
- **Reporters**: table, JSON
- **Pricing Service**: AWS Pricing API integration

## Priority Test Plan

### Phase 1: Unit Tests for Analyzers (High Priority)
These test the core business logic without requiring cloud credentials.

**Azure Analyzers:**
- [ ] VMs analyzer (idle detection, downsize recommendations)
- [ ] Disks analyzer (unattached, premium→standard)
- [ ] Storage analyzer (lifecycle policies)
- [ ] SQL analyzer (DTU usage, tier recommendations)
- [ ] Public IPs analyzer (unassociated IPs)

**AWS Analyzers:**
- [ ] EC2 analyzer (idle instances, rightsizing)
- [ ] EBS analyzer (unattached volumes)
- [ ] RDS analyzer (oversized databases)
- [ ] S3 analyzer (lifecycle policies)
- [ ] ELB analyzer (unused load balancers)
- [ ] EIP analyzer (unattached IPs)

### Phase 2: Integration Tests (Medium Priority)
Test with mocked SDK responses to verify full flow.

- [ ] AWS scan command with mocked SDK
- [ ] Azure scan command with mocked SDK
- [ ] Output formatting (table, JSON)

### Phase 3: Error Handling (Medium Priority)
- [ ] Missing credentials handling
- [ ] Invalid region/location
- [ ] API errors and retries
- [ ] Partial failures (one analyzer fails)

### Phase 4: E2E Tests (Low Priority - optional)
- [ ] Real cloud account scans (requires test accounts)
- [ ] CLI argument parsing
- [ ] Full workflow tests

## Testing Strategy

**For analyzers without SDK mocking:**
1. Test helper functions (pricing, downsizing logic)
2. Test opportunity creation logic
3. Test filtering logic (location, thresholds)

**For full integration:**
1. Mock Azure/AWS SDK responses
2. Verify correct API calls
3. Verify opportunity generation
4. Verify error handling

## Next Steps
1. Add unit tests for Azure pricing helpers
2. Add unit tests for analyzer helper functions
3. Add integration tests with mocked SDKs
4. Add error handling tests
