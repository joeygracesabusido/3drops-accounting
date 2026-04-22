# Bill Payment Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to pay unpaid purchase bills (full or partial) through a modal dialog on the Purchases page, creating proper double-entry journal entries and updating bill status.

**Architecture:** Add a new `Payment` model in Prisma, create a `POST /api/accounting/payments` endpoint that processes payments with journal entries, and add a payment modal to the existing purchases page UI triggered by clicking the status badge.

**Tech Stack:** Next.js 14 App Router, Prisma with MongoDB, React 18, shadcn/ui, Tailwind CSS, React Hook Form + Zod validation.

---

## File Map

### New Files
- `app/api/accounting/payments/route.ts` — Payment API (POST create, GET list by billId)

### Modified Files
- `prisma/schema.prisma` — Add `Payment` model
- `app/(dashboard)/accounting/purchases/page.tsx` — Add payment modal, state, handlers, status badge click

### No Changes Needed
- `app/api/accounting/purchases/route.ts` — Already returns `amountPaid` and `status` from the existing API
- `app/(dashboard)/accounting/subsidiary-ledgers/page.tsx` — AP reconciliation already works

---

## Task 1: Add Payment Model to Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the Payment model**

Add this model right after the `PurchaseBillItem` model (around line 685):

```prisma
model Payment {
  id             String       @id @default(auto()) @map("_id") @db.ObjectId
  billId         String       @map("purchaseBillId")
  bill           PurchaseBill @relation(fields: [billId], references: [id], onDelete: Cascade)
  amount         Float        @default(0)
  paymentDate    DateTime     @db.Date
  referenceNumber String?     // Check number, transfer ref, etc.
  notes          String?
  cashAccountId  String       @map("cashAccountId")
  cashAccount    Account      @relation(fields: [cashAccountId], references: [id])
  journalEntryId String?      @map("journalEntryId")
  journalEntry   JournalEntry? @relation(fields: [journalEntryId], references: [id])
  createdAt      DateTime     @default(now()) @db.TimestampUtc

  @@map("payments")
}
```

- [ ] **Step 2: Push schema to database**

Run: `npm run db:push`
Expected: Schema changes pushed to MongoDB, no errors.

---

## Task 2: Create Payment API Route

**Files:**
- Create: `app/api/accounting/payments/route.ts`

- [ ] **Step 1: Write the POST handler**

Create the file with this content:

