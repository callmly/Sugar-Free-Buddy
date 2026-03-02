# No Sugar Challenge — replit.md

## Overview

**No Sugar Challenge** is a collaborative web app for two people tracking a sugar-free journey together. It features real-time chat between users, daily mood/craving check-ins, streak tracking (days/hours since last relapse), an AI coach that responds in Lithuanian after each check-in, and an admin panel for configuring OpenAI settings and managing relapse time.

The app is designed to be intimate and small-scale — intended for exactly two users who share the experience together.

---

## User Preferences

Preferred communication style: Simple, everyday language.

---

## System Architecture

### Full-Stack Structure
- **Monorepo layout**: `client/` (React frontend), `server/` (Express backend), `shared/` (shared types and DB schema)
- **Single Express server** serves both the API and (in production) the built frontend static files
- **Vite** handles frontend dev server with HMR; in production, frontend is built to `dist/public/`

### Frontend Architecture
- **React + TypeScript** with Vite as the build tool
- **Routing**: Wouter (lightweight client-side router) with routes for `/login`, `/`, `/admin`, `/statistics`
- **Data fetching**: TanStack React Query with a custom `apiRequest` helper; credentials always included for session auth
- **UI Components**: Shadcn UI (Radix UI primitives + Tailwind CSS). All components live in `client/src/components/ui/`
- **Real-time updates**: Native browser WebSocket connects to `/ws` endpoint; messages broadcast to all connected clients
- **State**: Local React state per page; React Query for server state caching

### Backend Architecture
- **Express.js** HTTP server + `ws` WebSocket server sharing the same HTTP server instance
- **Session auth**: `express-session` with server-side sessions (no JWT). Sessions stored in memory by default; `connect-pg-simple` is available for Postgres session storage
- **Password hashing**: `bcryptjs` for hashing PIN codes at registration
- **Rate limiting**: Custom in-memory login attempt tracker with progressive lockouts (4 attempts → 1hr lockout, 12 attempts → 24hr lockout)
- **AI integration**: OpenAI SDK (`openai` package) — API key and model stored in the `admin_settings` DB table, not environment variables. Coach responds in Lithuanian with 3–6 sentences after each check-in
- **WebSocket broadcast**: All connected WS clients receive new messages (simple broadcast to all; no per-user channels)

### Database
- **PostgreSQL** via Drizzle ORM (`drizzle-orm/node-postgres` with `pg` Pool)
- **Schema defined in** `shared/schema.ts` using Drizzle's `pgTable` helpers
- **Tables**:
  - `users` — id (UUID), username, password (hashed PIN), created_at
  - `messages` — id, user_id (FK), content, is_coach (boolean), created_at
  - `check_ins` — id, user_id (FK), mood (int 1–5), craving (int 1–5), trigger (text, nullable), note (text), created_at. One per user per day; editable same day via PUT /api/checkins/:id
  - `admin_settings` — id, openai_api_key, openai_model, custom_instructions, chat_instructions, allow_registration, relapse_time, updated_at
- **Migrations**: Drizzle Kit (`drizzle-kit push` for schema sync); initial table creation also done via raw SQL in `server/init-db.ts` as a fallback
- **Connection**: `DATABASE_URL` environment variable required

### Authentication
- Username + numeric PIN (4–6 digits) at registration
- Session cookie (httpOnly, secure in production, 1-day maxAge by default; "remember me" extends this)
- Admin panel (`/admin`) requires an authenticated session
- Registration can be toggled on/off from admin settings (`allow_registration` flag)

### Streak Calculation
- Calculated from `relapse_time` stored in `admin_settings`
- Displayed as days, hours, minutes since that timestamp
- Admin can reset relapse time via the admin panel

---

## External Dependencies

| Dependency | Purpose |
|---|---|
| **PostgreSQL** | Primary relational database (requires `DATABASE_URL` env var) |
| **OpenAI API** | AI coach responses in Lithuanian; key stored in DB admin settings, not env |
| **Radix UI** | Accessible headless UI primitives (full suite of components) |
| **Tailwind CSS** | Utility-first styling with CSS variable theming |
| **TanStack React Query** | Server state management and caching on the frontend |
| **Drizzle ORM** | Type-safe SQL ORM and schema management |
| **bcryptjs** | PIN hashing for user authentication |
| **express-session** | Server-side session management |
| **connect-pg-simple** | Postgres session store (available but may not be wired in by default) |
| **ws** | WebSocket server for real-time chat |
| **Recharts** | Line charts on the statistics page |
| **Wouter** | Lightweight client-side routing |
| **Google Fonts** | Fonts: Architects Daughter, DM Sans, Fira Code, Geist Mono |

### Environment Variables Required
- `DATABASE_URL` — PostgreSQL connection string (mandatory)
- `SESSION_SECRET` — Session signing secret (falls back to a hardcoded default if not set; set this in production)
- OpenAI API key is **stored in the database** via the admin panel, not as an environment variable