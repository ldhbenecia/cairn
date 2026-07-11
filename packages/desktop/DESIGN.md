# cairn Desktop — Design System

The visual language of the cairn desktop app (Electron + React + Tailwind v4 + framer-motion).
This documents the system **as it is built** (exact tokens/values from `src/renderer/src/styles.css`
and the component idioms), plus the **design decisions and rules** we hold to.

> Source of truth for tokens is `styles.css` (`@theme` for dark, `[data-theme='light']` for light).
> This file is the human-readable rationale + catalog. If they disagree, the code wins — fix this doc.

---

## 1. Principles

- **Linear-toned, indigo-accented, cool-neutral.** One brand hue (indigo), a restrained cool-gray
  ramp on the *same hue axis* as the accent, generous whitespace, minimal chrome.
- **Dark-first.** Dark is the `@theme` default; light is a rigorous full-token override — not an
  afterthought. Both must feel intentional.
- **Two-weight type, dense scale.** Only `medium` (500) and `semibold` (600) are ever used. Sizes are
  hand-tuned arbitrary pixels (including half-pixel steps), not the named Tailwind scale.
- **Numbers are monospace.** Counts, dates, stats, timers use `font-mono` + `tabular-nums` so they
  don't jitter.
- **Restraint in motion.** Fast, soft, expo-eased transitions. Nothing bounces or lingers.
- **Depth is earned, not faked.** Dark uses lightness for elevation; light uses border + soft
  *navy* (never black) shadow. See §3.

---

## 2. Color tokens

All colors are CSS custom properties resolved by theme. Tailwind utilities map to them
(`bg-surface-1`, `text-ink-muted`, `border-hairline`, `text-accent`, …).

### Neutrals & ink

| Token | Dark | Light | Role |
|---|---|---|---|
| `--color-canvas` | `#010102` | `#f2f2f8` | App background (deepest plane) |
| `--color-surface-1` | `#0f1011` | `#ffffff` | Cards, dialogs (raised plane) |
| `--color-surface-2` | `#141516` | `#eaeaf2` | Inset wells, inputs, hover fills |
| `--color-surface-3` | `#18191a` | `#e2e2ee` | Deeper wells / active |
| `--color-surface-4` | `#191a1b` | `#d8d8e6` | Deepest well |
| `--color-hairline` | `#23252a` | `#dfdfe9` | Default 1px borders/dividers |
| `--color-hairline-strong` | `#34343a` | `#d2d2df` | Emphasized dividers / input framing |
| `--color-hairline-tertiary` | `#3e3e44` | `#c2c2d0` | High-contrast rules |
| `--color-ink` | `#f7f8f8` | `#1c1d22` | Primary text, headings |
| `--color-ink-muted` | `#d0d6e0` | `#3d424b` | Secondary body / descriptions |
| `--color-ink-subtle` | `#8a8f98` | `#646a74` | De-emphasized labels |
| `--color-ink-tertiary` | `#62666d` | `#5f6572` | Meta, captions, mono, placeholder |

**Ink hierarchy is 4 steps.** `ink` (primary) → `ink-muted` (secondary) → `ink-subtle` (quiet) →
`ink-tertiary` (meta/placeholder/disabled-ish). `ink-tertiary` and `ink` are the two most-used.

### Accent (indigo — the only brand hue)

| Token | Dark | Light |
|---|---|---|
| `--color-accent` | `#5b61e6` | `#5256dd` |
| `--color-accent-hover` | `#757bf0` | `#4a4ecf` |
| `--color-accent-focus` | `#474dcc` | `#3f43ba` |

Usage: `bg-accent` (primary buttons, brand mark, active nav), `text-accent`/`text-accent-hover`
(links, interactive text), translucent tints `bg-accent/10–45` (selected/hover surfaces),
`border-accent` + `/30–60` (selected cells), `text-white` (26×) as the on-accent label color.
`--color-chart-companion` = `color-mix(in srgb, var(--color-accent) 42%, var(--color-ink-tertiary))`
so chart pairs stay in sync if the accent changes.

### Semantic status

| Token | Dark | Light | Use |
|---|---|---|---|
| `--color-success` | `#27a644` | `#15803d` | Connected / confirm / positive trend |
| `--color-danger` | `#f87171` | `#dc2626` | Errors |
| `--color-warning` | `#fbbf24` | `#d97706` | Warnings |
| `--color-notice` | `#d4a574` | `#b45309` | Notices |

Light darkens all four (and the raw `emerald/rose/amber/violet/sky-400` category accents, overridden
in `styles.css`) for **AA contrast on white**. Rule: any status/functional text must clear WCAG AA;
prefer the token, not a raw Tailwind palette hex.

