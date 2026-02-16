# Noir Timetable (React + Node)

Premium dark timetable builder V1 with offline browser persistence.

## Stack
- `client`: React + Vite + TypeScript + Tailwind + Zustand + dnd-kit + Radix Dialog/Tabs
- `server`: Node + Express static host

## Commands
```bash
npm install
npm run dev
npm run build
npm start
```

## Features
- Setup wizard (days, periods, quick entities)
- CRUD for Classes, Teachers, Subjects, Rooms
- Drag/drop timetable with move/swap
- Conflict detection (teacher + room)
- Views: Whole / Class / Teacher / Room
- Autosave indicator with localStorage persistence (`timetable:v1`)
- Import/Export JSON + Reset
- Ctrl+K command palette
- Theme slider (Light / System / Dark) with OS default and persistence
