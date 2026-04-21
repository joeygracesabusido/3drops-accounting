# Prisma Integration in Next.js

Prisma should be used as the primary ORM for database operations.

## Database Access Patterns
- **Server Components**: Use Prisma directly. No need for separate API routes just to fetch data.
- **Server Actions**: Use Prisma for mutations (Create, Update, Delete).
- **API Routes**: Use Prisma for traditional API endpoints (e.g., when building for external consumers).

## Connection Management
- Use a single Prisma Client instance throughout the application.
- See `lib/prisma.ts` for the singleton pattern.

## Models and Schemas
- Define models in `prisma/schema.prisma`.
- Run `npx prisma db push` (for MongoDB) or `npx prisma migrate dev` (for relational databases) after schema updates.
- Run `npx prisma generate` to refresh the Prisma Client.
