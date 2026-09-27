# 1. Requirements analysis — Phase 1 UI/UX

Source: *GYM Tracking Application — Complete Development, Design, Architecture, Testing & QA/QC Documentation* v1.0 (27 Sep 2026), referred to below as **the spec**. Section numbers (§) point into that document.

## 1.1 What the product has to answer

The spec frames the product around four questions (§1). Each one maps to a primary screen, so a person can always answer it in one step from the main navigation.

| Question (§1) | Where the UI answers it | How |
|---|---|---|
| What should I do today? | **Today** (SCR-USR-01) | One primary action: *Start workout* (or *Resume* if one is in progress). The last workout is shown with *Start and compare with this*. Its exercises then appear as one-tap "Also in that session" chips. |
| What did I do previously? | **Today → Last workout**, **History** (SCR-USR-02), **Session detail** (SCR-USR-03) | Sessions are grouped by date. Same-day sessions are separate cards labelled *Morning / Afternoon / Evening* with their times. |
| Am I progressing? | **Progress** (SCR-USR-04), **Exercise → Progress** (SCR-USR-06) | Per-exercise change vs the previous session, sparklines, total-reps chart, sessions-per-week chart, best set. |
| What should I change next? | During the workout (SCR-WK-01), **Compare** (SCR-USR-07) | Previous values sit beside today's inputs with a signed change (+1 / −1 / 0), so the next target is visible while lifting. Recommendations are future scope (§49). |

## 1.2 People and context of use

| Persona | Goal | Context that shapes the design |
|---|---|---|
| **Lifter (User role)** | Log sets quickly and see if they are improving | On a phone in the gym, between sets, often one-handed, sweaty, sometimes gloved, with weak signal in basement gyms. Has 60–120 s of rest time. **Speed and error tolerance matter most.** |
| **Lifter reviewing** | Look back at history and trends | Phone or desktop, at home, calm. Reads charts and comparisons. |
| **Administrator (Admin role)** | Keep the exercise library correct: names, instructions, photos and videos | Mostly desktop or tablet. Uploads media and edits text. Needs validation and safe deactivation. |

Design consequences:

- The **active workout screen is the highest-priority experience** (§19). Controls are at least 44 px and the main actions are 52 px. Counts use a numeric keypad (`inputmode="numeric"`). Steppers change a count with one tap. Global navigation is hidden (§17).
- **Weak connectivity is normal, not exceptional.** Every set is saved in the background and queued when offline. A page refresh never loses data (§10, §36).
- Admin screens favour **data density and validation** over speed.

## 1.3 Phase 1 scope mapped to screens

Every Phase 1 functional scope item (§2) and acceptance-checklist item (§53) has a home in the UI.

| Scope item (§2 / §53) | Screen(s) | Prototype status |
|---|---|---|
| Exercise master / admin panel | SCR-ADM-01, SCR-ADM-02 | Built |
| Exercise photos | SCR-ADM-02 (upload, order, hide, delete, alt text), SCR-USR-06, DLG-06 | Built |
| Tutorial videos | Same as photos | Built (uploaded videos play; seeded videos show a placeholder) |
| Exercise descriptions / instructions | SCR-ADM-02 (one step per line + preview), SCR-USR-06, DLG-06 | Built |
| Categories / muscle groups / equipment (§48 1.2) | SCR-ADM-03 | Built |
| Email registration | SCR-AUTH-02 | Built |
| Email / password login, logout | SCR-AUTH-01, SCR-USR-08 | Built |
| Workout session creation (date captured automatically) | DLG-01 → SCR-WK-01 | Built |
| Exercise selection (fast search) | DLG-02 | Built |
| Set / count logging, edit, remove | SCR-WK-01 | Built (steppers, autosave, undo) |
| Multiple sessions on the same day | DLG-01, SCR-WK-02 "Start another session", SCR-USR-02 grouping | Built |
| Complete / cancel workout | DLG-04, DLG-05 | Built |
| Historical comparison; start with or without it | DLG-01 (choice), DLG-03 (per exercise), SCR-USR-07 | Built |
| Exercise-specific history and analytics | SCR-USR-06 History / Progress tabs, SCR-USR-04 | Built |
| Social sign-in | — | Deferred (§2). The register screen says so. |

