# SyncDeck End-to-End Testing Suite

This directory contains the official enterprise-grade End-to-End (E2E) testing framework for SyncDeck, built using Playwright, TypeScript, and the Page Object Model (POM) pattern.

The test suite runs against the real application, verifying the React frontend, Node.js backend, real WebSockets, SQLite (PGlite) / PostgreSQL database, and Redis cache.

---

## 🏗 Directory Structure

```text
tests/
├── README.md               # This instruction file
├── fixtures/
│   └── testFixtures.ts     # Custom Playwright fixtures (host & participant pages)
├── helpers/
│   ├── dbCleanups.ts       # Database & Redis flusher utils
│   └── drawingSimulator.ts # Mouse event draw simulators for canvas
├── pages/
│   ├── LandingPage.ts              # POM for room creation and joins
│   ├── HostDashboardPage.ts        # POM for host dashboards
│   └── ParticipantDashboardPage.ts # POM for participant dashboards
└── specs/
    ├── auth.spec.ts          # JWT persistence, refreshes, and cross-tab logout
    ├── chat-polls.spec.ts    # Real-time chat messaging and poll voting flow
    ├── room-lifecycle.spec.ts # Waiting room approvals, kicks, and store resets
    └── whiteboard.spec.ts    # Whiteboard drawing and canvas clearing
```

---

## 🚀 How to Execute the Suite

### 1. Prerequisites
Ensure you have installed the project dependencies and Playwright browser binaries:
```bash
npm install
npx playwright install chromium ffmpeg
```

### 2. Run All E2E Tests (Headless)
Runs all specs sequentially/in-parallel in headless Chromium and clean-starts the local dev server automatically:
```bash
npm run test:e2e
```

### 3. Run E2E Tests in UI Mode
Launches the interactive Playwright UI Runner, allowing you to trace, step-through, and debug tests with visual snapshots:
```bash
npx playwright test --ui
```

### 4. Show Test HTML Report
If a test fails, Playwright captures trace logs, videos, and screenshots. You can inspect the report by running:
```bash
npx playwright show-report
```

---

## 🛠 Adding New Tests

1. **Page Objects:** Add elements or actions to `tests/pages/` Page Object Models.
2. **Specs:** Create a `.spec.ts` file under `tests/specs/`.
3. **Fixtures:** Inject `landingPage`, `hostDashboard`, or the dynamic `createParticipant` helper function from `tests/fixtures/testFixtures.ts` into your specs.
