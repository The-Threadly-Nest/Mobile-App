# The Threadly Nest — Design System Update

This scaffold has the finalized brand system wired in: the gold/oxblood/
cream palette, and the Hedvig Letters Serif (headlines) + Instrument Sans (everything
else) font pairing. Follow these steps in order to get it running.

---

## Brand font setup

The Owuja brand fonts are bundled locally in `assets/fonts/` so cloud and EAS builds do not depend on machine-specific files:

- `InstrumentSans-Regular.ttf`
- `InstrumentSans-Medium.ttf`
- `InstrumentSans-SemiBold.ttf`
- `InstrumentSans-Bold.ttf`
- `HedvigLettersSerif-Regular.ttf`

`app/_layout.tsx` loads these files before the splash screen is hidden.

---

## Step 3 — Run the app

```bash
npx expo start
```

The app won't render until both fonts finish loading (this is
intentional — see `app/_layout.tsx`, it keeps the native splash screen
up until `useFonts` resolves, so you never see a flash of the wrong
font).

---

## Typography Rules — read before building new screens

This is the most important part of this update. The two fonts have
different jobs, and mixing them up is the easiest way to make the app
feel inconsistent or hurt readability:

| Use Hedvig Letters Serif (`<Headline>`) for | Use Instrument Sans (`font-body*`) for |
|---|---|
| Screen titles ("Welcome back", "Find your style") | Subtext, body copy |
| Onboarding hero headlines | Form labels and input text |
| Large hero/display moments only | Buttons |
| | Chat bubbles |
| | Status tags, badges |
| | Anything under ~18px |

**Why this split exists:** Hedvig Letters Serif is a serif — it looks beautiful at
large headline sizes but loses legibility fast in small, dense UI
(forms, chat, labels). Instrument Sans is a warm humanist sans built for
exactly that small-size legibility. This isn't a style preference,
it's a real readability constraint — see the design discussion history
for the full reasoning if you want it.

**Rule of thumb:** if you're writing a `<Headline>` component, it's
Hedvig Letters Serif. If you're writing anything else — an `<Input>`, a `<Button>`
label, a `<Text>` inside a list or card — use `font-body`,
`font-body-medium`, or `font-body-semibold`.

---

## Components already updated

- `src/shared/components/Button.tsx` — oxblood/gold/cream variants, pill shape, Instrument Sans label
- `src/shared/components/Input.tsx` — bordered, rounded, Instrument Sans
- `src/shared/components/Headline.tsx` — `<Headline>` (Hedvig Letters Serif) and `<Subtext>` (Instrument Sans) — use these instead of raw `<Text>` for any screen title
- `app/(auth)/login.tsx` — reference screen showing the full pattern in use; copy this structure for every other screen

---

## Palette reference (already in `tailwind.config.js`)

| Token | Hex | Use |
|---|---|---|
| `cream` | #FBF7EF | Page background |
| `oxblood` | #4A080C | Primary buttons, headlines, headers |
| `gold` | #C4A763 | Accent only — used sparingly |
| `ink` | #3A2E1A | Body text |
| `grey100` | #E4D5B7 | Borders |
| `grey700` | #8A7550 | Secondary/muted text |

Use these Tailwind classes directly — `bg-oxblood`, `text-ink`,
`border-grey100`, etc. Never hardcode a hex value in a screen; if a
color you need isn't in this table, add it to `tailwind.config.js`
first so it stays centralized.

---

## What's next

This scaffold has the design system wired in and one reference screen
(`login.tsx`) built against it. The remaining screens (signup, forgot
password, admin dashboard, staff, customer browse, chat, etc.) should
be built following the same pattern — `<Headline>` for the title,
`Input`/`Button` components for the rest, palette classes throughout.
