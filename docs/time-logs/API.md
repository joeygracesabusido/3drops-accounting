# Time Logs API

## Base Endpoint

```
/api/time-logs
```

---

## GET /api/time-logs

Fetch all time logs (filtered by role).

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| employeeId | string | No | Filter by specific employee (Admin/Manager only) |

### Response

```json
[
  {
    "id": "...",
    "employeeId": "...",
    "date": "2026-03-25T00:00:00.000Z",
    "clockIn": "2026-03-25T08:00:00.000Z",
    "clockOut": "2026-03-25T17:00:00.000Z",
    "workHours": 9.0,
    "lateMinutes": 0,
    "shift": {
      "id": "...",
      "name": "Morning Shift",
      "startTime": "08:00",
      "endTime": "17:00"
    },
    "employee": {
      "fullName": "John Doe",
      "employeeId": "EMP-001"
    }
  }
]
```

### Authorization
- ADMIN/MANAGER: Can view all time logs
- EMPLOYEE: Can only view their own time logs

---

## POST /api/time-logs

Record clock-in or clock-out.

### Request Body

```json
{
  "employeeId": "...",
  "type": "clockIn" | "clockOut",
  "latitude": 14.5995,
  "longitude": 120.9842
}
```

### Response (Success)

```json
{
  "message": "Clock in recorded successfully"
}
```

### Response (Error)

```json
{
  "error": "You must be within 100 meters of the office to clock in"
}
```

### Validation Rules
- GPS coordinates must be within office geofence radius
- Cannot clock in twice in the same day
- Cannot clock out without clocking in first

---

## DELETE /api/time-logs

Delete a time log entry.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Time log ID to delete |

### Response (Success)

```json
{
  "message": "Time log deleted successfully"
}
```

### Response (Error)

```json
{
  "error": "Time log ID is required"
}
```

### Authorization
- ADMIN/MANAGER only

---

## Import Endpoints

### POST /api/time-logs/import

Import time logs from CSV/Excel file.

**Content-Type**: `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| file | File | CSV or Excel file |

**Expected CSV Format:**
```csv
employeeNumber,date,clockIn,clockOut,notes
1001,2026-03-25,08:00,17:00,
```

### POST /api/time-logs/import-biometric

Import time logs from Touchlink Time Recorder device.

**Content-Type**: `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| file | File | .dat file from Touchlink |

**Expected .dat Format:**
```
EmployeeID\tDateTime\tStatus
91311\t2026-03-01 07:58:16\t1
91334\t2026-03-01 03:53:08\t1
```

**Processing Logic:**
- First punch of the day → clockIn
- Last punch of the day → clockOut
- Work hours calculated automatically
- Times are parsed as local Philippines time (no timezone conversion)
- lateMinutes calculated if clock-in is after shift start time
- undertimeMinutes calculated if clock-out is before shift end time

### POST /api/time-logs/import-xcls

Import time logs from Excel file with multiple punches per day.

**Content-Type**: `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| file | File | Excel file (.xlsx or .xls) |

**Expected Excel Format:**
| employee_id | Date | IN | OUT | IN | OUT | IN | OUT |
|-------------|------|----|-----|----|-----|----|-----|
| 91417 | 3/16/2026 | 7:48 AM | 5:01 PM | | | | |
| 91417 | 3/20/2026 | 7:46 AM | 5:06 PM | | 5:06 PM | | |
| 91417 | 3/21/2026 | 2:46 AM | | 12:56 PM | 5:04 PM | | |

**Processing Logic:**
- Supports up to 4 punches per day (3 IN, 3 OUT)
- First punch = clockIn, last punch = clockOut
- Work hours calculated from first to last punch
- If no punches for a date → marked as "Absent - No IN/OUT recorded"
- lateMinutes/undertimeMinutes calculated based on shift schedule

**Response:**
```json
{
  "message": "Import completed: 10 successful, 3 absent, 0 failed",
  "results": {
    "success": 10,
    "absent": 3,
    "failed": 0,
    "errors": []
  }
}
```
