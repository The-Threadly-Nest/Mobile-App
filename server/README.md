# The Threadly Nest — API Server

Express + Prisma + Zod, with fully custom email/password auth (bcrypt +
JWT — no Supabase, no OTP), a Gemini-powered booking chat assistant, and
a multi-tenant three-role data model (Admin / Staff / Customer).

---

## Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env` — see comments in the file for where each value comes
from (Postgres URL, JWT secret, Gmail App Password, Gemini API key).

```bash
npm run prisma:migrate   # creates tables in Postgres
npm run prisma:generate  # generates the typed Prisma client
npm run dev               # starts the API on http://localhost:4000
```

---

## Auth Model

This server owns identity fully — no Supabase, no third-party auth.

- **Admin & Customer** self-register via `POST /api/auth/signup`
- **Staff** accounts are created ONLY by an Admin, via `POST /api/staff/invite` — there is no public staff signup. The staff member gets an email with a link to set their password and activate.
- Passwords are hashed with bcrypt (12 rounds). Reset/activation tokens are hashed (never stored raw) and expire after 30 minutes.
- Login returns a JWT (30-day expiry) carrying `{ sub, email, role }` — `requireAuth` middleware verifies it, `requireRole()` gates admin-only routes.

---

## The Booking Chat Assistant

`POST /api/chat/message` — Gemini 2.5 Flash, constrained with function
calling so the model can only ever do one of two things: keep chatting
(display-only text) or call `create_booking` / `escalate_to_admin`.
Nothing else it says is ever written to the database.

Key safety mechanisms (see `src/lib/`):
- **Guardrails** (`chatGuardrails.ts`) — cheap regex checks run before
  any Gemini call, catching card numbers or dispute/refund language
- **History truncation** (`chatHistory.ts`) — conversations past 6 turns
  get collapsed to a summary marker instead of ballooning the token count
- **Server-enforced turn cap** — forces escalation after 8 exchanges
  regardless of what the model decides, not left to the prompt alone
- **Real data injected every call** — catalog items and available slots
  come from Prisma, the model can never invent availability

---

## Deploying

### Traditional host (Railway, Render, Fly.io)
```bash
npm run build && npm start
```

### Vercel (serverless)
1. Set `DATABASE_URL` to Supabase's **pooler** URL (port 6543,
   `?pgbouncer=true`) — required for serverless, not optional
2. Set all other env vars in Vercel's dashboard
3. Deploy — `vercel-build` runs `prisma generate` automatically
4. Run `npx prisma migrate deploy` once against production

---

## What's Left

- Paystack integration (payments) — noted as a future phase in the
  project proposal, not built here yet
- Cloudflare R2 / image upload service for catalog photos
- Real calendar/slot-management UI for Admin to set `AvailableSlot` rows
  (the schema and chat logic both assume these exist, but no CRUD
  routes are built for managing them yet)
