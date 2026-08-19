# The Threadly Nest — Design System Update

This scaffold has the finalized brand system wired in: the gold/oxblood/
cream palette, and the Fraunces (headlines) + Work Sans (everything
else) font pairing. Follow these steps in order to get it running.

---

## Step 1 — Install dependencies

```bash
npm install
```

This pulls in `expo-font` and `@expo-google-fonts/work-sans`, which
are already in `package.json`.

---

## Step 2 — Download the Fraunces font files

Work Sans loads automatically from the Google Fonts package — no
manual download needed. Fraunces is not pre-packaged the same way, so:

1. Go to **fonts.google.com/specimen/Fraunces**
2. Click "Get font" → "Get font" again → download the family zip
3. Unzip it — inside, find the **static** folder (not the variable font)
4. Copy these two files into `assets/fonts/`:
   - `Fraunces_72pt-Bold.ttf` → rename to `Fraunces-Bold.ttf`
   - `Fraunces_72pt-Regular.ttf` → rename to `Fraunces-Regular.ttf`

The exact filenames matter — `app/_layout.tsx` references them
directly by name.

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

| Use Fraunces (`<Headline>`) for | Use Work Sans (`font-body*`) for |
|---|---|
| Screen titles ("Welcome back", "Find your style") | Subtext, body copy |
| Onboarding hero headlines | Form labels and input text |
| Large hero/display moments only | Buttons |
| | Chat bubbles |
| | Status tags, badges |
| | Anything under ~18px |

**Why this split exists:** Fraunces is a serif — it looks beautiful at
large headline sizes but loses legibility fast in small, dense UI
(forms, chat, labels). Work Sans is a warm humanist sans built for
exactly that small-size legibility. This isn't a style preference,
it's a real readability constraint — see the design discussion history
for the full reasoning if you want it.

**Rule of thumb:** if you're writing a `<Headline>` component, it's
Fraunces. If you're writing anything else — an `<Input>`, a `<Button>`
label, a `<Text>` inside a list or card — use `font-body`,
`font-body-medium`, or `font-body-semibold`.

---

## Components already updated

- `src/shared/components/Button.tsx` — oxblood/gold/cream variants, pill shape, Work Sans label
- `src/shared/components/Input.tsx` — bordered, rounded, Work Sans
- `src/shared/components/Headline.tsx` — `<Headline>` (Fraunces) and `<Subtext>` (Work Sans) — use these instead of raw `<Text>` for any screen title
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
