# Server Actions

Server Actions are asynchronous functions that run on the server. They can be used in both Server and Client Components to handle data mutations in Next.js applications.

## Definition
Define a Server Action using the `'use server'` directive.

```tsx
// actions.ts
'use server'

import { revalidatePath } from 'next/cache'

export async function createItem(formData: FormData) {
  const name = formData.get('name')
  // Mutate data (e.g., Prisma)
  // ...
  revalidatePath('/items')
}
```

## Usage in Forms
- Use the `action` prop of a `<form>`.
- `useFormStatus` and `useFormState` hooks (from `react-dom`) help with pending states and server-side validation.

## Error Handling
- Use `try/catch` inside actions.
- Return an object with `error` or `success` fields to handle UI updates.
- Consider Zod for schema validation.