```typescript
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { billId, amount, paymentDate, cashAccountId, referenceNumber, notes } = body;

    if (!billId || !amount || !paymentDate || !cashAccountId) {
      return NextResponse.json(
        { error: 'Missing required fields: billId, amount, paymentDate, cashAccountId' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json({ error: 'Payment must be greater than 0' }, { status: 400 });
    }

    // Fetch the bill
    const bill = await prisma.purchaseBill.findUnique({
      where: { id: billId },
      include: { items: true },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    if (bill.status === 'PAID') {
      return NextResponse.json({ error: 'This bill is already fully paid' }, { status: 400 });
    }

    const unpaidBalance = bill.totalAmount - bill.amountPaid;

    if (amount > unpaidBalance) {
      return NextResponse.json(
        { error: 'Payment cannot exceed unpaid balance' },
        { status: 400 }
      );
    }

    // Fetch cash account to get its details
    const cashAccount = await prisma.account.findUnique({
      where: { id: cashAccountId },
    });

    if (!cashAccount) {
      return NextResponse.json({ error: 'Cash/Bank account not found' }, { status: 400 });
    }

    // Find the AP account associated with this bill's supplier
    const apAccount = await prisma.account.findFirst({
      where: { hasSubsidiaryLedger: true, subsidiaryType: 'SUPPLIER' },
    });

    if (!apAccount) {
      return NextResponse.json(
        { error: 'No AP control account configured. Set up a supplier AP account in Chart of Accounts.' },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Payment record
      const payment = await tx.payment.create({
        data: {
          billId,
          amount,
          paymentDate: new Date(paymentDate),
          referenceNumber: referenceNumber || null,
          notes: notes || null,
          cashAccountId,
        },
      });

      // 2. Create Journal Entry for payment
      // Debit: AP Control (2100) — reduces liability
      // Credit: Cash/Bank Account — reduces asset
      const journalEntry = await tx.journalEntry.create({
        data: {
          date: new Date(paymentDate),
          description: `Payment for Bill ${bill.billNumber} — ${bill.supplierName}`,
          reference: referenceNumber || bill.billNumber,
          status: 'POSTED',
          lines: {
            create: [
              {
                accountId: apAccount.id,
                debit: amount,
                credit: 0,
                memo: `Payment for Bill ${bill.billNumber}`,
              },
              {
                accountId: cashAccountId,
                debit: 0,
                credit: amount,
                memo: `Payment for Bill ${bill.billNumber}`,
              },
            ],
          },
        },
      });

      // 3. Update Payment with journal entry link
      await tx.payment.update({
        where: { id: payment.id },
        data: { journalEntryId: journalEntry.id },
      });

      // 4. Update PurchaseBill
      const newAmountPaid = bill.amountPaid + amount;
      const newStatus = newAmountPaid >= bill.totalAmount ? 'PAID' : 'PARTIALLY_PAID';
      await tx.purchaseBill.update({
        where: { id: billId },
        data: {
          amountPaid: newAmountPaid,
          status: newStatus,
        },
      });

      // 5. Create SubsidiaryTransaction for supplier ledger (debit = payment reduces AP)
      const supplierLedger = await tx.subsidiaryLedger.findFirst({
        where: {
          entityType: 'SUPPLIER',
          entityName: bill.supplierName,
          accountId: apAccount.id,
        },
      });

      if (supplierLedger) {
        await tx.subsidiaryTransaction.create({
          data: {
            ledgerId: supplierLedger.id,
            date: new Date(paymentDate),
            referenceNo: referenceNumber || bill.billNumber,
            description: `Payment for Bill ${bill.billNumber} — ${bill.supplierName}`,
            debit: amount,
            credit: 0,
            journalEntryId: journalEntry.id,
          },
        });
      }

      return { payment, journalEntry, newAmountPaid, newStatus };
    });

    return NextResponse.json({
      ...result,
      bill: {
        ...bill,
        amountPaid: result.newAmountPaid,
        status: result.newStatus,
      },
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    return NextResponse.json(
      { error: `Failed to process payment: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const billId = searchParams.get('billId');

    if (!billId) {
      return NextResponse.json({ error: 'billId query parameter is required' }, { status: 400 });
    }

    const payments = await prisma.payment.findMany({
      where: { billId },
      include: {
        cashAccount: true,
        journalEntry: true,
      },
      orderBy: { paymentDate: 'asc' },
    });

    return NextResponse.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify the file was created correctly**

Run: `npm run lint -- app/api/accounting/payments/route.ts`
Expected: No lint errors.

---

## Task 3: Add Payment Modal to Purchases Page

**Files:**
- Modify: `app/(dashboard)/accounting/purchases/page.tsx`

- [ ] **Step 1: Add new imports**

Update the imports at the top of the file to add `DollarSign` icon and `toast`:

Add to the existing imports:
```typescript
import { Plus, Search, Trash2, Edit, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
```

- [ ] **Step 2: Add new interfaces**

Add these interfaces after the existing `Vendor` interface:

```typescript
interface PaymentRecord {
  id: string;
  amount: number;
  paymentDate: string;
  referenceNumber: string | null;
  notes: string | null;
  cashAccount: { code: string; name: string };
  journalEntry: { id: string; reference: string } | null;
}

interface CashAccount {
  id: string;
  code: string;
  name: string;
}
```

- [ ] **Step 3: Add new state variables**

Add these after the existing `editingBill` state:

```typescript
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payingBill, setPayingBill] = useState<any>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [formDataPayment, setFormDataPayment] = useState({
    amount: 0,
    paymentDate: new Date().toISOString().split('T')[0],
    cashAccountId: '',
    referenceNumber: '',
    notes: '',
  });
```

