# D1 Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate HRIS from MongoDB/Prisma to Cloudflare D1 (SQLite) for Cloudflare Pages deployment.

**Architecture:** 
- Replace MongoDB with D1 (SQLite) database
- Use Prisma with SQLite provider
- Replace bcryptjs with Web Crypto API for Edge-compatible password hashing
- Add Edge runtime to all API routes

**Tech Stack:** Cloudflare D1, Prisma (SQLite), Web Crypto API

---

### Task 1: Create D1 Database and Update Wrangler

**Files:**
- Modify: `wrangler.jsonc`

**Step 1: Add D1 database to wrangler.jsonc**

```json
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "hris-nextjs",
  "compatibility_date": "2025-07-18",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "hris-db",
      "database_id": "your-database-id"
    }
  ]
}
```

**Step 2: Create D1 database locally**

Run: `npx wrangler d1 create hris-db --local`
Expected: Creates local D1 database

**Step 3: Update .env with D1 connection string**

Add: `DATABASE_URL="file:./dev.db"` (for local development)

---

### Task 2: Update Prisma Schema for SQLite

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Update datasource to SQLite**

Replace lines 9-12:
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

**Step 2: Remove MongoDB-specific annotations**

Remove all:
- `@db.ObjectId`
- `@map("_id")`
- `@@map("users")` and similar

**Step 3: Update ID fields**

Change all `String @id` to `String @id @default(cuid())`

**Step 4: Run Prisma generate**

Run: `npx prisma generate`
Expected: Generates new Prisma Client for SQLite

---

### Task 3: Create D1-Compatible Prisma Client

**Files:**
- Modify: `lib/prisma.ts`

**Step 1: Update prisma.ts for Edge runtime**

```typescript
import { PrismaClient } from "@prisma/client";

const prismaClientSingleton = () => {
  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL || "file:./dev.db",
      },
    },
  });
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = prisma;
```

---

### Task 4: Replace bcryptjs with Web Crypto API

**Files:**
- Create: `lib/auth.ts`
- Modify: `app/api/login/route.ts`
- Modify: `app/api/register/route.ts`

**Step 1: Create auth utility with Web Crypto**

```typescript
// lib/auth.ts

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  const hash = await hashPassword(password);
  return hash === hashedPassword;
}
```

**Step 2: Update login/route.ts**

Replace bcrypt import:
```typescript
import { verifyPassword } from '@/lib/auth';
```

Replace `bcrypt.compare` with `verifyPassword`:
```typescript
const isPasswordValid = await verifyPassword(password, user.password || '');
```

**Step 3: Update register/route.ts**

Replace bcrypt import:
```typescript
import { hashPassword } from '@/lib/auth';
```

Replace `bcrypt.hash` with `hashPassword`:
```typescript
const hashedPassword = await hashPassword(password);
```

---

### Task 5: Add Edge Runtime to All API Routes

**Files:**
- Modify: `app/api/login/route.ts`
- Modify: `app/api/register/route.ts`
- Modify: `app/api/employees/route.ts`
- Modify: `app/api/leaves/route.ts`
- Modify: `app/api/time-logs/route.ts`
- Modify: `app/api/time-logs/import/route.ts`
- Modify: `app/api/users/route.ts`
- Modify: `app/api/users/status/route.ts`
- Modify: `app/api/users/unlock/route.ts`
- Modify: `app/api/current-user/route.ts`

**Step 1: Add Edge runtime to each route**

Add after imports:
```typescript
export const runtime = 'edge';
```

---

### Task 6: Update Environment Configuration

**Files:**
- Modify: `.env`
- Modify: `.env.local` (create if needed)

**Step 1: Add D1 environment variables**

```
DATABASE_URL="file:./dev.db"
```

---

### Task 7: Build and Test

**Step 1: Run Cloudflare build**

Run: `npm run build:cloudflare`
Expected: Successful build with all routes as Edge functions

**Step 2: Test locally with Wrangler**

Run: `npx wrangler pages dev .output`
Expected: Application loads without errors

---

### Task 8: Deploy to Cloudflare

**Step 1: Push D1 schema**

Run: `npx wrangler d1 execute hris-db --local --file=prisma/migrations/migration_name.sql`

**Step 2: Deploy**

Run: `npx wrangler pages project create hris-app` (if needed)
Run: `npx wrangler deploy`
Expected: Successful deployment

---

**Plan complete and saved to `docs/plans/2026-03-04-d1-migration.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
