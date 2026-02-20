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

4. Run migration and seed users:

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
- `npm run db:seed` seeds super admin, teacher, and student users

## Auth Routes

- `/login` public login page
- `/dashboard` protected for active authenticated users
- `/dashboard/admin` protected for active `ADMIN` users only