- [ ] **Step 4: Add cash accounts fetch in fetchData**

Update the `fetchData` function to also fetch cash accounts:

```typescript
  async function fetchData() {
    setLoading(true);
    try {
      const [billsRes, accRes] = await Promise.all([
        fetch('/api/accounting/purchases'),
        fetch('/api/accounting/accounts'),
      ]);
      if (!billsRes.ok) throw new Error(`Failed to fetch bills: ${billsRes.status}`);
      if (!accRes.ok) throw new Error(`Failed to fetch accounts: ${accRes.status}`);
      setBills(await billsRes.json());
      const allAccounts = await accRes.json();
      setAccounts(allAccounts);
      // Filter cash/bank accounts (ASSET type with cash or bank in name)
      const cashAccs = allAccounts.filter(
        (a: any) => a.type === 'ASSET' && (a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank'))
      );
      setCashAccounts(cashAccs);
    } catch (err) {
      console.error('Error fetching bills:', err);
    } finally {
      setLoading(false);
    }
  }
```

- [ ] **Step 5: Add payment modal handler functions**

Add these functions after `handleEditBill`:

```typescript
  async function handleOpenPaymentModal(bill: any) {
    if (bill.status === 'PAID') {
      toast.error('This bill is already fully paid');
      return;
    }
    setPayingBill(bill);
    const unpaidBalance = bill.totalAmount - bill.amountPaid;
    setFormDataPayment({
      amount: unpaidBalance,
      paymentDate: new Date().toISOString().split('T')[0],
      cashAccountId: cashAccounts.length > 0 ? cashAccounts[0].id : '',
      referenceNumber: '',
      notes: '',
    });
    setShowPaymentModal(true);
    // Fetch payment history
    setPaymentLoading(true);
    try {
      const res = await fetch(`/api/accounting/payments?billId=${bill.id}`);
      if (res.ok) {
        const data = await res.json() as PaymentRecord[];
        setPayments(data);
      }
    } catch (err) {
      console.error('Error fetching payment history:', err);
    } finally {
      setPaymentLoading(false);
    }
  }

  async function handleProcessPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payingBill || !formDataPayment.cashAccountId) {
      toast.error('Please select a cash/bank account');
      return;
    }
    if (formDataPayment.amount <= 0) {
      toast.error('Payment must be greater than 0');
      return;
    }
    try {
      const res = await fetch('/api/accounting/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billId: payingBill.id,
          amount: formDataPayment.amount,
          paymentDate: formDataPayment.paymentDate,
          cashAccountId: formDataPayment.cashAccountId,
          referenceNumber: formDataPayment.referenceNumber || undefined,
          notes: formDataPayment.notes || undefined,
        }),
      });
      if (res.ok) {
        toast.success('Payment processed successfully');
        setShowPaymentModal(false);
        setPayingBill(null);
        setPayments([]);
        setFormDataPayment({
          amount: 0,
          paymentDate: new Date().toISOString().split('T')[0],
          cashAccountId: '',
          referenceNumber: '',
          notes: '',
        });
        await fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to process payment');
      }
    } catch (err) {
      console.error('Error processing payment:', err);
      toast.error('An error occurred while processing payment');
    }
  }

  function handleClosePaymentModal() {
    setShowPaymentModal(false);
    setPayingBill(null);
    setPayments([]);
    setFormDataPayment({
      amount: 0,
      paymentDate: new Date().toISOString().split('T')[0],
      cashAccountId: '',
      referenceNumber: '',
      notes: '',
    });
  }
```

- [ ] **Step 6: Add the payment modal JSX**

Add the payment modal dialog right before the closing `</div>` of the return statement, after the existing bill creation dialog. Insert this block:

