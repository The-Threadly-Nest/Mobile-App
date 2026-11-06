# Redesigned mobile screens: backend integration

The mobile app uses the public Railway API origin from `EXPO_PUBLIC_API_BASE_URL`.
Local `.env` and EAS preview/production profiles target the Railway backend; no
private Railway DNS name or database URL belongs in the mobile environment.

## Connected flows

- Browse loads `/api/catalog/marketplace` with pagination, uses actual catalog
  names/images/prices, and opens `/api/catalog/item/:id` through the existing item
  detail screen. Search/category filters apply to loaded items; Load More fetches
  the next page. Fake products, ratings, discounts and looping sale timers were
  removed because the API does not provide those offers or ratings.
- Saved Items uses the authenticated `/api/preferences` endpoint. Saved catalog
  IDs are validated as UUIDs, checked for existence, and stored under the current
  account's row-security identity. The profile popup resolves actual saved items.
  The customer floating tab bar also includes Favorites beside Profile; that
  screen loads the same saved records and supports removing them from the account.
- Profile photos use the existing presign/upload/image-processing flow, followed
  by saving the processed storage key to `/api/preferences`. The server rejects
  foreign ownership prefixes, pending/traversal keys and unsupported image data.
  It generates the URL itself; the client cannot assign an arbitrary remote URL.
  Admin uploads belong to the authenticated fashion house; customer uploads belong
  to the authenticated customer. SecureStore is only an account-bound device cache.
- Customer Settings edits phone/location in its popup and commits local state
  only after the API accepts the update. Partial preference updates preserve
  existing styles, budget, timeline, photo and saved items.
- Admin Settings opens the existing business-profile form in a popup, keeps its
  existing onboarding/profile update API, and dismisses the popup after saving.
  Fitting Slots opens the existing slot-management popup using its real APIs.
  Admin summaries and customer orders reload on focus. Failed order requests
  show a retry message rather than silently appearing as an empty order list.
- Notifications opens the device's app settings. Push token registration remains
  in the existing login/signup flow; this is not a new notification-feed API.
  The dashboard has only a notification bell (no profile shortcut). It reads real
  unread message counts from `/api/direct-messages/my-threads`, refreshes on
  focus/resume, pull-to-refresh and every 30 seconds while active, and opens the
  inbox. Opening the inbox does not falsely mark all conversations as read.
- Measurements, messages, order detail/checkout and role-specific admin tools
  retain their existing authenticated endpoints and ownership checks.

## Required before testing live

Deploy the backend and apply migration `20261106000000_profile_photo` using the
existing Railway pre-deploy migration step. It adds `photoKey` and
`savedCatalogIds` to `customer_preferences`; it does not delete rows or change
row policies. Then deploy/rebuild the mobile app. This change has **not** been
applied to Neon or Railway by editing the repository. Do not run a reset or replay
the fresh-database baseline against the existing Neon development database.

Photo upload requires working R2/S3 credentials and a reachable public asset base
URL on the backend. Run sign-in, catalog refresh, item detail, saving/unsaving,
photo upload/relaunch on another device, customer contact edits, admin profile
edits, and fitting-slot changes against the deployed API with test accounts.

## Deliberately unavailable

The admin balance remains unavailable and withdrawal is disabled: there is no
wallet ledger, payment-provider settlement or payout API. Revenue totals are not
available-to-withdraw balances. Privacy/legal copy and a full notification feed
are separate work, not fabricated backend integrations.

## Checks

Backend build and mocked integration/regression tests cover profile ownership,
partial settings updates, valid/invalid saved IDs, and photo persistence. Mobile
TypeScript checking currently needs the existing TypeScript 6 compatibility flag:
`npm run typecheck -- --ignoreDeprecations 6.0`. These checks do not substitute for
live Railway/R2 and physical-device tests. No production messages, uploads or
database writes are made by the mocked tests.
