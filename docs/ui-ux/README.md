# GymLogger — Phase 1 UI/UX

This is the UI/UX package for Phase 1 (ASP.NET Core web app) of the GYM Tracking Application. It is based on the *Complete Development, Design, Architecture, Testing & QA/QC Documentation* v1.0 (27 Sep 2026).

It has two parts:

1. **Specification** (this folder): the analysis, information architecture, screen specs, design system and QA/handoff notes.
2. **Clickable prototype** ([`/prototype`](../../prototype)): every Phase 1 screen, working end to end against a mock of the `/api/v1` contract. It needs no build step and no server.

## Reading order

| Doc | What's in it |
|---|---|
| [01 — Requirements analysis](01-analysis.md) | The four product questions mapped to screens, personas, scope-to-screen matrix, **19 UX decisions** (several need business sign-off), open questions |
| [02 — Information architecture and flows](02-information-architecture.md) | Sitemap, navigation per breakpoint, route table, session lifecycle, the core flows as diagrams, failure paths |
| [03 — Screen specifications](03-screens.md) | Each screen and dialog: content, actions, states, validation, API calls, QA references |
| [04 — Design system](04-design-system.md) | Principles, colour tokens with contrast ratios, type, spacing, breakpoints, component inventory, charts, content style |
| [05 — Quality and handoff](05-quality-and-handoff.md) | WCAG 2.2 AA checklist (§33), responsive matrix (§19), QA traceability, **API additions the UI needs**, Razor Pages implementation guide, Phase 2/3 portability |

## Try the prototype

```bash
# Any static server works, or open prototype/index.html directly in a browser.
npx serve prototype        # then open the printed URL
```

Sign in with a demo account (listed on the sign-in screen):

| Account | Email | Password |
|---|---|---|
| Lifter with 8 weeks of history | `demo@gymlogger.test` | `Demo@1234` |
| Administrator | `admin@gymlogger.test` | `Admin@1234` |
| Second user (isolation checks) | `other@gymlogger.test` | `Other@1234` |

The **Prototype** button (sidebar, or the flask icon on phones) switches accounts and simulates **slow**, **offline** or **failing** network. It also changes the theme, resets the data and shows the last API calls. The **Screen index** (`#/screens`) links to every screen by ID. The **UI kit** (`#/ui-kit`) shows the tokens and components live.

The seed data includes the spec's worked example relative to today's date: two Bench Press sessions on one day (*Morning 15 / 12 / 10*, *Afternoon 12 / 10 / 8*), an *Evening* session three days earlier (*14 / 11 / 9*), and a cancelled session.

## Checks

```bash
node --test prototype/tests/domain.test.cjs            # comparison, analytics, validation rules
node prototype/tests/e2e-smoke.cjs [screenshot-dir]    # needs Playwright + Chromium
```

The end-to-end smoke test covers the §58 acceptance walkthrough: register, sign in, log a workout, a second same-day session with comparison, history, compare and progress. It also checks user isolation, admin protection, admin create plus media validation, offline → refresh → sync, and no horizontal overflow at all nine §19 widths.
