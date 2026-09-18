# IMBONI Education Hub — v2 (rebuilt from the notebook spec)

This is a ground-up rebuild of IMBONI Education Hub, built to match the
handwritten system spec exactly (registration flow, approval chains,
subscription model, and feature set). Nothing here was carried over from
the earlier scaffold — every table, route, and screen below traces back
to a specific line in your notes.

## Stack

- **Backend:** Node.js + Express, MySQL (via `mysql2`), JWT auth, bcrypt,
  Multer for file uploads, `@anthropic-ai/sdk` for the AI tutor.
- **Frontend:** React (Vite) + Tailwind CSS + React Router.

## How each rule maps to the code

| # | Spec rule | Where it lives |
|---|-----------|-----------------|
| — | Website → Sch1...SchN, admin registers school | `platformAdminController.registerSchool`, `/platform` page |
| — | Lecturers: notes, quizzes, gradebook, auto-grading, live sessions, attendance | `resourceController`, `quizController`, `assignmentController`, `sessionController` |
| — | Students: free resources, teams, marks, forums, AI tutor, kanban, enrolled courses/teams | `resourceController`, `teamController`, `forumController`, `aiTutorController`, `kanbanController`, `studentController.getMyDashboard` |
| 1 | Auto-route to dashboard on login (courses, pending tasks, assignments, grades) | `GET /api/students/me/dashboard` → `StudentDashboard.jsx` |
| 2 | Every registering student waits for admin approval | `users.approval_status = 'pending'` on self-registration; enforced in `authController.login` |
| 3 | Admin adds lecturers/students and approves/rejects students | `schoolAdminController.createUser`, `.decideStudent` |
| 4 | Multiple concurrent users | Stateless JWT auth + MySQL connection pool — no server-side session lock |
| 5 | Schools pay 50,000 RWF / 3 months for free student access | `schools.subscription_*`, `subscription_payments` table, `platformAdminController.recordPayment` |
| 6 | Admin-created accounts get a default name/password, changed on first login | `generateCredentials.js`, `must_change_password` flag, `/change-password` page |
| 7 | Student belongs to exactly one school's space; registration branches by education level | `student_profiles` table, `studentController.registerStudent`, `RegisterStudent.jsx` |
| 8 | Student clicks "Join" on their course → lecturer approves → then sees teams/resources/tasks | `course_join_requests` table, `courseController.requestToJoin` / `.decideJoinRequest` |

## Roles

- `platform_admin` — registers schools, manages subscriptions (this is *you*, running IMBONI itself)
- `school_admin` — one per school, approves students, creates lecturer/student accounts
- `lecturer` — creates courses, shares resources, sets assignments/quizzes, hosts sessions, approves join requests
- `student` — registers, gets approved, joins courses, uses kanban/AI tutor/forums/teams

Teams support lecturer-created and student-created teams. Students can browse
teams for their enrolled courses, request to join, and team creators can
approve or reject those requests from the dashboard.

Project collaboration endpoints are available under `/api/projects`: project
creation and membership, shared sprint tasks, milestones, code reviews with
inline comments, wiki pages, commit history, and multipart file uploads.

## Setup

### 1. Database
```bash
mysql -u root -p < database/schema.sql
# For an existing installation, add the shared project workspace tables:
mysql -u root -p < database/project_collaboration_migration.sql
```
This creates the `imboni_hub` database and one seed `platform_admin`
account: `admin@imboni.rw` — **you must reset this password directly in
the database or via a script before relying on it**, the seed hash is a
placeholder.

### 2. Backend
```bash
cd backend
cp .env.example .env   # fill in DB credentials, JWT_SECRET, ANTHROPIC_API_KEY
npm install
npm run dev
```
API runs on `http://localhost:5000`.

### 3. Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```
App runs on `http://localhost:5173`.

## Flow to test end-to-end

1. Log in as `platform_admin` → register a school (university or secondary) → note the generated school-admin credentials.
2. Log in as that school admin → change password → create a lecturer account (note credentials) → approve/reject any self-registered students.
3. Log in as the lecturer → change password → create a course.
4. Register a new student from the landing page (`/register`) — choose education level, pick the school, fill the branching fields → submit → status is "pending."
5. Approve that student from the school admin dashboard.
6. Log in as the student → dashboard loads (Rule 1) → browse courses → click "Join" → status shows "pending."
7. Log in as the lecturer → approve the join request → student now has access to resources, teams, forum, assignments, quizzes for that course.
8. Back on the platform admin dashboard, record the school's 50,000 RWF / 3-month payment to keep its subscription active.

## What's intentionally left for you to extend

- Payment gateway integration (mobile money / card) — currently `recordPayment` is a manual admin action, ready to be wired to a real payment webhook.
- Real-time video for live sessions — `live_sessions.meeting_link` currently expects an external link (Zoom/Meet); swap in a WebRTC/Jitsi embed if you want it native.
- Push/email notifications — the `notifications` table is populated on every approval/decision; add a delivery channel (email, SMS, in-app socket) on top of it.