## 1.4 Key UX decisions

These decisions fill gaps the spec leaves open. Each one is implemented in the prototype and can be changed. Items marked **Needs sign-off** change business rules and should be confirmed before backend work (§38, *Definition of Ready*).

| # | Decision | Rationale | Needs sign-off |
|---|---|---|---|
| D1 | **Session label** is derived from the local start time: Morning 04:00–11:59, Afternoon 12:00–16:59, Evening 17:00–20:59, Night 21:00–03:59. The start time is always shown too. | The spec's examples use "18 Sep — Morning". Two sessions can share a label, so the time is what makes them unique. | |
| D2 | **One workout in progress at a time** per user. Starting a second one resumes the first (the API returns 409 with `activeWorkoutId`). | Prevents orphaned in-progress sessions and confusion about where sets were logged. Same-day sessions are still unlimited once the previous one is finished. | **Yes** |
| D3 | **Comparison is a view choice, not stored data.** The chosen reference session is kept on the client per workout. No schema change is needed. | The spec says comparisons are calculated dynamically and need no comparison table (§12). | |
| D4 | Comparison is by **set number**: current set *n* vs previous set *n*. A missing set shows "—" and no change, never zero. The running total in a card compares like for like (only set numbers logged so far). | Matches the spec's worked example (+1 / +1 / 0, §25). It avoids misleading "−22 reps" while a workout is still in progress. | |
| D5 | **Add set pre-fills** the count from the comparison session's same set number, or else from the previous set, and saves it. The field is focused and selected so typing replaces it. With no suggestion, a draft row is created that saves on the first valid entry. Its placeholder shows last time's count for that set, and the steppers count from it, but nothing is saved until the person enters a count. | "Optimise for speed and minimum interaction" (§17). Most sets repeat or nearly repeat the last count. | **Yes** (alternative: an unsaved placeholder that needs confirming) |
| D6 | **Set numbers stay contiguous.** Removing set 2 of 3 renumbers set 3 to set 2 on the server, in one transaction. | Keeps the uniqueness constraint `WorkoutExerciseId + SetNumber` (§9) and keeps comparisons meaningful. | **Yes** |
| D7 | **Removing a set is undoable for about 6 s.** The row hides at once and the delete is sent after the undo window. | Mis-taps are likely in the gym. Undo is faster than a confirmation dialog. | |
| D8 | **Removing an exercise that has sets** asks for confirmation. An empty exercise is removed at once. | Destructive and not easily undone. | |
| D9 | **Finishing removes exercises that have no sets** and warns about them first. Finishing needs at least one set; with none, the person is offered *Cancel workout*. | Avoids empty rows in history and analytics. | **Yes** |
| D10 | **Completed and cancelled sessions are read-only** in Phase 1. | "Completed workouts must not be silently overwritten" (§47). Corrections can come later with audit logging. | **Yes** |
| D11 | **Cancelled sessions** stay in History with a *Cancelled* badge. They are excluded from progress, analytics and comparison choices. | A cancelled workout is not a performance record, but deleting it would lose history. | **Yes** |
| D12 | **Inactive exercises** are hidden from the picker and library search. They still appear by name in past sessions and in exercise detail, with a "No longer available for new workouts" banner. | "Inactive exercise cannot be selected for a new workout" (§20). History stays intact. | |
| D13 | **Another user's record returns *Not found* (404)**, never *Forbidden*. | Does not reveal that the record exists (§15, §26). | |
| D14 | **An exercise appears once per session.** Picking it again scrolls to the existing card. | Keeps comparison and analytics unambiguous. Supersets or repeats can be modelled later with SetType (§51). | **Yes** |
| D15 | **Count range is a whole number from 1 to 999.** | The spec says "valid" without defining it. Zero-rep sets are not meaningful for this model. | **Yes** |
| D16 | **Password policy:** 8–128 characters with at least one uppercase letter, one lowercase letter and one number. It is shown as a live checklist. | The spec says "policy enforced" without a policy. This follows common NIST-compatible practice without forced symbols. | **Yes** |
| D17 | **Sign-in errors are generic** ("Email or password is incorrect"). Five failures in 5 minutes returns 429 with a wait time. | Avoids account enumeration and meets the rate-limiting requirement (§23). Registration still reports duplicate emails because the spec requires it (§20). | |
| D18 | **Weeks start on Monday** for weekly stats and charts. | ISO 8601. The hint text states it. | |
| D19 | **Charts plot one point per session**, spaced by session order rather than calendar date. | Two sessions on one date would otherwise overlap and look merged. "Analytics do not incorrectly merge session identity" (§30). | |

