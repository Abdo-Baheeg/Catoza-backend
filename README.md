# Flatmates Backend API & Database Engine

Serverless TypeScript backend for the **Flatmates** application, designed to run on **Vercel Functions (Hobby, $0 free-tier)** backed by **Neon Serverless Postgres** via **Drizzle ORM**.

---

## 🚀 Key Features & Architectural Highlights

1. **Serverless & Stateless Architecture:**
   - Designed for Vercel Functions with fast cold-start performance.
   - Database connections pooled via `@neondatabase/serverless` / `pg.Pool`.
   - Native Vercel zero-config routing via `vercel.json` and `api/index.ts`.

2. **Server-Authoritative Ledger & Pure Domain Core:**
   - **Integer Money Units:** All amounts stored as `BIGINT amount_minor` (piastres/cents); zero floating-point arithmetic.
   - **Deterministic Splits:** `equal`, `percentage`, `exact`, and `shares` (weighted) split methods. Any remainder minor units are distributed deterministically by sorting participant user IDs.
   - **Balance Invariant:** $\sum \text{Net Balances} = 0$ strictly across every household.
   - **Min-Transfer Greedy Settle-up:** Pairs the largest debtor with the largest creditor iteratively to generate optimal settlement suggestions.
   - **Confirmed Settlements Only:** Settlements are recorded as `pending` and only update balances when confirmed by the recipient.

3. **Serverless-Friendly Sync Protocol:**
   - **Idempotent Batch Push (`POST /api/v1/sync/push`):** Supports batches up to 50 operations. Stored in `sync_operations` with SHA-256 payload hashing. Replaying an identical operation returns `duplicate` without re-execution; replaying with changed payload is rejected.
   - **Optimistic Concurrency Control:** Compares `baseVersion` against the database; returns `conflict` on stale edits.
   - **Cursor-Based Pull (`GET /api/v1/sync/pull?cursor=N`):** Reads incremental changes from the append-only `change_log`.

4. **Audit Trail & Household Life:**
   - Append-only event history for all financial actions (`expense_events`).
   - Server-side filtered private notes, read receipts (`note_reads`).
   - Chores with automatic rotation upon assignment completion.
   - Shopping items with one-tap conversion to active expenses (`shopping_items -> expenses`).
   - Polls with single-vote enforcement.
   - Away periods for household members.
   - Daily sweep job (`/api/v1/internal/cron/daily`) for recurring expense generation, chore rotation, and pruning old sync/change records to stay within free-tier limits.

---

## 🗄️ Database Schema (Postgres / Drizzle)

The schema defines 22 tables in `src/db/schema.ts`:
- **Auth & Accounts:** `users`, `sessions` (rotating refresh tokens), `devices` (FCM tokens).
- **Households & Memberships:** `households`, `memberships`, `away_periods`.
- **Expenses & Ledger:** `expenses`, `expense_shares`, `expense_events` (audit log), `expense_comments`.
- **Settlements:** `settlements`.
- **Household Life:** `notes`, `note_reads`, `chores`, `chore_assignments`, `shopping_items`, `polls`, `poll_options`, `poll_votes`, `recurring_templates`.
- **Sync & Replication:** `sync_operations` (idempotency), `change_log` (cursor tracking).

### Critical Indexes
- `expenses(household_id, expense_date DESC)`
- `change_log(household_id, seq)`
- `memberships(user_id)`
- Unique constraint on `memberships(household_id, user_id)`

---

## 📡 API Endpoints (`/api/v1`)

