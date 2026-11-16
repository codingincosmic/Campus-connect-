# Campus Connect 

A responsive web app for a college to manage **attendance, assignments, notices and results**,
with four roles: **Admin**, **Teacher**, **Student** and **Parent**.

Built to be used on phones as much as on desktops — students and parents will mostly be on mobile.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | React 19 + Vite + Tailwind CSS v4 + React Router |
| Backend | Node.js + Express |
| Database | PostgreSQL via Prisma ORM |
| Auth | JWT in an **httpOnly cookie**, with role-based access control |
| File storage | Local disk behind a swappable adapter (S3-ready) |
| Validation | Zod on the backend |

---

## Build status

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Scaffolding, auth, RBAC, seed data | **Done** |
| 2 | Classes, subjects, enrollment, account creation | **Done** |
| 3 | Attendance (mark, view, reports, CSV) | **Done** |
| 4 | Assignments (create, submit, grade) | **Done** |
| 5 | Notices | **Done** |
| 6 | Performance / results (SGPA & CGPA) | Built — awaiting DB to verify |
| 7 | Dashboards, polish, responsiveness pass | Built — awaiting DB to verify |

The database schema in `server/prisma/schema.prisma` covers **all** phases already, so later
phases add features without re-shaping tables you already have data in.

---

## Setup

### 1. Prerequisites

