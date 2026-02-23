# St. Austin Teaching Platform

Next.js application with PostgreSQL via Prisma and NextAuth authentication.

## Prerequisites

- Node.js 20+
- PostgreSQL running locally on your machine

## Setup

1. Install dependencies:

```bash
npm install
```

2. Set environment variables:

```bash
cp .env.example .env
# Edit .env values (DATABASE_URL and NEXTAUTH_SECRET are required)
```

3. Create your database:

```bash
createdb st_austin
```

4. Run migration and bootstrap the initial Super Admin:

```bash
npm run db:migrate
npm run db:seed
```

5. Start the app:

```bash
npm run dev
```

## Database Scripts

- `npm run db:generate` generates Prisma client
- `npm run db:migrate` runs Prisma migrations in dev
- `npm run db:studio` opens Prisma Studio
- `npm run db:seed` creates the initial Super Admin if no admin exists

## Initial Super Admin (System Bootstrap)

- A single Super Admin account is created during setup via `npm run db:seed`.
- If any `ADMIN` user already exists, bootstrap creation is blocked.
- Credentials should be shared with the client through a secure channel.
- Additional admin accounts should be created manually in the database by authorized operators.

## Onboarding Policy

- Teachers: Admin invite only.
- Students: Admin invite or self-signup.
- Student self-signup is time-boxed by `NEXT_PUBLIC_STUDENT_SELF_SIGNUP_CUTOFF_DATE` (YYYY-MM-DD); after that date, only invited enrollment should be allowed.
- Admin invites expire based on `INVITE_EXPIRY_HOURS` (default `168` hours / 7 days).
- Invitation emails are sent via SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`).
- For Gmail, use an App Password and set `SMTP_SERVICE=gmail` (defaults: `smtp.gmail.com`, port `465`, secure `true`).

## Auth Routes

- `/admin/login` public admin-only login page
- `/login` public teacher/student login page
- `/register/student` public student self-signup page (open until cutoff date)
- `/invite/accept?token=...` public invitation acceptance page
- `/dashboard` protected for active authenticated users
- `/dashboard/admin` protected for active `ADMIN` users only
- `/dashboard/admin/invitations` protected admin invite management page

## Static Assets

- Public assets are served from the `public/` folder.
- Default logo path: `public/logo/st-austin-logo.svg` (URL: `/logo/st-austin-logo.svg`).

## Invite API (Admin)

- `POST /api/admin/invitations` creates or refreshes an invite for `TEACHER` or `STUDENT` users (Admin session required)
- Request JSON: `{ "email": "user@example.com", "name": "Name", "role": "TEACHER" }`
- Server sends the invitation email automatically using `nodemailer`
- Response JSON includes `inviteUrl` (returned even when email delivery fails, so admin can share manually)
