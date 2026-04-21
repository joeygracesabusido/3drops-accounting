# Time Logs Features Guide

## Clock In/Out

### How to Clock In
1. Navigate to `/time-logs`
2. Ensure GPS location is enabled and you're within office range
3. Select employee from dropdown (ifAdmin/Manager)
4. Click "Clock In" button

### How to Clock Out
1. Navigate to `/time-logs`
2. Ensure you're still within office geofence
3. Click "Clock Out" button

### GPS Requirements
- Browser must have geolocation permission
- Employee must be within configured office radius
- Distance is calculated using Haversine formula

---

## Import Time Logs

### CSV/Excel Import
1. Click "Import" button in the header
2. Download the template for correct format
3. Fill in the template with time log data
4. Upload the file
5. Review import results

**Template Format:**
| Field | Required | Format |
|-------|----------|--------|
| employeeNumber | Yes | Number |
| date | Yes | YYYY-MM-DD |
| clockIn | Yes | HH:MM |
| clockOut | No | HH:MM |
| notes | No | Text |

### Biometric Import
1. Click "Import Biometric" button
2. Upload .dat file from Touchlink Time Recorder device
3. Review import results

**Supported Format (Touchlink Time Recorder 3):**
```
EmployeeID    DateTime              Status
91311         2026-03-01 07:58:16   1
91334         2026-03-01 03:53:08   1
```

- Tab-separated format
- First punch of the day = clock-in
- Last punch of the day = clock-out
- Work hours calculated automatically
- Times are in local Philippines time (no timezone conversion needed)
- Late minutes calculated if clock-in is after shift start time
- Undertime calculated if clock-out is before shift end time

### XCLS Import
1. Click "Import XCLS" button
2. Download the template for correct format
3. Upload the Excel file (.xlsx or .xls)
4. Review import results

**Supported Format:**
| Column | Description |
|--------|-------------|
| employee_id | Employee ID number |
| Date | Date in M/D/YYYY format (e.g., 3/16/2026) |
| IN | First clock-in time (e.g., 7:48 AM) |
| OUT | First clock-out time (e.g., 5:01 PM) |
| IN | Second clock-in time (optional) |
| OUT | Second clock-out time (optional) |
| IN | Third clock-in time (optional) |
| OUT | Third clock-out time (optional) |

**Example:**
```
employee_id    Date        IN        OUT       IN        OUT
91417          3/16/2026   7:48 AM   5:01 PM
91417          3/20/2026   7:46 AM   5:06 PM             5:06 PM
91417          3/21/2026   2:46 AM             12:56 PM   5:04 PM
```

**Behavior:**
- Supports up to 4 punches per day (3 IN, 3 OUT)
- First punch = clock-in, last punch = clock-out
- Work hours calculated from first to last punch
- **If no IN or OUT for a date**: Marks as "Absent - No IN/OUT recorded"
- Late minutes calculated based on shift schedule
- Undertime calculated if clock-out is before shift end time
- **Date Handling:** Uses noon (12:00) local time to prevent timezone shift in MongoDB

---

## Delete Time Log

### For Admin/Manager
1. Navigate to `/time-logs`
2. Find the time log entry in the table
3. Click the trash icon in the Actions column
4. Confirm deletion in the dialog

### Delete Confirmation Modal
The delete modal features a dark theme with:
- Black background
- Yellow warning text with gradient overlay
- Yellow border with glow effect
- Styled cancel and delete buttons

### Authorization
Only ADMIN and MANAGER roles can delete time logs.

---

## Search Time Logs

Use the search bar above the time logs table to filter by employee name.

---

## Work Hours Calculation

Work hours are automatically calculated when an employee clocks out:

```
workHours = (clockOut - clockIn) / (1000 * 60 * 60)
```

Rounded to 2 decimal places.

---

## Lateness Tracking

If an employee has an assigned shift schedule:
- System compares actual clock-in time with shift start time
- Late minutes are recorded in `lateMinutes` field
- Remarks show "Late (Xm)" or "On Time"
