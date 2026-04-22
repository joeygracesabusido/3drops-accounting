# Update Payment Feature Design

## Overview

Add edit and delete actions to the Payment History dialog in the Purchase Bills page. When a payment is edited, the original payment, its journal entry, and its subsidiary transaction are deleted, then new ones are created with the updated values. The bill's `amountPaid` and `status` are recalculated.

## Frontend Changes

### File: `app/(dashboard)/accounting/purchases/page.tsx`

**New state:**
- `editingPayment: any` — tracks which payment is being edited

**New functions:**
- `handleEditPayment(payment)` — opens the payment dialog pre-populated with the payment's data
- `handleDeletePayment(paymentId, billId)` — deletes a payment and refreshes the page
- `handleSubmit` — updated to send `PATCH` when `editingPayment` is set

**UI changes in Payment History dialog:**
- Add "Actions" column to the payments table
- Edit button (pencil icon) — enabled for all payments
- Delete button (trash icon) — enabled for all payments, with confirmation
- Dialog title changes to "Edit Payment" when editing
- Submit button changes to "Update Payment" when editing

## Backend Changes

### File: `app/api/accounting/payments/route.ts`

**PATCH endpoint: `/api/accounting/payments?id=<paymentId>`**

1. Validate payment exists
2. Run Prisma transaction:
   - Delete journal entry (cascade removes lines)
   - Delete subsidiary transaction (if exists)
   - Delete payment record
   - Recalculate bill's `amountPaid` by summing all remaining payments
   - Update bill's `status` (PAID/PARTIALLY_PAID/UNPAID)
   - Create new journal entry (debit AP, credit cash)
   - Create new subsidiary transaction for supplier ledger
   - Create new payment record
3. Return updated data

**DELETE endpoint: `/api/accounting/payments?id=<paymentId>`**

1. Validate payment exists
2. Run Prisma transaction:
   - Delete journal entry (cascade removes lines)
   - Delete subsidiary transaction (if exists)
   - Delete payment record
   - Recalculate bill's `amountPaid` by summing all remaining payments
   - Update bill's `status`
3. Return updated bill data

## Data Flow

```
User clicks Edit → Dialog opens with pre-filled values → User modifies → PATCH request
  → Backend deletes old JE + ST + Payment → Recalculates bill totals → Creates new JE + ST + Payment → UI refreshes
```

## Constraints

- No status restrictions on edit/delete (any payment can be modified)
- Bill must remain in a valid state after recalculation
- All changes are wrapped in Prisma transactions for atomicity
