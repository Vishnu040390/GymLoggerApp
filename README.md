# GymLogger — GYM Tracking Application

A personal gym log built around four questions: *What should I do today? What did I do previously? Am I progressing? What should I change next?*

| Phase | Stack | Status |
|---|---|---|
| **1** | ASP.NET Core, REST API, SQL Server, web app for Admin and User | **UI/UX ready for review** |
| 2 | React web client on the same API; MySQL or PostgreSQL | Planned |
| 3 | React Native: 3.1 Android, 3.2 iOS | Planned |

## Contents

- [`docs/ui-ux/`](docs/ui-ux/README.md): Phase 1 UI/UX specification. It covers requirements analysis, information architecture and flows, screen specs, design system, accessibility, QA traceability and the backend handoff.
- [`prototype/`](prototype/README.md): clickable prototype of every Phase 1 screen, running against a mock of the `/api/v1` contract. Open `prototype/index.html` to try it.

## Quick start

```bash
npx serve prototype                              # or open prototype/index.html
node --test prototype/tests/domain.test.cjs      # domain rule tests
node prototype/tests/e2e-smoke.cjs               # end-to-end smoke test (Playwright + Chromium)
```

Sign in as `demo@gymlogger.test` / `Demo@1234`, or as `admin@gymlogger.test` / `Admin@1234` for exercise management.
