# 4. Design system

The source of truth is [`prototype/css/tokens.css`](../../prototype/css/tokens.css) (tokens) and [`prototype/css/app.css`](../../prototype/css/app.css) (components). The live reference is the prototype's **UI kit** (`#/ui-kit`), which reads token values at runtime, so it always matches the code in both themes.

## 4.1 Design principles

1. **Today's numbers are loud, history is quiet and distinct.** Current values are solid, large, editable and in the action colour. Historical values use a separate "paper log" treatment: sand tint, dashed border, clock icon and a *Previous* label (§18: "Historical data must be visually distinguishable").
2. **One thumb, one tap.** The workout screen uses 44–52 px targets, a numeric keypad and steppers, and keeps the primary actions in the bottom bar.
3. **Never lose a set.** Every change is saved in the background with a visible save state. Destructive actions are undoable or confirmed.
4. **State is never colour alone.** Status, change and validation always pair colour with an icon *and* text (§33).
5. **Say what happened and what to do.** Messages are plain, specific and free of jargon, and never expose technical details (§22).

## 4.2 Colour

A cool neutral palette is biased toward the action blue. The **sand "paper log"** hue is reserved for historical, read-only data. Semantic colours (positive, negative, warning) are separate from the accent. The dark theme is chosen deliberately, not inverted: accents are lifted and surfaces are near-black blue.

| Role | Token | Light | Dark | Use |
|---|---|---|---|---|
| Page background | `--bg` | `#F2F4F8` | `#0B0F16` | App background |
| Surface | `--surface` | `#FFFFFF` | `#131923` | Cards, inputs, dialogs |
| Subtle surface | `--surface-2` | `#EDF0F5` | `#1A212D` | Table headers, steppers, hover |
| Border | `--border` | `#D7DDE7` | `#283243` | Card and divider hairlines (decorative) |
| Control border | `--border-strong` | `#7F8A9C` | `#65728A` | Inputs, steppers, secondary buttons (≥ 3:1) |
| Text | `--text` | `#111722` | `#E8ECF3` | Primary text |
| Muted text | `--text-muted` | `#5A6475` | `#98A2B3` | Secondary text and metadata |
| Action / current | `--primary` | `#1D4ED8` | `#7AA2FF` | Primary buttons, links, focus, chart series |
| Historical | `--hist-bg` / `--hist-text` / `--hist-strong` | `#F6EEDD` / `#664B12` / `#47340A` | `#221D13` / `#E2C68C` / `#F2DFB5` | Previous values, reference session, "Last workout" |
| Increase | `--pos` on `--pos-bg` | `#15703A` on `#E2F3E8` | `#5CCB8B` on `#12291C` | ▲ +n |
| Decrease | `--neg` on `--neg-bg` | `#B42318` on `#FCE9E7` | `#FF8A80` on `#34191A` | ▼ −n |
| No change | `--neu` on `--neu-bg` | `#4F5969` on `#EAEDF2` | `#A7B0BF` on `#1F2632` | = 0 |
| In progress | `--live` | `#15703A` | `#5CCB8B` | Status badge (pulsing dot plus text) |
| Completed | `--done` | `#1A3FA3` | `#A9C1FF` | Status badge (✓ plus text) |
| Cancelled / inactive | `--void` | `#4F5969` | `#A7B0BF` | Status badge (⊘ plus text) |
| Warning / offline | `--warn` on `--warn-bg` | `#875000` on `#FFF3D4` | `#F2B85B` on `#2C2211` | Offline banner, "not saved yet" |
| Destructive | `--danger` / `--danger-text` | `#B42318` | `#C4282E` / `#FF8A80` | Delete, cancel workout, errors |

### Contrast (WCAG 2.2 AA)