---

## 3. Elevation & shadows

**The mechanism differs by theme — this is deliberate:**

- **Dark** signals elevation with *lightness* (`surface-1` sits above `canvas`). Shadows are the
  Tailwind `shadow-black/40|50` utilities.
- **Light** cannot (everything is already light), so elevation = **visible border + soft navy
  shadow**. Black shadows on a light canvas read as a dirty grey smudge and are banned.

Light shadow tokens (defined in `[data-theme='light']`, cool navy `rgb(28,39,64)`):

```css
--shadow-card:      0 1px 2px 0 rgba(28,39,64,.05), 0 2px 6px -1px rgba(28,39,64,.06);
--shadow-elevated:  0 4px 10px -4px rgba(28,39,64,.10), 0 12px 28px -8px rgba(28,39,64,.16);
```

- **Resting cards** (`.bg-surface-1.border-hairline`) get `--shadow-card` via a single light-only
  rule — border + whisper shadow makes a white card a distinct plane above the deeper canvas.
- **Floating surfaces** (dialogs, palette, drawer, popovers, toast, tooltip) use `--shadow-elevated`
  in light (negative spread → crisp Linear-popover penumbra, not a foggy halo). They keep the
  Tailwind `shadow-black/40|50` for dark; the swap is a single light-only rule on `.glass-panel`
  (the 8 glass surfaces) and a `.floating-panel` marker class (the 4 non-glass ones). The card rule
  excludes both so a dialog never gets the whisper `--shadow-card`.

### Why the light palette looks the way it does (2026-07-11 refinement)

The original light theme read *washed / flat / clinical* from four failures at once, fixed together:
1. **Value separation at the JND floor** — `canvas #f8f9fb` vs white card was ΔL\*≈2.1 (contrast
   1.05). Fixed by deepening canvas to `#f2f2f8` (ΔL\*≈4.3) while keeping cards pure white.
2. **Invisible borders** — hairline `#e8eaef` was 1.20:1 on white (below the ~1.3 perceptible line).
   Fixed to `#dfdfe9` (1.32:1) / strong `#d2d2df` (1.50:1).
3. **No card shadow, black panel shadow.** Added the navy tokens above.
4. **Wrong hue axis** — neutrals were steel-blue (~220°) while the accent is indigo (~238°), so the
   two read as different temperatures ("clinical"). The whole light ramp was re-tinted onto the
   **indigo axis** (`R=G`, blue slightly higher). Now grays + accent are one family.

**Rule going forward:** the light neutral ramp stays on the indigo axis and evenly stepped; deepen
the canvas/ramp, never tint `surface-1` off pure white; shadows are navy, never black.

---

## 4. Liquid Glass

Opt-in frosted material for dialogs, menus, drawer, toast — toggled by the `data-glass` attribute on
`:root` (`applyGlass()` in `settings-context.tsx`). CSS-only; **no native window vibrancy** (rejected
— caused whole-window glassiness and flicker on toggle). Applied via the `.glass-panel` class.

Principles (hard-won across iterations):

- **Glass = the background shows through.** If you raise opacity until it doesn't, the glass is gone.
- **Dark:** a *cool-gray* tint (not near-black `surface-1`) + `backdrop-filter` `brightness()` lifts
  the content behind so it refracts. Current: `linear-gradient` `rgba(38,42,52,.30)→rgba(28,31,40,.42)`,
  `blur(42px) saturate(2.05) brightness(1.22)`, overlay `rgba(0,0,0,.20)`.
- **Light:** a *large* dialog cannot be very transparent without looking unnatural (white-on-white
  has nothing to refract, and opaque inner cards then float weirdly). So light glass is a **near-solid
  cool frost** (`rgba(247,249,252,.82)→rgba(242,245,250,.90)`, `blur(40px) saturate(1.4)`) — a glass
  *material* read, not a see-through pane. `saturate` stays low: high saturation pulls the dashboard's
  accent into a **rainbow smear** on big panels.
- **Packaged builds don't composite `backdrop-filter`** (Electron, measured). Keep panel opacity high
  enough that the fallback (a flat translucent surface) is still readable; a sheen + border defines the
  glass edge when blur is absent.

---

## 5. Typography

- **Families:** `--font-text` (Inter → SF Pro Text) is the UI default (set on `body`); `--font-sans`
  (Inter → SF Pro Display) near-identical; `--font-mono` (JetBrains Mono → SF Mono).
- **Base:** 14px / 400 / line-height 1.5 / `word-break: keep-all` (Korean line breaks) / antialiased.
- **Weights:** only `font-medium` (labels, body-emphasis, buttons, nav) and `font-semibold`
  (all headings, titles, stat numbers). **Never** bold/black.

