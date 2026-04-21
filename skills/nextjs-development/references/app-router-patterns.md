# App Router Patterns

## Routing and Layouts
Next.js 14 uses a file-system based router in the `app/` directory.

- **`layout.tsx`**: Shared UI for a segment and its children. Does not re-render on navigation.
- **`page.tsx`**: Unique UI for a route.
- **`loading.tsx`**: UI to show while content is loading (using Suspense).
- **`error.tsx`**: UI to show when an error occurs in the segment (using React Error Boundary).
- **`not-found.tsx`**: UI for 404 pages.

## Server Components vs Client Components
- **Server Components**: Default. Better for performance, fetching data, and security.
- **Client Components**: Required for interactivity, hooks, and browser APIs. Use `'use client'` directive.

## Data Fetching
- Fetch data directly in Server Components using `async/await`.
- Use `fetch` with caching options (`{ cache: 'force-cache' }` or `{ next: { revalidate: 3600 } }`).
- For sensitive data, use `unstable_noStore` or `export const dynamic = 'force-dynamic'`.
