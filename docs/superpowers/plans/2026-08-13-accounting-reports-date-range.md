# Accounting Reports Date Range Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users pick From/To dates on the Financial Reports page so reports can be generated for a chosen period instead of always "all data / today".

**Architecture:** Three report API routes (trial-balance, income-statement, balance-sheet) gain optional `startDate`/`endDate` query params that filter journal entries by their `date` field before summing ledger lines. The reports page gains two `<input type="date">` pickers that pass these params and show the chosen period in the report headers. Income Statement uses both bounds; Trial Balance and Balance Sheet use only the To (as-of) bound.

**Tech Stack:** Next.js 14 App Router, Prisma (MongoDB), React, date-fns not required (native `toLocaleDateString` suffices).

## Global Constraints

- TypeScript strict mode; no `any` in new code (top of the reports page file already has `eslint-disable @typescript-eslint/no-explicit-any` — leave it, but new code must not introduce new `any`).
- 2 spaces indentation, single quotes, trailing commas, semicolons.
- Journal entry `date` values are stored at UTC midnight (`new Date('YYYY-MM-DD')`), so filters use `T00:00:00.000Z` (gte) and `T23:59:59.999Z` (lte).
- Date params must match `^\d{4}-\d{2}-\d{2}$`; invalid or blank dates are ignored (never 500).
- No test framework exists in this repo. Verification = `npm run lint` (no errors), `npx tsc --noEmit` (no errors), and for the final task `npm run build` (success).
- Always wrap API handler bodies in try/catch; log with `console.error('Context:', error)`.

---

### Task 1: Income Statement API — From/To date filtering

**Files:**
- Modify: `app/api/accounting/reports/income-statement/route.ts` (replace entire file)

**Interfaces:**
- Produces: `GET /api/accounting/reports/income-statement?branchId=...&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` — filters journal entries to `date >= startDate` AND `date <= endDate` (each bound optional); response shape unchanged (`{ revenue, expenses, totalRevenue, totalExpenses, netIncome }`).

- [ ] **Step 1: Replace the file with date-aware version**

