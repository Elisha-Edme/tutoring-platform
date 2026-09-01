# Scheduling & Booking Plan

## Decision: same spreadsheet, new tabs

Keep the existing spreadsheet. A second file would need its own `GOOGLE_SHEET_ID`,
separate service-account sharing, and more env vars — no benefit at this scale.
The sheet will grow from 4 tabs to 8. That's fine.

**New tabs to add (in order)**:

| Tab | Purpose |
|-----|---------|
| `TutorAvailability` | Recurring availability rules (one row per rule per tutor) |
| `AvailabilityExceptions` | Blocked dates or one-off time overrides |
| `LessonRequests` | Parent-initiated booking requests; status tracks lifecycle |
| `TutorStudents` | Tutor ↔ parent/child links (tutor's "my students" list) |

---

## Tab schemas

### TutorAvailability
Columns (position matters — code reads by index):

```
id | tutorUserId | startTime | endTime | timezone |
repeatType | repeatInterval | repeatDays |
endsType | endsDate | endsAfterCount | createdAt
```

- `id` — UUID, e.g. `avail_abc123`
- `startTime` / `endTime` — `HH:MM` 24-hour, e.g. `16:00` / `18:00`
- `timezone` — IANA string, e.g. `America/New_York` (default for all tutors for now)
- `repeatType` — `daily | weekly | biweekly | monthly | yearly`
- `repeatInterval` — integer ≥ 1 (e.g. `2` with `weekly` = every 2 weeks)
- `repeatDays` — comma-sep abbreviated days for weekly rules: `Mon,Wed,Fri`. Empty for non-weekly.
- `endsType` — `never | on | after`
- `endsDate` — ISO date `2026-12-31` (only used when `endsType=on`, else empty)
- `endsAfterCount` — integer (only used when `endsType=after`, else empty)
- `createdAt` — ISO timestamp

**Example rows:**
```
avail_001 | tutor_x | 16:00 | 18:00 | America/New_York | weekly | 1 | Mon,Wed | never | | | 2026-09-01T00:00:00Z
avail_002 | tutor_x | 10:00 | 12:00 | America/New_York | weekly | 1 | Sat     | on    | 2027-06-01 | | 2026-09-01T00:00:00Z
```

### AvailabilityExceptions
```
id | tutorUserId | date | type | startTime | endTime | reason
```

- `date` — ISO date `2026-12-25`
- `type` — `blocked` (entire day off, ignore availability rules) or `modified` (different time window)
- `startTime` / `endTime` — only used when `type=modified`
- `reason` — optional free text, shown to parent ("Holiday", "School event", etc.)

### LessonRequests
```
id | parentUserId | parentEmail | parentName | childName | tutorUserId | tutorEmail |
requestedDate | requestedStartTime | requestedEndTime |
message | status | createdAt | respondedAt
```

- `id` — UUID `req_abc123`
- `requestedDate` — ISO date `2026-09-15`
- `requestedStartTime` / `requestedEndTime` — `HH:MM` 24-hour
- `status` — `pending | accepted | declined | cancelled`
- `respondedAt` — ISO timestamp (empty until tutor responds)

### TutorStudents
```
tutorUserId | parentUserId | childName | addedAt
```

One row per tutor–child relationship. A tutor can add the same parent's multiple children
as separate rows.

---

## Email: Nodemailer via Gmail SMTP

Install: `npm install nodemailer @types/nodemailer`

New env vars (`.env.local`):
```
GMAIL_USER=tutoio.app@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx   # 16-char App Password from Gmail security settings
```

New file `lib/email.ts` — a single `sendEmail({ to, subject, html })` helper using
`nodemailer.createTransport` with Gmail SMTP (`smtp.gmail.com:587`, STARTTLS).

Email sent on booking request:
- **To:** tutor's email
- **Reply-To:** parent's email (so tutor can reply directly without any extra UI)
- **Subject:** `New lesson request from [Parent Name]`
- **Body:** child name, requested date/time, message, parent email, link to dashboard

---

## Feature breakdown

### Feature 1 — Tutor availability editor (replaces the demo grid)

**Where:** Tutor dashboard → Availability section (replacing `AvailabilityGrid` in
`TutorProfilePanel.tsx`).

**UX:** 
- List of existing recurring rules: "Mon, Wed · 4:00 PM – 6:00 PM · Weekly · Never ends"
  with a trash icon to delete
- "+ Add availability" button opens `RecurrenceModal`
- "Add exception" button opens `ExceptionModal` (block a date or override a time)

**RecurrenceModal** — mirrors the Google Calendar custom recurrence dialog:
1. Start time / end time (hour:minute + AM/PM pickers)
2. "Repeat every [N] [day/week/month/year]" — number stepper + select
3. "Repeat on" day toggles (S M T W T F S) — shown only when weekly/biweekly
4. "Ends" — three radio options:
   - Never
   - On [date picker]
   - After [N] occurrences
5. Save / Cancel

**API routes:**
- `GET  /api/tutor/availability` — returns all rules + exceptions for the signed-in tutor
- `POST /api/tutor/availability` — creates a new rule row in `TutorAvailability`
- `DELETE /api/tutor/availability?id=avail_xxx` — deletes a rule row
- `POST /api/tutor/availability/exceptions` — adds a row to `AvailabilityExceptions`
- `DELETE /api/tutor/availability/exceptions?id=exc_xxx`

---

### Feature 2 — Parent booking flow

**Where:** Tutor card in `/tutors` grid → "Request a Lesson" button → opens a modal
(or a `/tutors/[tutorUserId]/book` page — modal is simpler for now).

**UX:**
1. Parent clicks "Request a Lesson" on a tutor card
2. A modal opens with a 4-week date picker (only dates with available slots are enabled)
3. Selecting a date shows available time slots for that day (derived from tutor's rules minus exceptions)
4. Parent selects a slot, selects which of their children, types an optional message
5. Submits → writes `LessonRequests` row + sends email to tutor

**Slot computation** (runs in the `POST /api/lessons/request` route AND in a new
`GET /api/tutors/[tutorUserId]/slots?from=DATE&to=DATE` route used by the booking modal):

```
expandRules(rules, dateRange)
  → for each rule, generate concrete (date, startTime, endTime) pairs
     within the date range respecting repeatType / repeatInterval / repeatDays
     and the ends condition
  → flatten, sort
→ subtract exceptions (blocked dates fully removed; modified dates get the override times)
→ return sorted list of { date, startTime, endTime }
```

This logic lives in `lib/schedule.ts` (pure functions, no Sheets access — safe to call
from route handlers).

**API routes:**
- `GET  /api/tutors/[tutorUserId]/slots?from=YYYY-MM-DD&to=YYYY-MM-DD` — returns available slots
- `POST /api/lessons/request` — body: `{ tutorUserId, childName, requestedDate, requestedStartTime, requestedEndTime, message }`. Verifies session (parent), writes row, sends email.

---

### Feature 3 — Tutor lesson requests inbox

**Where:** Tutor dashboard → new "Lesson Requests" section.

**UX:**
- Tabs or filter: Pending / Accepted / All
- Each card: parent name, child name, date + time, message, Accept / Decline buttons
- Accepting / declining updates the `status` and `respondedAt` columns

**API routes:**
- `GET  /api/tutor/requests` — returns `LessonRequests` rows where `tutorUserId = me`
- `PUT  /api/lessons/[id]/status` — body `{ status: 'accepted' | 'declined' }`, verifies caller is the tutor

When a request is accepted, the tutor's "Upcoming sessions" section (already stubbed in
the dashboard) should show it.

---

### Feature 4 — Tutor "add a student"

**Where:** Tutor dashboard → new "My Students" section.

**UX:**
1. Tutor clicks "+ Add a student"
2. Enters parent email address, clicks "Look up"
3. System calls `GET /api/parent/by-email?email=` (new route) — returns parent name +
   their children list, or a "no account found" message
4. Tutor selects one child from the list → clicks "Add"
5. Writes a row to `TutorStudents`
6. The "My Students" section now shows the child's name, parent name, and date added

**API routes:**
- `GET  /api/parent/by-email?email=` — verifies caller is a tutor, returns `{ name, children[] }` or 404
- `GET  /api/tutor/students` — returns `TutorStudents` rows joined with parent/child info
- `POST /api/tutor/students` — body `{ parentUserId, childName }`, writes row
- `DELETE /api/tutor/students` — body `{ parentUserId, childName }`, removes row

---

## Files to create / modify

### New files
```
lib/email.ts                                      # Nodemailer sendEmail helper
lib/schedule.ts                                   # expandRules() + slot computation (pure, no I/O)
app/api/tutor/availability/route.ts               # GET + POST
app/api/tutor/availability/exceptions/route.ts    # POST + DELETE
app/api/tutor/requests/route.ts                   # GET (tutor's inbox)
app/api/tutor/students/route.ts                   # GET + POST + DELETE
app/api/lessons/request/route.ts                  # POST (parent submits booking)
app/api/lessons/[id]/status/route.ts              # PUT (tutor accept/decline)
app/api/tutors/[tutorUserId]/slots/route.ts       # GET available slots for date range
app/api/parent/by-email/route.ts                  # GET parent by email (for tutor student-add)
app/dashboard/tutor/AvailabilityEditor.tsx        # Replaces AvailabilityGrid
app/dashboard/tutor/RecurrenceModal.tsx           # Google Calendar-style recurrence picker
app/dashboard/tutor/ExceptionModal.tsx            # Block/override a specific date
app/dashboard/tutor/LessonRequestsPanel.tsx       # Tutor inbox: pending requests
app/dashboard/tutor/MyStudentsPanel.tsx           # Tutor student list + add flow
app/tutors/BookingModal.tsx                       # Parent-facing slot picker + request form
```

### Modified files
```
lib/types.ts           # Add TutorAvailabilityRule, AvailabilityException, LessonRequest, TutorStudent
lib/sheets.ts          # Add CRUD helpers for all 4 new tabs
app/dashboard/tutor/TutorProfilePanel.tsx  # Import AvailabilityEditor, LessonRequestsPanel, MyStudentsPanel
app/tutors/TutorGrid.tsx                   # Add "Request a Lesson" button → BookingModal
```

---

## Build order (recommended)

Build in this order so each step is independently testable:

1. **Sheets schema + helpers** — add the 4 tabs to the spreadsheet manually, add types +
   helpers in `lib/sheets.ts`. Verify with a quick route that reads/writes each tab.
2. **Email** — `lib/email.ts`, smoke-test with a temporary test route.
3. **Availability editor** (tutor dashboard) — `AvailabilityEditor` + `RecurrenceModal` +
   `ExceptionModal` + the 3 availability API routes. At this point tutors can set schedules.
4. **Slot computation** — `lib/schedule.ts` + `GET /api/tutors/[id]/slots`. Verify the
   expansion logic returns correct dates for weekly, biweekly, and monthly rules.
5. **Booking modal** (parent side) — `BookingModal` in the tutor grid + `POST /api/lessons/request`
   + the email send. End-to-end: parent books → email arrives at tutoio.app@gmail.com.
6. **Tutor lesson inbox** — `LessonRequestsPanel` + `GET /api/tutor/requests` +
   `PUT /api/lessons/[id]/status`. Tutor can accept/decline.
7. **Tutor add student** — `MyStudentsPanel` + the 3 student routes.

---

## Scope notes / things not in this plan

- **Cancellations by parent** — out of scope for now; can be added alongside the lesson inbox later.
- **Email on accept/decline** — easy to add in step 6 (same `sendEmail` helper, different template).
- **Timezone handling** — storing `America/New_York` as the default for all tutors is fine for the
  demo. Full per-user timezone support can come later.
- **Conflict detection** — if two parents book the same slot before the tutor accepts either,
  the tutor sees two pending requests for the same time and can decline one. Good enough for now.
- **Lesson summaries / session history** — original spec item, not covered here; add after booking works.