| Area | Method | Endpoint | Description |
|---|---|---|---|
| **Health** | `GET` | `/health` | Uptime check, DB ping, minimum app version |
| **Auth** | `POST` | `/auth/register` | Register new user with password hash |
| | `POST` | `/auth/login` | Login, issue JWT access + rotating refresh token |
| | `POST` | `/auth/refresh` | Rotate refresh token, issue new tokens |
| | `POST` | `/auth/logout` | Revoke session |
| | `GET` | `/auth/me` | Current user profile |
| **Households** | `POST` | `/households` | Create household & assign creator as admin |
| | `POST` | `/households/join` | Join household via invite code |
| | `GET` | `/households/my` | List households user belongs to |
| | `GET` | `/households/:id/members` | List members and roles |
| | `POST` | `/households/:id/invite-code` | Regenerate invite code (admin only) |
| | `PATCH` | `/households/memberships/:id` | Update member role or status |
| **Expenses** | `POST` | `/households/:id/expenses` | Create expense with split shares & audit log |
| | `GET` | `/households/:id/expenses` | List expenses (filterable by category, status, date) |
| | `GET` | `/expenses/:id` | Detailed view with shares, comments & audit log |
| | `PATCH` | `/expenses/:id` | Edit expense with optimistic version check |
| | `POST` | `/expenses/:id/cancel` | Cancel expense |
| | `POST` | `/expenses/:id/dispute` | Dispute expense |
| | `POST` | `/expenses/:id/comments` | Add comment to expense |
| **Balances** | `GET` | `/households/:id/balances` | Live member balances & totals |
| | `GET` | `/households/:id/balances/suggestions` | Settle-up min-transfer suggestions |
| **Settlements**| `POST` | `/households/:id/settlements`| Record settlement payment (pending) |
| | `GET` | `/households/:id/settlements`| List settlements |
| | `POST` | `/settlements/:id/confirm` | Confirm receipt (recipient only) |
| | `POST` | `/settlements/:id/reject` | Reject settlement |
| **Household Life** | `GET/POST` | `/households/:id/notes` | Notes (private notes filtered server-side) |
| | `POST` | `/notes/:id/read` | Mark note as read |
| | `GET/POST` | `/households/:id/chores` | Chores & rotations |
| | `PATCH` | `/chores/assignments/:id` | Complete chore assignment & advance rotation |
| | `GET/POST` | `/households/:id/shopping` | Shopping list items |
| | `POST` | `/households/:id/shopping/to-expense` | Convert bought items to an active expense |
| | `GET/POST` | `/households/:id/polls` | Polls & choices |
| | `POST` | `/polls/:id/vote` | Cast vote on poll |
| | `GET/POST` | `/households/:id/away-periods` | Away periods |
| **Sync** | `POST` | `/sync/push` | Idempotent batch push with conflict detection |
| | `GET` | `/sync/pull?cursor=N` | Cursor-based change log pull |
| **Devices** | `POST` | `/devices` | Register FCM push notification token |
| **Uploads** | `POST` | `/uploads/receipt` | Signed receipt upload with 500 KB limit |
| **Internal Ops**| `POST` | `/internal/cron/daily` | Daily sweep (protected by `CRON_SECRET`) |

---

## 🛠️ Getting Started

### 1. Environment Setup
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your database URL (e.g. Neon connection string) and secrets:
```env
DATABASE_URL=postgresql://user:password@ep-sample-pooler.us-east-2.aws.neon.tech/flatmates?sslmode=require
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_jwt_refresh_secret
CRON_SECRET=your_cron_secret
```

### 2. Database Migrations
Generate Drizzle migrations:
```bash
npm run db:generate
```
Apply migrations to Postgres:
```bash
npm run db:migrate
```

### 3. Seed Sample Data
Seeds users (Alice, Bob, Charlie), household ("Maadi Flat 4B"), expenses matching the worked example, notes, and chores:
```bash
npm run db:seed
```

### 4. Run Development Server
```bash
npm run dev
```
The server will start on `http://localhost:3000`. Test `/api/v1/health` in your browser or curl:
```bash
curl http://localhost:3000/api/v1/health
```

### 5. Run Unit & Property Tests
```bash
npm test
```
All domain core tests (worked example, remainder allocation, percentage/shares splits, invariants) run with Vitest.

---

## ☁️ Deploying to Vercel (Hobby, $0 Stack)

1. Push this repository to your **personal** GitHub account.
2. In the Vercel Dashboard, import the repository.
3. In **Settings -> Environment Variables**, add:
   - `DATABASE_URL` (Neon pooled endpoint)
   - `JWT_SECRET`
   - `JWT_REFRESH_SECRET`
   - `CRON_SECRET`
4. Deploy! Vercel automatically maps `/api/*` to `api/index.ts` and configures the daily cron job via `vercel.json`.
