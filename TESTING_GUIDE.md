# Comprehensive Testing Guide

## Overview

This guide establishes testing infrastructure for the ISP Billing System with unit tests, integration tests, and E2E tests.

**Current Status:**
- Unit Tests: 2 tests (package validation)
- Integration Tests: Framework ready, 32 placeholders
- E2E Tests: Not implemented

**Target:**
- Unit Tests: 70%+ coverage on components & utilities
- Integration Tests: All critical flows
- E2E Tests: Key user journeys

---

## 1. Unit Testing

### Setup

#### Frontend Unit Tests
```bash
cd frontend
npm install --save-dev vitest @vitest/ui @testing-library/react @testing-library/dom
npm install --save-dev jsdom
```

#### Backend Unit Tests
```bash
cd backend
npm install --save-dev vitest @vitest/ui ts-node
```

### Vitest Configuration

**frontend/vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/types/**',
      ],
      lines: 70,
      functions: 70,
      branches: 70,
      statements: 70,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**frontend/src/test/setup.ts:**
```typescript
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock as any;
```

### Unit Test Examples

#### Component Unit Test
```typescript
// frontend/src/components/__tests__/Header.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Header from '../layout/Header';

describe('Header Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render header with user info', () => {
    render(<Header />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('should display user name when logged in', () => {
    render(<Header />);
    const userElement = screen.getByText(/User/i);
    expect(userElement).toBeVisible();
  });

  it('should have logout button', () => {
    render(<Header />);
    const logoutButton = screen.getByRole('button', { name: /logout/i });
    expect(logoutButton).toBeInTheDocument();
  });
});
```

#### Utility Function Test
```typescript
// frontend/src/lib/__tests__/sanitization.test.ts
import { describe, it, expect } from 'vitest';
import { 
  sanitizeHtml, 
  escapeHtml, 
  sanitizeEmail 
} from '@/lib/sanitization';

describe('Sanitization Utilities', () => {
  describe('sanitizeHtml', () => {
    it('should remove script tags', () => {
      const input = 'Hello <script>alert("XSS")</script> World';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('<script>');
      expect(result).toContain('Hello');
    });

    it('should remove event handlers', () => {
      const input = '<img src="x" onerror="alert(\'XSS\')">';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('onerror');
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML entities', () => {
      const input = '<div>Test</div>';
      const result = escapeHtml(input);
      expect(result).toBe('&lt;div&gt;Test&lt;/div&gt;');
    });
  });

  describe('sanitizeEmail', () => {
    it('should validate and sanitize email', () => {
      expect(sanitizeEmail('test@example.com')).toBe('test@example.com');
      expect(sanitizeEmail('invalid-email')).toBe('');
      expect(sanitizeEmail('TEST@EXAMPLE.COM')).toBe('test@example.com');
    });
  });
});
```

#### API Client Test
```typescript
// frontend/src/api/__tests__/client.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authApi } from '@/api/client';

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should add auth headers to requests', async () => {
    // Mock implementation
    const spy = vi.spyOn(authApi, 'login');
    
    try {
      await authApi.login({ email: 'test@test.com', password: 'pass' });
    } catch (e) {
      // Expected to fail without server
    }

    expect(spy).toHaveBeenCalled();
  });
});
```

### Backend Unit Tests

```typescript
// backend/src/lib/__tests__/errorHandler.test.ts
import { describe, it, expect } from 'vitest';
import { 
  AppError, 
  ValidationError, 
  AuthenticationError 
} from '@/lib/errorHandler';

describe('Error Handling', () => {
  describe('AppError', () => {
    it('should create AppError with correct properties', () => {
      const error = new AppError('TEST_ERROR', 'Test message', 400);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Test message');
    });
  });

  describe('ValidationError', () => {
    it('should set status code to 400', () => {
      const error = new ValidationError('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('AuthenticationError', () => {
    it('should set status code to 401', () => {
      const error = new AuthenticationError();
      expect(error.statusCode).toBe(401);
    });
  });
});
```

### Run Unit Tests
```bash
npm run test              # Run all tests
npm run test:watch       # Watch mode
npm run test:ui          # Interactive UI
npm run test:coverage    # Coverage report
```

---

## 2. Integration Testing

### Setup

```bash
npm install --save-dev msw
npm install --save-dev @testing-library/user-event
```

#### MSW Setup
```typescript
// frontend/src/test/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  // Auth endpoints
  http.post('/api/v1/auth/login', () => {
    return HttpResponse.json({
      token: 'test-token',
      user: { id: '1', email: 'test@test.com', role: 'user' },
    });
  }),

  // Client endpoints
  http.get('/api/v1/clients', () => {
    return HttpResponse.json({
      data: [
        { id: '1', name: 'Client 1', email: 'client1@test.com' },
      ],
    });
  }),

  http.post('/api/v1/clients', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(
      { id: '2', ...body },
      { status: 201 }
    );
  }),
];
```

```typescript
// frontend/src/test/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

#### Integration Test Example
```typescript
// frontend/src/test/__tests__/clientManagement.integration.test.ts
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '../mocks/server';
import ClientList from '@/pages/Clients';

describe('Client Management Integration', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('should fetch and display clients', async () => {
    render(<ClientList />);

    await waitFor(() => {
      expect(screen.getByText('Client 1')).toBeInTheDocument();
    });
  });

  it('should create new client', async () => {
    const user = userEvent.setup();
    render(<ClientList />);

    const addButton = screen.getByRole('button', { name: /add client/i });
    await user.click(addButton);

    const nameInput = screen.getByLabelText(/name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /save/i });

    await user.type(nameInput, 'New Client');
    await user.type(emailInput, 'new@test.com');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('New Client')).toBeInTheDocument();
    });
  });

  it('should handle API errors gracefully', async () => {
    server.use(
      http.get('/api/v1/clients', () => {
        return HttpResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      })
    );

    render(<ClientList />);

    await waitFor(() => {
      expect(screen.getByText(/unauthorized|error/i)).toBeInTheDocument();
    });
  });
});
```

### Run Integration Tests
```bash
npm run test:integration
npm run test:integration:watch
npm run test:integration:coverage
```

---

## 3. E2E Testing with Playwright

### Setup

```bash
cd frontend
npm install --save-dev @playwright/test
npx playwright install
npx playwright codegen http://localhost:5173
```

### Playwright Configuration

**frontend/playwright.config.ts:**
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

### E2E Test Examples

```typescript
// frontend/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should login successfully', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForURL('/dashboard');
    expect(page.url()).toContain('/dashboard');
  });

  it('should show error on invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Invalid credentials')).toBeVisible();
  });

  it('should logout successfully', async ({ page }) => {
    // Assuming logged in state
    await page.goto('/dashboard');

    await page.click('button[aria-label="user menu"]');
    await page.click('text=Logout');

    await page.waitForURL('/login');
    expect(page.url()).toContain('/login');
  });
});
```

```typescript
// frontend/e2e/clients.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Client Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@test.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should view client list', async ({ page }) => {
    await page.goto('/clients');
    await expect(page.locator('table')).toBeVisible();
  });

  test('should create new client', async ({ page }) => {
    await page.goto('/clients');
    await page.click('button:has-text("Add Client")');

    await page.fill('input[name="name"]', 'Test Client');
    await page.fill('input[name="email"]', 'client@test.com');
    await page.click('button:has-text("Save")');

    await expect(page.locator('text=Client created')).toBeVisible();
  });

  test('should edit client', async ({ page }) => {
    await page.goto('/clients');
    
    await page.click('text=First Client');
    await page.click('button:has-text("Edit")');
    
    await page.fill('input[name="name"]', 'Updated Client');
    await page.click('button:has-text("Save")');

    await expect(page.locator('text=Updated Client')).toBeVisible();
  });

  test('should delete client', async ({ page }) => {
    await page.goto('/clients');
    
    await page.click('button[aria-label="more options"]');
    await page.click('text=Delete');
    
    // Confirm deletion
    await page.click('button:has-text("Confirm")');

    await expect(page.locator('text=Client deleted')).toBeVisible();
  });
});
```

```typescript
// frontend/e2e/performance.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test('should load dashboard in < 3 seconds', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/dashboard');
    
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000);
  });

  test('should handle large data sets', async ({ page }) => {
    await page.goto('/transactions');

    // Scroll to bottom to trigger virtual scrolling
    await page.locator('table tbody').scrollIntoViewIfNeeded();
    
    const rows = await page.locator('table tbody tr').count();
    expect(rows).toBeGreaterThan(0);
  });

  test('should cache API responses', async ({ page }) => {
    await page.goto('/clients');

    // First load
    const firstLoadMetrics = await page.evaluate(() => performance.timing);

    // Navigate away and back
    await page.goto('/dashboard');
    await page.goto('/clients');

    // Second load should be faster
    const secondLoadMetrics = await page.evaluate(() => performance.timing);
    
    // In real scenario, second load should use cache and be faster
    expect(secondLoadMetrics).toBeDefined();
  });
});
```

### Run E2E Tests
```bash
npm run test:e2e           # Run all E2E tests
npm run test:e2e:debug    # Debug mode
npm run test:e2e:headed   # Show browser
npm run test:e2e:report   # View report
```

---

## 4. Test Coverage Goals

### By Component Type

| Type | Target | Priority |
|------|--------|----------|
| Utilities | 90%+ | High |
| Hooks | 80%+ | High |
| Components | 70%+ | Medium |
| Pages | 60%+ | Medium |
| API Client | 85%+ | High |

### Critical Flows to Test

1. **Authentication** ✅
   - Login/Logout
   - Password Reset
   - Token Refresh

2. **Client Management** ✅
   - Create/Read/Update/Delete
   - List with Pagination
   - Search/Filter

3. **Billing** ✅
   - Invoice Generation
   - Payment Processing
   - Subscription Management

4. **Error Handling** ✅
   - 401/403 responses
   - Network errors
   - Validation errors

---

## 5. Continuous Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:coverage

      - name: Run integration tests
        run: npm run test:integration

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## 6. Test Organization

```
frontend/
├── src/
│   └── __tests__/
│       ├── setup.ts                 # Test setup
│       ├── mocks/
│       │   ├── handlers.ts          # MSW handlers
│       │   └── server.ts            # MSW server
│       ├── components/
│       │   └── Header.test.tsx
│       ├── lib/
│       │   └── sanitization.test.ts
│       └── pages/
│           └── Clients.test.tsx
│
├── e2e/
│   ├── auth.spec.ts
│   ├── clients.spec.ts
│   ├── billing.spec.ts
│   └── performance.spec.ts
│
└── playwright.config.ts
```

---

## 7. Running All Tests

```bash
# Run all tests
npm run test:all

# Run with coverage report
npm run test:all:coverage

# Watch mode
npm run test:watch
```

### package.json scripts
```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:integration": "vitest --config vitest.integration.ts",
    "test:e2e": "playwright test",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:report": "playwright show-report",
    "test:all": "npm run test && npm run test:integration && npm run test:e2e"
  }
}
```

---

## 8. Best Practices

### Do's ✅
- Write tests as you code
- Test behavior, not implementation
- Use descriptive test names
- Mock external dependencies
- Test error scenarios
- Keep tests focused and isolated
- Use beforeEach/afterEach for setup/cleanup

### Don'ts ❌
- Test implementation details
- Create dependent tests
- Write tests that are too long
- Mock everything (avoid over-mocking)
- Ignore flaky tests
- Test frameworks instead of your code

---

## 9. Coverage Reports

Generate and view coverage:
```bash
npm run test:coverage

# View HTML report
open coverage/index.html
```

---

## 10. Next Steps

1. **Week 1:** Implement unit test infrastructure
2. **Week 2:** Write unit tests for critical utilities & components (300+ tests)
3. **Week 3:** Implement integration test suite (100+ tests)
4. **Week 4:** Set up E2E tests with Playwright (50+ tests)

**Target:** 70%+ overall code coverage by end of sprint