```jsx
        {/* Payment Modal */}
        <Dialog open={showPaymentModal} onOpenChange={handleClosePaymentModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Pay Bill — {payingBill?.billNumber}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleProcessPayment} className="space-y-4 pt-4">
              {/* Summary Section */}
              {payingBill && (
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Supplier:</span>
                    <span className="font-medium">{payingBill.supplierName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Amount:</span>
                    <span className="font-medium">{`\u20B1`}{(payingBill.totalAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount Paid:</span>
                    <span className="font-medium">{`\u20B1`}{(payingBill.amountPaid ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold border-t pt-2 mt-2">
                    <span>Unpaid Balance:</span>
                    <span className="text-destructive">{`\u20B1`}{((payingBill.totalAmount ?? 0) - (payingBill.amountPaid ?? 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}

              {/* Payment Form */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payment Amount *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formDataPayment.amount}
                    onChange={e => setFormDataPayment(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Payment Date *</Label>
                  <Input
                    type="date"
                    value={formDataPayment.paymentDate}
                    onChange={e => setFormDataPayment(prev => ({ ...prev, paymentDate: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Cash/Bank Account *</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formDataPayment.cashAccountId}
                    onChange={e => setFormDataPayment(prev => ({ ...prev, cashAccountId: e.target.value }))}
                    required
                  >
                    <option value="">Select Cash/Bank Account...</option>
                    {cashAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Reference Number</Label>
                  <Input
                    placeholder="Check #, transfer ref..."
                    value={formDataPayment.referenceNumber}
                    onChange={e => setFormDataPayment(prev => ({ ...prev, referenceNumber: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input
                    placeholder="Optional notes..."
                    value={formDataPayment.notes}
                    onChange={e => setFormDataPayment(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </div>

              {/* Payment History */}
              {payments.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Payment History</Label>
                  <Table className="border rounded-lg">
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Account</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{new Date(p.paymentDate).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right font-medium">{`\u20B1`}{p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell>{p.referenceNumber || '-'}</TableCell>
                          <TableCell>{p.cashAccount.code} - {p.cashAccount.name}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <DialogFooter>
                <Button type="submit" disabled={paymentLoading}>
                  <DollarSign className="w-4 h-4 mr-2" />
                  Process Payment
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
```

- [ ] **Step 7: Make status badges clickable for UNPAID/PARTIALLY_PAID**

Find the status badge in the table (around line 445) and replace it with a clickable version:

```jsx
                    <TableCell>
                      {bill.status === 'PAID' ? (
                        <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">{bill.status}</span>
                      ) : (
                        <span
                          className="px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800 cursor-pointer hover:bg-orange-200"
                          onClick={() => handleOpenPaymentModal(bill)}
                          title="Click to pay"
                        >
                          {bill.status}
                        </span>
                      )}
                    </TableCell>
```

- [ ] **Step 8: Run lint**

Run: `npm run lint -- app/(dashboard)/accounting/purchases/page.tsx`
Expected: No lint errors.

---

## Task 4: Run Build and Verify

- [ ] **Step 1: Run build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Verify manually**

1. Start dev server: `npm run dev`
2. Navigate to `/accounting/purchases`
3. Verify you can click the UNPAID badge to open the payment modal
4. Verify the payment form shows correct unpaid balance
5. Verify cash/bank account dropdown populates
6. Submit a test payment and verify:
   - Bill status updates
   - Journal entry is created
   - Payment history shows in modal
   - Table refreshes with new status

---

## Spec Coverage Checklist

- [x] Payment model with all required fields (amount, paymentDate, referenceNumber, notes, cashAccountId)
- [x] POST /api/accounting/payments endpoint with full validation
- [x] GET /api/accounting/payments?billId= endpoint for payment history
- [x] Payment modal with summary section showing supplier, total, paid, unpaid balance
- [x] Payment form: amount, date, cash account, reference number, notes
- [x] Status badge click triggers payment modal (UNPAID and PARTIALLY_PAID only)
- [x] Journal entry: Debit AP, Credit Cash/Bank
- [x] Bill status updates: UNPAID → PARTIALLY_PAID → PAID
- [x] Subsidiary transaction created for supplier ledger
- [x] Payment history displayed in modal
- [x] Error handling: amount > balance, already paid, invalid amount
- [x] Uses toast for success/error messages
- [x] Full payment support (amount = unpaid balance)
- [x] Partial payment support (amount < unpaid balance)