| Pair | Light | Ratio | Dark | Ratio |
|---|---|---|---|---|
| `--text` on `--surface` | #111722 / #FFFFFF | 18.0:1 | #E8ECF3 / #131923 | 14.9:1 |
| `--text-muted` on `--surface-2` | #5A6475 / #EDF0F5 | 5.2:1 | #98A2B3 / #1A212D | 6.3:1 |
| `--on-primary` on `--primary` | #FFFFFF / #1D4ED8 | 6.7:1 | #0A1633 / #7AA2FF | 7.2:1 |
| `--primary` (links) on `--surface` | #1D4ED8 / #FFFFFF | 6.7:1 | #7AA2FF / #131923 | 7.1:1 |
| `--hist-text` on `--hist-bg` | #664B12 / #F6EEDD | 7.1:1 | #E2C68C / #221D13 | 10.1:1 |
| `--pos` on `--pos-bg` | #15703A / #E2F3E8 | 5.3:1 | #5CCB8B / #12291C | 7.6:1 |
| `--neg` on `--neg-bg` | #B42318 / #FCE9E7 | 5.6:1 | #FF8A80 / #34191A | 7.1:1 |
| `--warn` on `--warn-bg` | #875000 / #FFF3D4 | 6.0:1 | #F2B85B / #2C2211 | 8.8:1 |
| `--on-danger` on `--danger` | #FFFFFF / #B42318 | 6.6:1 | #FFFFFF / #C4282E | 5.7:1 |
| `--border-strong` (control edge) on `--surface` | #7F8A9C / #FFFFFF | 3.5:1 | #65728A / #131923 | 3.6:1 |

Text pairs pass 4.5:1 or better, and control boundaries pass 3:1 (WCAG 1.4.11).

### Theme implementation

`:root` holds the full light palette. `@media (prefers-color-scheme: dark)` redefines the tokens under `:root:not([data-theme="light"])`, and `:root[data-theme="dark"]` repeats them so the in-app **System / Light / Dark** choice (Profile) wins in both directions. Components only ever reference tokens.

## 4.3 Typography

| Role | Face | Size / weight | Use |
|---|---|---|---|
| Display | **Barlow Condensed** 700 | 36 px (desktop), 28 px (mobile) | Page titles, section titles, **set counts** (26 px), timer |
| Body | **Barlow** 400–700 | 16 px / 1.5 | Text and inputs. 16 px also stops iOS zooming into fields. |
| Small | Barlow 600 | 14 px | Metadata, secondary text |
| Caption / eyebrow | Barlow 700, uppercase, +0.08em | 11–12 px | Labels such as PREVIOUS, SET, COMPARING WITH |

- The condensed display face echoes a gym whiteboard or scoreboard. It is used only for titles and numbers people read at a glance.
- Numbers that line up in columns (set tables, axis ticks, totals) use `font-variant-numeric: tabular-nums`. Large standalone stat values keep proportional figures.
- Fallbacks: `"Roboto Condensed", "Arial Narrow", system-ui` for display, and `system-ui, -apple-system, "Segoe UI", Roboto…` for body. Production should **self-host** both fonts (WOFF2) rather than load them from Google Fonts.

## 4.4 Space, shape, elevation, motion

- **Spacing:** 4 px grid (`--sp-1` 4 → `--sp-12` 48). Page gutter 16 / 24 / 32 px at < 768 / ≥ 768 / ≥ 1280 px.
- **Radius:** 6 (small), 10 (controls), 14 (cards and dialogs), pill (badges and chips).
- **Elevation:** only for things that float, such as dialogs, menus, toasts, the sticky save bar and the workout action bar. Cards use a 1 px border, not a shadow.
- **Motion:** 120–200 ms ease-out for hover, dialogs and toasts. The live-status dot pulses. With `prefers-reduced-motion`, all animation is effectively disabled.

## 4.5 Layout and breakpoints

