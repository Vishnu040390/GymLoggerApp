# 2. Information architecture and user flows

## 2.1 Sitemap

```mermaid
flowchart TD
  subgraph Public
    L[SCR-AUTH-01 Sign in]
    R[SCR-AUTH-02 Create account]
  end
  subgraph User["Signed in — User (Admin has these too)"]
    T[SCR-USR-01 Today]
    WK[SCR-WK-01 Active workout]
    WS[SCR-WK-02 Workout complete]
    H[SCR-USR-02 History]
    SD[SCR-USR-03 Session detail]
    P[SCR-USR-04 Progress]
    LIB[SCR-USR-05 Exercise library]
    EX[SCR-USR-06 Exercise detail<br/>Overview · History · Progress]
    CMP[SCR-USR-07 Compare sessions]
    PR[SCR-USR-08 Profile]
  end
  subgraph Admin["Signed in — Admin only"]
    A1[SCR-ADM-01 Exercise management]
    A2[SCR-ADM-02 Exercise editor]
    A3[SCR-ADM-03 Reference data]
  end
  L --> T
  R --> L
  T -->|DLG-01 Start| WK
  WK -->|DLG-04 Finish| WS
  WS -->|Start another session| WK
  T --> H --> SD
  SD -->|Start comparing with this| WK
  T --> P --> EX
  T --> LIB --> EX --> CMP
  SD --> EX
  T --> PR
  PR --> A1
  A1 --> A2
  A1 --> A3
```

## 2.2 Navigation model

| Breakpoint | User area | Admin area | Active workout |
|---|---|---|---|
| < 1024 px (phones, tablets) | Top bar (brand and profile) and a **bottom tab bar**: Today · History · Progress · Exercises · Profile | Top bar with an *Admin* badge and a horizontal sub-navigation: Exercises · Reference data · Back to training | **Focus layout:** no tab bar or sidebar. A sticky header has a back button, status, timer and save state. A sticky bottom bar has *Add exercise* and *Finish*. |
| ≥ 1024 px (desktop) | **Left sidebar** with the same items. Admins also get an *Exercise admin* link. The user card links to Profile. | Sidebar on a darker surface with an *Admin* section label, to make the context switch obvious | Same focus layout, centred at 760 px |

Rules:

- The **active workout never shows global navigation** (§17). Leaving is explicit (← *Today*) and safe, because the workout stays *In progress* and Today shows a *Resume* card.
- The bottom tab bar is at most 5 items with icon *and* text labels.
- Every page has one `h1`. After navigation, focus moves to it so screen readers announce the new page.
- A **skip link** ("Skip to content") is the first focusable element.

## 2.3 Routes

The prototype uses hash routes. The ASP.NET Core web app would use the same paths without the `#`.

| Route | Screen | Access |
|---|---|---|
| `/login`, `/register` | SCR-AUTH-01, SCR-AUTH-02 | Guests only. Signed-in people are redirected to Today. |
| `/` | SCR-USR-01 Today | User |
| `/workout/{id}` | SCR-WK-01 Active workout | Owner. Completed or cancelled workouts redirect to `/history/{id}`. |
| `/workout/{id}/summary` | SCR-WK-02 Workout complete | Owner |
| `/history?exercise=&status=&range=` | SCR-USR-02 History | User |
| `/history/{id}` | SCR-USR-03 Session detail | Owner (404 otherwise) |
| `/progress` | SCR-USR-04 Progress | User |
| `/library?q=&category=` | SCR-USR-05 Exercise library | User |
| `/exercise/{id}?tab=overview\|history\|progress` | SCR-USR-06 Exercise detail | User |
| `/exercise/{id}/compare?a=&b=` | SCR-USR-07 Compare sessions | User |
| `/profile` | SCR-USR-08 Profile | User |
| `/admin/exercises?q=&status=&category=` | SCR-ADM-01 | Admin (403 page otherwise) |
| `/admin/exercises/new`, `/admin/exercises/{id}` | SCR-ADM-02 | Admin |
| `/admin/reference` | SCR-ADM-03 | Admin |

Filters and tabs are kept in the URL, so a view can be bookmarked or shared and the browser Back button restores it.

## 2.4 Workout session lifecycle

