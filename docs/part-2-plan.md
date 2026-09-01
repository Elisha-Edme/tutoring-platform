# Tune Up Together — Part 2 Plan (for later)

Pick this up after the Part 1 demo-readiness work. Part 1 kept the UI monochrome and
stored passwords in plaintext for demo visibility — both are revisited here.

## A. Visual design / "flavor" (monochrome → branded, inspired by tuneuptogether.org)

- **Theme layer**: add Tailwind v4 `@theme` tokens in `app/globals.css` — a primary color
  (trust, e.g. deep indigo/blue) + a warm accent (energy, e.g. amber/coral) + a display font
  for headings via `next/font` (keep Geist for body). *Est: 30–45 min.*
- **Hero background** — options & tradeoffs:
  1. **CSS gradient + subtle SVG pattern** (sound waves / music notes). Fast, no assets, no
     licensing, tiny payload, on-brand. *Est: 45–60 min.* ← recommended first.
  2. **Royalty-free photo** (Unsplash) with a dark overlay via `next/image`. More emotional;
     needs licensing/attribution + optimization. *Est: 60–90 min.*
  3. **Real org photos** once the team provides them. Most authentic; asset-dependent. *Est: ~30 min.*
- **Component polish**: card shadows + hover lift, consistent section rhythm, accent pills/badges,
  per-instrument icons, real footer with socials, logo + favicon + OG image. *Est: 1–2 h.*

## B. Remaining functionality (estimate + solution/tradeoff)

1. **Dynamic landing stats** — sum lessons+hours, count tutors from the sheet via `/api/stats`
   (route handler, NOT page render) + client fetch or ISR. Live vs cached (rate limits). *30–45 min.*
2. **Tutor login + `/dashboard/tutor`** — auth already exists; tutors have `TuneUp123`; add a role
   redirect in signin (the proxy already gates `/dashboard`). *1–2 h.*
3. **Tutor detail page `/tutors/[id]`** — via `/api/tutors/[id]`, or a modal on the grid. *~1 h.*
4. **Lesson booking / requests** — A) simple "Request a lesson" → `Requests` tab + email (*2–3 h*);
   B) full availability + scheduling/calendar (*5–8 h*). Speed vs completeness.
5. **Reviews** ("Leave a Review" like the live site) — `Reviews` tab + form + show average rating on
   cards (a `rating` field already exists on `TutorProfile`). *2–3 h.*
6. **Admin auth** — protect ALL `/api/admin/*` (including destructive `delete-tutor`) with an admin
   password/session or a secret env header. **Do before any deploy.** *30–45 min.*
7. **Re-introduce password hashing** (reverse Part 1.1) + real production secrets. *30–45 min.*
8. **Deploy to Vercel** + env vars (Google service-account creds, `JWT_SECRET`, `GOOGLE_SHEET_ID`).
   SSR is already safe (no googleapis in render). *~30 min.*
9. **Email notifications** (`nodemailer` already a dependency) on signup/contact/booking — Gmail SMTP
   vs transactional (Resend/SendGrid). *1–2 h.*
10. **Tutor photo uploads** (replace the gravatar placeholder) — a URL field in the admin form
    (*~30 min*) vs real uploads to Vercel Blob/S3 (*2–3 h*).
11. **Data hardening** — add a `childId` to the `Children` tab; consider migrating off Google Sheets
    to Postgres/Supabase if usage outgrows the spreadsheet. *Variable.*
