# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start Vite dev server (localhost:5173)
npm run build     # production build → dist/
npm run preview   # preview production build locally
```

There is no test runner or linter configured.

## Environment

Create a `.env` file at the project root:

```
VITE_SUPABASE_URL=<your-supabase-project-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

## Database

Apply `schema_v2.sql` in the Supabase SQL Editor to set up the current schema. `schema.sql` is the legacy v1 schema (single `votes` table) and is no longer used by the React app.

Tables: `rooms` → `participants` → `availabilities`; `rooms` → `appointments`; `participant_times` (for the confirmed page time overlap feature).

## Architecture

**Stack:** React 18 + Vite + Tailwind CSS v3 + Supabase (Postgres + Realtime)

**Routing** (`src/App.jsx`):
- `/` — `HomePage`: create a room, select date range, set max participants; copies the vote link on creation
- `/vote/:roomId` — `VotePage`: main voting UI with heatmap calendar, ranking list, and date confirmation
- `/confirmed/:roomId` — `ConfirmedPage`: post-confirmation page for time-slot input and shared memo

**Custom hooks** (all in `src/hooks/`):
- `useRoom` — fetches a single room record
- `useParticipants` — fetches participants, handles session restore from `localStorage`, exposes `registerParticipant` (with PIN verification and capacity check)
- `useVotes` — fetches `availabilities`, subscribes via Supabase Realtime with a 5-second polling fallback on disconnect; exposes `saveVotes` (upsert by `participant_id`)
- `useAppointment` — fetches/upserts/deletes the `appointments` row; exposes `confirmDate`, `cancelAppointment`, `saveMemo`
- `useParticipantTimes` — fetches/upserts `participant_times` rows; used only on `ConfirmedPage`

**Session persistence:** `localStorage` key `participant_${roomId}` stores `{ id, name, pin }`. On load, `useParticipants` tries to restore by `id` first, then by `name + room_id`. If PIN doesn't match, the stored entry is cleared and the name modal is shown.

**Key UX rules:**
- Heatmap (other participants' votes) is hidden from a user until they have submitted their own votes (`hasSubmitted` gate in `VotePage`)
- `HEAT_COLORS` (6 shades of green) in `src/constants/colors.js` map vote count to opacity; index 0 is empty
- `MAX_PARTICIPANTS_LIMIT = 10`, `PIN_LENGTH = 4`, `MAX_CALENDAR_YEAR = 2027` are all in `src/constants/colors.js`

**`Calendar` component** (`src/components/Calendar.jsx`) supports two modes:
- `mode="range"` — used on `HomePage` for selecting the room's date range
- `mode="multi"` — used on `VotePage` for each participant to toggle their available dates, with optional `heatmapData` and `isEditMode` props

**Real-time flow:** Each hook subscribes to its own Supabase channel (`participants-{roomId}`, `avail-{roomId}`, `appt-{roomId}`, `times-{roomId}`). Channel errors fall back to polling where implemented.
