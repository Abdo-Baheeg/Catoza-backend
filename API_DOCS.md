# Flatmates API Documentation

Comprehensive REST API reference for the **Flatmates** backend engine.

- **Base URL (Local):** `http://localhost:3000/api/v1`
- **Base URL (Production/Vercel):** `https://<your-deployment-domain>.vercel.app/api/v1`
- **Default Content-Type:** `application/json`

---

## Table of Contents
1. [Core Principles & Data Formats](#1-core-principles--data-formats)
2. [Authentication & Authorization](#2-authentication--authorization)
3. [Standard Error Format](#3-standard-error-format)
4. [System & Health](#4-system--health)
5. [Authentication & Accounts](#5-authentication--accounts)
6. [Households & Memberships](#6-households--memberships)
7. [Expenses & Ledger](#7-expenses--ledger)
8. [Balances & Settlement Suggestions](#8-balances--settlement-suggestions)
9. [Settlements (Pay-back)](#9-settlements-pay-back)
10. [Household Life (Notes, Chores, Shopping, Polls, Away)](#10-household-life)
11. [Offline-First Sync Protocol](#11-offline-first-sync-protocol)
12. [Device & Push Notification Tokens](#12-device--push-notification-tokens)
13. [Receipt & File Uploads](#13-receipt--file-uploads)
14. [Internal Cron & Automation](#14-internal-cron--automation)

---

## 1. Core Principles & Data Formats

### 1.1 Integer Minor Money Units (`amountMinor`)
All currency quantities are handled strictly as **integer minor units** (e.g., piastres, cents, pence). Floating-point currency values are never used in database calculations.
- `100.00 EGP` $\rightarrow$ `10000`
- `15.50 USD` $\rightarrow$ `1550`

In request/response payloads, `amountMinor` is accepted as a number or stringified integer (to preserve 64-bit integer precision safely over JSON).

### 1.2 Balance Invariant
Within any household, the sum of all members' net balances is strictly zero:
$$\sum_{u \in \text{Members}} \text{Balance}(u) = 0$$

### 1.3 Timestamps & Identifiers
- **Timestamps:** ISO-8601 strings in UTC (e.g., `2026-10-29T21:00:00.000Z`).
- **IDs:** Canonical UUID v4 strings (e.g., `f47ac10b-58cc-4372-a567-0e02b2c3d479`).
- **Cache-Control:** All responses contain `Cache-Control: no-store` to prevent caching sensitive household ledger data on edge proxies or browsers.

---

## 2. Authentication & Authorization

### 2.1 Access Tokens (JWT)
Protected endpoints require a Bearer token in the `Authorization` header:
```http
Authorization: Bearer <accessToken>
```
- Access tokens expire in **15 minutes**.
- Refresh tokens are long-lived (30 days) and rotated upon each refresh call.

### 2.2 Household Roles & Scopes
- **Public:** No token required (`/auth/register`, `/auth/login`, `/auth/refresh`, `/health`).
- **Authenticated:** Valid JWT required.
- **Household Member:** Authenticated user must have an active membership in the target household (`memberships.status != 'left'`).
- **Household Admin:** Authenticated member must possess `role: "admin"` in the target household.
- **Cron Service:** Internal routes require the `CRON_SECRET` sent via `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret: <CRON_SECRET>`.

---

## 3. Standard Error Format

All error responses return an appropriate HTTP status code with JSON body:

```json
{
  "code": "ERROR_CODE_STRING",
  "message": "Human readable description of the error",
  "details": null
}
```

### Common Status & Error Codes:
| Status | Code | Meaning |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Request body, query, or path parameter failed schema validation (contains Zod issue details in `details`). |
| `400` | `BAD_REQUEST` | Semantic failure (e.g., file size limit exceeded, invalid participant split math). |
| `401` | `UNAUTHORIZED` | Missing, expired, or invalid Bearer token / cron secret. |
| `403` | `NOT_A_MEMBER` | User is not an active member of the specified household. |
| `403` | `ADMIN_REQUIRED` | Operation requires household admin role. |
| `404` | `NOT_FOUND` | Target resource does not exist. |
| `409` | `EMAIL_EXISTS` | Email address already taken during registration. |
| `409` | `CONFLICT` | Optimistic concurrency conflict (supplied `baseVersion` does not match the server's version). |
| `500` | `INTERNAL_SERVER_ERROR` | Unexpected unhandled server exception. |

---

## 4. System & Health

### `GET /health` or `GET /api/v1/health`
Checks database connectivity and server readiness.

- **Auth Required:** None
- **Response `200 OK`:**
```json
{
  "status": "healthy",
  "database": {
    "status": "ok",
    "latencyMs": 8
  },
  "version": "1.0.0",
  "minSupportedAppVersion": "1.0.0",
  "timestamp": "2026-10-29T21:15:00.000Z"
}
```

---

## 5. Authentication & Accounts

### `POST /api/v1/auth/register`
Creates a new user profile and returns access and refresh tokens.

- **Auth Required:** None
- **Body:**
```json
{
  "email": "user@example.com",
  "password": "Password123!",
  "displayName": "Ahmed Bahig",
  "avatarUrl": "https://example.com/avatar.png",
  "instapayLink": "https://ipn.eg/S/ahmed_bahig",
  "instapayUsername": "ahmed_bahig"
}
```
- **Response `201 Created`:**
```json
{
  "user": {
    "id": "e4b6c93d-422f-45b7-a3aa-173822d36391",
    "email": "user@example.com",
    "displayName": "Ahmed Bahig",
    "avatarUrl": "https://example.com/avatar.png",
    "instapayLink": "https://ipn.eg/S/ahmed_bahig",
    "instapayUsername": "ahmed_bahig",
    "createdAt": "2026-10-29T21:00:00.000Z"
  },
  "tokens": {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "48b3b429188..."
  }
}
```

---

### `POST /api/v1/auth/login`
Authenticates with email and password.

- **Auth Required:** None
- **Body:**
```json
{
  "email": "user@example.com",
  "password": "Password123!",
  "deviceName": "Ahmed's iPhone"
}
```
- **Response `200 OK`:** Same payload as register (`user` and `tokens`).

---

### `POST /api/v1/auth/refresh`
Rotates the session refresh token and issues a new access token.

- **Auth Required:** None
- **Body:**
```json
{
  "refreshToken": "48b3b429188..."
}
```
- **Response `200 OK`:**
```json
{
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "c9284ba3041..."
}
```

---

### `POST /api/v1/auth/logout`
Revokes the refresh token session.

- **Auth Required:** None
- **Body:**
```json
{
  "refreshToken": "c9284ba3041..."
}
```
- **Response `200 OK`:**
```json
{
  "message": "Logged out successfully"
}
```

---

### `GET /api/v1/auth/me`
Retrieves the profile of the currently authenticated user.

- **Auth Required:** Bearer Token
- **Response `200 OK`:**
```json
{
  "id": "e4b6c93d-422f-45b7-a3aa-173822d36391",
  "email": "user@example.com",
  "displayName": "Ahmed Bahig",
  "avatarUrl": "https://example.com/avatar.png",
  "instapayLink": "https://ipn.eg/S/ahmed_bahig",
  "instapayUsername": "ahmed_bahig",
  "createdAt": "2026-10-29T21:00:00.000Z"
}
```

---

### `PATCH /api/v1/auth/me`
Updates user profile settings, including avatar URL and Egyptian InstaPay payment link / username.

- **Auth Required:** Bearer Token
- **Body:**
```json
{
  "displayName": "Ahmed Bahig",
  "avatarUrl": "https://blob.vercel-storage.com/avatars/user_1.jpg",
  "instapayLink": "https://ipn.eg/S/ahmed_bahig",
  "instapayUsername": "ahmed_bahig"
}
```
- **Response `200 OK`:** Updated user profile object.

---

### `POST /api/v1/auth/me/avatar`
Uploads a user avatar photo (under 500 KB) and directly binds it to `users.avatarUrl`.

- **Auth Required:** Bearer Token
- **Body:**
```json
{
  "imageBase64": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "filename": "my_profile_photo.jpg"
}
```
- **Response `201 Created`:**
```json
{
  "user": {
    "id": "e4b6c93d-422f-45b7-a3aa-173822d36391",
    "displayName": "Ahmed Bahig",
    "avatarUrl": "https://blob.vercel-storage.com/avatars/...",
    "instapayLink": "https://ipn.eg/S/ahmed_bahig"
  },
  "upload": {
    "url": "https://blob.vercel-storage.com/avatars/...",
    "fileKey": "avatars/7f918e...-my_profile_photo.jpg",
    "sizeBytes": 182400,
    "contentType": "image/jpeg"
  }
}
```

---

## 6. Households & Memberships

### `GET /api/v1/households/my`
Lists all active households the user belongs to.

- **Auth Required:** Bearer Token
- **Response `200 OK`:**
```json
[
  {
    "id": "2d1c6762-b91c-4ce1-a3f2-cbe8a3a242f3",
    "name": "Flat 402 Degla",
    "currency": "EGP",
    "timezone": "Africa/Cairo",
    "role": "admin",
    "memberStatus": "active",
    "joinedAt": "2026-10-29T21:00:00.000Z"
  }
]
```

---

### `POST /api/v1/households`
Creates a new household. The creating user automatically becomes an `admin`.

- **Auth Required:** Bearer Token
- **Body:**
```json
{
  "name": "Flat 402 Degla",
  "currency": "EGP",
  "timezone": "Africa/Cairo"
}
```
- **Response `201 Created`:**
```json
{
  "id": "2d1c6762-b91c-4ce1-a3f2-cbe8a3a242f3",
  "name": "Flat 402 Degla",
  "currency": "EGP",
  "inviteCode": "FLAT402X",
  "timezone": "Africa/Cairo",
  "createdAt": "2026-10-29T21:00:00.000Z"
}
```

---

### `POST /api/v1/households/join`
Joins an existing household using an invite code.

- **Auth Required:** Bearer Token
- **Body:**
```json
{
  "inviteCode": "FLAT402X"
}
```
- **Response `200 OK`:**
```json
{
  "membershipId": "91ab4ef1-0163-4411-9fa6-163e77840332",
  "householdId": "2d1c6762-b91c-4ce1-a3f2-cbe8a3a242f3",
  "name": "Flat 402 Degla",
  "role": "member",
  "currency": "EGP"
}
```

---

### `GET /api/v1/households/:id/members`
Lists all members in the household.

- **Auth Required:** Bearer Token (Household Member)
- **Response `200 OK`:**
```json
[
  {
    "membershipId": "91ab4ef1-0163-4411-9fa6-163e77840332",
    "userId": "e4b6c93d-422f-45b7-a3aa-173822d36391",
    "displayName": "Ahmed Bahig",
    "email": "user@example.com",
    "avatarUrl": "https://example.com/avatar.png",
    "role": "admin",
    "status": "active",
    "joinedAt": "2026-10-29T21:00:00.000Z"
  }
]
```

---

### `POST /api/v1/households/:id/invite-code`
Generates a new random invite code and invalidates the old one.

- **Auth Required:** Bearer Token (Household Admin)
- **Response `200 OK`:**
```json
{
  "inviteCode": "NEWCODE9"
}
```

---

### `PATCH /api/v1/households/memberships/:id`
Updates a member's role or status.

- **Auth Required:** Bearer Token
- **Body:**
```json
{
  "role": "member",
  "status": "away"
}
```
- **Response `200 OK`:** Updated membership record.

---

## 7. Expenses & Ledger

### Split Methods
When creating an expense, four split methods are supported:
1. `"equal"`: Divides `amountMinor` equally across all participants. Any rounding remainder is distributed 1-minor-unit each to participants ordered by their `userId`.
2. `"percentage"`: Each participant specifies `percentage` (sum of percentages must equal `100.0`).
3. `"exact"`: Each participant specifies `exactMinor` (sum must equal total `amountMinor`).
4. `"shares"`: Weighted shares (e.g., person A has 2 shares, person B has 1 share).

---

### `POST /api/v1/households/:householdId/expenses`
Records a new shared expense.

- **Auth Required:** Bearer Token (Household Member)
- **Body:**
```json
{
  "payerId": "e4b6c93d-422f-45b7-a3aa-173822d36391",
  "title": "Weekly Grocery Run",
  "notes": "Bought at Metro Supermarket",
  "amountMinor": 65000,
  "currency": "EGP",
  "category": "Groceries",
  "expenseDate": "2026-10-29T18:00:00.000Z",
  "splitMethod": "equal",
  "participants": [
    { "userId": "e4b6c93d-422f-45b7-a3aa-173822d36391" },
    { "userId": "87c7bb92-05f3-421b-871c-3e2849b38d99" }
  ],
  "receiptUrl": "https://blob.vercel-storage.com/receipts/grocery.jpg"
}
```
- **Response `201 Created`:**
```json
{
  "id": "7ca641e7-fbcf-4a39-a78b-30eb8a2e70e9",
  "householdId": "2d1c6762-b91c-4ce1-a3f2-cbe8a3a242f3",
  "payerId": "e4b6c93d-422f-45b7-a3aa-173822d36391",
  "title": "Weekly Grocery Run",
  "amountMinor": 65000,
  "currency": "EGP",
  "category": "Groceries",
  "splitMethod": "equal",
  "status": "active",
  "version": 1,
  "shares": [
    {
      "userId": "e4b6c93d-422f-45b7-a3aa-173822d36391",
      "shareMinor": 32500
    },
    {
      "userId": "87c7bb92-05f3-421b-871c-3e2849b38d99",
      "shareMinor": 32500
    }
  ]
}
```

---

### `GET /api/v1/households/:householdId/expenses`
Lists expenses with filtering and pagination.

- **Auth Required:** Bearer Token (Household Member)
- **Query Parameters:**
  - `category` (optional string): Filter by category.
  - `status` (optional `"active"` | `"cancelled"` | `"disputed"`): Defaults to all.
  - `limit` (optional integer, e.g., `20`).
  - `offset` (optional integer, e.g., `0`).
- **Response `200 OK`:** Array of expense objects including participants and calculated shares.

---

### `GET /api/v1/expenses/:id`
Retrieves full details of a single expense, including audit events and comments.

- **Auth Required:** Bearer Token
- **Response `200 OK`:** Full expense object with `shares`, `events`, and `comments`.

---

### `PATCH /api/v1/expenses/:id`
Edits an expense. **Requires Optimistic Concurrency Control.**

- **Auth Required:** Bearer Token
- **Body:**
```json
{
  "baseVersion": 1,
  "title": "Weekly Grocery Run (Corrected)",
  "amountMinor": 68000,
  "splitMethod": "equal",
  "participants": [
    { "userId": "e4b6c93d-422f-45b7-a3aa-173822d36391" },
    { "userId": "87c7bb92-05f3-421b-871c-3e2849b38d99" }
  ]
}
```
- If `baseVersion` does not match the server's current version, returns `409 Conflict`.
- On success, increments `version` and writes an entry to `expense_events` and `change_log`.

---

### `POST /api/v1/expenses/:id/cancel`
Cancels an expense (marks status as `cancelled`), zeroing out its impact on household balances.

- **Auth Required:** Bearer Token
- **Response `200 OK`:** `{ "id": "...", "status": "cancelled", "version": 2 }`

---

### `POST /api/v1/expenses/:id/dispute`
Marks an expense as `disputed` for household discussion.

- **Auth Required:** Bearer Token
- **Body:**
```json
{
  "reason": "I did not consume the milk and eggs in this order"
}
```
- **Response `200 OK`:** `{ "id": "...", "status": "disputed" }`

---

### `POST /api/v1/expenses/:id/comments`
Appends a discussion message to an expense.

- **Auth Required:** Bearer Token
- **Body:**
```json
{
  "body": "Receipt uploaded; let me know if anyone wants to adjust."
}
```
- **Response `201 Created`:** Created comment record.

---

## 8. Balances & Settlement Suggestions

### `GET /api/v1/households/:householdId/balances`
Calculates real-time net balances for all household members from active expenses and confirmed settlements.

- **Auth Required:** Bearer Token (Household Member)
- **Response `200 OK`:**
```json
{
  "householdId": "2d1c6762-b91c-4ce1-a3f2-cbe8a3a242f3",
  "netBalances": [
    {
      "userId": "e4b6c93d-422f-45b7-a3aa-173822d36391",
      "displayName": "Ahmed Bahig",
      "balanceMinor": 32500
    },
    {
      "userId": "87c7bb92-05f3-421b-871c-3e2849b38d99",
      "displayName": "Karim Nour",
      "balanceMinor": -32500
    }
  ],
  "suggestions": [
    {
      "from": "87c7bb92-05f3-421b-871c-3e2849b38d99",
      "to": "e4b6c93d-422f-45b7-a3aa-173822d36391",
      "amountMinor": 32500
    }
  ]
}
```
*Note: A positive `balanceMinor` indicates the user is owed money (creditor). A negative `balanceMinor` indicates the user owes money (debtor).*

---

### `GET /api/v1/households/:householdId/balances/suggestions`
Returns only the greedy minimum-transfer settlement suggestions for settling debts within the household.

- **Auth Required:** Bearer Token (Household Member)
- **Response `200 OK`:** Array of `{ from, to, amountMinor }`.

---

## 9. Settlements (Pay-back)

Settlements record real-world payments (cash, bank transfer, InstaPay) between members.
- When created, status is `"pending"`.
- Pending settlements **do not** affect balances.
- Once the recipient calls `/confirm`, status changes to `"confirmed"` and the ledger balance is updated.

---

### `POST /api/v1/households/:householdId/settlements`
Initiates a settlement payment.

- **Auth Required:** Bearer Token (Household Member)
- **Body:**
```json
{
  "fromUser": "87c7bb92-05f3-421b-871c-3e2849b38d99",
  "toUser": "e4b6c93d-422f-45b7-a3aa-173822d36391",
  "amountMinor": 32500,
  "currency": "EGP"
}
```
- **Response `201 Created`:** Created settlement with status `"pending"`.

---

### `GET /api/v1/households/:householdId/settlements`
Lists all settlements for the household.

- **Auth Required:** Bearer Token (Household Member)
- **Response `200 OK`:** Array of settlement objects.

---

### `POST /api/v1/settlements/:id/confirm`
Recipient confirms receipt of payment.

- **Auth Required:** Bearer Token (Recipient of settlement)
- **Response `200 OK`:** `{ "id": "...", "status": "confirmed" }`

---

### `POST /api/v1/settlements/:id/reject`
Recipient or sender rejects the settlement.

- **Auth Required:** Bearer Token (Participant of settlement)
- **Response `200 OK`:** `{ "id": "...", "status": "rejected" }`

---

## 10. Household Life

### 10.1 Notes & Bulletin Board

#### `POST /api/v1/households/:householdId/notes`
- **Body:**
```json
{
  "title": "Wi-Fi Password",
  "body": "Network: Flat402, Pass: WelcomeHome2026",
  "pinned": true,
  "visibility": "all",
  "recipientId": null
}
```
- `visibility`: `"all"` or `"private"`. If `"private"`, only `recipientId` and the author can view the note.

#### `GET /api/v1/households/:householdId/notes`
Lists notes accessible to the requesting user (filtered server-side for private notes).

#### `POST /api/v1/notes/:id/read`
Records a read-receipt (`note_reads`).

#### `DELETE /api/v1/notes/:id`
Deletes note (author or admin only).

---

### 10.2 Chores & Automatic Rotation

#### `POST /api/v1/households/:householdId/chores`
Creates a recurring chore with an ordered rotation list.
- **Body:**
```json
{
  "title": "Take out trash & recycling",
  "description": "Sunday and Wednesday night",
  "frequency": "weekly",
  "rotationUserIds": [
    "e4b6c93d-422f-45b7-a3aa-173822d36391",
    "87c7bb92-05f3-421b-871c-3e2849b38d99"
  ],
  "firstDueOn": "2026-11-01T20:00:00.000Z"
}
```

#### `GET /api/v1/households/:householdId/chores`
Lists chores configured for the household.

#### `GET /api/v1/households/:householdId/chores/assignments`
Lists active and past chore assignments.

#### `PATCH /api/v1/chores/assignments/:id`
Marks assignment as `"completed"` or `"skipped"`. When completed, the system automatically creates the next assignment for the next user in the rotation list.
- **Body:**
```json
{
  "status": "completed"
}
```

---

### 10.3 Shopping List & Conversion to Expenses

#### `POST /api/v1/households/:householdId/shopping`
Adds an item to the household shopping list.
- **Body:**
```json
{
  "name": "Dishwasher pods",
  "qty": "1 pack"
}
```

#### `GET /api/v1/households/:householdId/shopping`
Lists shopping items.

#### `PATCH /api/v1/shopping/:id`
Updates item state (e.g. `status: "bought"`).

#### `POST /api/v1/households/:householdId/shopping/to-expense`
Converts multiple bought shopping items into a single active split expense in one atomic transaction.
- **Body:**
```json
{
  "itemIds": [
    "4d88e40f-7b0b-46e3-82a0-4ff66a4ef314",
    "d0e6538d-0453-4886-9a2c-aef649be2df9"
  ],
  "payerId": "e4b6c93d-422f-45b7-a3aa-173822d36391",
  "amountMinor": 24000,
  "participantIds": [
    "e4b6c93d-422f-45b7-a3aa-173822d36391",
    "87c7bb92-05f3-421b-871c-3e2849b38d99"
  ]
}
```

---

### 10.4 Polls & Voting

#### `POST /api/v1/households/:householdId/polls`
- **Body:**
```json
{
  "question": "Which internet speed upgrade should we get?",
  "options": ["100 Mbps (500 EGP)", "200 Mbps (800 EGP)"],
  "closesAt": "2026-11-05T23:59:59.000Z"
}
```

#### `GET /api/v1/households/:householdId/polls`
Lists polls, options, and vote counts.

#### `POST /api/v1/polls/:id/vote`
Casts or updates the user's vote (single-vote enforcement).
- **Body:**
```json
{
  "pollOptionId": "7c980332-9c3a-4efb-8664-df8491c49ae1"
}
```

---

### 10.5 Away Periods

#### `POST /api/v1/households/:householdId/away-periods`
Records dates when a member will be away (used by clients to exempt members from splits or pause chore assignments).
- **Body:**
```json
{
  "startsOn": "2026-12-01T00:00:00.000Z",
  "endsOn": "2026-12-15T00:00:00.000Z"
}
```

#### `GET /api/v1/households/:householdId/away-periods`
Lists away periods for the household.

---

## 11. Offline-First Sync Protocol

The sync engine uses an idempotent operation queue for writes (`push`) and an append-only change log cursor for reads (`pull`).

### `POST /api/v1/sync/push`
Pushes a batch of up to 50 offline operations created by the client.
- **Idempotency:** Each operation has an `operationId`. The server stores a SHA-256 hash of the payload in `sync_operations`. Re-sending an identical operation returns `status: "duplicate"`.
- **Conflict Handling:** Updates check `baseVersion`. Stale updates return `status: "conflict"` alongside the current server state without failing the rest of the batch.

- **Body:**
```json
{
  "operations": [
    {
      "operationId": "651639d1-03ec-4903-8d59-57ef9a5ae310",
      "householdId": "2d1c6762-b91c-4ce1-a3f2-cbe8a3a242f3",
      "entityType": "expense",
      "entityId": "7ca641e7-fbcf-4a39-a78b-30eb8a2e70e9",
      "op": "create",
      "baseVersion": 0,
      "payload": {
        "title": "Milk",
        "amountMinor": 3500,
        "payerId": "e4b6c93d-422f-45b7-a3aa-173822d36391",
        "participants": [
          { "userId": "e4b6c93d-422f-45b7-a3aa-173822d36391" }
        ]
      }
    }
  ]
}
```

- **Response `200 OK`:**
```json
{
  "results": [
    {
      "operationId": "651639d1-03ec-4903-8d59-57ef9a5ae310",
      "status": "applied",
      "version": 1
    }
  ]
}
```

---

### `GET /api/v1/sync/pull?cursor=N`
Fetches incremental changes from the household `change_log`.

- **Query Parameters:**
  - `cursor` (optional BigInt sequence string): Sequence number of the last received change. If omitted, starts from `0`.
- **Response `200 OK`:**
```json
{
  "changes": [
    {
      "seq": "1042",
      "householdId": "2d1c6762-b91c-4ce1-a3f2-cbe8a3a242f3",
      "entityType": "expense",
      "entityId": "7ca641e7-fbcf-4a39-a78b-30eb8a2e70e9",
      "op": "upsert",
      "version": 1,
      "createdAt": "2026-10-29T21:20:00.000Z"
    }
  ],
  "nextCursor": "1042",
  "resyncRequired": false
}
```

---

## 12. Device & Push Notification Tokens

### `POST /api/v1/devices`
Registers or refreshes a Firebase Cloud Messaging (FCM) token for push notifications.

- **Auth Required:** Bearer Token
- **Body:**
```json
{
  "fcmToken": "fcm_token_string_here_min_10_chars",
  "platform": "android"
}
```
- Supported `platform` values: `"android"`, `"ios"`, `"web"`.
- **Response `201 Created` or `200 OK`:**
```json
{
  "message": "Device registered",
  "id": "2bc8ec10-2b99-4d6b-b4a1-054593856230"
}
```

---

## 13. Receipt & File Uploads

### 13.1 Built-in Camera Capture Web Tool
A mobile-friendly camera capture tool is available at:
`GET /camera`

Features:
- Accesses rear camera (`facingMode: "environment"`) for receipts and front camera for avatars.
- Client-side auto-compresses photos to JPEG (0.75 quality) on HTML `<canvas>` to guarantee size $\le 500$ KB.
- Uploads directly via `/api/v1/uploads/direct` or `/api/v1/auth/me/avatar`.

For native Android Jetpack Compose camera capture code, see [`docs/android-camera-integration.md`](file:///home/abdo-bahig/Desktop/Catoza%20Backend/Catoza%20Backend/docs/android-camera-integration.md).

---

### `POST /api/v1/uploads/direct`
Directly receives a base64-encoded image captured by a camera or image picker.
- Size limit: **500 KB** (strictly enforced).
- Dual Storage: Uploads to Vercel Blob if `BLOB_READ_WRITE_TOKEN` is set; falls back to local disk (`/uploads/...`) in development.

- **Auth Required:** Bearer Token
- **Body:**
```json
{
  "imageBase64": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "type": "receipts",
  "filename": "receipt_camera_snap.jpg"
}
```
- Supported `type` values: `"receipts"`, `"avatars"`.
- **Response `201 Created`:**
```json
{
  "url": "https://blob.vercel-storage.com/receipts/f8a1...-receipt_camera_snap.jpg",
  "fileKey": "receipts/f8a1...-receipt_camera_snap.jpg",
  "sizeBytes": 215400,
  "contentType": "image/jpeg"
}
```

---

### `POST /api/v1/uploads/receipt`
Requests an upload target URL / metadata for receipt images. Enforces a **500 KB limit** to keep storage within free-tier quotas.

- **Auth Required:** Bearer Token
- **Body:**
```json
{
  "filename": "receipt_oct29.jpg",
  "contentType": "image/jpeg",
  "sizeBytes": 245100
}
```
- Allowed types: `image/jpeg`, `image/png`, `image/webp`.
- **Response `200 OK`:**
```json
{
  "uploadUrl": "https://blob.vercel-storage.com/receipts/...",
  "fileKey": "receipts/7f918e...-receipt_oct29.jpg",
  "maxSizeBytes": 524288
}
```

---

### `POST /api/v1/uploads/avatar`
Requests upload target metadata for a profile picture.

- **Auth Required:** Bearer Token
- **Body:**
```json
{
  "filename": "profile.jpg",
  "contentType": "image/jpeg",
  "sizeBytes": 150000
}
```
- **Response `200 OK`:** Same schema as receipt upload with `avatars/` path.

---

## 14. Internal Cron & Automation

### `POST /api/v1/internal/cron/daily`
Triggered automatically once daily by Vercel Cron (schedule: `0 4 * * *`). Performs database maintenance:
1. Generates recurring expenses due today from active `recurring_templates` and advances `nextRunOn`.
2. Prunes `sync_operations` records older than 30 days.
3. Prunes `change_log` entries older than 90 days.

- **Auth Required:** `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret: <CRON_SECRET>`
- **Response `200 OK`:**
```json
{
  "success": true,
  "timestamp": "2026-10-30T04:00:00.000Z",
  "results": {
    "recurringProcessed": 2,
    "syncOperationsPruned": 145,
    "changeLogPruned": 320
  }
}
```
