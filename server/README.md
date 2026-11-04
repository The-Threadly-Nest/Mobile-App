# Owuja API

NestJS 11, TypeScript, Prisma and PostgreSQL. The backend is a modular monolith: commerce and availability share database transactions while feature modules own their HTTP endpoints and application services.

## Structure

- `src/app.module.ts`: composition root for 12 feature modules.
- `src/app.ts`: shared Nest bootstrap, CORS, request limits, logging and exception handling.
- `src/core/auth`: native Nest session, role and platform-admin guards, credential revocation and tenant identity.
- `src/core/database`: injectable database access and shutdown lifecycle.
- `src/modules`: identity, fashion-houses, workforce, catalog, orders, billing, availability, customers, messaging, design, media and waitlist.
- `src/core/http`: typed endpoint inputs, validation pipes, response metadata interceptor, native rate-limit guard and exception filter.
- `src/schemas`: Zod input contracts with readable field validation messages.
- `src/lib`: shared infrastructure and existing domain rules.

The 87 existing feature endpoints retain their methods and `/api/...` paths. Health remains at `/health`; API documentation remains at `/api-docs`. The old Express router files have been replaced by Nest controllers and injectable services.

## Request handling

All 87 feature endpoints use Nest controllers, typed inputs and native guards. Feature services accept validated data and account identity, return values, and use the injected database service. They no longer accept Express requests, responses or callbacks. The old handler bridge and authentication/validation middleware have been removed.

Endpoint DTO contracts live beside each feature. The input pipe validates and strips unknown body fields; account identity comes only from the session guard. Multipart audio uses Nest's file interceptor with the existing 20 MB limit. A response interceptor preserves dynamic status codes and collection pagination headers without services writing HTTP responses.

Authentication, upload, waitlist, chat and voice-parser limits are enforced by a native guard. Development can use memory; production uses atomic database-backed counters shared across instances.

This remains a modular monolith, not a microservices or GraphQL rewrite. Shared provider helpers for email, notifications and storage remain infrastructure functions. REST paths and the public response contracts remain unchanged.

## Install and verify

Use Node.js 20.9 or newer. From `server`, run these yourself:

```powershell
npm install
npx prisma generate
npm run build
npm test
```

The HTTP regression tests load compiled code, so build before running tests. They use mocked database and provider boundaries and never send real email or write to the database. Keep the dependency lockfile in sync with `package.json` before CI uses `npm ci`.

Configure `.env` from `.env.example`. `DATABASE_URL` and `JWT_SECRET` are required at startup. Regenerate Prisma Client after schema changes. This framework migration adds no database schema changes and requires no database reset. Earlier unapplied waitlist schema changes must be applied separately before using the waitlist.

## Run

- Development: `npm run dev` starts Nest in watch mode.
- Railway / other long-running host: `npm run build`, then `npm start`.
- Vercel: `api/index.ts` initializes and caches the same Nest application per warm instance. Keep the existing Vercel rewrite configuration.

`PORT` defaults to 4000. `TRUST_PROXY_HOPS` defaults to 0 for direct access; configure it to the actual proxy chain when deployed. `ALLOWED_ORIGIN` accepts a single origin, comma-separated origins or `*`.

## Database row security

The restricted business connection and privileged identity connection have separate responsibilities:

- `DATABASE_URL`: restricted login inheriting `owuja_runtime`, without ownership, `SUPERUSER`, `CREATEROLE`, `CREATEDB` or `BYPASSRLS`.
- `IDENTITY_DATABASE_URL`: private owner connection for credential verification, public waitlist processing and internal notification lookups. Never expose it in the mobile/web client or commit it.
- `DIRECT_URL`: owner connection for schema migrations, not the normal business-query connection.
- `DATABASE_RLS_ENABLED=true`: enables per-request transaction-local database identity and validates the restricted login at startup. Restart the API after changing the local environment.

The row-policy SQL is in `20261103010000_database_row_policies`. Queries set the authenticated account and fashion house with `set_config(..., true)` inside the same transaction as the query; connection-pool reuse must never retain a previous request's identity. Protected queries without an authenticated identity fail closed. Authentication and platform-level operations use the explicit privileged boundary instead.

`tests/database-rls.test.ts` is an opt-in rollback-only policy test (`SECURITY_TEST_DATABASE_URL`). `tests/rls-runtime.test.ts` is an opt-in test of the actual Neon development login/API (`RUN_RLS_RUNTIME_TEST=true`); it removes its temporary records afterward. Neither should target Railway production.

Do not use `db push --force-reset` on this configured database: it deletes records and removes custom policies. A fresh Railway deployment still needs the previously discussed migration-baseline repair; the old index-first migration history is not a fresh-database baseline.

## Commerce contracts carried over

- Price calculation uses database catalog prices.
- Checkout and booking transaction boundaries, unique keys and idempotency rules are retained.
- Tenant-scoped order, invoice, staff and slot access remains in the existing queries.
- Customer, staff, fashion-house admin and platform-admin permissions remain distinct.
- Message ownership, read state, deletion rules and escalation lifecycle are retained.
- Email, object storage and notifications retain their existing provider integration.

Logs use readable request summaries and exclude request bodies, credentials, message contents and raw provider errors. Server failures return a safe, readable message; field validation includes actionable messages and field paths.

Compilation and isolated regression checks do not replace testing the mobile/web flows against your development services before deployment. No database migration or reset is required by this refactor.