Size scale — hand-tuned arbitrary px (no `text-sm/base/lg`):

| px | Role |
|---|---|
| 9 / 10 / 10.5 | Micro labels, badges, axis ticks |
| 11 / 11.5 | Captions, uppercase eyebrows, small mono meta |
| **12** | Labels, meta, multi-line descriptions (with `leading-relaxed`) |
| 12.5 / **13** | **Primary body** — rows, list items, dialog body, buttons |
| 13.5 / 14 | Slightly-larger body / tab titles |
| **15** | Workhorse title (panel/dialog/drawer headers, sidebar brand) |
| 16 / 17 / 18 | Section / stat / step titles |
| 20 / 24 / 26 / 28 | Display / hero (stats use `font-mono`) |

- **Mono + tabular-nums** for all numeric/date content (dates, counts, timers, SHAs, paths, streaks).
- **Tracking:** negative optical tightening on `semibold` headings, scaling with size
  (`-0.2px @15` → `-0.6px @28`); `uppercase tracking-wider` only for section eyebrows
  (`text-[11px] font-medium uppercase tracking-wider text-ink-tertiary`).

---

## 6. Radii & spacing

Radius tokens (`--radius-*`): `xs 4 · sm 6 · md 8 · lg 12 · xl 16 · 2xl 24`.

| Radius | Used by |
|---|---|
| `rounded-md` (8) | Buttons, icon buttons, chips, sidebar/nav items, small menus |
| `rounded-lg` (12) | Cards, panels, popovers, inputs-in-panels, segmented tracks |
| `rounded-xl` (16) | Dialogs, publish scope cells, glass panels |
| `rounded-full` | Pills (AccountStatusPill), toggle knob, legend dots |

Spacing rhythm (recurring): padding `px-3/px-4`, `py-1.5/py-2/py-3.5`; gaps `gap-1.5/gap-2/gap-2.5`;
card `px-4 py-3.5`; dialog header `px-6 py-4`, body `px-6 py-5`. Icon-button target is **`size-7`
(28px)** — the minimum comfortable tap target; smaller controls were bumped up to it.

---

## 7. Motion

