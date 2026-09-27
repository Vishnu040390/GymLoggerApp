# 3. Screen specifications

Each screen lists its purpose, content, actions, states, validation and the API calls it makes. Screen IDs match the prototype's **Screen index** (`#/screens`). API paths are relative to `/api/v1`. Endpoints marked **(proposed)** are not in §14 of the spec and are needed by the UI (see [05-quality-and-handoff.md §5.4](05-quality-and-handoff.md#54-api-contract-notes-for-the-backend)).

Common to every data screen:

- **Loading:** skeleton blocks in the shape of the content. When a filter refetches, the previous results stay on screen at reduced opacity, so there is no flash.
- **Error:** an inline error panel with the server's safe message and a **Try again** button. Offline errors say "You're offline".
- **401:** redirect to sign in with `next=` set to the current route. **403:** the access-denied page. **404:** the not-found page.
- The page `<title>` is "*Screen* · GymLogger". Focus moves to the `h1` after navigation.

---

## Authentication

### SCR-AUTH-01 — Sign in · `/login`

| | |
|---|---|
| **Purpose** | Return to training. |
| **Content** | Eyebrow "Welcome back", H1 "Sign in", one-line value statement. Email and Password fields; the password has a show/hide toggle. Primary **Sign in** (full width, 52 px). "New to GymLogger? Create an account". *Prototype only:* a demo-accounts card. |
| **Contextual banners** | `?expired=1` → "Your session has expired… anything you logged is saved". `?registered=1` → "Account created. Sign in…" (email pre-filled). `?signedout=1` → "You have signed out". |
| **Validation** | Client: email format and password present, shown inline. Server: 401 → banner "Email or password is incorrect." (the password is cleared and focused). 403 → "This account is inactive…". 429 → "Too many sign-in attempts. Try again in N min." |
| **Behaviour** | Button shows *Signing in…* and is disabled while pending. On success, go to `next`, or else Today (User) or Exercise management (Admin). |
| **API** | `POST /auth/login` |
| **QA refs** | §28 valid login, wrong password, unknown email, inactive account |

### SCR-AUTH-02 — Create account · `/register`

| | |
|---|---|
| **Content** | Your name, Email, Password with a **live requirement checklist** (✓/✗ plus screen-reader text "met / not met"), Confirm password. Note that Google and Apple sign-in come later. |
| **Validation** | Name 2–50 characters. Email format. Password rules (D16). The confirmation must match. Server 409 → inline on Email: "An account with this email already exists. Sign in instead." |
| **Success** | Go to Sign in with the email pre-filled and a success banner. This matches the spec's Register → Login flow (§58). |
| **API** | `POST /auth/register` |
| **QA refs** | §28 valid registration, duplicate email, invalid email, weak password |

---

## Training (User)

### SCR-USR-01 — Today · `/`

| | |
|---|---|
| **Purpose** | Answer "what should I do today?" in one tap. |
| **Layout** | Eyebrow with the full date. H1 "Good morning, *Name*". Two columns on desktop: left = action and recent history, right = week stats and exercise trends. |
| **Hero card** | *No workout in progress:* "Start today's workout" (or "Start another session" if one is already done today) with **Start workout** and **Compare with previous**. *In progress:* a blue live card with "Workout in progress", elapsed time, exercises, sets and **Resume workout**. |
| **Today's sessions** | Shown only if sessions exist today. Session cards (label · time range · status · first 3 exercises with sets), with a count "2 sessions". |
| **Last workout** | Historical-style card (see the design system: "paper log") with up to 5 exercises. **View session** and **Start and compare with this** (opens DLG-01 with this session preselected). |
| **This week** | 3 stat tiles: Sessions, Sets and Reps, each with "Last week: n". Hint: weeks start Monday; cancelled sessions are not counted. |
| **Recent exercises** | Up to 5 rows: name, last sets, date and label, sparkline of the last 10 totals, change vs the previous session. Each row links to that exercise's Progress tab. |
| **Empty** | New account: "No workouts yet — your finished workouts appear here…" and "Nothing to compare yet". |
| **API** | `GET /workouts/active` (proposed), `GET /workouts?date=today`, `GET /workouts?status=Completed&pageSize=1`, `GET /analytics/summary` (proposed) |