## 1.5 Gaps and open questions in the spec

| # | Topic | Question | Proposed answer | Blocks |
|---|---|---|---|---|
| Q1 | Time zone (§21) | Which time zone decides `WorkoutDate` near midnight? | The client sends its local calendar date and IANA time zone when starting a workout. The server accepts dates within ±1 day of the server date. Times are stored in UTC and shown in local time. | Workout API |
| Q2 | Password reset | Not in scope, but people will forget passwords. | Add "Forgot password?" by email in Phase 1.x. The login screen has room for the link. | Auth |
| Q3 | Email verification | Should accounts verify their email before use? | Recommended before production. The UI would add a "Check your inbox" state after registration. | Auth |
| Q4 | Media storage | Where are photos and videos stored and streamed from? Is there a CDN? What is the maximum video length? | Use blob storage with generated names (§23). Limits: images 5 MB, videos 100 MB. Server-side thumbnails. | Admin media |
| Q5 | Alt text / titles | `ExerciseMedia` has no `AltText` or `Title` columns. | **Add `AltText` (required for images) and `Title` (videos)** to meet the accessibility requirement (§33). Optionally add `DurationSeconds`. | Schema |
| Q6 | Admin as a lifter | Can an admin also log workouts? | Yes. Admin includes all User capabilities. The admin area is reached from the sidebar or profile. | Roles |
| Q7 | Editing a finished workout | Can people fix a typo after finishing? | Not in Phase 1 (D10). A later "Correct session" flow with an audit trail (§47). | — |
| Q8 | Unit of "count" | Reps only, or also seconds for timed holds such as a plank? | Reps only in Phase 1. Timed exercises need a `SetType` or unit (§51). | Exercise master |
| Q9 | Reference session persistence | Should the chosen comparison session be stored on the server so it follows the person across devices? | Not needed for Phase 1 (D3). Could become `WorkoutSession.ReferenceSessionId` later. | — |
| Q10 | Data retention and deletion | Can a user delete their account or their data? | Needed for privacy compliance before launch. Add to Profile in a later release. | Legal |

## 1.6 Non-functional UX requirements derived from the spec

- **Responsive:** every screen works at 320, 375, 390, 414, 768, 1024, 1280, 1440 and 1920 px without horizontal scrolling (§19). The prototype's smoke test checks this automatically.
- **Accessible:** WCAG 2.2 AA. See [05-quality-and-handoff.md](05-quality-and-handoff.md) for the §33 checklist.
- **States:** every data screen has loading, empty and error states, and error states have a retry (§17, §32).
- **Reliability:** autosave with a visible save state, idempotent creates, double-submit protection on *Finish*, and resilience to refresh and offline periods (§10, §36).
- **Security in the UI:** no stack traces or SQL errors in messages (§22), generic sign-in errors, record-not-found for other people's data, and file type/MIME/size checks on the client *and* the server (§23).
