# Testing Strategy - BeautifyPRO

## Overview

BeautifyPRO verwendet eine mehrschichtige Test-Strategie:

| Ebene | Framework | Fokus |
|-------|-----------|-------|
| Unit Tests | Vitest | Domain-Logik, Utilities |
| Integration Tests | Vitest | API-Flows, Services |
| E2E Tests | Playwright | User Journeys, UI |
| Load Tests | k6 | Performance, Skalierung |

---

## Test ausführen

```bash
# Unit & Integration Tests
npm test              # Watch mode
npm run test:run      # Single run
npm run test:coverage # Mit Coverage

# E2E Tests
npm run test:e2e          # Headless
npm run test:e2e:headed   # Mit Browser
npm run test:e2e:ui       # Playwright UI

# Alle Tests
npm run test:all

# Load Tests (k6 erforderlich)
k6 run loadtests/booking-flow.js
k6 run loadtests/api-stress.js
```

---

## Test-Struktur

```
tests/
├── unit/
│   └── slot-engine.test.ts    # Slot-Berechnung
├── integration/
│   ├── booking-flow.test.ts   # Buchungslogik
│   └── checkout-flow.test.ts  # Checkout-Logik
└── lib/
    ├── utils.test.ts          # Utility-Funktionen
    └── logger.test.ts         # Logging

e2e/
├── public-site.spec.ts        # Öffentliche Seiten
├── booking.spec.ts            # Terminbuchung
├── checkout.spec.ts           # Shop Checkout
├── customer-portal.spec.ts    # Kundenbereich
└── admin-portal.spec.ts       # Admin-Bereich

loadtests/
├── booking-flow.js            # Booking unter Last
└── api-stress.js              # API Stress-Test
```

---

## Unit Tests

### Konventionen

- Datei: `*.test.ts` im `tests/` Ordner
- Beschreibung: Deutsch für User-facing, Englisch für technische
- Assertions: Vitest expect()

### Beispiel

```typescript
import { describe, it, expect } from 'vitest';
import { formatChf } from '@/lib/utils';

describe('formatChf', () => {
  it('should format cents to CHF', () => {
    expect(formatChf(2500)).toMatch(/25/);
    expect(formatChf(2500)).toMatch(/CHF/);
  });
});
```

---

## E2E Tests

### Setup

```bash
# Playwright installieren
npm install -D @playwright/test
npx playwright install chromium
```

### Test schreiben

```typescript
import { test, expect } from '@playwright/test';

test('should display homepage', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
});
```

### Best Practices

- Selektoren: Bevorzuge `getByRole()`, `getByText()` über CSS-Selektoren
- Timeouts: Verwende `waitForTimeout()` sparsam
- Isolation: Jeder Test sollte unabhängig sein

---

## Load Tests

### k6 installieren

```bash
# macOS
brew install k6

# Windows
choco install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### Tests ausführen

```bash
# Gegen lokalen Server
k6 run loadtests/booking-flow.js

# Gegen Production (vorsichtig!)
k6 run -e BASE_URL=https://beautifypro.demo loadtests/api-stress.js
```

### Schwellenwerte

| Metrik | Ziel |
|--------|------|
| p95 Response Time | < 500ms |
| p99 Response Time | < 1000ms |
| Error Rate | < 1% |
| Concurrent Users | 50+ |

---

## CI/CD Integration

Tests laufen automatisch bei:
- Push auf `main` oder `develop`
- Pull Requests

### GitHub Actions

```yaml
# .github/workflows/ci.yml
- name: Run tests
  run: npm run test:run

- name: Run E2E tests
  run: npm run test:e2e
```

---

## Coverage Ziele

| Bereich | Minimum | Ziel |
|---------|---------|------|
| Domain-Logik | 70% | 90% |
| API Routes | 60% | 80% |
| UI Components | 40% | 60% |
| Gesamt | 60% | 75% |

---

## Debugging

### Vitest

```bash
# Debug-Modus
npm test -- --reporter=verbose

# Einzelnen Test
npm test -- -t "formatChf"
```

### Playwright

```bash
# Mit Trace
npm run test:e2e -- --trace on

# Debug-Modus
PWDEBUG=1 npm run test:e2e
```

---

## Mocking

### Vitest Mocks

```typescript
import { vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue({ data: [], error: null }),
  })),
}));
```

### Playwright Network Mocking

```typescript
await page.route('**/api/services', (route) => {
  route.fulfill({
    status: 200,
    body: JSON.stringify([{ id: '1', name: 'Test' }]),
  });
});
```
