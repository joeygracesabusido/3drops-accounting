---
name: nextjs-development
description: Next.js 14 App Router development with TypeScript, Prisma, and Tailwind CSS. Use when building or modifying web applications, implementing Server Components, Server Actions, or managing data fetching and API routes in a Next.js environment.
---

# Nextjs Development

## Overview
This skill provides expert guidance for developing and maintaining modern Next.js 14 applications using the App Router. It focuses on the specific patterns required for React Server Components (RSC), Client Components, Server Actions, and Prisma integration.

## Key Workflows

### 1. Route and Page Creation
- Use the `app/` directory for routing.
- Prefer Server Components by default for better performance and SEO.
- Use `layout.tsx` for shared UI and `page.tsx` for unique route UI.
- Implement `loading.tsx` and `error.tsx` for enhanced UX.

### 2. Data Fetching and Mutations
- Fetch data directly in Server Components using `async/await`.
- Use **Server Actions** (`'use server'`) for data mutations (POST, PUT, DELETE).
- Leverage Prisma for database operations within Server Components and Actions.
- Use `revalidatePath` or `revalidateTag` to update cached data.

### 3. Client Interactivity
- Use `'use client'` directive at the top of files that require hooks (`useState`, `useEffect`) or event listeners.
- Keep Client Components as "leaves" in the component tree to maximize Server Component usage.

## Reference Documentation
For detailed patterns and implementation details, refer to:
- [app-router-patterns.md](references/app-router-patterns.md): Layouts, loading states, and routing.
- [server-actions.md](references/server-actions.md): Data mutations, form handling, and revalidation.
- [prisma-integration.md](references/prisma-integration.md): Database access patterns in Next.js.
- [styling-conventions.md](references/styling-conventions.md): Tailwind CSS and shadcn/ui best practices.

## Resources
- `assets/templates/`: Boilerplate for common components and pages.
- `scripts/generate_route.cjs`: Script to quickly scaffold a new route with common files.
