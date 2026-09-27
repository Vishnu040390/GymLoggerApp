# GymLogger Phase 1 — UX prototype

A clickable prototype of every Phase 1 screen that needs no server. It loads the **production web UI** from [`src/GYM.Web/wwwroot`](../src/GYM.Web/wwwroot) and adds an in-browser mock of the `/api/v1` contract, so design review always matches the real application.

Open `prototype/index.html` in a browser, or run `npx serve .` from the repository root and browse to `/prototype/`. The specification it implements is in [`docs/ui-ux`](../docs/ui-ux/README.md).

> The mock duplicates business rules **only** so the prototype runs without a server. The real rules live in `GYM.Domain` and `GYM.Application` (C#) (spec §2, §49).

## Structure

```
index.html              loads ../src/GYM.Web/wwwroot/{css,js} plus the two mock files below
js/mock-db.js           seeded data mirroring the SQL Server schema, demo accounts
js/mock-api.js          mock /api/v1: envelope, auth, roles, isolation, idempotency, network simulation
tests/domain.test.cjs   unit tests for the client-side rules (node --test)
tests/e2e-smoke.cjs     Playwright end-to-end smoke test, for the prototype or (with BASE_URL) the real app
```

With the mock loaded, the UI also shows the **Prototype** controls. They switch accounts, simulate slow, offline or failing network, change the theme, reset data and show recent API calls. It also shows the Screen index (`#/screens`) and UI kit (`#/ui-kit`). None of these exist in the real application.

## Demo accounts

`demo@gymlogger.test` / `Demo@1234` · `admin@gymlogger.test` / `Admin@1234` · `other@gymlogger.test` / `Other@1234` · `inactive@gymlogger.test` / `Inactive@1234` (rejected at sign-in)
