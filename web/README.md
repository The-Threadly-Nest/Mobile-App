# Owuja web

Next.js App Router website with Tailwind CSS v4, using local Instrument Sans and Hedvig Letters Serif fonts from `public/assets/fonts`. PostCSS loads Tailwind through `postcss.config.mjs`. Brand colours and font utilities are defined in the CSS `@theme` block.

Routes: `/` for direct waitlist registration (no email-code verification), `/admin` for the dashboard, and `/unsubscribe` for email preferences. Privacy and Terms pages are deferred.

Set `API_BASE_URL` to the NestJS backend origin. It is read only by `app/api/[...path]/route.ts`. Browser requests use same-origin `/api` endpoints. See `.env.example` for development and [RAILWAY.md](../RAILWAY.md) for production variables and two-service Railpack deployment.

Use Node.js 20.9 or newer. Install dependencies with `npm install`, then use `npm run dev`, `npm run build`, and `npm start`. Deploy with `web` as the project root and the Next.js framework preset.

Configure Resend and `WAITLIST_PUBLIC_URL` on the backend. The waitlist stores designer team size and shopper interests. Choosing Other reveals a custom-city field. Submissions are validated by the backend and duplicates do not overwrite details or reactivate unsubscribed contacts. Admin invitations no longer require waitlist email verification; mobile account verification is unchanged. The team-size column must exist before using signups.

The proxy permits only the listed API routes, caps request bodies at 16 KiB (including streamed bodies), preserves rate-limit/retry headers and masks upstream server failures. On Railway, configure the same private `WEB_PROXY_SECRET` on both services and `TRUST_RAILWAY_PROXY=true`. The backend authenticates signed visitor identity before applying rate limits. Never expose these variables to browser code.

All pages and interactive components use TypeScript and React state. Shared request and response types live in `lib/waitlist-types.ts`, with request handling in `lib/api.ts`. TypeScript strict mode is enabled. Run `npm run typecheck` after installing dependencies to check types. Admin credentials stay in memory for the current page session; refreshing requires signing in again.