**Signature easing:** `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out expo) for *entrances*; `ease-in` for
*exits*. Enters are a touch longer than exits.

| Animation | In | Out |
|---|---|---|
| Panel (`.panel-enter`) | 180ms ease-out (opacity + 2px y) | — |
| Popover (`.popover-in/out`) | 160ms expo (y-8 + scale .95), origin top-right | 130ms ease-in |
| Dialog (`.dialog-content`) | 170ms expo (scale .96) | 120ms ease-in |
| Dialog overlay | 150ms ease-out | 120ms ease-in |
| Drawer (`.drawer-in/out`) | 200ms ease-out (translateX 100%) | 200ms |

- **framer-motion** for React-driven surfaces (command palette, achievements dialog, run-toast,
  publish result cards): `opacity` + `scale (0.96)` + small `y`, durations 0.15–0.28s, same expo ease.
  Conditional overlays are wrapped in `<AnimatePresence>` with a stable `key` and an `exit` prop so
  they *close* smoothly, not just open.
- **Reveal-on-scroll** (dashboard) via `IntersectionObserver` — sections fade/rise once on entry.
- **Hover/active** use `transition-colors`; every interactive surface should have it (no snap).

---

## 8. Components

There are **no central Button/Input/Card React components** — they are consistent inline Tailwind
idioms. Genuinely shared components: `Toggle`, `Segmented`/`Field` (`field.tsx`), `Accordion`,
`Pagination`, `RunToast`, `InsightCard`, `AccountStatusPill`.

### Buttons
- **Primary (accent):** `rounded-md bg-accent px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-accent-hover`.
- **Secondary (bordered):** `rounded-md border border-hairline px-3 py-2 text-[13px] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink`.
- **Icon (canonical):** `flex size-7 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink`. Icon-only buttons **must** carry an `aria-label`.

### Surfaces
- **Card / panel:** `rounded-lg border border-hairline bg-surface-1 px-4 py-3.5` (light: + `--shadow-card`).
- **InsightCard:** hue-tinted variant — `borderColor/background: color-mix(… {hue} …)`; hue palette
  teal/violet/amber/rose/sky. Grid `grid-cols-2 sm:grid-cols-4`.
- **List container:** `overflow-hidden rounded-lg border border-hairline`.

### Inputs
- **Text input:** `w-full rounded-md border border-hairline bg-surface-1 px-3 py-2 text-[13px] text-ink placeholder:text-ink-tertiary focus:border-accent`.
- **Textarea:** same recipe but `bg-surface-2` + `resize-none` + `leading-relaxed`. Commits on blur; first `Esc` commits+blurs.
- Inputs rely on **`focus:border-accent`** for focus position (they are excluded from the global focus ring — see §9).

### Selection controls
- **Toggle** (`toggle.tsx`): the app's only `role="switch"`; all bespoke switches were unified into it.
- **Segmented** (`field.tsx`): track `flex gap-1 rounded-lg bg-surface-2 p-1`; active item = solid accent pill.
- **Model / scope selectors:** card-grid — bordered cells, selected = `border-accent` + `bg-accent` tint (+ Check badge on the publish scope grid).

### Chips, pills, pagination
- **Category/status chip:** `rounded-md border px-2 py-0.5 text-[11px] font-medium` + semantic hue class (daily=indigo, weekly=blue, monthly=violet, draft=amber, final=success). Long/custom statuses `truncate` with a `title`.
- **AccountStatusPill:** `rounded-full px-1.5 py-0.5 text-[10px] font-medium`, translucent-bg + solid-text tone.
- **Pagination:** `size-7` chevrons (with `aria-label`) + numbers marked by an **animated accent underline** (measured), current page carries `aria-current="page"`.

### Overlays
- **Dialog:** Radix + `.dialog-content.glass-panel`, overlay `.dialog-overlay`. Close via CSS keyframes.
- **Popover/dropdown:** `.popover-in` / `.popover-out`, `rounded-lg border border-hairline bg-surface-1 p-1`, origin top-right.
- **RunToast:** bottom-right `glass-panel` `w-80`, `z-[70]` (above dialogs at `z-50`).
- **Sidebar nav item:** active = `bg-surface-2` + a 3px left accent rail (`w-0.75`).

---

## 9. Interaction & behavior rules

These are product decisions, not just conventions:

- **No focus rings.** The global `:focus-visible` outline is removed on *all* elements (owner
  preference — the blue outline that appeared on tabs/buttons read as clutter). Text inputs still show
  position via `focus:border-accent`. *Trade-off accepted:* keyboard-only focus visibility is reduced.
- **Text selection is scoped.** `body { user-select: none }`; only `.journal-content` (the published
  worklog reader body) and `input, textarea` are selectable/copyable. Applied on `body` (not `#root`)
  so Radix/`createPortal` overlays inherit it.
- **Cursor.** `default` everywhere (even buttons). Graph: `pointer` only when directly over a node,
  `grab`/`grabbing` for panning.
- **Window drag.** macOS `titleBarStyle: 'hiddenInset'` — the renderer supplies the drag band. Each
  top-level view has a full-width `h-20 [-webkit-app-region:drag]` strip; interactive controls and the
  graph canvas are `no-drag`.
- **Theme.** Dark is default; the OS-`system` option follows `prefers-color-scheme`. Light is a full
  token override — keep dark untouched when editing `[data-theme='light']`.

---

## 10. Graph view (physics)

The connections graph is a canvas force-sim tuned so **entering the view is calm** (the user
repeatedly disliked layout motion on entry):

- **Blob seed** — each month is one cluster; same-month nodes scatter around its center (not a
  concentric ring, which collapses along a radial line on entry).
- **Off-screen pre-warm** — physics is run to convergence *before the first paint*, so the settled
  layout simply appears; no visible "spread then contract."
- **Decaying drift** — after settling, nodes drift gently (planets) with an amplitude that eases to
  zero, then the `requestAnimationFrame` loop **stops** (idle cost = 0). Interaction/theme/search wake
  a single redraw; config changes wake the physics briefly.
- **Physics only on node-drag** — panning never re-heats the sim (that caused per-click jitter).
- **Cursor/hover on nodes only** (`pad 0`); clicking has a small forgiving pad.
- **Subtle node glow** (`shadowBlur ≈ r`) so dense clusters don't fog into a milky haze.

---

## 11. Adding to the system

- **New color?** Add a token to *both* `@theme` (dark) and `[data-theme='light']`. Light must clear
  AA and stay on the indigo neutral axis. Don't hardcode hex in components — use a token.
- **New elevation?** Reuse `--shadow-card` / `--shadow-elevated`; never introduce a black light shadow.
- **New size?** Reuse an existing px from §5 before inventing one; keep to `medium`/`semibold`.
- **New overlay?** Reuse the dialog/popover keyframes + the expo/ease-in in/out timing; wrap
  conditional React overlays in `AnimatePresence` with a stable key + `exit`.
- **Icon-only control?** `size-7` + `aria-label`.
