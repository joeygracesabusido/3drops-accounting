# Time Logs System

## Overview

The Time Logs system tracks employee attendance with clock-in/clock-out functionality, GPS geofencing validation, and biometric data import support.

## Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Database Schema | ✅ Complete | TimeLog model with clockIn, clockOut, GPS coordinates |
| TypeScript Types | ✅ Complete | TimeLog interface in page.tsx |
| API Routes | ✅ Complete | `/api/time-logs` with GET, POST, DELETE |
| UI Dashboard | ✅ Complete | Time logs page at `/time-logs` |
| GPS Geofencing | ✅ Complete | Office location validation for clock-in/out |
| CSV Import | ✅ Complete | Import time logs from CSV/Excel |
| Biometric Import | ✅ Complete | Import from Touchlink .dat files |
| XCLS Import | ✅ Complete | Import from Excel with multiple punches per day |
| Delete Functionality | ✅ Complete | Admin/Manager can delete time logs |
| Search/Filter | ✅ Complete | Search by employee name |

---

## Features

### Clock In/Out
- Employees can clock in/out using the dashboard
- GPS validation ensures employees are within office geofence
- Automatic work hours calculation

### Data Import
- **CSV/Excel Import**: Upload time logs via CSV or Excel files
- **Biometric Import**: Import directly from Touchlink biometric devices (.dat files)
- **XCLS Import**: Import from Excel files with multiple punches per day (up to 4)
- Supports multiple date formats (YYYY-MM-DD, MM-DD-YYYY, DD-MM-YYYY)

### Admin Features
- View all employee time logs
- Search by employee name
- Delete individual time log entries

---

## Project Structure

```
├── app/
│   ├── (dashboard)/
│   │   └── time-logs/
│   │       └── page.tsx          # Time logs dashboard UI
│   └── api/
│       └── time-logs/
│           ├── route.ts           # GET, POST, DELETE time logs
│           ├── import/
│           │   └── route.ts       # CSV/Excel import
│           ├── import-biometric/
│           │   └── route.ts       # Biometric data import (Touchlink)
│           └── import-xcls/
│               └── route.ts       # XCLS Excel import
├── lib/
│   └── prisma.ts                 # Prisma client singleton
├── prisma/
│   └── schema.prisma             # Database schema with TimeLog model
└── docs/
    └── time-logs/                # This documentation
```

---

## User Roles

| Role | Clock In/Out | View All Logs | Import | Delete |
|------|-------------|---------------|--------|--------|
| ADMIN | ✅ | ✅ | ✅ | ✅ |
| MANAGER | ✅ | ✅ | ✅ | ✅ |
| EMPLOYEE | ✅ (own) | ❌ | ❌ | ❌ |

---

## Table of Contents

1. [API Endpoints](./API.md)
2. [Features Guide](./FEATURES.md)

---

## Changelog

### 2026-03-25
- Added delete functionality for time logs
- Admin/Manager can delete individual time log entries
- Confirmation dialog before deletion
- Dark theme modal with yellow text and gradient styling

### 2026-03-25
- Updated biometric import for Touchlink Time Recorder 3
- Supports Touchlink .dat format (EmployeeID, DateTime, Status)
- Auto-detects clock-in (first punch) and clock-out (last punch)
- Calculates work hours automatically

### 2026-03-25
- Fixed timezone handling in biometric import (device exports local Philippines time, no UTC conversion needed)
- Added lateMinutes and undertimeMinutes calculation based on shift schedule
- Days worked now counts only complete days (both clock-in AND clock-out)
- Added XCLS import for Excel files with multiple punches per day
- Days with no IN/OUT recorded are marked as "Absent"
