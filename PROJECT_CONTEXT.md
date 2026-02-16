# Noir Timetable Project Context

This file documents where each major feature lives so any AI agent or developer can navigate the codebase quickly.

## Monorepo Layout
- `/Users/blackcat/Desktop/timetable/client` React + Vite + TypeScript app (main product).
- `/Users/blackcat/Desktop/timetable/server` Express static server for serving `client/dist`.
- `/Users/blackcat/Desktop/timetable/package.json` root scripts for install/dev/build/start orchestration.

## Frontend Entry + Core Wiring
- `/Users/blackcat/Desktop/timetable/client/src/main.tsx` app bootstrap.
- `/Users/blackcat/Desktop/timetable/client/src/App.tsx` top-level shell, first-run wizard routing, panel layout, desktop resize/reorder behavior.
- `/Users/blackcat/Desktop/timetable/client/src/store.ts` Zustand store, mutations, persistence, imports/resets.
- `/Users/blackcat/Desktop/timetable/client/src/types.ts` shared TypeScript types for state, entities, scheduling, UI.
- `/Users/blackcat/Desktop/timetable/client/src/utils.ts` pure helpers: ids, slot keys, import shape normalization, conflict detection, time model helpers.

## UI Components (Primary)
- `/Users/blackcat/Desktop/timetable/client/src/components/TopBar.tsx`
  - View switcher
  - Search + command shortcut button
  - Export/Import/Reset/Layout controls
  - Autosave/conflict status
  - Theme slider
  - Shortcuts guide modal trigger
- `/Users/blackcat/Desktop/timetable/client/src/components/Sidebar.tsx`
  - Entity CRUD for Classes/Teachers/Subjects/Rooms
  - Teacher default subject assignment editing
- `/Users/blackcat/Desktop/timetable/client/src/components/Canvas.tsx`
  - Timetable grid rendering
  - Day tabs
  - Drag/drop cells and lesson cards
  - Conflict visuals and break rows
- `/Users/blackcat/Desktop/timetable/client/src/components/Inspector.tsx`
  - Selected slot editor (subject/teacher/room actions)
- `/Users/blackcat/Desktop/timetable/client/src/components/CommandPalette.tsx`
  - Ctrl+K jump navigation across view targets
- `/Users/blackcat/Desktop/timetable/client/src/components/ShortcutsGuide.tsx`
  - Keyboard shortcuts help popup with all supported shortcut mappings
- `/Users/blackcat/Desktop/timetable/client/src/components/SchedulingTools.tsx`
  - Requirements editor
  - Availability management
  - Candidate generation controls
- `/Users/blackcat/Desktop/timetable/client/src/components/Wizard.tsx`
  - Initial setup flow (days/periods/start/end/breaks/bootstrap entities)

## Layout + Responsiveness Components
- `/Users/blackcat/Desktop/timetable/client/src/components/LayoutControls.tsx`
  - Panel order controls and per-panel width sliders.
- `/Users/blackcat/Desktop/timetable/client/src/components/PanelShell.tsx`
  - Reusable panel wrapper with drag handles and drop highlighting.
- `/Users/blackcat/Desktop/timetable/client/src/components/AppFooter.tsx`
  - Bottom footer bar.

## Theme System
- `/Users/blackcat/Desktop/timetable/client/src/components/ThemeSlider.tsx`
  - Two-mode theme control: `dark` and `light` (labeled Bright in UI).
  - Supports pointer drag, click, wheel, keyboard arrows.
- `/Users/blackcat/Desktop/timetable/client/src/utils.ts`
  - `getSystemPreferredTheme()` used for first-load theme default from OS preference.
- `/Users/blackcat/Desktop/timetable/client/src/index.css`
  - Theme tokens, panel styles, and shared design primitives.

## Scheduling Engine
- `/Users/blackcat/Desktop/timetable/client/src/scheduler-core.ts`
  - Candidate generation algorithm and scoring logic.
- `/Users/blackcat/Desktop/timetable/client/src/workers/generator.worker.ts`
  - Web Worker wrapper for non-blocking schedule generation.

## Persistence / Import / Export
- State key: `timetable:v1` (Zustand persisted state).
- Layout key: `timetable:layout:v1` (panel order + panel widths).
- Import validation + normalization:
  - `/Users/blackcat/Desktop/timetable/client/src/utils.ts` (`validateImport`, `ensureDataShape`)
- Export trigger:
  - `/Users/blackcat/Desktop/timetable/client/src/App.tsx` (`exportJson`)

## Keyboard Shortcuts + History
- `/Users/blackcat/Desktop/timetable/client/src/App.tsx`
  - Global keyboard handler (Cmd/Ctrl + C/V/Delete/Z/Shift+Z, Ctrl+Y, Cmd/Ctrl+K)
- `/Users/blackcat/Desktop/timetable/client/src/store.ts`
  - Slot clipboard + undo/redo runtime state
  - History stack capture for slot-changing operations (`upsertSlot`, `swapOrMoveSlot`, `clearSlot`, `applyCandidate`)

## Conflict Logic
- `/Users/blackcat/Desktop/timetable/client/src/utils.ts` (`conflictMap`)
  - Teacher unavailable conflicts from availability matrix.
  - Teacher double-booking conflicts.
  - Room double-booking conflicts.

## Drag/Drop Notes
- Grid drag behavior lives in `/Users/blackcat/Desktop/timetable/client/src/components/Canvas.tsx`.
- Panel reorder drag behavior lives in `/Users/blackcat/Desktop/timetable/client/src/components/PanelShell.tsx`.

## Quick Commands
- Install: `npm install`
- Dev: `npm run dev`
- Build all: `npm run build`
- Start server build: `npm start`
- Build client only: `npm run build --workspace client`