| Width | Layout |
|---|---|
| 320–380 | Single column. Stepper buttons 40 px. The comparison cell stacks the previous value over the change. |
| < 600 | Dialogs become **bottom sheets**; the exercise picker is full screen. The prototype button in the top bar is icon-only below 480. |
| 600–1023 | Single column or 2-column grids. Centred dialogs. Bottom tab bar. |
| ≥ 1024 | **Sidebar navigation (248 px)**. Today and exercise overview use a 1.6 : 1 split. The admin table replaces cards (≥ 900). |
| ≥ 1280 | Content maximum 1120 px, gutter 32 px. The active workout stays at 760 px for scanning. |

Validated automatically at 320, 375, 390, 414, 768, 1024, 1280, 1440 and 1920 px (§19). See `prototype/tests/e2e-smoke.cjs`.

## 4.6 Components

Each component maps to a function in `src/GYM.Web/wwwroot/js/ui.js` or a class in `app.css`. In Phase 2 they become **React components** with the same names.

| Component | Anatomy and variants | States | Accessibility |
|---|---|---|---|
| **Button** `.btn` | primary · secondary · soft · ghost · historical · destructive · destructive-quiet. Sizes: sm 36, default 44, lg 52. Icon-only. | hover, active (1 px press), focus ring, disabled, **busy** (spinner and label, disabled) | Real `<button>` or `<a>`. Icon-only buttons have an `aria-label`. `aria-busy` while pending. |
| **Stepper** `.stepper` | − · numeric input · + | focus-within ring, invalid (red fill), min/max disables the button | Input has `aria-label="Set n count"`, `inputmode="numeric"`, `min`, `max`. Buttons are labelled "Increase set n count". |
| **Set row** `.set-row` | set badge · stepper · (previous chip and change) · remove | saved · not saved yet (amber) · draft (blue) · error (red and message) | State is also given as text (screen-reader "(not saved yet)", visible messages). |
| **Change badge** `UI.delta` | ▲ +n (green) · ▼ −n (red) · = 0 (grey) · — (none) | — | Arrow, sign and text always present, plus screen-reader text "more than previous". |
| **Status badge** `UI.statusBadge` | In progress (pulsing dot) · Completed (✓) · Cancelled (⊘); Active / Inactive | — | Text is always visible. |
| **Historical surface** `.hist`, `.prev-val`, `.btn-hist`, `.banner--hist` | Sand tint, dashed border, clock icon, uppercase *Previous* / *Comparing with* label | — | Distinguished by label, border style and icon, not only hue. |
| **Session card** `UI.sessionCard` | label · time range · duration and totals · status · up to 3 exercise lines · "+n more"; historical variant | link hover | Whole card is one link. Status is text. |
| **Stat tile** `UI.stat` | label · value (with unit) · footer (comparison) | — | Plain text. |
| **Dialog / sheet** `UI.dialog` | header (title, description, ×) · body · footer actions; wide and full variants | busy action; inline error banner | Native `<dialog>` + `showModal()`: focus trap, Esc, inert background, `aria-labelledby`, focus returns to the trigger. |
| **Confirm** `UI.confirm` | Title, consequence sentence, *Cancel* and destructive action | — | The destructive button is never focused by default. |
| **Menu** `UI.menu` | ⋮ trigger, list of items, divider, destructive item | open/closed | `aria-haspopup`, `aria-expanded`, `role="menu"`/`menuitem`, arrow, Home, End and Esc keys, focus returns to the trigger. |
| **Toast** `UI.toast` | icon · message · optional action (Undo) · dismiss | success, error | Container is `aria-live="polite"`; errors use `role="alert"`. Stays 4 s, or 7 s with an action. |
| **Banner** `.banner` | info · success · warning · error · historical | — | `role="status"`, or `role="alert"` for errors. |
| **Empty state** `UI.empty` | icon · title · why and what next · optional action | — | Heading level fits the page. |
| **Error state** `UI.errorState` | icon · "We couldn't load this" / "You're offline" · safe message · Try again | — | `role="alert"`. |
| **Skeleton** `UI.skeleton` | title, lines, cards | shimmer (none with reduced motion) | `aria-busy="true"`, `aria-label="Loading"`. |
| **Form field** `.field` | label (with * for required) · control · hint · error | invalid | `aria-required`, `aria-invalid`, `aria-describedby` → hint and error. The first invalid field is focused, and a summary banner lists the problem. |
| **Segmented control** `.seg` | radio group styled as a segment | checked, focus | Native radios in a `role="radiogroup"` with a label. |
| **Choice card** `.choice` | radio, title, description; historical variant | checked (outline and tint) | Native radio in a `<label>`, grouped by `fieldset`/`legend`. |
| **Chips** `.chip` | Filter toggles, quick-add | pressed | `aria-pressed`. |
| **Tabs** `.tabs` | tablist with tab buttons and one panel | selected | ARIA tabs pattern with roving `tabindex` and arrow keys. |
| **Save indicator** `.save-state` | saved · saving · offline (n waiting) · error (Retry) | — | Visible text. Only offline, error and recovered are announced. |
| **Gallery** `S.gallery` | main stage · thumbnails · video play button | selected thumbnail | Thumbnails use `aria-pressed` and labels. Images have alt text from `ExerciseMedia.AltText`. |
| **Dropzone and media card** | drop area, file input, per-file errors, card with preview, alt text or title, reorder, hide, delete | uploading, hidden | Real file input inside a `<label>`. Reordering uses buttons, never drag-only. |
| **Charts** `Charts.line`, `Charts.columns`, `Charts.spark` | see 4.7 | hover and focus tooltip | See 4.7. |

