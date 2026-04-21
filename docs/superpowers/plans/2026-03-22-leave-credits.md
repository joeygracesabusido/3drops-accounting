# Leave Credits Feature Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement automated monthly leave credit accrual system for regular employees per Philippine labor law (15 days/year = 1.25 days/month)

**Architecture:** Leave credits are accrued monthly via cron job on last day of month. Only REGULAR employees earn credits. Probationary employees earn credits retroactively once regularized.

**Tech Stack:** Next.js 14 API Routes, Prisma ORM, MongoDB, node-cron for scheduling

**Status:** ✅ COMPLETED (March 22, 2026)

---

## Overview

### Business Rules
1. **Entitlement:** Only REGULAR employees earn leave credits
2. **Accrual Rate:** 1.25 days per month (15 days/year)
3. **Accrual Date:** End of every month (last day)
4. **Mid-Month Hire:** No credit for partial month; credits start on first full month end
5. **Regularization:** Probationary employees earn prorated credits from regularization date

### Philippine Labor Law Compliance
- Service Incentive Leave (SIL) under Article 95 of the Labor Code
- Applies to employees with more than 6 months of service
- 5 days minimum per year (we offer 15 days = generous benefit)

---

## File Structure

### Files Created
- `lib/leave-credits.ts` - Leave credit calculation utilities
- `app/api/leave-credits/route.ts` - Leave credits CRUD API
- `app/api/leave-credits/accrue/route.ts` - Trigger monthly accrual
- `app/api/leave-credits/balance/route.ts` - Get employee balance
- `app/(dashboard)/leave-credits/page.tsx` - Leave credits UI
- `types/index.ts` - Added LeaveCredit types

### Files Modified
- `prisma/schema.prisma` - Added EmployeeStatus, LeaveCredit, LeaveCreditTransaction models
- `app/(dashboard)/leaves/page.tsx` - Show available balance when filing

---

## Chunk 1: Database Schema ✅

### Task 1: Update Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [x] **Step 1: Read current schema**
- [x] **Step 2: Apply schema changes** - Added EmployeeStatus enum, LeaveCredit, LeaveCreditTransaction models
- [x] **Step 3: Commit**

---

## Chunk 2: Type Definitions ✅

### Task 2: Add Leave Credit Types

**Files:**
- Modify: `types/index.ts`

- [x] **Step 1: Update types/index.ts** - Added EmployeeStatus, LeaveCreditType, LeaveCredit, LeaveCreditWithEmployee, LeaveCreditTransaction, LeaveCreditBalance types
- [x] **Step 2: Commit**

---

## Chunk 3: Leave Credit Utilities ✅

### Task 3: Create Leave Credit Calculation Module

**Files:**
- Create: `lib/leave-credits.ts`

- [x] **Step 1: Create lib/leave-credits.ts** - Implemented `calculateMonthlyAccrual`, `getLeaveBalance`, `deductLeave` functions
- [x] **Step 2: Run lint check**
- [x] **Step 3: Commit**

---

## Chunk 4: API Endpoints ✅

### Task 4: Create Leave Credits API

**Files:**
- Create: `app/api/leave-credits/route.ts`
- Create: `app/api/leave-credits/balance/route.ts`
- Create: `app/api/leave-credits/accrue/route.ts`

- [x] **Step 1: Create app/api/leave-credits/route.ts** - GET/POST endpoints for leave credits
- [x] **Step 2: Create app/api/leave-credits/balance/route.ts** - Balance check endpoint
- [x] **Step 3: Create app/api/leave-credits/accrue/route.ts** - Monthly accrual trigger
- [x] **Step 4: Run lint check**
- [x] **Step 5: Commit**

---

## Chunk 5: Leave Credits UI ✅

### Task 5: Create Leave Credits Dashboard Page

**Files:**
- Create: `app/(dashboard)/leave-credits/page.tsx`

- [x] **Step 1: Create app/(dashboard)/leave-credits/page.tsx** - Dashboard with balance cards, transaction history, and accrual modal
- [x] **Step 2: Run build check**
- [x] **Step 3: Commit**

---

## Chunk 6: Integrate with Leave Request (Show Balance) ✅

### Task 6: Update Leave Page to Show Available Balance

**Files:**
- Modify: `app/(dashboard)/leaves/page.tsx`

- [x] **Step 1: Update app/(dashboard)/leaves/page.tsx** - Added leave balance display in file leave modal
- [x] **Step 2: Test the integration**
- [x] **Step 3: Commit**

---

## Chunk 7: Cron Job for Automated Accrual ✅

### Task 7: Create Cron Job Script

**Files:**
- Create: `scripts/run-leave-accrual.ts` (optional - can be triggered via API)

- [x] **Step 1: Script available via /api/leave-credits/accrue endpoint**
- [x] **Step 2: Can be called by external cron service**

---

## Summary

### Features Implemented ✅
1. **Database Schema** - EmployeeStatus enum, LeaveCredit and LeaveCreditTransaction models
2. **Type Definitions** - Full TypeScript types for leave credits
3. **Calculation Utilities** - Logic for monthly accrual, balance tracking, deduction
4. **API Endpoints** - GET/POST credits, balance check, manual accrual trigger
5. **Dashboard UI** - Leave credits page with transaction history
6. **Leave Integration** - Show available balance when filing leave
7. **Accrual API** - Endpoint for automated monthly accrual via cron

### Philippine Labor Law Compliance ✅
- Implements Service Incentive Leave (SIL) per Article 95 of the Labor Code
- 15 days/year (1.25/month) - exceeds minimum 5-day requirement
- Tracks all transactions for audit trail
- Supports both vacation and sick leave

### Build Status
```bash
npm run build  # ✅ SUCCESS
```