### DLG-01 — Start workout

| | |
|---|---|
| **Content** | Date and session label, read-only: "The date and start time are recorded automatically" (§11). A radio group of choice cards: **Start without comparison** (default) or **Compare with a previous session**. The second option shows the last 12 completed sessions, one per row even when they share a date (weekday, date — label · time range, first 4 exercises). |
| **Actions** | *Not now* · **Start workout**. The button shows busy state and sends an idempotency key, so a double tap creates only one session. |
| **Edge cases** | 409 (a workout is already in progress) → toast "Picking up where you left off" and open that workout (D2). No previous sessions → an empty state inside the dialog. |
| **API** | `GET /workouts?status=Completed&pageSize=12`, `POST /workouts {workoutDate, timeZone}` |

### SCR-WK-01 — Active workout · `/workout/{id}` (priority screen)

| | |
|---|---|
| **Layout** | Focus layout: no global navigation. Content width is at most 760 px. |
| **Sticky header** | ← back ("Back to Today, your workout stays in progress"), H1 "Workout", "Sun 27 Sep · Morning · 07:12", ⋮ menu (Add exercise, Cancel workout). Status row: **In progress** badge (dot plus text), elapsed timer (`role="timer"`, not announced), **save state** (see below). |
| **Comparison banner** | Shown when the workout was started with a reference session. "COMPARING WITH Fri 18 Sep — Morning · 07:10–08:02" in the historical style. "Also in that session:" lists the reference session's exercises not yet added as **one-tap chips**. × stops comparing. |
| **Exercise card** | Thumbnail. Name, which opens DLG-06 instructions without leaving the workout. Muscle · equipment. ⋮ menu: View instructions, Compare with previous / Change comparison, Stop comparing, Remove exercise. If comparing, a historical strip reads "PREVIOUS 18 Sep — Morning · 15 / 12 / 10" with **Change**. |
| **Sets table** | Columns: **Set** (number badge) · **Count** (stepper: − 44 px, input with numeric keypad, + 44 px) · **Previous** (only when comparing: dashed sand chip plus change badge) · remove (trash, 36 px). Footer: **Add set** · **Compare** (if history exists and no comparison) · running total "3 sets · 41 reps ▲ +1" (like for like, D4). "First time logging this exercise" when there is no history. |
| **Set entry** | *Add set* adds a row pre-filled from the comparison or the previous set (D5). The input is focused with its text selected, so typing replaces it. **Enter** moves to the next row or to *Add set*. Steppers clamp to 1–999. Invalid input shows an inline message under the row, and the last saved value is kept and named. |
| **Row states** | Saved (neutral number badge) · Not saved yet (amber badge plus screen-reader text) · Draft, no count yet (blue badge, "Enter a count to save this set. Last time: 10." with last time's count as the placeholder) · Error (red badge plus message). |
| **Save state** (header) | "All changes saved" (cloud ✓) · "Saving…" (spinner) · "Offline · 3 changes waiting" · "Not saved · Retry". Only offline, error and recovery are announced to screen readers, not every save. |
| **Removing** | A set is soft-removed with an undo toast for about 6 s (D7). Removing an exercise with sets asks for confirmation (D8). |
| **Sticky bottom bar** | **Add exercise** (secondary) · **Finish** (primary), both 52 px, with safe-area padding. |
| **Empty** | "Add your first exercise — Search the exercise library, then log each set as you finish it. Everything saves automatically." with a large **Add exercise** button. |
| **Guards** | A completed or cancelled workout opens as read-only history. Another user's workout returns 404. Leaving the screen flushes pending edits into the sync queue. |
| **API** | `GET /workouts/{id}`, `GET /exercises/{id}/history?excludeWorkoutId=` (per exercise, for comparison and suggestions), `POST /workouts/{id}/exercises`, `DELETE /workout-exercises/{id}` (proposed), `POST /workout-exercises/{id}/sets`, `PUT /workout-sets/{id}`, `DELETE /workout-sets/{id}`. Creates carry `Idempotency-Key`. |
| **QA refs** | §29 (all rows), §30, §36 (double click, refresh, network retry, temporary failure), §32 |

### DLG-02 — Add exercise (full screen on phones)

| | |
|---|---|
| **Content** | Search field (autofocus; matches name, muscle, equipment and category). Category chips with `aria-pressed`. Groups when not filtering: **From your comparison session**, **Recently done** (5), **All exercises** (A–Z). A filtered view shows "n results". |
| **Row** | Thumbnail · name · muscle · equipment · "Last: 15 / 12 / 10 · 18 Sep" (historical colour) · *Added* badge if already in the workout · ⓘ opens the instructions. |
| **Behaviour** | Picking an exercise closes the dialog, adds the card, scrolls to it and focuses *Add set*. Picking one already added scrolls to its card (D14). Inactive exercises never appear (D12). |
| **Empty** | "No matching exercises. Try another name or category. Exercises an admin has deactivated are not shown." |
| **API** | `GET /exercises?include=last&excludeWorkoutId=&sort=name`, `GET /reference` (proposed) |

### DLG-03 — Previous performance (per exercise)

A radio list with **No comparison** first, then previous completed sessions containing the exercise, **grouped by date with "2 separate sessions" when needed**. Each row shows label, time range, sets and total. **Apply** updates only that exercise card. Historical data is read-only; the dialog says so (§12).

### DLG-04 — Finish workout

Summary tiles: duration, exercises, sets and reps. Warnings: "Leg Press has no sets and will be removed" (D9), "1 set without a count won't be saved", and "You're offline…" when relevant. The note "After you finish, this session becomes read-only." Actions: *Keep logging* · **Finish workout**. The button is busy while it waits for queued changes and then completes the workout with an idempotency key, so a double click cannot complete twice. With zero sets the dialog becomes "Nothing logged yet", offering *Cancel workout* or *Keep logging*.

### DLG-05 — Cancel workout

"Cancel this workout? It will be marked as **Cancelled**. It stays in your history, but it won't count towards progress or appear as a comparison." Actions: *Keep workout* (default focus) · **Cancel workout** (destructive). Then return to Today with the toast "Workout cancelled. It's still listed in your history."

### SCR-WK-02 — Workout complete · `/workout/{id}/summary`

A green ✓ and "Nice work, *Name*" with the date, label and time range. Tiles: duration, exercises, sets and reps. **How it compares:** one card per exercise showing today's sets and total, then the reference session (or the previous session) in the historical style, with the total change and a *Compare set by set* link. First-time exercises say "Next time you'll see a comparison here." Actions: **Start another session** (same day, opens DLG-01) · *View in history* · *Back to Today*. Hint: "You can log more than one session on the same day. Each one is kept separately."

### SCR-USR-02 — History · `/history`

| | |
|---|---|
| **Filters** (one row, above the results) | Exercise (select) · Date range (last 30 days, last 90 days, all time) · Status (All / Completed / Cancelled, segmented). Filters are kept in the URL. |
| **Results** | "Showing 15 of 42 sessions". **Grouped by date** (H2 "Fri 18 Sep 2026") with "2 separate sessions" when more than one. Session cards sit in a 2-column grid on desktop. **Load more sessions** pages by 15 and focuses the first new card. |
| **Empty** | Filtered: "No sessions match these filters" with **Clear filters**. New account: "No workouts yet" with **Start a workout**. |
| **API** | `GET /workouts?status=&exerciseId=&from=&page=&pageSize=15`, `GET /analytics/summary` (exercise options) |

### SCR-USR-03 — Session detail · `/history/{id}`

A back link to History. Eyebrow "Morning session", H1 with the full date, then time range, duration and status badge. Banner: **Read-only** ("Finished sessions can't be edited, so your history stays accurate") or **Cancelled** ("…not counted in progress or offered as a comparison"). Stat tiles. One card per exercise with a read-only **set strip** (SET 1 · 15, SET 2 · 12…) and *History* / *Compare* links. Primary action: **Start a workout comparing with this session**. In-progress sessions redirect to the workout screen. **API:** `GET /workouts/{id}`.

### SCR-USR-04 — Progress · `/progress`

Tiles: Sessions (last 30 days), Per week (8-week average), Exercises trained (last 30 days), Sets (last 30 days). **By exercise** with a sort control (Most recent · Most sessions · Biggest change · Name). Desktop shows a table (Exercise, Sessions, Last session, Sets, Trend sparkline, Change); phones show a list. Inactive exercises carry an *Inactive* badge. **API:** `GET /analytics/summary`.

### SCR-USR-05 — Exercise library · `/library`

Search and category chips, and a grid of tiles (16:10 photo, name, muscle · equipment, *Tutorial* badge if there is a video, *Logged n×* badge in the historical style). Filtering is live, and a screen-reader status line says "n exercises shown". **API:** `GET /exercises?include=last`, `GET /reference`.

### SCR-USR-06 — Exercise detail · `/exercise/{id}?tab=`

Header: back link, H1 name, tags (category · muscle · equipment), **Compare sessions** button. An inactive exercise shows the banner "No longer available for new workouts". An ARIA **tablist** (arrow keys, Home and End) keeps the selected tab in the URL:

- **Overview:** media gallery (main stage plus a row of thumbnails with `aria-pressed`; videos have a play button), About, and **How to do it** as numbered steps.
- **History:** completed sessions grouped by date, with "n separate sessions" when needed. Each shows label, time, set strip, total, best and change vs the previous session, with *View session* and *Compare*.
- **Progress:** range control (4 weeks · 12 weeks · All time). Tiles: Sessions (in range and all time), Frequency per week, Best set (with its session), Last session total and change. Charts: **Total reps per session** (line, one point per session) and **Sessions per week** (columns). **Show the data as a table** (disclosure) provides the table twin.

**API:** `GET /exercises/{id}`, `GET /exercises/{id}/history`, `GET /exercises/{id}/analytics?range=`.

### SCR-USR-07 — Compare sessions · `/exercise/{id}/compare?a=&b=`

Two selects: **Session** and **Compared with** (the second has a *Reference* badge in the historical style), plus **Swap**. The defaults are the latest session and the one before it. The result card shows "Total reps 40 vs 38 (+5.3%)" and the change badge, then a table: Set · Session A (current style) · Session B (historical column tint with a clock icon) · Change. A totals row follows, then the note "A dash means that set was not done in that session…". Choosing the same session twice shows a warning. With fewer than 2 sessions, an empty state appears. **API:** `GET /exercises/{id}/history`, `GET /exercises/{id}/comparison?currentWorkoutId=&previousWorkoutId=`.

### SCR-USR-08 — Profile · `/profile`

Avatar initials, name, email and an *Admin* badge when relevant. Form: Display name (editable, validated), Email (read-only: "Email changes are not available in Phase 1"). **Appearance:** System · Light · Dark. **Administration** link for admins. **Session:** "Signed in until 14:32 on Sun 27 Sep. Any workout in progress stays saved when you sign out." **Sign out** (quiet destructive style). **API:** `GET /auth/me` (proposed), `PUT /users/me` (proposed), `POST /auth/logout`.

---

## Administration (Admin only)

### SCR-ADM-01 — Exercise management · `/admin/exercises`

Matches §16. Header "Exercise management" with **+ Add exercise**. Toolbar: search · status (All, Active, Inactive) · category. A status line reads "18 of 18 exercises · 17 active".

- **Desktop table:** Order · Exercise (thumbnail, name link, "equipment · updated 29 Jun") · Category · Muscle · Media (photo and video counts) · Status badge · actions **Edit** and **Deactivate/Activate**.
- **Phone and tablet:** one card per exercise with the same data and actions.

Deactivating asks for confirmation: "People won't be able to add it to new workouts. Past sessions that include it are kept." Activating needs no confirmation. **API:** `GET /exercises?scope=admin&status=all`, `GET /reference`, `PATCH /exercises/{id}/status` (proposed).

### SCR-ADM-02 — Exercise editor · `/admin/exercises/new`, `/admin/exercises/{id}`

| | |
|---|---|
| **Details** | Exercise name* (2–100 characters, unique) · Category* · Muscle group* · Equipment* (inactive options are disabled unless already selected) · Display order (0–9999; empty means "add at the end") · Status switch "Active", with the hint "Only active exercises can be added to new workouts". |
| **Content** | Description (up to 2,000 characters, with a counter). Instructions (up to 4,000 characters, **one step per line**, with a counter and a *Preview steps* disclosure showing the numbered result). |
| **Media** (after the exercise exists) | Dropzone and file picker ("JPG, PNG or WebP up to 5 MB · MP4 or WebM up to 100 MB. Files are checked for type, content and size."). Each rejected file gets its own error. An upload shows a placeholder card with a spinner. **Media cards:** preview, Photo or Video badge, position #n, file name, MIME type and size, **Alt text** (images, required) or **Video title**, both saved on change. Actions: move earlier or later (buttons, so the keyboard works), **Hide/Show**, **Delete** (confirmed: "…To keep it but stop showing it, choose Hide instead."). |
| **Save bar** (sticky) | "Unsaved changes" / "All changes saved" · Cancel · **Create exercise** / **Save changes**. Leaving with unsaved changes asks "Discard unsaved changes?". Deactivating through the switch asks for confirmation. |
| **Errors** | Client-side required fields show inline errors plus a summary banner, and focus moves to the first invalid field. Server 409 duplicate name → inline on Name. 415/413 on media → inline per file. |
| **API** | `GET /exercises/{id}?scope=admin`, `POST /exercises`, `PUT /exercises/{id}`, `POST /exercises/{id}/media`, `PUT /exercises/{id}/media/{mediaId}` (proposed), `POST /exercises/{id}/media/reorder` (proposed), `DELETE /exercises/{id}/media/{mediaId}` (proposed) |
| **QA refs** | §53 Exercise Master checklist, §23 file upload security |

### SCR-ADM-03 — Reference data · `/admin/reference`

Three cards: **Categories**, **Muscle groups** and **Equipment**. Each row shows the name, "used by n exercises", **Rename** (inline form: Save / Cancel) and an Active switch. Each card ends with an add form. Duplicate names are rejected inline. **API:** `GET /reference`, `POST /reference/{type}`, `PUT /reference/{type}/{id}` (all proposed).

---

## System

| ID | Screen | Content |
|---|---|---|
| SCR-SYS-01 | Not found (also used for another person's record) | "We can't find that page. It may have been removed, or the link may be wrong…" with **Go to Today** |
| SCR-SYS-02 | Access denied (403) | "You don't have access to this page. Exercise management is available to administrators only…" with **Go to Today** |
| — | Offline banner (global) | "You're offline. Workout changes are kept on this device and sync when you reconnect." |
| — | Toasts | Bottom centre, above the tab bar or workout bar. Success is dark; errors are red with `role="alert"`. Optional action (Undo). Auto-dismiss after 4 s, or 7 s with an action. |