- **Node.js 20 or newer** (this project was built and tested on Node 22)
- A **PostgreSQL database**. Any hosted provider works; the free tiers are plenty:
  - [Neon](https://neon.tech) — recommended
  - [Supabase](https://supabase.com)

### 2. Install dependencies

From the project root:

```bash
npm run setup
```

This installs the root, `server/` and `client/` dependencies in one go.

### 3. Create your database and get the connection string

**Neon:** create a project → *Connection Details* → copy the connection string.

> **Important:** use the string **without** `-pooler` in the hostname. The pooled
> connection cannot run schema migrations.

**Supabase:** *Project Settings* → *Database* → *Connection string* → *URI*, and
replace `[YOUR-PASSWORD]` with your real database password.

### 4. Configure environment variables

A `server/.env` file has already been created for you with a randomly generated
`JWT_SECRET`. Open it and paste your connection string into `DATABASE_URL`:

```env
DATABASE_URL="postgresql://user:password@your-host.neon.tech/neondb?sslmode=require"
```

Every other value has a working default. See `server/.env.example` for what each one does.

### 5. Create the database tables

```bash
npm run db:migrate
```

Prisma will ask you to name the migration — `init` is fine. This creates every table.

### 6. Load sample data

```bash
npm run db:seed
```

This creates one fully-populated class so the app is immediately testable.

### 7. Run it

```bash
npm run dev
```

| | |
| --- | --- |
| App | http://localhost:5173 |
| API | http://localhost:4000/api/health |

Both the API and the frontend start together, and both reload on save.

---

## Demo logins

Every seeded account uses the password **`Password@123`**
(change `SEED_PASSWORD` in `server/.env` before seeding if you'd prefer another).

You can sign in with either the username or the email address.

| Role | Username | Email | Notes |
| --- | --- | --- | --- |
| Admin | `admin` | admin@college.edu | Dr. Meera Iyer |
| Teacher | `anita` | anita.rao@college.edu | Teaches 3 subjects |
| Teacher | `vikram` | vikram.shah@college.edu | Teaches 2 subjects |
| Student | `bca2301` | bca2301@student.college.edu | Aarav Sharma |
| Parent | `rajesh` | rajesh.sharma@parent.college.edu | **2 children** — tests the child switcher |
| Parent | `sunita` | sunita.patel@parent.college.edu | 1 child |

Seeded academic data:

- **BCA Year 2 / Section A** — 2025-26, semester 3 — 5 subjects, 8 students
- **BCA Year 2 / Section B** — 2025-26, semester 3 — 2 subjects, 2 students

---

## API surface so far

All routes are prefixed with `/api`. "Staff" means ADMIN **or** TEACHER.

| Method | Route | Who |
| --- | --- | --- |
| POST | `/auth/login` | public |
| POST | `/auth/logout` | public |
| GET | `/auth/me` | logged in |
| POST | `/auth/change-password` | logged in |
| GET | `/config` | public |
| GET | `/classes` · `/classes/:id` | staff |
| POST · PATCH · DELETE | `/classes` · `/classes/:id` | admin |
| GET | `/classes/:id/students` | staff |
| POST · DELETE | `/classes/:id/students` | admin |
| GET | `/subjects` | staff |
| POST · PATCH · DELETE | `/subjects` · `/subjects/:id` | admin |
| GET · POST · PATCH · DELETE | `/users` · `/users/:id` | admin |
| POST | `/users/:id/reset-password` | admin |
| GET · POST · DELETE | `/users/:id/children` | admin |
| GET | `/attendance/sheet` | staff |
| POST | `/attendance/mark` | staff |
| GET | `/attendance/report` · `/attendance/report.csv` | staff |
| GET | `/attendance/defaulters` | staff |
| GET | `/attendance/me` | student |
| GET | `/attendance/student/:studentId` | scoped per role |
| GET · POST | `/assignments` | staff |
| PATCH · DELETE | `/assignments/:id` | staff (own subjects) |
| GET | `/assignments/:id/submissions` | staff |
| POST | `/assignments/:id/publish` | staff |
| PATCH | `/assignments/submissions/:id/grade` | staff |
| GET | `/assignments/mine` | student |
| POST | `/assignments/:id/submit` | student |
| GET | `/assignments/student/:studentId` | scoped per role |
| GET | `/assignments/:id/file` · `/assignments/submissions/:id/file` | scoped per role |
| GET | `/notices` · `/notices/:id` · `/notices/unread-count` | any role (audience-scoped) |
| POST | `/notices/:id/read` · `/notices/read-all` | any role |
| POST · PATCH · DELETE | `/notices` · `/notices/:id` | **staff only** |
| GET | `/notices/targets` · `/notices/:id/file` | staff / audience-scoped |
| GET | `/results/me` | student |
| GET | `/results/student/:studentId` | scoped per role |
| GET | `/results/class/:classId` · `/results/class/:classId/csv` | staff |
| GET | `/results/subject/:subjectId` | staff |
| GET | `/dashboard/teacher` · `/dashboard/student` · `/dashboard/parent` | matching role |
| GET | `/dashboard/child/:studentId` | scoped per role |
| GET | `/admin/overview` · `/admin/teachers` · `/admin/activity` | admin |

Teachers see only classes in which they teach at least one subject; that rule
lives in one function (`classFilterFor`) so it can't drift between endpoints.
Similarly, who may view a given student's records is decided once in
`server/src/lib/access.js` and reused by every module.

### Attendance rules

| Status | Counts as attended? | In the total? |
| --- | --- | --- |
| Present | yes | yes |
| Late | yes | yes |
| Absent | no | yes |
| Excused | — | **no** — removed from the denominator |

`percentage = attended / (records − excused) × 100`

A student with no records yet shows "—", not 0%, and is never flagged a defaulter.
Change any of this in `server/src/config/attendance.js`.

**Editing history.** A teacher may add attendance for any past date (catching up),
but *changing* an already-saved record only works within
`ATTENDANCE_EDIT_WINDOW_DAYS` (default 7) and requires a written reason, which is
stored on the record along with who changed it and when.

### Assignment rules

| Situation | Behaviour |
| --- | --- |
| Submitted after the due date | **Accepted**, but flagged `late` for the teacher |
| Student re-submits | Replaces the file; any provisional (unpublished) mark is cleared |
| Student re-submits after results are published | Refused — the work is final |
| Teacher enters marks | **Never shown to students or parents on the assignments page** |
| Teacher clicks *Release results* | Marks go to the marksheet; the student sees the assignment as "Evaluated" |
| Deleting an assignment with submissions | Refused, to protect students' work |

**Where marks are visible.** Assignment marks are an official record, so they
belong on the marksheet (results module), not on the assignments screen. The
student/parent API responses do not contain `marksObtained` or `grade` at all —
this is enforced in `publicSubmission()` in
`server/src/modules/assignments/assignments.service.js`, not merely hidden in the
UI, so the marks cannot be read by calling the API directly. Teachers use a
separate `staffSubmission()` shape and do see the numbers.

Written feedback *is* still shown to students once results are released, since
it is teaching guidance rather than an official record.

### Who can see an assignment

**An assignment is visible only to students enrolled in the class *and section*
of its subject.** This trips people up, because the same subject name can exist
in several sections, each with a different teacher — for example:

| Subject | Class | Teacher | Students who see its assignments |
| --- | --- | --- | --- |
| Data Structures | BCA Year 2 / **A** | Anita Rao | the 8 students in Section A |
| Data Structures | BCA Year 2 / **B** | Vikram Shah | the 2 students in Section B |

So an assignment set by Vikram never reaches a Section A student, however
identical the subject name looks. **Admin → All assignments** has a "Visible to"
column showing the target class, section and enrolled headcount for exactly this
reason.

### Notice rules

**Who can post what:**

| Role | Whole college | Whole class (all sections) | One section |
| --- | --- | --- | --- |
| Admin | yes | yes | yes |
| Teacher | no | no | only sections they teach in |
| Student | — | — | — |
| Parent | — | — | — |

**Students and parents are strictly view-only.** They can read their notices,
mark them read and download attachments; every write route returns `403`.

**Who sees a notice:**

| Target | Reaches |
| --- | --- |
| `ALL` | everyone in the college |
| `CLASS` | every section of that class name **in that academic year** |
| `SECTION` | that one class+section only |

Students see notices for their enrolled classes, parents see notices for their
children's classes, teachers see notices for classes they teach (plus their own
posts), and admins see everything. Requesting a notice you're not in the
audience for returns **404**, not 403 — so you can't confirm it exists.

The academic year is part of `CLASS` targeting on purpose: without it, a notice
for "BCA Year 2" would also reach next year's cohort of the same class name.

Read/unread is tracked per user in `notice_reads`; opening a notice marks it
read, and the sidebar shows an unread count.

**Guard against mis-targeting.** Because one teacher often teaches several
sections, it is easy to post to the wrong one — and the mistake is invisible
until someone complains. So the compose form shows a live "this notice will go
to" panel with the exact class, section and student headcount *before* you post,
warns outright when the target has **0 students enrolled**, and the success
message afterwards repeats where it actually went and how many students will
see it.

### Results and GPA

The marksheet **stores nothing**. Every figure is derived from graded, released
assignment marks, so there is no second copy to drift out of sync with what
teachers actually entered.

An "assessment" is simply an assignment — a written test, a lab exercise and a
homework upload are all the same shape (title, maximum, mark), so they share one
table instead of needing a separate `exams` model.

Per subject:

```
sum(marks) / sum(maxMarks) -> percentage -> letter grade -> grade point
```

then weighted by each subject's credits:

```
SGPA = sum(gradePoint × credits) / sum(credits)     for one semester
CGPA = the same, across every semester
```

Only subjects with **released** marks count. A subject with nothing released yet
shows "Awaiting results", never 0%, and is left out of the SGPA rather than
dragging it down.

Marks appear **only** on the results pages — the assignments screens say
"Evaluated" and show no number.

### Capacity: will this hold 1000–2000 students?

Yes — Postgres is not troubled by this size. But two things need saying plainly.

**Row counts at 2000 students** (≈40 classes, 6 subjects each, 180 teaching days):

| Table | Rows per academic year | Note |
| --- | --- | --- |
| `users` | ~4,100 | students + parents + staff |
| `student_class_enrollments` | ~2,000 | |
| `attendance_records` | **~2,160,000** | 6 subjects × 180 days × 2000 — dominates everything |
| `assignment_submissions` | ~180,000 | |
| `notice_reads` | ~1,000,000 | grows as notices × users |
| everything else | < 10,000 | |

Two tables reach millions of rows a year. Postgres serves that in single-digit
milliseconds **provided the indexes are right**, which is the catch below.

**Indexes matter more than row count.** Postgres composite indexes only serve
queries that filter on a *leftmost prefix*. An index on `(studentId, classId)`
does **not** help a query filtering by `classId` alone — that becomes a
sequential scan over the whole table. Three such gaps existed and are now fixed:

| Table | Query | Was | Now |
| --- | --- | --- | --- |
| `student_class_enrollments` | class rosters, gradebooks (`WHERE classId`) | seq scan | `@@index([classId])` |
| `notice_reads` | unread badge (`WHERE userId`) — runs on **every page load** | seq scan | `@@index([userId])` |
| `attendance_records` | admin oversight (`GROUP BY markedById`) | seq scan | `@@index([markedById])` |

Plus `assignments.createdById`, `assignment_submissions.gradedById` and
`marksObtained`, `notices.targetClassId`, and `parent_student_links.studentId`.

> **Run `npm run db:migrate` to apply these.** Without them, the notices badge
> alone would scan a million-row table on every navigation.

**The real constraint is hosting, not the code.** At 2000 students, attendance
plus its indexes is roughly **700 MB per year**, and `notice_reads` adds ~100 MB.
Supabase's free tier caps at **500 MB**, so it will not fit a full year at that
size. Options, cheapest first:

1. **Self-host Postgres on your VPS** — no artificial cap, and you are deploying
   to a VPS anyway. Best fit.
2. **Supabase Pro** (8 GB) or an equivalent paid tier.
3. **Mark attendance once per day** instead of per subject — cuts the dominant
   table roughly 6× (see `server/src/config/attendance.js`), at the cost of
   subject-wise attendance percentages.
4. **Archive completed academic years** to a separate table or database.

The free tier is fine for a pilot of one or two classes, which is what it is
being used for now.

### Concurrency: can records clash?

Every duplicate-prone relationship is protected by a **database-level unique
constraint**, not by application checks — so two users acting at the same
instant cannot create a double record even if both pass validation:

| Constraint | Prevents |
| --- | --- |
| `attendance_records (studentId, subjectId, date, periodNo)` | the same register being saved twice |
| `assignment_submissions (assignmentId, studentId)` | two submissions from one student |
| `student_class_enrollments (studentId, classId)` | double enrolment |
| `parent_student_links (parentId, studentId)` | duplicate parent links |
| `notice_reads (noticeId, userId)` | duplicate read receipts |
| `users.email`, `users.username`, `users.rollNo` | duplicate accounts or roll numbers |
| `classes (name, section, academicYear)` | two identical class rows |
| `subjects (classId, name)` | the same subject twice in one class |

Bulk writes use `createMany({ skipDuplicates: true })`, which Postgres executes
as `INSERT ... ON CONFLICT DO NOTHING` — atomic, so re-saving is a no-op rather
than an error. Saving a register is wrapped in a transaction, so a sheet either
saves completely or not at all.

**One accepted limitation:** if two staff members somehow mark the *same* subject,
date and period simultaneously, the first save wins and the second is silently
skipped rather than merged. In practice one teacher owns a subject, so this is
not a realistic collision — but it is a deliberate trade-off, not an oversight.

### Admin oversight

Admins get read-only visibility of teaching activity at **Teachers & activity**:

- per-teacher counts — subjects, assignments set, attendance sessions taken,
  attendance records **changed**, submissions graded, and last-active time
- a merged activity feed, filterable by teacher and event type

Attendance edits are highlighted and carry the reason the teacher typed, so a
changed register can always be accounted for. There is no separate audit table —
the feed is derived from the records the other modules already write.

**Uploads.** Files go through the storage adapter, never straight to disk from
feature code. The extension allowlist is in `server/src/lib/upload.js`; anything
not on it is rejected. Downloads are served by authorised routes
(`/assignments/:id/file`), not as static files, and the internal storage key is
never sent to the browser — so knowing a filename gets you nothing.

---

## Useful commands

Run these from the project root.

| Command | What it does |
| --- | --- |
| `npm run dev` | Start API + frontend together |
| `npm run dev:server` | Start only the API |
| `npm run dev:client` | Start only the frontend |
| `npm run db:migrate` | Create and apply a migration after editing the schema |
| `npm run db:seed` | Load (or reload) the sample data |
| `npm run db:reset` | **Wipe the database**, re-run all migrations, re-seed |
| `npm run db:studio` | Open Prisma Studio, a visual database browser |
| `npm run build` | Production build of the frontend |

---

## Project structure

```
college-portal/
├─ package.json            Root scripts — runs both halves together
│
├─ server/                 Express + Prisma API
│  ├─ .env                 Your secrets (gitignored)
│  ├─ .env.example          Documented template
│  ├─ prisma/
│  │  ├─ schema.prisma     ALL database tables, heavily commented
│  │  └─ seed.js           Sample data
│  ├─ uploads/             Assignment files (local storage driver)
│  └─ src/
│     ├─ index.js          Entry point: connect DB, start server
│     ├─ app.js            Express setup and middleware order
│     ├─ routes.js         Table of contents for the whole API
│     ├─ config/
│     │  ├─ env.js         Reads + validates environment variables
│     │  └─ grading.js     ★ Grade bands, grade points, GPA rules
│     ├─ lib/
│     │  ├─ prisma.js      One shared database client
│     │  ├─ jwt.js         Token signing + the httpOnly cookie
│     │  ├─ password.js    bcrypt hashing
│     │  ├─ storage.js     ★ File storage adapter (swap local → S3 here)
│     │  ├─ errors.js      AppError + helpers (badRequest, forbidden, ...)
│     │  └─ asyncHandler.js
│     ├─ middleware/
│     │  ├─ auth.js        ★ requireAuth + requireRole — real security
│     │  ├─ validate.js    Zod request validation
│     │  └─ errorHandler.js  Turns any error into consistent JSON
│     └─ modules/
│        └─ auth/          routes → controller → service → schemas
│
└─ client/                 React frontend
   └─ src/
      ├─ main.jsx          Entry point + providers
      ├─ App.jsx           ★ Route map, one branch per role
      ├─ index.css         Tailwind import + design tokens
      ├─ api/client.js     ★ The only place that calls fetch()
      ├─ auth/
      │  ├─ AuthContext.jsx    Who is logged in
      │  └─ ProtectedRoute.jsx Route guards
      ├─ components/
      │  ├─ AppLayout.jsx  App shell: top bar, sidebar, mobile drawer
      │  ├─ ui.jsx         Button, Field, Card, Alert, Badge, EmptyState
      │  └─ Spinner.jsx
      └─ pages/            One folder per role
```

★ = the files worth reading first to understand how the app hangs together.

### How a request flows

```
Browser                     Express                          Postgres
  │                            │                                │
  ├─ fetch('/api/...')  ──────►│                                │
  │  (cookie sent               ├─ requireAuth   verify JWT ────►│  load user
  │   automatically)            ├─ requireRole   check role      │
  │                            ├─ validate      check body (Zod) │
  │                            ├─ controller    HTTP in/out      │
  │                            ├─ service       business rules ─►│  query
  │◄── JSON ───────────────────┤                                │
  │                            └─ errorHandler  on any throw     │
```

Each layer has one job, which keeps files short and makes it obvious where to add something new.

---

## Design decisions worth knowing

**JWT in an httpOnly cookie, not localStorage.**
JavaScript cannot read an httpOnly cookie, so a cross-site scripting bug can't steal
the token. The frontend never touches the token at all — it asks `GET /api/auth/me`
who is logged in.

**Frontend route guards are not security.**
`ProtectedRoute` stops a student *navigating* to an admin page. It does nothing to stop
someone calling the API directly. The real enforcement is `requireAuth` + `requireRole`
on the backend, applied to every protected route.

**The user is re-read from the database on every request.**
Slightly more work than trusting the token payload, but it means deactivating an account
or changing a role takes effect immediately rather than whenever the token expires.

**Login errors are deliberately vague.**
"Incorrect email/username or password" is returned whether or not the account exists,
so nobody can probe which email addresses belong to the college.

**No public signup.**
The college creates all student and parent accounts (Phase 2), keeping the data controlled.

**File storage goes through one adapter.**
Feature code never touches `fs`. Moving to S3/R2 later means adding a driver to
`server/src/lib/storage.js` and changing `STORAGE_DRIVER` — no feature code changes.

**One row in `classes` = one class *and* section.**
E.g. `name: "BCA Year 2", section: "A"`. So notice targeting means:
`ALL` = everyone, `CLASS` = every section of that class name, `SECTION` = one specific row.

---

## Things you'll want to customise

| What | Where |
| --- | --- |
| Grade bands, grade points, pass mark, GPA scale | `server/src/config/grading.js` |
| Attendance threshold (default 75%) | `ATTENDANCE_THRESHOLD` in `server/.env` |
| How many days back attendance can be edited (default 7) | `ATTENDANCE_EDIT_WINDOW_DAYS` in `server/.env` |
| How Late/Excused affect the percentage | `server/src/config/attendance.js` |
| **The college's timezone** (default `Asia/Kolkata`) | `COLLEGE_TIMEZONE` in `server/.env` |
| Max upload size (default 10 MB) | `MAX_UPLOAD_MB` in `server/.env` |
| Brand colours | `--color-brand-*` in `client/src/index.css` |
| Demo account password | `SEED_PASSWORD` in `server/.env`, then re-seed |

---

## Troubleshooting

**`Can't reach database server` / Prisma error `P1001`**

First work out whether it's the network or the database itself:

```powershell
Test-NetConnection aws-0-ap-south-1.pooler.supabase.com -Port 5432
```

- **TCP fails** — network, DNS or firewall problem, or a wrong host in `DATABASE_URL`.
- **TCP succeeds but Prisma still reports P1001** — the connection pooler in front
  of the database is up, but the database behind it is not. On Supabase's free tier
  this almost always means the **project has been paused after a period of
  inactivity**. Open the Supabase dashboard and click **Restore / Resume**, wait a
  minute or two, then restart `npm run dev`.

On Neon, make sure you used the connection string **without** `-pooler`, and that
it ends with `?sslmode=require`.

**`Missing required environment variable: DATABASE_URL`**
`server/.env` doesn't exist or the variable is empty. Copy `server/.env.example` to
`server/.env` and fill it in.

**Migration hangs or errors on Neon**
You're on the pooled connection string. Switch to the direct one.

**Login succeeds but the page bounces back to login**
The auth cookie isn't reaching the API. In development, make sure you're browsing
`http://localhost:5173` (the Vite proxy makes the API same-origin) rather than hitting
port 4000 directly.

**"I posted a notice / set an assignment but the student can't see it"**
Almost always a section mix-up rather than a bug. Both are delivered by
**class *and* section**, and the same class name usually exists in more than one
section with a different teacher:

| Subject / class | Section | Teacher | Reaches |
| --- | --- | --- | --- |
| Data Structures, BCA Year 2 | **A** | Anita Rao | the 8 Section A students |
| Data Structures, BCA Year 2 | **B** | Vikram Shah | the 2 Section B students |

Check the target with **Admin → All assignments** ("Visible to" column), or the
"this notice will go to" panel in the notice composer. A class with **0 students
enrolled** reaches nobody at all.

**Port already in use / `EADDRINUSE` / the API keeps dying**
You almost certainly have `npm run dev` running in **two** terminals. Both try to
bind port 4000; one wins, the other crashes, and `node --watch` then gives up with
"Waiting for file changes before restarting". Close every terminal running it and
start a single one. To check on Windows:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 4000
```

If you need a different port, change `PORT` in `server/.env` and the matching
`target` in `client/vite.config.js`.

**"You cannot mark attendance for a date in the future" — for today's date**
`COLLEGE_TIMEZONE` is wrong or missing. The server decides what "today" is in
that timezone; if it's left as UTC while your college is in IST, then between
00:00 and 05:30 local time the server still thinks it's yesterday and rejects
today as being in the future.

---

## Deploying later

The app is structured for a single VPS or a platform like Render/Railway:

1. Set the same environment variables in the platform's dashboard, with
   `NODE_ENV=production` (this makes the auth cookie `secure`, so **HTTPS is required**).
2. Run `npm run db:deploy` in `server/` to apply migrations without prompting.
3. Build the frontend with `npm run build` and serve `client/dist` — either as static
   files from the same host, or from a separate origin with `CLIENT_ORIGIN` set to it.
4. Local disk uploads do **not** survive a redeploy on ephemeral platforms. Switch
   `STORAGE_DRIVER` to an S3 driver before going live with real assignment files.