```mermaid
stateDiagram-v2
  [*] --> InProgress: Start workout (date and start time captured)
  InProgress --> InProgress: Add/remove exercise, add/edit/remove set (autosaved)
  InProgress --> Completed: Finish (≥1 set; empty exercises removed)
  InProgress --> Cancelled: Cancel workout (confirmed)
  Completed --> [*]: Read-only in History, used by Progress and Compare
  Cancelled --> [*]: Read-only in History, excluded from Progress and Compare
```

## 2.5 Core flows

### F1 — Register and sign in (§58)

```mermaid
flowchart LR
  A[Create account] -->|valid| B[Sign in, email pre-filled<br/>'Account created']
  A -->|duplicate email| A1[Inline error on Email:<br/>'already exists. Sign in instead.']
  A -->|weak password| A2[Live checklist shows<br/>which rules fail]
  B -->|valid| C[Today]
  B -->|wrong password or unknown email| B1[Generic error banner,<br/>password cleared and focused]
  B -->|inactive| B2['This account is inactive']
  B -->|5 failures in 5 min| B3[429: 'Try again in N min']
```

### F2 — Log a workout (the priority flow)

```mermaid
flowchart TD
  T[Today] -->|Start workout| D1{DLG-01<br/>Comparison?}
  D1 -->|Start without comparison| W[Active workout]
  D1 -->|Compare with a previous session<br/>pick one, same-day sessions listed separately| W
  W -->|Add exercise| D2[DLG-02 search / category chips /<br/>recent / from comparison session]
  D2 --> W
  W -->|Add set| S[Row pre-filled and focused,<br/>saved in the background]
  S -->|stepper − / + or type| S
  S -->|Enter| S2[Next row or Add set]
  W -->|Compare on one exercise| D3[DLG-03 previous performance]
  D3 --> W
  W -->|Finish| D4[DLG-04 summary and warnings]
  D4 -->|Finish workout| WS[Workout complete:<br/>how it compares]
  WS -->|Start another session| D1
  W -->|⋮ Cancel workout| D5[DLG-05 confirm] --> T
```

Speed budget. The target for logging a set that repeats last time's count is **one tap** (*Add set*). For a different count it is **two taps** (a stepper tap), or a tap plus typing. No screen change is needed.

### F3 — Same-day second session and comparison (§30)

1. Finish the morning session. The summary offers **Start another session**.
2. Choose **Compare with a previous session** and pick *Today — Morning*. This morning appears as its own entry, separate from earlier dates.
3. The workout shows a **Comparing with** banner in the historical "paper log" style. Its exercises are offered as one-tap chips.
4. Each set row shows **Previous** (read-only, dashed and sand-coloured) and **Change** (arrow, sign and number).
5. History and exercise history show **"2 separate sessions"** under the date, each with its own label and time.

### F4 — Review progress

Today → *Recent exercises* or Progress → exercise → **Progress** tab. Choose a range (4 weeks, 12 weeks or all time). Stat tiles, the total-reps chart and the sessions-per-week chart all update, and a table view is available. From the **History** tab, *Compare* opens a set-by-set comparison of any two sessions.

### F5 — Admin: create an exercise with media (§58)

```mermaid
flowchart LR
  A[Exercise management] -->|Add exercise| B[Editor: details and instructions]
  B -->|Create| C[Editor with 'Exercise created' banner;<br/>media section enabled]
  C -->|Drop or choose files| D{Client check:<br/>extension · MIME · size}
  D -->|fail| D1[Inline error per file]
  D -->|pass| E[Upload → server re-validates<br/>415 / 413 on failure]
  E --> F[Media card: set alt text, reorder,<br/>hide or show, delete]
  B -->|Status switch off| G[Confirm deactivation:<br/>'past sessions are kept']
```

### F6 — Failure paths

| Situation | What the person sees |
|---|---|
| Offline during a workout | Offline banner at the top. Header shows *Offline · 3 changes waiting*. Rows not yet saved have an amber set number. Changes sync automatically when back online. |
| Refresh or closed tab during a workout | The session is still *In progress*. Today shows *Resume workout*. Queued changes are replayed from local storage. |
| Server error while saving | *Not saved · Retry* in the header. Automatic retry after 6 s. |
| Session expired | Toast, then the sign-in screen with "Your session has expired… Anything you logged is saved". After sign-in, the person returns to where they were. |
| Workout finished in another tab | The rejected change shows "This workout is completed and can no longer be changed". The screen reloads to the read-only session. |
| Opening another person's workout by ID | "We can't find that page" (404, D13). |
| User opens an admin URL | "You don't have access to this page" (403). |