## 4.7 Charts

- **One series per chart**, so there is no legend box; the card title names the measure. The series colour is `--chart-series` (validated: in the lightness band, ≥ 3:1 on both surfaces).
- **Line:** 2 px line, 10% area wash, 8 px markers with a 2 px surface ring, hairline solid grid, and the latest value labelled at the end. **One point per session**, spaced by session order, so same-day sessions never merge (D19).
- **Columns:** at most 24 px wide, 4 px rounded top and square base, integer y-axis ticks.
- **Interaction:** a crosshair snaps to the nearest session on hover. The chart is focusable, and **←/→/Home/End** move through sessions with the same tooltip (value first, then session). Each bar is focusable.
- **Table twin:** every chart has *Show the data as a table* with the same values (§33, non-visual access).
- Weeks start on Monday. Cancelled sessions are excluded, and the caption says so.

## 4.8 Iconography

A single inline SVG set on a 24 px grid with 2 px stroke and round caps (`src/GYM.Web/wwwroot/js/icons.js`, about 50 icons). Icons are decorative (`aria-hidden`) unless they are the only content of a control, in which case the control carries the label. Key meanings are fixed: **clock-arrow = history / previous**, **⇄ = compare**, **flag = finish**, **⊘ = cancelled or cancel**, **cloud ✓ = saved**, **wifi-off = offline**.

## 4.9 Content style guide

- **Voice:** direct and encouraging, never cute. "Nice work, Alex" on completion; everywhere else, plain statements.
- **Dates:** `Fri 18 Sep 2026` in headings, `18 Sep` in lists (the year is added when it isn't the current year), relative terms ("Yesterday", "3 days ago") only as secondary text. **Times** use the 24-hour clock (`07:12`). **Session names** are `18 Sep — Morning` and always come with a time when two could collide.
- **Numbers:** sets are written `15 / 12 / 10`. Change is written `+2`, `−1` (true minus sign) or `0`. Totals say "reps".
- **Buttons** say exactly what happens: *Start workout*, *Finish workout*, *Cancel workout* / *Keep workout*, *Deactivate*, *Delete file*. Never "OK" or "Yes".
- **Errors** say what went wrong and how to fix it: "Count must be 999 or less.", "An exercise named "Bench Press" already exists.", "You're offline. Your sets are safe on this device…". Never show codes, stack traces or SQL (§22).
- **Terminology:** *workout* and *session* are used interchangeably in UI copy ("Start workout", "Session detail"). *Count* is the column label and *reps* the unit. *Set* is never called *Rep 1, Rep 2* (§8 note).
