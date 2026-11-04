# Deploy Owuja with Railpack

This prepares deployment; it does not create Railway services or change Neon.
Privacy and Terms pages are deliberately deferred.

## Services

Create one Railway project containing a **new PostgreSQL database**, an `api`
service, and a `web` service. Connect the same repository to both application
services. Select **Railpack**, not Dockerfile.

| Setting | api | web |
| --- | --- | --- |
| Root directory | `/server` | `/web` |
| Build | From `server/railpack.json` | From `web/railpack.json` |
| Start | `npm start` | `npm start -- --hostname ::` |
| Pre-deploy command | `npm run db:deploy && npm run db:provision` | None |
| Healthcheck path | `/health` | `/` |
| Service variable `PORT` | `4000` | `3000` |
| Service variable `RAILPACK_NODE_VERSION` | `22` | `22` |

Keep `RAILPACK_PRUNE_DEPS=false` on the API: the pre-deploy command needs the
installed Prisma CLI. Do not set a Dockerfile path. Remove old custom build/start
overrides if they conflict with the commands above. Build steps install from the
lockfiles, generate Prisma Client on Linux, and compile the applications.
Railpack's native Node install/build steps are intentionally retained so its
manifest, lockfile and source-copy commands are not replaced. The API's npm
`prebuild` hook generates Prisma Client before TypeScript compilation.

## Private variables

Use Railway variables/references, **not committed files**. The examples below
assume the database service is named `Postgres` and the backend is named `api`.
Replace those reference names if you choose different service names.

Generate three independent random hexadecimal secrets (64 characters each):
`JWT_SECRET`, `WEB_PROXY_SECRET`, and a runtime database password. You can generate
each locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
Store the runtime password as a private shared Railway variable named
`RUNTIME_DB_PASSWORD`. Hexadecimal avoids URL-escaping mistakes.

Set on **api**:

```text
NODE_ENV=production
PORT=4000
RAILPACK_NODE_VERSION=22
RAILPACK_PRUNE_DEPS=false
DATABASE_RLS_ENABLED=true
RATE_LIMIT_STORE=database
TRUST_PROXY_HOPS=0
TRUST_RAILWAY_PROXY=true
DIRECT_URL=${{Postgres.DATABASE_URL}}
IDENTITY_DATABASE_URL=${{Postgres.DATABASE_URL}}
DATABASE_URL=postgresql://owuja_app:${{shared.RUNTIME_DB_PASSWORD}}@${{Postgres.RAILWAY_PRIVATE_DOMAIN}}:5432/${{Postgres.PGDATABASE}}
JWT_SECRET=<private random secret>
WEB_PROXY_SECRET=<private random secret shared with web>
ALLOWED_ORIGIN=https://<your-web-domain>
WAITLIST_PUBLIC_URL=https://<your-web-domain>
WAITLIST_INVITE_URL=<your actual early-access destination>
PLATFORM_ADMIN_EMAILS=<your actual platform-admin email>
RESEND_API_KEY=<your Resend key>
EMAIL_FROM=<your verified sender>
EMAIL_REPLY_TO=<your support address>
```

The three database URLs must target the same host, port and database. Keep the
Postgres owner's URL only in `DIRECT_URL` and `IDENTITY_DATABASE_URL`; never use
it as the normal runtime `DATABASE_URL`. The pre-deploy step creates the
non-owner `owuja_app` login and grants the existing `owuja_runtime` group. It
refuses unsafe existing role flags and does not rotate existing passwords.

Set on **web**:

```text
NODE_ENV=production
PORT=3000
RAILPACK_NODE_VERSION=22
TRUST_RAILWAY_PROXY=true
API_BASE_URL=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:4000
WEB_PROXY_SECRET=<exact same private value as api>
```

`API_BASE_URL` and `WEB_PROXY_SECRET` are server-only. Never prefix them with
`NEXT_PUBLIC_`. The web service uses Railway's edge-provided `X-Real-IP`, not
arbitrary `X-Forwarded-For`, and signs the visitor identity sent to the API.
These settings assume Railway's public edge is the only public entry point;
review client identity again before adding another CDN/reverse proxy.

Configure the existing R2/S3, Gemini, Google authentication and mobile deep-link
variables from `server/.env.example` before using their corresponding features.
No test API keys or default administrator credentials are supplied. An admin
still needs a verified admin account plus the platform email allowlist.

## Database and deployment order

1. Use a **fresh empty Railway PostgreSQL database**, not Neon development.
2. Configure the API variables and pre-deploy command above, then deploy API.
   The missing `0_initial_schema` now creates core tables before the existing
   incremental migrations. Later migrations add waitlist/team size, shared rate
   limits, availability constraints and row policies. The database owner must be
   able to create roles and the `btree_gist` extension.
3. Confirm API `/health` succeeds. A security preflight checks the owner/runtime
   separation, restricted role and installed row policies before startup.
4. Configure and deploy web, generate its public Railway domain, and set the
   matching API origin/waitlist URLs. Generate an API public domain only if the
   mobile app needs public access. Keep web-to-API requests on private networking.
5. Test a shopper signup, designer signup with team size, custom city, duplicate
   submission, welcome email/unsubscribe, admin login and invitation delivery.
   Confirm separate visitors have separate rate-limit buckets.

Never run `db push --force-reset` or replay the new initial migration against an
existing database. Neon was previously maintained with `db push`; it needs its
own reviewed baselining procedure, not the fresh-database deployment commands.
Do not migrate existing Neon data to Railway unless separately requested.

## Verification boundary

Local builds and mocked regression tests do not prove that Railway private DNS,
database extension permissions, role creation, provider credentials or migration
replay work in your account. Verify the first deployment's pre-deploy and health
logs before accepting real signups. No Railway deployment or live database
change is performed by adding these files.

References: [Railpack configuration](https://railpack.com/config/file/),
[Railway monorepos](https://docs.railway.com/deployments/monorepo),
[Railway client-IP headers](https://docs.railway.com/networking/public-networking/specs-and-limits).
