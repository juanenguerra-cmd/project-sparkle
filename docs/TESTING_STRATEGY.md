# Testing Strategy

## Overview

Project Sparkle uses a comprehensive testing approach with three layers:

1. **Unit Tests** - Test individual functions and business logic
2. **Integration Tests** - Test data flows and component interactions
3. **End-to-End Tests** - Test complete user journeys

---

## Unit Testing

### What to Test

✅ **Business Logic**
- Metrics calculations (AUR, infection rates, DOT)
- Data validation schemas
- Utility functions
- Data transformations

✅ **Pure Functions**
- Date formatting
- Data aggregations
- Sorting and filtering logic

❌ **Don't Unit Test**
- UI rendering (use E2E instead)
- Third-party library internals
- Simple getters/setters

### Example Structure

```typescript
// src/__tests__/unit/calculations.test.ts
import { describe, it, expect } from 'vitest';
import { calculateAUR } from '@/lib/metrics';

describe('Antibiotic Utilization Rate', () => {
  it('calculates AUR correctly', () => {
    const result = calculateAUR(150, 1000);
    expect(result).toBe(150);
  });
  
  it('handles edge cases', () => {
    expect(calculateAUR(0, 1000)).toBe(0);
    expect(calculateAUR(150, 0)).toBe(0);
  });
});
```

### Running Unit Tests

```bash
# Run all unit tests
npm test

# Run in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test src/__tests__/unit/calculations.test.ts
```

### Coverage Goals

- **Business Logic:** 90%+ coverage
- **Utilities:** 80%+ coverage
- **Overall:** 80%+ coverage

---

## Integration Testing

### What to Test

✅ **Data Flows**
- Creating and retrieving residents
- Linking antibiotics to residents
- Outbreak management workflows
- Data persistence

✅ **Component Integration**
- Form submission to data storage
- Filter application to data display
- State management across components

### Example Structure

```typescript
// src/__tests__/integration/residentFlow.test.ts
import { describe, it, expect, beforeEach } from 'vitest';

describe('Resident Management Flow', () => {
  beforeEach(() => {
    // Setup test database/storage
  });
  
  it('creates and retrieves resident', async () => {
    const resident = await createResident(mockData);
    const retrieved = await getResident(resident.id);
    expect(retrieved).toEqual(resident);
  });
});
```

### Running Integration Tests

```bash
# Run integration tests
npm test src/__tests__/integration
```

---

## End-to-End Testing

### What to Test

✅ **Critical User Journeys**
- Add new resident
- Track antibiotic usage
- Manage outbreak
- Generate reports
- Export data

✅ **User Interactions**
- Form validation
- Navigation
- Search and filtering
- Error handling

### Example Structure

```typescript
// tests/e2e/addResident.spec.ts
import { test, expect } from '@playwright/test';

test('should add new resident', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Residents');
  await page.click('button:has-text("Add Resident")');
  
  // Fill form
  await page.fill('input[name="firstName"]', 'John');
  await page.fill('input[name="lastName"]', 'Doe');
  
  // Submit
  await page.click('button[type="submit"]');
  
  // Verify
  await expect(page.locator('text=Success')).toBeVisible();
});
```

### Running E2E Tests

```bash
# Install browsers (first time only)
npx playwright install --with-deps

# Run all E2E tests
npm run test:e2e

# Run in headed mode (see browser)
npx playwright test --headed

# Run specific test
npx playwright test tests/e2e/addResident.spec.ts

# Debug mode
npx playwright test --debug
```

### E2E Best Practices

1. **Use data-testid attributes:**
   ```tsx
   <button data-testid="add-resident-btn">Add</button>
   ```
   ```typescript
   await page.click('[data-testid="add-resident-btn"]');
   ```

2. **Wait for elements properly:**
   ```typescript
   await page.waitForSelector('[data-testid="resident-list"]');
   ```

3. **Use Page Object Model:**
   ```typescript
   class ResidentPage {
     constructor(private page: Page) {}
     
     async addResident(data: ResidentData) {
       await this.page.click('[data-testid="add-btn"]');
       // ...
     }
   }
   ```

---

## Test Data Management

### Fixtures

Create reusable test data:

```typescript
// src/test/fixtures/residents.ts
export const mockResident = {
  residentId: 'RES-001',
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '1950-01-15',
  admissionDate: '2024-01-01',
};

export const mockResidents = [
  mockResident,
  { ...mockResident, residentId: 'RES-002', firstName: 'Jane' },
];
```

### Database Seeding

For E2E tests, seed the database:

```typescript
// tests/helpers/seed.ts
export async function seedDatabase() {
  // Insert test data
}

export async function clearDatabase() {
  // Clean up test data
}
```

---

## Continuous Integration

### GitHub Actions

Tests run automatically on:
- Every push to main/develop
- Every pull request
- Before deployment

### CI Pipeline

```yaml
jobs:
  test:
    - Install dependencies
    - Run linter
    - Run type check
    - Run unit tests
    - Run integration tests
    - Run E2E tests
    - Generate coverage report
    - Upload artifacts
```

### Coverage Reports

Coverage reports are:
- Generated on every CI run
- Uploaded to Codecov
- Commented on pull requests
- Tracked over time

---

## Testing Checklist

### Before Writing Tests
- [ ] Identify what needs testing
- [ ] Choose appropriate test type
- [ ] Create test data fixtures
- [ ] Setup test environment

### Writing Tests
- [ ] Follow AAA pattern (Arrange, Act, Assert)
- [ ] One assertion per test (when possible)
- [ ] Descriptive test names
- [ ] Test edge cases
- [ ] Mock external dependencies

### After Writing Tests
- [ ] All tests pass
- [ ] Coverage meets targets
- [ ] Tests run in CI
- [ ] Tests are documented

---

## Common Testing Patterns

### Mocking API Calls

```typescript
import { vi } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

mockFetch.mockResolvedValue({
  json: async () => ({ data: 'mocked' }),
});
```

### Testing Forms

```typescript
test('validates form input', async ({ page }) => {
  await page.fill('input[name="email"]', 'invalid');
  await page.click('button[type="submit"]');
  
  await expect(page.locator('text=Invalid email')).toBeVisible();
});
```

### Testing Navigation

```typescript
test('navigates to residents page', async ({ page }) => {
  await page.click('a[href="/residents"]');
  await expect(page).toHaveURL(/.*residents/);
});
```

---

## Debugging Tests

### Unit/Integration Tests

```bash
# Run in debug mode
node --inspect-brk node_modules/.bin/vitest

# Use debugger statement
debugger;
```

### E2E Tests

```bash
# Debug mode with Playwright Inspector
npx playwright test --debug

# Pause on failure
npx playwright test --trace on

# View trace
npx playwright show-trace trace.zip
```

---

## Performance Testing

### Load Testing (Future)

Consider adding:
- Artillery for API load testing
- Lighthouse CI for performance regression
- Bundle size monitoring

---

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
- [Test Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
