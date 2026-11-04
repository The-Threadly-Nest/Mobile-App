# Owuja web

Next.js App Router website with Tailwind CSS v4, using local Instrument Sans and Hedvig Letters Serif fonts from `public/assets/fonts`. PostCSS loads Tailwind through `postcss.config.mjs`. Brand colours and font utilities are defined in the CSS `@theme` block.

Routes: `/` for waitlist registration and six-digit email verification, `/admin` for the existing dashboard, `/unsubscribe` for email preferences. Admin access is unchanged pending separate work.

Set `API_BASE_URL` in the website environment to the Express backend origin. It is read only by `app/api/[...path]/route.ts`. Browser requests use same-origin `/api` endpoints.

Use Node.js 20.9 or newer. Install dependencies with `npm install`, then use `npm run dev`, `npm run build`, and `npm start`. Deploy with `web` as the project root and the Next.js framework preset.

Configure Resend and `WAITLIST_PUBLIC_URL` on the backend. Apply the waitlist migrations, including `20261101010000_waitlist_email_verification`, and regenerate Prisma Client before using this feature. Codes expire after 10 minutes, allow five attempts, and can be resent after one minute. Only verified entries can receive launch invitations.

All pages and interactive components use TypeScript and React state. Shared request and response types live in `lib/waitlist-types.ts`, with request handling in `lib/api.ts`. TypeScript strict mode is enabled. Run `npm run typecheck` after installing dependencies to check types. Admin credentials stay in memory for the current page session; refreshing requires signing in again.