Write the full contents of `app/api/accounting/reports/income-statement/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface AccountEntry {
  name: string;
  code: string;
  balance: number;
}

interface IncomeStatementReport {
  revenue: AccountEntry[];
  expenses: AccountEntry[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
}

/**
 * GAAP Income Statement
 * Formula: Revenue - Expenses = Net Income
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      dateFilter.gte = new Date(`${startDate}T00:00:00.000Z`);
    }
    if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      dateFilter.lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    let entryIds: string[] | undefined;
    if (branchId || Object.keys(dateFilter).length > 0) {
      const entries = await prisma.journalEntry.findMany({
        where: {
          branchId: branchId || undefined,
          date: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
        },
        select: { id: true },
      });
      entryIds = entries.map(e => e.id);
    }

    const accounts = await prisma.account.findMany({
      where: {
        OR: [
          { type: 'REVENUE' },
          { type: 'EXPENSE' }
        ]
      },
      include: entryIds ? {
        lines: { where: { entryId: { in: entryIds } } }
      } : true,
      orderBy: { code: 'asc' },
    });

    const report: IncomeStatementReport = {
      revenue: [],
      expenses: [],
      totalRevenue: 0,
      totalExpenses: 0,
      netIncome: 0,
    };

    accounts.forEach(account => {
      const totalDebit = account.lines.reduce((sum, line) => sum + line.debit, 0);
      const totalCredit = account.lines.reduce((sum, line) => sum + line.credit, 0);

      let balance = 0;
      if (account.type === 'REVENUE') {
        balance = totalCredit - totalDebit; // Revenue increases with credit
        if (balance !== 0) {
          report.revenue.push({ name: account.name, code: account.code, balance });
          report.totalRevenue += balance;
        }
      } else if (account.type === 'EXPENSE') {
        balance = totalDebit - totalCredit; // Expense increases with debit
        if (balance !== 0) {
          report.expenses.push({ name: account.name, code: account.code, balance });
          report.totalExpenses += balance;
        }
      }
    });

    report.netIncome = report.totalRevenue - report.totalExpenses;

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error generating income statement:', error);
    return NextResponse.json({ error: 'Failed to generate income statement' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `income-statement/route.ts`.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors mentioning `income-statement/route.ts` (or overall success).

- [ ] **Step 4: Commit**

```bash
git add app/api/accounting/reports/income-statement/route.ts
git commit -m "feat: add date range filtering to income statement report API"
```

---

### Task 2: Trial Balance API — as-of (To) date filtering

**Files:**
- Modify: `app/api/accounting/reports/trial-balance/route.ts` (replace entire file)

**Interfaces:**
- Consumes: date filter pattern from Task 1 (identifier `dateFilter` with optional `lte`).
- Produces: `GET /api/accounting/reports/trial-balance?branchId=...&endDate=YYYY-MM-DD` — filters journal entries to `date <= endDate` (optional; `startDate` param is ignored by this route); response shape unchanged (`{ data, grandTotalDebit, grandTotalCredit, isBalanced }`).

- [ ] **Step 1: Replace the file with date-aware version**

Write the full contents of `app/api/accounting/reports/trial-balance/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GAAP Trial Balance Report
 * Shows all accounts with their respective total debits and total credits.
 * In a balanced ledger, Total Debits MUST equal Total Credits.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const endDate = searchParams.get('endDate');

    const dateFilter: { lte?: Date } = {};
    if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      dateFilter.lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    let entryIds: string[] | undefined;
    if (branchId || Object.keys(dateFilter).length > 0) {
      const entries = await prisma.journalEntry.findMany({
        where: {
          branchId: branchId || undefined,
          date: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
        },
        select: { id: true },
      });
      entryIds = entries.map(e => e.id);
    }

    const accounts = await prisma.account.findMany({
      include: {
        lines: entryIds ? {
          where: { entryId: { in: entryIds } }
        } : true,
      },
      orderBy: { code: 'asc' },
    });

    const trialBalance = accounts.map(account => {
      const totalDebit = account.lines.reduce((sum, line) => sum + line.debit, 0);
      const totalCredit = account.lines.reduce((sum, line) => sum + line.credit, 0);

      // The Trial Balance shows the net position of each account
      // Assets/Expenses usually have Debit balances
      // Liabilities/Equity/Revenue usually have Credit balances
      let debitBalance = 0;
      let creditBalance = 0;

      const net = totalDebit - totalCredit;

      if (account.type === 'ASSET' || account.type === 'EXPENSE') {
        if (net >= 0) debitBalance = net;
        else creditBalance = Math.abs(net);
      } else {
        const netCredit = totalCredit - totalDebit;
        if (netCredit >= 0) creditBalance = netCredit;
        else debitBalance = Math.abs(netCredit);
      }

      return {
        code: account.code,
        name: account.name,
        type: account.type,
        totalDebit: debitBalance,
        totalCredit: creditBalance,
      };
    }).filter(acc => acc.totalDebit !== 0 || acc.totalCredit !== 0);

    const grandTotalDebit = trialBalance.reduce((sum, acc) => sum + acc.totalDebit, 0);
    const grandTotalCredit = trialBalance.reduce((sum, acc) => sum + acc.totalCredit, 0);

    return NextResponse.json({
      data: trialBalance,
      grandTotalDebit,
      grandTotalCredit,
      isBalanced: Math.abs(grandTotalDebit - grandTotalCredit) < 0.01
    });
  } catch (error) {
    console.error('Error generating trial balance:', error);
    return NextResponse.json({ error: 'Failed to generate trial balance' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `trial-balance/route.ts`.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add app/api/accounting/reports/trial-balance/route.ts
git commit -m "feat: add as-of date filtering to trial balance report API"
```

---

### Task 3: Balance Sheet API — as-of (To) date filtering

**Files:**
- Modify: `app/api/accounting/reports/balance-sheet/route.ts` (replace entire file)

**Interfaces:**
- Consumes: date filter pattern from Task 2 (same as-of semantics).
- Produces: `GET /api/accounting/reports/balance-sheet?branchId=...&endDate=YYYY-MM-DD` — filters journal entries to `date <= endDate` (optional; `startDate` param is ignored); response shape unchanged (`{ assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity, netIncome, totalLiabilitiesEquity }`).

- [ ] **Step 1: Replace the file with date-aware version**

Write the full contents of `app/api/accounting/reports/balance-sheet/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface AccountEntry {
  name: string;
  code: string;
  balance: number;
}

interface BalanceSheetReport {
  assets: AccountEntry[];
  liabilities: AccountEntry[];
  equity: AccountEntry[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  netIncome: number;
  totalLiabilitiesEquity: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const endDate = searchParams.get('endDate');

    const dateFilter: { lte?: Date } = {};
    if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      dateFilter.lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    let entryIds: string[] | undefined;
    if (branchId || Object.keys(dateFilter).length > 0) {
      const entries = await prisma.journalEntry.findMany({
        where: {
          branchId: branchId || undefined,
          date: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
        },
        select: { id: true },
      });
      entryIds = entries.map(e => e.id);
    }

    const accounts = await prisma.account.findMany({
      include: entryIds ? {
        lines: { where: { entryId: { in: entryIds } } }
      } : true,
      orderBy: { code: 'asc' },
    });

    const report: BalanceSheetReport = {
      assets: [],
      liabilities: [],
      equity: [],
      totalAssets: 0,
      totalLiabilities: 0,
      totalEquity: 0,
      netIncome: 0,
      totalLiabilitiesEquity: 0,
    };

    let totalRevenue = 0;
    let totalExpenses = 0;

    accounts.forEach(account => {
      const totalDebit = account.lines.reduce((sum, line) => sum + line.debit, 0);
      const totalCredit = account.lines.reduce((sum, line) => sum + line.credit, 0);

      if (account.type === 'REVENUE') {
        totalRevenue += (totalCredit - totalDebit);
      } else if (account.type === 'EXPENSE') {
        totalExpenses += (totalDebit - totalCredit);
      } else {
        let balance = 0;
        if (account.type === 'ASSET') {
          balance = totalDebit - totalCredit;
          if (balance !== 0) {
            report.assets.push({ name: account.name, code: account.code, balance });
            report.totalAssets += balance;
          }
        } else if (account.type === 'LIABILITY') {
          balance = totalCredit - totalDebit;
          if (balance !== 0) {
            report.liabilities.push({ name: account.name, code: account.code, balance });
            report.totalLiabilities += balance;
          }
        } else if (account.type === 'EQUITY') {
          balance = totalCredit - totalDebit;
          if (balance !== 0) {
            report.equity.push({ name: account.name, code: account.code, balance });
            report.totalEquity += balance;
          }
        }
      }
    });

    report.netIncome = totalRevenue - totalExpenses;
    if (report.netIncome !== 0) {
      report.equity.push({
        name: 'Retained Earnings (Current Period)',
        code: 'NET-INC',
        balance: report.netIncome
      });
      report.totalEquity += report.netIncome;
    }

    report.totalLiabilitiesEquity = report.totalLiabilities + report.totalEquity;

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error generating balance sheet:', error);
    return NextResponse.json({ error: 'Failed to generate balance sheet' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `balance-sheet/route.ts`.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add app/api/accounting/reports/balance-sheet/route.ts
git commit -m "feat: add as-of date filtering to balance sheet report API"
```

---

### Task 4: Reports page — date pickers, query params, dynamic headers

**Files:**
- Modify: `app/(dashboard)/accounting/reports/page.tsx`

**Interfaces:**
- Consumes: `startDate`/`endDate` params from Tasks 1–3 (format `YYYY-MM-DD`, blank = no filter).
- Produces: From/To date inputs wired to the API; report headers showing chosen dates.

- [ ] **Step 1: Add state**

In `app/(dashboard)/accounting/reports/page.tsx`, inside `ReportsPage()`, add after the `selectedBranch` line (currently line 55):

```tsx
const [startDate, setStartDate] = useState('');
const [endDate, setEndDate] = useState('');
```

- [ ] **Step 2: Update fetchReport to pass date params**

Replace the existing `fetchReport` useCallback (lines 57–69) with:

```tsx
const fetchReport = useCallback(async () => {
  setLoading(true);
  try {
    const params = new URLSearchParams();
    if (selectedBranch) params.set('branchId', selectedBranch.id);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const qs = params.toString();
    const url = `/api/accounting/reports/${activeReport}${qs ? `?${qs}` : ''}`;
    const res = await fetch(url);
    const json = await res.json();
    setData(json);
  } catch (err) {
    console.error('Error fetching report:', err);
  } finally {
    setLoading(false);
  }
}, [activeReport, selectedBranch, startDate, endDate]);
```

- [ ] **Step 3: Add date format helper**

Add inside `ReportsPage()` (before the `return`):

```tsx
const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });

const todayLabel = new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
```

- [ ] **Step 4: Add From/To date inputs to the toolbar**

Replace the current report-selector block (lines 91–103) with:

```tsx
<div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-lg border shadow-sm">
  <div className="flex items-center gap-4">
    <label className="font-medium text-sm">Select Report Type:</label>
    <select
      value={activeReport}
      onChange={(e) => setActiveReport(e.target.value)}
      className="flex h-10 w-64 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      <option value="trial-balance">Trial Balance</option>
      <option value="income-statement">Income Statement (Profit &amp; Loss)</option>
      <option value="balance-sheet">Balance Sheet (Financial Position)</option>
    </select>
  </div>
  <div className="flex items-center gap-2">
    <label className="font-medium text-sm">From:</label>
    <input
      type="date"
      value={startDate}
      onChange={(e) => setStartDate(e.target.value)}
      className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    />
    <label className="font-medium text-sm">To:</label>
    <input
      type="date"
      value={endDate}
      onChange={(e) => setEndDate(e.target.value)}
      className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    />
  </div>
  <div className="flex items-center gap-2 ml-auto">
    <Button variant="outline" onClick={fetchReport} disabled={loading} className="flex items-center gap-2">
      <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
      Refresh
    </Button>
    <Button variant="outline" className="flex items-center gap-2">
      <Download className="w-4 h-4" />
      Export PDF
    </Button>
  </div>
</div>
```

- [ ] **Step 5: Update the three report headers**

Trial Balance header (currently line 120), replace with:

```tsx
<p className="text-sm text-muted-foreground">As of {endDate ? formatDate(endDate) : todayLabel}</p>
```

Income Statement header (currently line 185), replace with:

```tsx
<p className="text-sm text-muted-foreground italic">
  {startDate
    ? `For the period ${formatDate(startDate)} to ${endDate ? formatDate(endDate) : todayLabel}`
    : `For the period ended ${endDate ? formatDate(endDate) : todayLabel}`}
</p>
```

Balance Sheet header (currently line 255), replace with:

```tsx
<p className="text-sm text-muted-foreground italic">As of {endDate ? formatDate(endDate) : todayLabel}</p>
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Lint**

Run: `npm run lint`
Expected: success. If `react/no-unescaped-entities` fires on the `&amp;` in `Income Statement (Profit &amp; Loss)`, keep the entity form — that is the fix.

- [ ] **Step 8: Commit**

```bash
git add "app/(dashboard)/accounting/reports/page.tsx"
git commit -m "feat: add date range picker to financial reports page"
```

---

### Task 5: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: compile succeeds, no TypeScript or ESLint errors.

- [ ] **Step 2: Manual smoke test**

Start dev server (`npm run dev`) and open `http://localhost:3000/accounting/reports`:

1. No dates selected → all three reports show the same results as before this change (all data), headers show today.
2. Income Statement: set From and To → revenue/expenses/net income only include entries within the range; header reads "For the period <From> to <To>".
3. Income Statement: set only To → header reads "For the period ended <To>".
4. Trial Balance: set To to a past date → balances reflect only entries up to that date; header reads "As of <To>".
5. Balance Sheet: same as trial balance.
6. Changing From/To re-fetches automatically (spinner shows).