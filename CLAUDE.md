# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development
- `npm run dev`: Start the development server
- `npm run build`: Run the production build
- `npm run lint`: Run ESLint checks
- `npm run build:cloudflare`: Build for Cloudflare Pages deployment

### Database (Prisma)
- `npm run db:push`: Push schema changes to the database
- `npm run db:seed`: Seed the database with initial data
- `npm run db:seed:coa`: Seed Chart of Accounts data
- `npx prisma generate`: Regenerate Prisma client (also runs on `postinstall`)

### Maintenance Scripts
- `npm run leave-accrual`: Run leave credit accrual script
- `npm run link-users`: Link users to employee records

## Architecture & Structure

### Big Picture
The project is a Human Resource Information System (HRIS) tailored for Philippine labor laws, built with Next.js 14 (App Router), TypeScript, and MongoDB (via Prisma).

### Core Structure
- `app/`: Next.js App Router.
  - `(auth)/`: Authentication routes (login, register).
  - `(dashboard)/`: Main application logic, split by module (employees, payroll, leave-credits, asset-inventory, etc.).
  - `api/`: Serverless API routes.
- `lib/`: Shared utilities and business logic (e.g., `depreciation.ts`, `leave-credits.ts`).
- `prisma/`: Database schema (`schema.prisma`) and seeding logic.
- `components/`: Reusable UI components (mostly shadcn/ui).
- `scripts/`: Administrative TS scripts for data migration and periodic tasks.

### Key Implementation Details
- **Auth**: Uses `next-auth` with a Prisma adapter.
- **Database**: MongoDB is used as the primary store.
- **Dynamic Routing**: Many API routes use `cookies()` or `request.url`, requiring `export const dynamic = 'force-dynamic'` to avoid static prerendering errors during build.
- **Deployment**: Targeted for Cloudflare Pages using `@cloudflare/next-on-pages`. Use `npm run build:cloudflare` for production builds.
- **Payroll Logic**: Specialized logic for Philippine holidays and payroll calculations is implemented in `app/api/payroll/route.ts` and related lib files.
