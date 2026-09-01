# Tune Up Together — Agent Handoff

Read this first. It's the fast path to being productive on this repo.

## What this app is
"Tune Up Together" is a **nonprofit music-tutoring platform**: high school musicians give
**free lessons** to elementary/middle-school students. This app lets **parents** sign up and
manage their kids, browse a **tutor directory**, and lets **tutors** manage their profile.
It's a demo being iterated quickly (not yet deployed).

## Stack
Next.js **16.2.9** (App Router, Turbopack), React 19, TypeScript, Tailwind **v4**.
Database = **Google Sheets** via the `googleapis` service account. No SQL, no Prisma.

## ⚠️ The one critical gotcha (do not forget)
Calling `googleapis` **inside a page/Server-Component render crashes** Next.js 16 with
`ArrayBuffer is not detachable ... failed to pipe response`. It works fine in **route handlers**.
**Rule:** all Sheets reads/writes live in `app/api/**/route.ts`; pages/components `fetch()` those
routes (usually client-side). `getSession()` (pure Node crypto, no googleapis) **is** safe to call
directly in a Server Component, so server-side auth guards still work.

## Google Sheets schema (spreadsheet ID in `.env.local` → `GOOGLE_SHEET_ID`)
**Row 1 of every tab is a header; data starts at row 2.** Code reads by **column position**, not
header text, so header wording is cosmetic but **column order and tab names must not change**.
Helpers live in `lib/sheets.ts`.

- **Users** — `id | email | name | role | passwordHash | createdAt`
  - `role` ∈ `parent | tutor | admin`. `passwordHash` currently holds **plaintext** (see Auth).
- **TutorProfiles** — `userId | email | name | instruments | bio | school | credentials | location | photoUrl | lessonsCompleted | hoursCompleted | rating`
  - `instruments` = comma-separated in one cell (e.g. `Viola, Piano`). Numbers default `0`.
- **ParentProfiles** — `userId | email | name`
- **Children** — `parentUserId | name | grade | instruments`
  - one row per child; `instruments` comma-separated (kids can have multiple). Linked to parent by
    `parentUserId` (foreign key on the child side — parents intentionally have no child-id column).

## Auth model
- Email + password. **Passwords are stored PLAINTEXT on purpose** (demo visibility — user's call).
  Hashing was removed from `lib/auth.ts`; re-add before any real launch (Part 2 item #7).
- **Every tutor's password is `TuneUp123`** (seeded). Tutor emails are `first.last@tuneuptogether.org`
  (e.g. `navin.vasudev@tuneuptogether.org`). Parents set their own password at signup.
- Session = JWT (HS256, `jose` to sign) in an httpOnly `session` cookie, verified with Node crypto in
  `verifySessionSync`. `proxy.ts` gates `/dashboard/*` on cookie **presence only** (real verification
  happens in the page via `getSession()` — verifying with jose in proxy also triggered the ArrayBuffer bug).
- New tutors get a default avatar (`DEFAULT_AVATAR_URL`, a Gravatar silhouette) in `lib/constants.ts`.

## Routes & pages
- Pages: `/` (landing, redirects signed-in users to their dashboard), `/tutors`, `/signup`, `/signin`,
  `/contact` (info-only), `/dashboard/parent`, `/dashboard/tutor`, `/admin/create-tutor` (hidden, unlinked).
- API (route handlers): `auth/{signup,signin,signout}`, `tutors` (GET all), `parent/children` (GET + PUT
  replace-all), `tutor/me` (GET + PUT bio/instruments), `admin/{seed-tutors,create-tutor,delete-tutor}`.

## Key decisions & redirections the user gave (honor these)
- **Do NOT push/PR or deploy** until the user explicitly says so.
- **No tutor self-signup** — tutors are created via the admin page/seed only.
- Signed-in users land on their **dashboard**, not the landing page (parent→`/dashboard/parent`,
  tutor→`/dashboard/tutor`). Navbar shows "Dashboard" (not "Home") when signed in.
- Contact page is **info-only** (no form). The `tuneuptogether.org` link was removed (Instagram + email stay).
- Part 1 was kept **monochrome**; all color/imagery is deferred to Part 2.
- Children UI: **pencil icon = edit that one child**, **+ Add child = add**. Availability on the tutor
  dashboard is an **interactive demo grid (Sun–Sat, EST), not persisted** — that's intentional for the demo.

## Images / photos
Tutor `photoUrl` may be a Google Drive share link. `lib/images.ts` `toDisplayImageUrl()` rewrites
`.../file/d/ID/view` (or `?id=ID`) → `https://drive.google.com/thumbnail?id=ID&sz=w400` (renders for
**publicly-shared** files). `<img>` uses `referrerPolicy="no-referrer"` + `onError` fallback to initials.
The org **logo** is `public/logo.png` (also `app/icon.png` favicon), used in the Navbar + landing hero.

## Env (`.env.local`, gitignored — never commit)
`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` (watch for trailing commas / `\n`),
`GOOGLE_SHEET_ID` (the long id from the sheet URL, NOT the `gid` tab number), `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`.

## Status & where to look next
- **Part 1 is done** (plaintext passwords + 35 real tutors seeded, parent add/edit children, contact page,
  tightened landing + tutor directory, tutor dashboard with bio/instruments edit + availability demo, logo).
- **Plans:** full two-part plan → `docs/two-part-plan.md`; the later-work backlog with estimates →
  `docs/part-2-plan.md`. Biggest pre-launch items: **re-add password hashing**, **protect `/api/admin/*`**
  (currently unauthenticated, incl. destructive delete), dynamic landing stats, booking, reviews, deploy.

## Gotchas / conventions
- Verify with `npx tsc --noEmit`. Dev server: `npm run dev` (localhost:3000).
- `middleware.ts` is renamed `proxy.ts` in Next 16; `cookies()` is async; route `params` are promises.
- Admin routes are **unauthenticated** — fine locally, must be locked down before deploy.
- git: user is on GitHub account `Elisha-Edme` (repo owner); `gh auth switch` toggles to work account `eedme_hubspot`.
