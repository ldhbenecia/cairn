# AGENTS.md

Instructions for `packages/desktop`.

## Scope

This package owns the Electron desktop app, main/preload process bridge, React
renderer, preferences/onboarding UI, worklog browsing, tray behavior, native
notifications, and packaging.

## Process Boundaries

- Keep Electron main-process code under `src/main/`.
- Keep preload APIs under `src/preload/` and expose a small, typed bridge.
- Keep renderer code under `src/renderer/src/`.
- Do not access Node, Electron, filesystem, shell, or secrets directly from React
  renderer components. Route those actions through typed preload APIs.
- Validate IPC input at the boundary and return renderer-friendly result shapes.
- Keep secret values out of renderer state, logs, screenshots, and error text.

## React And TypeScript

- Prefer small function components with explicit props.
- Keep state close to the workflow that owns it. Lift state only when multiple
  sibling flows need it.
- Use derived values instead of duplicating state.
- Avoid speculative abstractions for one-off UI.
- Keep async UI states explicit: idle, loading, success, empty, and error when
  the workflow needs them.
- Preserve existing i18n patterns in `src/renderer/src/i18n.ts`; do not hardcode
  new user-facing strings outside the established structure.
- Preserve existing API typing patterns in `src/renderer/src/cairn-api.d.ts`.
- Use existing Radix UI primitives and `lucide-react` icons when they fit the
  interaction. Do not hand-roll equivalent primitives without a clear reason.

## Desktop UX

- This is a utilitarian desktop tool, not a marketing site. Prioritize dense,
  scannable, predictable workflows over decorative layout.
- Keep the first screen useful for repeated work: status, recent worklogs,
  settings/onboarding entry points, and clear action affordances.
- Use restrained visual styling and existing design tokens/classes from
  `src/renderer/src/styles.css`.
- Do not introduce a new component library without a clear need and user
  approval.
- Use familiar controls: icon buttons for tools, toggles for binary settings,
  menus for option sets, tabs for view switches, and inputs for editable values.
- Keep cards for repeated items or framed tools. Do not nest cards inside cards.
- Ensure text fits on small desktop windows and does not overlap adjacent UI.

## Electron UX

- Keep tray/menu actions predictable and mirrored with in-app commands when
  practical.
- Native notifications should be actionable only when the corresponding app flow
  exists.
- Avoid blocking the renderer on long-running core work. Surface progress or
  disabled states when an action is in flight.
- Keep packaged-app behavior in mind: avoid dev-only paths and implicit cwd
  assumptions.

## Verification

Use the narrowest useful command for the change:

```bash
pnpm --filter @cairn/desktop typecheck
pnpm desktop:build
```

For UI changes, run the app when feasible and verify the changed workflow in the
desktop window.
