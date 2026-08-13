# Design: Date Range for Accounting Reports

**Date:** 2026-08-13
**Status:** Approved by user

## Goal

Let users choose a date range for the three financial reports (Trial Balance, Income
Statement, Balance Sheet) on `/accounting/reports`, as an alternative to the current
"all data / today" behavior.

## Behavior

From/To date pickers are shown for all three report types. The user chose:
"From-To for all". Specifically:

- **Income Statement** (period report): journal entries filtered to `date >= startDate`
  AND `date <= endDate`. When only one bound is set, the other remains unbounded
  (same as current behavior when both are blank).
- **Trial Balance & Balance Sheet** (point-in-time reports): the **To** date is used as
  the "as of" cutoff — entries with `date <= endDate` are included. The From date is
  accepted but does not affect the query (matches "ignore From" per approved option);
  it is still shown in the UI for symmetry.
- Blank dates = no filtering (current behavior preserved).

## API Changes

Three routes accept new query params `startDate` and `endDate` (combined with existing
`branchId`):

- `app/api/accounting/reports/trial-balance/route.ts`
- `app/api/accounting/reports/income-statement/route.ts`
- `app/api/accounting/reports/balance-sheet/route.ts`

Query construction (shared pattern in each route):

```typescript
const branchId = searchParams.get('branchId');
const startDate = searchParams.get('startDate');
const endDate = searchParams.get('endDate');

const hasBranchFilter = Boolean(branchId);

const dateFilter: any = {};
if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
  dateFilter.lte = new Date(`${endDate}T23:59:59.999Z`);
}
// Income Statement only: also use the From bound
if (useStartDate && startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
  dateFilter.gte = new Date(`${startDate}T00:00:00.000Z`);
}

let entryIds: string[] | undefined;
if (hasBranchFilter || Object.keys(dateFilter).length > 0) {
  const entries = await prisma.journalEntry.findMany({
    where: {
      branchId: branchId || undefined,
      date: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
    },
    select: { id: true },
  });
  entryIds = entries.map(e => e.id);
}
```

`useStartDate` is `true` only in the income-statement route (TB/BS ignore the From
bound). When neither branch nor date filter is present, the account query keeps the
existing `include: { lines: true }` path (no entryIds lookup).

For Trial Balance and Balance Sheet, `startDate` is parsed but only `endDate` is used
(`date.lte`). Invalid/blank dates are ignored — never crash or return 500.

### Date storage

Journal entry `date` values are stored at UTC midnight
(`new Date('YYYY-MM-DD')` from date pickers elsewhere in the app). The
`T00:00:00.000Z` / `T23:59:59.999Z` bounds therefore cover the full selected day.

## Frontend Changes

`app/(dashboard)/accounting/reports/page.tsx`:

1. Add `startDate` / `endDate` state (strings, `YYYY-MM-DD` for `<input type="date">`).
2. Add two date inputs in the toolbar row (between the report type selector block and
   the refresh/export buttons), with labels "From" and "To".
3. `fetchReport` builds the URL query from `activeReport`, `selectedBranch`,
   `startDate`, `endDate`; deps updated accordingly.
4. Re-fetch on date change (same auto-fetch pattern as report type).
5. Report headers show chosen dates instead of `new Date()`:
   - Income Statement: `For the period ended <To>`; when From is also set
     `For the period <From> to <To>`.
   - Trial Balance / Balance Sheet: `As of <To>`; when To is blank, fall back to today.
6. Formatting uses `en-PH` locale, `month: 'long', day: 'numeric', year: 'numeric'`,
   consistent with existing header code.

## Error Handling

- Always try/catch in the API; log with `console.error('Context:', error)`.
- Invalid date strings are validated with a regex; silently ignored.
- No `any` in new frontend code (existing file already has
  `eslint-disable @typescript-eslint/no-explicit-any` at top — keep as is, but write
  new code without `any`).

## Testing / Verification

- `npm run lint`
- `npx tsc --noEmit`
- Manual: run dev server, select each report, set From/To, verify:
  - Income Statement respects both bounds.
  - Trial Balance / Balance Sheet respect the To (as-of) cutoff.
  - Blank dates return all data (current behavior).
  - Header text shows the selected dates.

## Out of Scope

- Export PDF date range (existing button does not export anyway).
- Persisting date selection in URL/localStorage.
- Per-report date semantics beyond what is described above.