# The Threadly Nest

Full project — mobile app + backend, merged into one folder.

```
the-threadly-nest/
├── app-mobile/     ← React Native (Expo) app — all 3 roles (Admin/Staff/Customer)
└── server/         ← Express + Prisma + Zod API, with Gemini booking chat
```

## Start here

1. **`server/README.md`** — set up the backend first (Postgres, auth, Gemini API key)
2. **`app-mobile/README.md`** — set up the mobile app (fonts, then point it at your running server)

## Design system

- **Palette:** cream `#FBF7EF`, oxblood `#4A080C`, gold `#C4A763` — defined in `app-mobile/tailwind.config.js`
- **Fonts:** Fraunces (headlines only, via `<Headline>`) + Work Sans (everything else) — see the Typography Rules table in `app-mobile/README.md` before building new screens

## What's built vs. what's left

**Built:** full auth (signup/login/forgot-password/reset/staff-activation), all three role dashboards, Admin measurement capture + staff invite + invoicing + escalation queue, Staff order updates + mood board, Customer discovery + Gemini-powered booking chat + order progress tracking.

**Left as documented extension points:** Paystack payments, image upload (Cloudflare R2), calendar/slot management UI for Admin, live data replacing the mock data currently in `app-mobile/src/shared/mockData.ts`.
