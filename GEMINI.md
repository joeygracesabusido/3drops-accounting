# GEMINI.md - Agent Instructions for HRIS Philippines

This file contains foundational mandates and project-specific context for the Gemini CLI agent. These instructions take precedence over general tool defaults.

## Project Context

- **System**: Human Resource Information System (HRIS) tailored for Philippine labor laws.
- **Framework**: Next.js 14 (App Router).
- **Database**: MongoDB with Prisma ORM.
- **Styling**: Tailwind CSS + shadcn/ui.
- **Authentication**: Custom cookie-based session management (NextAuth.js v4 also configured).

## Foundational Mandates

### 1. Database Schema Changes
- Always run `npx prisma db push` after modifying `prisma/schema.prisma` to keep the MongoDB collection in sync.
- For local development, `npx prisma generate` is triggered via `postinstall`.

### 2. Role-Based Access Control (RBAC)
- **Admin**: Full access to all features (Users, Employees, Leaves, Overtime, Payroll, Reports).
- **Employee**: Can view their own records and file requests (Leaves, Overtime).
- **Mandate**: Every administrative `PUT`, `POST`, or `DELETE` API route **must** have a server-side role check (e.g., verifying `userRole` cookie is `ADMIN`).

### 3. UI and Components
- Use `lucide-react` for icons.
- Prefer existing `components/ui/` (shadcn) components.
- Icons: Use `Timer` for Overtime and `Clock` for Time Logs.

### 4. Code Standards
- Use **2 spaces** for indentation.
- Use **single quotes** for strings.
- Always include `try/catch` blocks in API routes and return meaningful error messages.

## Key Features & Models

### Overtime Management
- **Model**: `OvertimeRequest`
- **Fields**: `id`, `employeeId`, `approverId`, `date`, `hours`, `reason`, `status` (`PENDING`, `APPROVED`, `REJECTED`), `adminNotes`.
- **API**: `/api/overtime`
- **Page**: `/overtime`
- **Rules**: 
  - Employees can apply for overtime.
  - Only **Admins** can review, approve, or reject overtime requests.
  - Approvals are reflected in `OvertimeRequest` model (integration with `TimeLog` and `Payroll` pending).

### Leave Management
- **Model**: `LeaveRequest`
- **Fields**: `id`, `employeeId`, `approverId`, `leaveType`, `startDate`, `endDate`, `daysCount`, `reason`, `status`, `adminNotes`.
- **API**: `/api/leaves`
- **Page**: `/leaves`
- **Rules**:
  - Manager-based approval flow (managerId in Employee record).
  - Admin can also review all leaves.

## Directory Structure
- `/app/api`: All API endpoints.
- `/app/(dashboard)`: Dashboard-related pages.
- `/prisma/schema.prisma`: Source of truth for database models.
- `/types/index.ts`: Shared TypeScript interfaces.
