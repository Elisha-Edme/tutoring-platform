# Tune Up Together — Two-Part Plan

## Context

The tutoring platform is functionally working: 35 real tutors are in Google Sheets,
parent signup/signin works, the parent dashboard and tutor directory render live
via API routes (all Sheets access is in route handlers to avoid the Next.js 16
"ArrayBuffer is not detachable" render crash). This plan covers a **Part 1** we
implement now (demo-readiness) and a **Part 2** saved to its own repo file for later
(visual redesign + remaining features).

Key constraints confirmed with the user:
- **Contact page = info-only** (no backend form).
- **Part 1 stays monochrome** — only structure/content changes; all color/imagery is Part 2.
- **Migrate the 35 existing tutors' password cells to plaintext `TuneUp123`** now.
- Security note (intentional, demo-only): passwords will be stored **plaintext**. This is a
  deliberate downgrade for demo visibility and MUST be reversed before any real launch (tracked in Part 2).

Codebase facts (from exploration):
- `lib/auth.ts` — `hashPassword`/`verifyPassword` (scrypt) to remove; `verifySessionSync` uses
  `createHmac`+`timingSafeEqual` and MUST keep working (JWT sessions).
- `hashPassword` call sites: `app/api/auth/signup/route.ts:27`, `app/api/admin/seed-tutors/route.ts:20`,
  `app/api/admin/create-tutor/route.ts:23`. `verifyPassword`: `app/api/auth/signin/route.ts:15`.
- `lib/sheets.ts` already has `getDataRows`, `appendRow(s)`, `deleteRowsWhere` (private),
  `getChildrenByParent`, `getSheetIdByTitle`. No update helper currently.
- Children stored one-row-per-child in `Children` tab (`parentUserId, name, grade, instruments`); no child IDs.
- `app/dashboard/parent/ChildrenList.tsx` is read-only, fetches `GET /api/parent/children`.
- `SignUpForm.tsx` has the multi-instrument pill UI + `GRADES`/`INSTRUMENTS` consts (to reuse).
- Bare Tailwind v4 (`globals.css` = `@import "tailwindcss";`), Geist font, no footer, Navbar per-page.

---

## Part 1 — Implement now

### Step 0 — Save Part 2 to the repo
Write the "Part 2" section below to **`docs/part-2-plan.md`** so it survives as a standalone
reference the user can pick up later.

### 1.1 Remove password hashing → plaintext, and migrate existing tutors

**Code changes (going forward, everyone stored plaintext):**
- `lib/auth.ts`: delete `hashPassword` and `verifyPassword`; change the crypto import to only
  `{ timingSafeEqual, createHmac }` (both still used by `verifySessionSync`).
- `app/api/auth/signup/route.ts`: drop `hashPassword` import (keep `signSession`); `const passwordHash = password`.
- `app/api/auth/signin/route.ts`: drop `verifyPassword` import; change check to `if (!user || user.passwordHash !== password)`.
- `app/api/admin/seed-tutors/route.ts` & `create-tutor/route.ts`: drop `hashPassword` import;
  `const passwordHash = DEFAULT_TUTOR_PASSWORD`.

**One-time migration for the 35 existing tutors (whose cells hold scrypt hashes):**
- Add `resetTutorPasswords(plaintext)` to `lib/sheets.ts`: read `getDataRows('Users')`, build the
  passwordHash column (col E) replacing rows where `role === 'tutor'` with `plaintext`, preserving
  any non-tutor row's existing value, then one `spreadsheets.values.update` on `Users!E2:E{n}`.
- Add a **temporary** route `app/api/admin/migrate-passwords/route.ts` (POST → calls
  `resetTutorPasswords(DEFAULT_TUTOR_PASSWORD)`), run it once via curl, then **delete the route file**.

### 1.2 Add/edit children on the parent dashboard

Model: **replace-all** (no per-child IDs needed — matches the signup shape).
- `lib/sheets.ts`: add `replaceChildren(parentUserId, children)` = `deleteRowsWhere('Children', 0, parentUserId)`
  then `appendRows('Children', ...)`.
- `app/api/parent/children/route.ts`: add a `PUT` handler — verify session (parent), validate each child
  has name + grade + ≥1 instrument, call `replaceChildren`, return `{ ok, children }`.
- `lib/constants.ts`: extract `GRADES` and `CHILD_INSTRUMENTS` (currently inline in `SignUpForm.tsx`);
  reuse in both `SignUpForm.tsx` and the new manager.
- Replace `ChildrenList.tsx` with `ManageChildren.tsx` (client): view mode (cards) + "Add / edit children"
  → edit mode reusing the pill toggle UI (name input, grade select, instrument pills, add/remove row,
  Save → `PUT` → refresh, Cancel). Update `app/dashboard/parent/page.tsx` import.

### 1.3 Contact page (info-only, fixes the `/contact` 404)
- New `app/contact/page.tsx` (server): `Navbar` + centered section — heading, mission line, email +
  social links (placeholders; confirm real handles with the org), matching the monochrome style.
  No API route. This resolves the broken Navbar link.

### 1.4 Tighten the landing page (monochrome, structure/content only)
- `app/page.tsx`: refine hierarchy/spacing; keep the dual CTA; make stats a 3-up row
  (211 lessons · 170 hours · **35 tutors**); add a "How it works" 3-step section
  (Browse tutors → Create an account → Get matched for free lessons).
