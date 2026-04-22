# Bill Payment Feature Design

## Overview

Add the ability to pay unpaid purchase bills through a modal dialog on the Purchases page. Users click the UNPAID status badge to open a payment modal where they can make full or partial payments, select a cash/bank account, and add reference details.

## Database Changes

### New Model: Payment

```prisma
model Payment {
  id             String    @id @default(dbgenerated("uuid_generate_v4()"))
  billId         String    @map("purchaseBillId")
  bill           PurchaseBill @relation(fields: [billId], references: [id], onDelete: Cascade)
  amount         Float     @default(0)
  paymentDate    DateTime  @db.Date
  referenceNumber String?  // Check number, transfer ref, etc.
  notes          String?
  cashAccountId  String    @map("cashAccountId")
  cashAccount    Account   @relation(fields: [cashAccountId], references: [id])
  journalEntryId String?   @map("journalEntryId")
  journalEntry   JournalEntry? @relation(fields: [journalEntryId], references: [id])
  createdAt      DateTime  @default(now()) @db.TimestampUtc
}
```

## Frontend Design

### Payment Modal (Inline in Purchases Page)

**Trigger:** Click the status badge (UNPAID/PARTIALLY_PAID) in the table row.

**Modal Content:**
- **Header:** "Pay Bill — {billNumber}"
- **Summary Section:**
  - Supplier: {supplierName}
  - Total Amount: {₱totalAmount}
  - Amount Paid: {₱amountPaid}
  - **Unpaid Balance: {₱unpaidBalance}** (highlighted, larger font)
- **Form Fields:**
  1. **Payment Amount** — number input, defaults to unpaid balance, max = unpaid balance
  2. **Cash/Bank Account** — dropdown of all ASSET accounts (type = ASSET, or specifically 1100-1130 range)
  3. **Payment Date** — date input, defaults to today (Manila time)
  4. **Reference Number** — text input, optional
  5. **Notes** — textarea, optional
- **Submit Button:** "Process Payment"

**After Payment:**
- Modal closes
- Table refreshes
- Status badge updates to PARTIALLY_PAID or PAID
- If fully paid, status badge changes to green PAID badge

### Status Badge Click Behavior

- **UNPAID** badge → clickable, opens payment modal
- **PARTIALLY_PAID** badge → clickable, opens payment modal (shows remaining balance)
- **PAID** badge → not clickable, no action

### Payment History (Optional Enhancement)

Below the payment form in the modal, show a small list of previous payments for this bill:
- Date | Amount | Reference | Cash Account

## Backend Design

### POST /api/accounting/payments

**Request Body:**
```typescript
{
  billId: string,
  amount: number,
  paymentDate: string,
  cashAccountId: string,
  referenceNumber?: string,
  notes?: string
}
```

**Logic (in Prisma transaction):**
1. Fetch the PurchaseBill with its items, journalEntry, and existing payments
2. Calculate unpaidBalance = totalAmount - amountPaid
3. Validate: payment amount > 0 and <= unpaidBalance
4. Create Payment record
5. Create JournalEntry:
   - Lines:
     - Debit: AP Control Account (2100) — amount
     - Credit: Selected Cash/Bank Account — amount
   - Reference: "Payment for Bill {billNumber} — {referenceNumber}"
6. Update PurchaseBill:
   - amountPaid += payment amount
   - status = amountPaid >= totalAmount ? 'PAID' : 'PARTIALLY_PAID'
7. Update SubsidiaryTransaction for the supplier ledger:
   - Create new transaction record with debit = payment amount (reduces AP)
8. Return the created payment with updated bill

### GET /api/accounting/payments?billId={id}

**Response:** Array of Payment records for the specified bill.

Used by the payment modal to load payment history.

## Journal Entry Pattern

### Bill Creation (existing)
```
Debit:  Expense Account      ₱{netAmount}
Debit:  Input VAT (2320)     ₱{vatAmount}     [if not noInputVat]
Credit: AP Control (2100)    ₱{totalAmount}
```

### Bill Payment (new)
```
Debit:  AP Control (2100)    ₱{paymentAmount}
Credit: Cash/Bank Account    ₱{paymentAmount}
```

## Status Flow

```
UNPAID ──[payment]──> PARTIALLY_PAID ──[payment]──> PAID
          (partial)        (partial)                 (complete)
```

- Status starts as `UNPAID` when bill is created
- First payment: if amount < unpaidBalance → `PARTIALLY_PAID`
- Subsequent payments: if amountPaid >= totalAmount → `PAID`
- Once `PAID`, no further payments allowed

## Error Handling

- Payment amount > unpaid balance → "Payment cannot exceed unpaid balance"
- Payment amount <= 0 → "Payment must be greater than 0"
- Bill already PAID → "This bill is already fully paid"
- API errors → toast/alert with error message
- Cash account not found → "Please select a valid cash/bank account"

## Key Files

- `app/(dashboard)/accounting/purchases/page.tsx` — Add payment modal, status badge click handler
- `app/api/accounting/payments/route.ts` — POST create payment, GET fetch by billId
- `prisma/schema.prisma` — Add Payment model
- `app/(dashboard)/accounting/subsidiary-ledgers/page.tsx` — No changes needed (already handles AP reconciliation)
