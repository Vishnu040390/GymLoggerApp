# 5. UX quality checklist and developer handoff

## 5.1 Accessibility — WCAG 2.2 AA mapped to spec §33

| §33 requirement | How the design meets it | Where to verify |
|---|---|---|
| Keyboard navigation | Every control is a native `button`, `a`, `input` or `select`. Dialogs use native `<dialog>` (focus trap, Esc). Menus support arrow keys, Home, End and Esc. Tabs follow the ARIA tabs pattern. Charts are focusable and move with ←/→. Media reorder uses buttons, not drag-only. Enter in a set count moves to the next row. | Tab through Today → Start → Workout → Finish |
| Visible focus | 3 px `--focus-ring` outline with 2 px offset on `:focus-visible`. Page headings that receive focus programmatically after navigation show no ring. | UI kit |
| Form labels | Every input has a `<label>` or `aria-label` ("Set 2 count"). Hints and errors are linked with `aria-describedby`. | Register, Admin editor |
| Accessible controls | Targets are ≥ 44 px (40 px on stepper buttons at ≤ 380 px width), 52 px for workout actions. Icon-only buttons are labelled. `aria-pressed` on chips and thumbnails, `aria-expanded` on menus, `aria-busy` on pending buttons. | Workout at 320 px |
| Colour contrast | Text ≥ 4.5:1 and control boundaries ≥ 3:1 in both themes (see [04 §4.2](04-design-system.md#contrast-wcag-22-aa)). | Token table |
| Meaningful error messages | They say what happened and how to fix it, next to the field. Forms also show a summary banner and focus the first invalid field. Server errors are mapped to fields. | Sign in, Register, Admin editor |
| Required-field indicators | Visible `*` (hidden from screen readers) plus `aria-required="true"`. | All forms |
| Alternative text for images | Exercise photos use `ExerciseMedia.AltText`, which is **required** in the admin editor (schema addition Q5). Thumbnails next to a visible name are decorative (`alt=""`). | Admin editor, Exercise detail |
| Status not conveyed by colour alone | Status badges have text. Change badges have an arrow, sign and screen-reader text. Row save state has a number-badge colour *plus* text. Historical data has a label, dashed border and clock icon. | Workout with comparison |
| Logical heading hierarchy | One `h1` per page, `h2` for sections, `h3` inside cards. Focus moves to the `h1` after navigation. | Any page |
| (Additional) Live regions | Toast region is `aria-live="polite"`; errors use `role="alert"`. Save status announces only offline, error and recovery. List filters announce "n exercises shown". | Workout offline test |
| (Additional) Reduced motion / forced colours | `prefers-reduced-motion` disables animation. `forced-colors` adds borders to badges and chips and uses system colours for charts. | OS settings |
| (Additional) Zoom and reflow | No horizontal scrolling at 320 px (equivalent to 400% zoom at 1280). Inputs are 16 px. | Smoke test |

## 5.2 Responsive matrix — §19

The prototype smoke test (`prototype/tests/e2e-smoke.cjs`) loads Today, History, Progress, Exercises, Exercise → Progress, Compare and Profile at **320, 375, 390, 414, 768, 1024, 1280, 1440 and 1920 px** and fails on any horizontal overflow. It also checks the **active workout with comparison at 320 px**, the highest-priority responsive experience. Current result: **all pass**.

## 5.3 UI QA traceability

| Spec item | Screen / behaviour | Automated in the prototype smoke test |
|---|---|---|
| §28 Valid / duplicate / invalid registration, weak password | SCR-AUTH-02 | ✓ duplicate email, live rules, success redirect |
| §28 Valid login, wrong password, inactive account | SCR-AUTH-01 | ✓ |
| §28 Missing auth → 401, user calling admin → 403 | Route guard → Sign in / Access denied | ✓ 403 page |
| §29 Start workout, add exercise, add set, multiple sets in order, complete | SCR-WK-01, DLG-02, DLG-04, SCR-WK-02 | ✓ |
| §29 Cancel workout | DLG-05 | manual |
| §29/§30 Second session same day, same exercise again, select previous session | DLG-01 compare, SCR-WK-01 | ✓ (previous value and +1 change) |
| §30 History shows same-day sessions separately | SCR-USR-02, SCR-USR-06 History | ✓ "2 separate sessions" |
| §29 Inactive exercise rejected for new logging | DLG-02 hides it; the API returns 422 | manual (Smith Machine Squat is seeded inactive) |
| §29 Another user's session → access denied | SCR-SYS-01 via `/history/ws-other-1` | ✓ |
| §31 Empty history, one session, many sessions | Empty states on every list; charts need ≥ 1 session | manual (register a new account) |
| §32 Loading / empty / error states | Skeletons, empty and error panels with retry | manual (Prototype → Network: Slow / Fail next request) |
| §36 Double-click completion, duplicate submission | Busy buttons plus `Idempotency-Key` | manual |
| §36 Refresh during workout, temporary network failure, retry | Sync queue persisted and replayed | ✓ offline → refresh → reconnect |
| §53 Exercise master: create, edit, activate/deactivate, photo, video, description, instructions, media validation | SCR-ADM-01, SCR-ADM-02 | ✓ create, duplicate name, file-type rejection, upload |
| §33 Accessibility | See 5.1 | partly (no JS errors, focus); run axe during implementation |

Run it:

```bash
npm i -D playwright        # or use a global Playwright with Chromium
node prototype/tests/e2e-smoke.cjs [screenshot-dir]
node --test prototype/tests/domain.test.cjs
```

## 5.4 API contract notes for the backend

The UI works against §14 plus the following additions and clarifications. All of them are **implemented in the ASP.NET Core API** (`src/GYM.Web/Controllers`) and mirrored by the prototype's mock (`prototype/js/mock-api.js`).

| Endpoint | Status | Why the UI needs it |
|---|---|---|
| `GET /auth/me` | **Add** | Profile, and restoring the session on load |
| `PUT /users/me` `{displayName}` | **Add** | Profile edit |
| `GET /workouts?status=&date=&from=&exerciseId=&page=&pageSize=` | Clarify query parameters | History filters, Today's sessions, paging (`{items, page, pageSize, total}`) |
| `GET /workouts/active` | **Add** | Resume card, and guarding against two in-progress workouts (D2) |
| `POST /workouts` `{workoutDate, timeZone}` → 201, or **409** `{activeWorkoutId}` | Clarify | Automatic date capture (Q1), single in-progress workout |
| `POST /workouts/{id}/complete` → 422 if no sets | Clarify | D9 |
| `DELETE /workout-exercises/{id}` | **Add** | "Add/remove exercise where permitted" (§32) |
| `POST /workout-exercises/{id}/sets` `{count}` → the server assigns `setNumber` | Clarify | Prevents duplicate set numbers (§20) |
| `DELETE /workout-sets/{id}` → the server renumbers later sets | Clarify | D6 |
| `GET /exercises?search=&categoryId=&status=&scope=admin&include=last&excludeWorkoutId=&sort=` | Clarify | Picker "Last: …", admin list |
| `PATCH /exercises/{id}/status` `{isActive}` | **Add** | One-click activate / deactivate |
| `PUT/DELETE /exercises/{id}/media/{mediaId}`, `POST /exercises/{id}/media/reorder` `{ids}` | **Add** | Alt text and title, hide/show, delete, order |
| `GET /exercises/{id}/history?excludeWorkoutId=&limit=` → items include `label`, `total`, `best`, `deltaVsPrevious` | Clarify | Comparison picker, exercise history |
| `GET /exercises/{id}/comparison?currentWorkoutId=&previousWorkoutId=` → `{rows[{setNumber, current, previous, delta}], totals{current, previous, delta, deltaPct}}` | Clarify | Compare screen |
| `GET /exercises/{id}/analytics?range=4w\|12w\|all` | Clarify | Progress tab |
| `GET /analytics/summary` | **Add** | Today (this week, recent exercises), Progress, History exercise filter |
| `GET /reference`, `POST /reference/{type}`, `PUT /reference/{type}/{id}` | **Add** | Editor selects, Reference data screen |

Cross-cutting:

- **Envelope** `{success, message, data, errors[{field, message}]}` on every response (§14). The UI maps `errors[].field` onto form fields and shows `message` in a banner or toast.
- **`Idempotency-Key` header** on creating POSTs: start workout, add exercise, add set, upload media, complete and cancel. Keep responses for 24 h per user and key. This is how retries and double-clicks never duplicate records (§36).
- **404, not 403, for another user's records** (D13).
- **Schema additions:** `ExerciseMedia.AltText` (required for images), `ExerciseMedia.Title`, and optionally `ExerciseMedia.DurationSeconds` (Q5).

## 5.5 How the UI is implemented in Phase 1 (ASP.NET Core)

The web UI is implemented as a **dependency-free JavaScript client** in `src/GYM.Web/wwwroot`, served by ASP.NET Core and calling the REST API. This keeps the API the only way in for every client (spec §3.1 "API-first", §52), so Phase 2 (React) and Phase 3 (React Native) reuse the same contracts. The prototype in `/prototype` loads the **same files** plus an in-browser mock of the API, so design review and the production UI cannot drift apart.

| Asset | Location |
|---|---|
| Tokens and components (`tokens.css`, `app.css`) | `src/GYM.Web/wwwroot/css/` |
| Screens, router, components, charts, sync queue | `src/GYM.Web/wwwroot/js/` |
| API client (`api-client.js`) | Uses `fetch()` against `/api/v1` with the HttpOnly cookie. It switches to the mock only when `GL.MockApi` is loaded (prototype). |
| Mock API and seed data | `prototype/js/mock-api.js`, `prototype/js/mock-db.js` (prototype only) |
| `domain.js` | Client-side validation and display helpers only. The canonical rules are in `GYM.Domain` (C#) and covered by `src/GYM.Tests/Unit`. |

Implementation notes (as built):

- **Authentication:** cookie authentication (HttpOnly, SameSite=Strict, 8-hour sliding session). State-changing API calls must send `X-Requested-With` (CSRF defence). Phase 3 mobile clients will need a bearer-token scheme alongside it (§15).
- **Validation:** server-side messages match [03-screens.md](03-screens.md), and the UI shows them as-is.
- **Media:** extension, MIME type, file signature (magic bytes) and size are checked on the server. Files are stored under generated names outside `wwwroot` and served with `nosniff` (§23).
- **Response headers:** the CSP is `script-src 'self'`; the UI has no inline scripts or handlers. The fonts are still loaded from Google Fonts; self-hosting them is a follow-up.

## 5.6 Phase 2 (React) and Phase 3 (React Native) portability

- The tokens become a TypeScript theme object or CSS variables. The component inventory (04 §4.6) is the React component list. The routes are unchanged.
- The **API client plus sync queue** pattern (`api-client.js`, `sync.js`) carries over directly to React and React Native, using AsyncStorage or SQLite instead of `localStorage` on mobile.
- No business rule lives only in the UI. Deltas shown while typing are presentation of `current − previous`. Canonical comparison and analytics come from the API (§2, §49).

## 5.7 Prototype limitations (not product behaviour)

- Data lives in the browser (`localStorage`). *Prototype → Reset demo data* restores the seed. Password "hashes" are a stand-in; the real system uses ASP.NET Core Identity.
- Seeded photos and videos are generated artwork. Uploaded images under 1.5 MB persist; larger images and videos preview only until reload.
- The **Prototype** button (review tools: switch account, simulate slow, offline and failing network, theme, API log) is not part of the product UI.