- New `components/Footer.tsx` (monochrome: org name, nav links, contact, © year); render it in
  `app/layout.tsx` after `{children}` so it's global (no page has a footer today — low risk).

### 1.5 Tighten the tutor directory (monochrome, structure/content only)
- `app/tutors/TutorGrid.tsx`: render the avatar `<img>` (`photoUrl`, rounded) with initial fallback;
  show lessons/hours as small text when > 0; add a name search input beside the instrument pills;
  show a "Showing N tutors" count; refine card spacing/typography. Keep the client `fetch('/api/tutors')`.

### Files touched (Part 1)
`lib/auth.ts`, `lib/sheets.ts`, `lib/constants.ts`, `app/api/auth/signup/route.ts`,
`app/api/auth/signin/route.ts`, `app/api/admin/{seed-tutors,create-tutor}/route.ts`,
`app/api/admin/migrate-passwords/route.ts` (temp), `app/api/parent/children/route.ts`,
`app/dashboard/parent/{page.tsx, ManageChildren.tsx}` (replaces `ChildrenList.tsx`),
`app/contact/page.tsx`, `app/page.tsx`, `app/layout.tsx`, `components/Footer.tsx`,
`app/tutors/TutorGrid.tsx`, `app/signup/SignUpForm.tsx` (use shared consts).

### Verification (Part 1)
Dev server already runs on `localhost:3000`.
- **1.1**: `curl -X POST /api/admin/migrate-passwords` → then confirm sheet col E shows `TuneUp123`
  for tutors; `curl -X POST /api/auth/signin -d '{"email":"navin.vasudev@tuneuptogether.org","password":"TuneUp123"}'`
  → expect `{ ok:true }`; sign up a new parent and confirm their chosen password appears plaintext + signin works.
- **1.2**: on `/dashboard/parent`, add a child + save; confirm a new row in `Children` and the card re-renders;
  edit/remove and re-save; confirm the `Children` rows for that parent are fully replaced.
- **1.3**: visit `/contact` → 200 (no 404); Navbar link works.
- **1.4 / 1.5**: browser check landing + `/tutors` (search, count, avatars, stats); confirm no
  "ArrayBuffer" regression (these pages never call googleapis during render).

---

## Part 2 — Later (also written to `docs/part-2-plan.md`)

### A. Visual design / "flavor" (from monochrome → branded, inspired by tuneuptogether.org)
- **Theme layer**: add Tailwind v4 `@theme` tokens in `globals.css` — a primary (trust, e.g. deep
  indigo/blue) + a warm accent (energy, e.g. amber/coral) + a display font for headings via
  `next/font` (keep Geist for body). *Est: 30–45 min.*
- **Hero background** — options & tradeoffs:
  1. **CSS gradient + subtle SVG pattern** (sound waves / music notes). Fast, no assets, no licensing,
     tiny payload, on-brand. *Est: 45–60 min.* ← recommended now.
  2. **Royalty-free photo** (Unsplash) with dark overlay via `next/image`. More emotional; needs
     licensing/attribution + optimization. *Est: 60–90 min.*
  3. **Real org photos** when the team provides them. Most authentic; asset-dependent. *Est: ~30 min.*
- **Component polish**: card shadows + hover lift, consistent section rhythm, accent pills/badges,
  per-instrument icons, real footer with socials, logo + favicon + OG image. *Est: 1–2 h.*

### B. Remaining functionality (estimates + solution/tradeoff)
1. **Dynamic landing stats** (sum lessons+hours, count tutors from the sheet) via `/api/stats`
   (route handler, not render) + client fetch or ISR. Live vs cached (rate limits). *30–45 min.*
2. **Tutor login + `/dashboard/tutor`** — auth already exists; tutors have `TuneUp123`; add role
   redirect in signin (proxy already gates `/dashboard`). *1–2 h.*
3. **Tutor detail page `/tutors/[id]`** via `/api/tutors/[id]`, or a modal on the grid. *~1 h.*
4. **Lesson booking/requests** — A) simple "Request a lesson" → `Requests` tab + email (*2–3 h*);
   B) full availability + scheduling (*5–8 h*). Speed vs completeness.
5. **Reviews** ("Leave a Review" like the live site) — `Reviews` tab + form + show avg on cards
   (a `rating` field already exists). *2–3 h.*
6. **Admin auth** — protect all `/api/admin/*` (incl. destructive `delete-tutor`) with an admin
   password/session or secret env header. **Do before any deploy.** *30–45 min.*
7. **Re-introduce password hashing** (reverse 1.1) + real prod secrets. *30–45 min.*
8. **Deploy to Vercel** + env vars (Google creds, `JWT_SECRET`). SSR already safe. *~30 min.*
9. **Email notifications** (`nodemailer` already a dep) on signup/contact/booking — Gmail SMTP vs
   transactional (Resend/SendGrid). *1–2 h.*
10. **Tutor photo uploads** (replace gravatar) — URL field in admin form (*~30 min*) vs real uploads
    to Vercel Blob/S3 (*2–3 h*).
11. **Data hardening** — add `childId` to `Children`; consider migrating off Sheets to Postgres/Supabase
    if usage outgrows the spreadsheet. *Variable.*
