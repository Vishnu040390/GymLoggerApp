# GymLogger Phase 1 — UX prototype

A clickable, dependency-free prototype of every Phase 1 screen. Open `index.html` in a browser, or serve the folder (`npx serve prototype`). The specification it implements is in [`docs/ui-ux`](../docs/ui-ux/README.md).

> This is a design artefact, not production code. Business rules are duplicated in `js/domain.js` and `js/mock-api.js` **only** so the prototype runs without a server. In the real system they live in `GYM.Domain` and `GYM.Application` (C#), per spec §2 and §49.

## Structure

```
index.html            entry point (classic scripts, works from file://)
css/tokens.css        design tokens: colour (light/dark), type, spacing, radius, motion
css/app.css           layout shells and components (consumes tokens only)
js/util.js            DOM, date and storage helpers
js/icons.js           inline SVG icon set
js/domain.js          comparison, analytics and validation rules (also used by the Node tests)
js/mock-db.js         seeded data that mirrors the SQL Server schema
js/mock-api.js        mock /api/v1: envelope, auth, roles, isolation, idempotency, network simulation
js/api-client.js      typed client used by every screen (swap transport() for fetch())
js/sync.js            workout autosave queue: offline, retry, idempotent, survives refresh
js/ui.js              components: dialogs, toasts, menus, badges, states, form errors
js/charts.js          line, column and sparkline charts with keyboard tooltips
js/app.js             router, layout shells, prototype controls
js/views/*.js         screens (IDs match docs/ui-ux/03-screens.md)
tests/domain.test.cjs unit tests (node --test)
tests/e2e-smoke.cjs   Playwright end-to-end smoke test
```

## Demo accounts

`demo@gymlogger.test` / `Demo@1234` · `admin@gymlogger.test` / `Admin@1234` · `other@gymlogger.test` / `Other@1234` · `inactive@gymlogger.test` / `Inactive@1234` (rejected at sign-in)
