# Import Biometric Feature Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated "Import Biometric" button that allows admins/managers to upload ZKTeco .dat files containing attendance records from biometric devices and insert them into the TimeLog database.

**Architecture:** Create a new API endpoint `/api/time-logs/import-biometric` that parses ZKTeco .dat files (tab-separated), matches employees by employeeNumber, and creates/updates TimeLog records. Add a new dialog component in the time-logs page with date format selection and file upload.

**Tech Stack:** Next.js 14, React 18, Prisma ORM, MongoDB, TypeScript, shadcn/ui Dialog components

---

## File Structure

### Files to Create
- `app/api/time-logs/import-biometric/route.ts` - API endpoint for biometric file import

### Files to Modify
- `app/(dashboard)/time-logs/page.tsx:507-522` - Add biometric import dialog content
- `app/(dashboard)/time-logs/page.tsx:449-497` - Implement handleBiometricImport function (skeleton exists)

---

## Task Breakdown

### Task 1: Create Biometric Import API Endpoint

**Files:**
- Create: `app/api/time-logs/import-biometric/route.ts`

- [ ] **Step 1: Create the API route file with ZKTeco .dat parser**

```typescript
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const dateFormat = formData.get('dateFormat') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const text = await file.text();
    const lines = text.trim().split('\n');
    
    if (lines.length === 0) {
      return NextResponse.json(
        { error: 'File is empty' },
        { status: 400 }
      );
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    const parseZKTecoDate = (dateStr: string, format: string): Date | null => {
      if (!dateStr) return null;
      
      try {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          let year: number, month: number, day: number;
          
          if (format === 'yyyy-mm-dd') {
            year = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10) - 1;
            day = parseInt(parts[2], 10);
          } else if (format === 'mm-dd-yyyy') {
            month = parseInt(parts[0], 10) - 1;
            day = parseInt(parts[1], 10);
            year = parseInt(parts[2], 10);
          } else { // dd-mm-yyyy
            day = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10) - 1;
            year = parseInt(parts[2], 10);
          }
          
          const date = new Date(year, month, day);
          if (isNaN(date.getTime())) return null;
          return date;
        }
        return null;
      } catch {
        return null;
      }
    };

    const parseZKTecoTime = (timeStr: string): Date | null => {
      if (!timeStr) return null;
      
      try {
        const parts = timeStr.split(':');
        if (parts.length === 2) {
          const hours = parseInt(parts[0], 10);
          const minutes = parseInt(parts[1], 10);
          if (!isNaN(hours) && !isNaN(minutes)) {
            const date = new Date();
            date.setHours(hours, minutes, 0, 0);
            return date;
          }
        }
        return null;
      } catch {
        return null;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      try {
        const fields = line.split('\t');
        
        if (fields.length < 3) {
          results.failed++;
          results.errors.push(`Line ${i + 1}: Invalid format - insufficient fields`);
          continue;
        }

        const userId = fields[0].trim();
        const dateStr = fields[1].trim();
        const timeStr = fields[2].trim();

        if (!userId || !dateStr || !timeStr) {
          results.failed++;
          results.errors.push(`Line ${i + 1}: Missing required fields`);
          continue;
        }

        const dateObj = parseZKTecoDate(dateStr, dateFormat);
        if (!dateObj) {
          results.failed++;
          results.errors.push(`Line ${i + 1}: Invalid date format "${dateStr}"`);
          continue;
        }

        const timeObj = parseZKTecoTime(timeStr);
        if (!timeObj) {
          results.failed++;
          results.errors.push(`Line ${i + 1}: Invalid time format "${timeStr}"`);
          continue;
        }

        const employee = await prisma.employee.findFirst({
          where: { 
            OR: [
              { employeeNumber: parseInt(userId) },
              { employeeId: userId }
            ]
          },
        });

        if (!employee) {
          results.failed++;
          results.errors.push(`Line ${i + 1}: Employee not found for ID "${userId}"`);
          continue;
        }

        const dateNormalized = new Date(dateObj);
        dateNormalized.setHours(0, 0, 0, 0);

        const dateStart = new Date(dateNormalized);
        const dateEnd = new Date(dateNormalized);
        dateEnd.setDate(dateEnd.getDate() + 1);

        const existingLog = await prisma.timeLog.findFirst({
          where: {
            employeeId: employee.id,
            date: {
              gte: dateStart,
              lt: dateEnd,
            },
          },
        });

        const clockInTime = new Date(dateNormalized);
        clockInTime.setHours(timeObj.getHours(), timeObj.getMinutes(), 0, 0);

        if (existingLog) {
          if (!existingLog.clockIn) {
            await prisma.timeLog.update({
              where: { id: existingLog.id },
              data: {
                clockIn: clockInTime,
                isEdited: true,
                notes: 'Imported from biometric device',
              },
            });
          }
          results.success++;
        } else {
          await prisma.timeLog.create({
            data: {
              employeeId: employee.id,
              date: dateNormalized,
              clockIn: clockInTime,
              isEdited: true,
              notes: 'Imported from biometric device',
            },
          });
          results.success++;
        }
      } catch (rowError) {
        results.failed++;
        results.errors.push(`Line ${i + 1}: ${rowError instanceof Error ? rowError.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      message: `Import completed: ${results.success} successful, ${results.failed} failed`,
      results,
    });
  } catch (error) {
    console.error('Error importing biometric data:', error);
    return NextResponse.json(
      { error: 'Failed to import biometric data' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify the file was created**

Run: `ls -la app/api/time-logs/import-biometric/route.ts`
Expected: File exists

- [ ] **Step 3: Commit the API endpoint**

```bash
git add app/api/time-logs/import-biometric/route.ts
git commit -m "feat: add biometric import API endpoint for ZKTeco .dat files"
```

### Task 2: Implement Biometric Import Dialog UI

**Files:**
- Modify: `app/(dashboard)/time-logs/page.tsx:507-522`

- [ ] **Step 1: Add the biometric import dialog content after the existing import dialog**

Insert after line 522 (after the biometric DialogTrigger closing tag):

```typescript
              <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden rounded-2xl shadow-2xl border-0">
                <div className="relative bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-6">
                  <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
                  <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-20 h-20 bg-white/10 rounded-full blur-xl"></div>
                  <div className="relative flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      <Upload className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <DialogTitle className="text-xl font-bold text-white">Import Biometric Data</DialogTitle>
                      <DialogDescription className="text-purple-100 text-sm mt-0.5">
                        Upload .dat file from ZKTeco biometric device
                      </DialogDescription>
                    </div>
                  </div>
                </div>
                <div className="p-6 space-y-6">
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100 rounded-2xl p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <FileSpreadsheet className="w-6 h-6 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 mb-1">File Format</p>
                        <p className="text-sm text-gray-500 mb-3">ZKTeco .dat format (tab-separated)</p>
                        <div className="bg-white/70 rounded-lg p-3 text-xs font-mono text-gray-600">
                          <p>UserID&lt;tab&gt;Date&lt;tab&gt;Time</p>
                          <p className="mt-1 text-gray-400">Example: 1001&lt;tab&gt;01-15-2026&lt;tab&gt;08:30</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border rounded-2xl p-5">
                    <Label className="font-semibold text-gray-900 mb-2 block">Date Format</Label>
                    <div className="grid grid-cols-3 gap-3">
                      <label className="flex items-center gap-2 p-3 border-2 rounded-xl cursor-pointer hover:bg-purple-50 transition-colors"
                        style={{ borderColor: biometricDateFormat === 'yyyy-mm-dd' ? '#9333ea' : '#e5e7eb' }}>
                        <input
                          type="radio"
                          name="dateFormat"
                          value="yyyy-mm-dd"
                          checked={biometricDateFormat === 'yyyy-mm-dd'}
                          onChange={(e) => setBiometricDateFormat(e.target.value)}
                          className="w-4 h-4 text-purple-600"
                        />
                        <span className="text-sm font-medium">YYYY-MM-DD</span>
                      </label>
                      <label className="flex items-center gap-2 p-3 border-2 rounded-xl cursor-pointer hover:bg-purple-50 transition-colors"
                        style={{ borderColor: biometricDateFormat === 'mm-dd-yyyy' ? '#9333ea' : '#e5e7eb' }}>
                        <input
                          type="radio"
                          name="dateFormat"
                          value="mm-dd-yyyy"
                          checked={biometricDateFormat === 'mm-dd-yyyy'}
                          onChange={(e) => setBiometricDateFormat(e.target.value)}
                          className="w-4 h-4 text-purple-600"
                        />
                        <span className="text-sm font-medium">MM-DD-YYYY</span>
                      </label>
                      <label className="flex items-center gap-2 p-3 border-2 rounded-xl cursor-pointer hover:bg-purple-50 transition-colors"
                        style={{ borderColor: biometricDateFormat === 'dd-mm-yyyy' ? '#9333ea' : '#e5e7eb' }}>
                        <input
                          type="radio"
                          name="dateFormat"
                          value="dd-mm-yyyy"
                          checked={biometricDateFormat === 'dd-mm-yyyy'}
                          onChange={(e) => setBiometricDateFormat(e.target.value)}
                          className="w-4 h-4 text-purple-600"
                        />
                        <span className="text-sm font-medium">DD-MM-YYYY</span>
                      </label>
                    </div>
                  </div>

                  <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-6 hover:border-purple-300 hover:bg-purple-50/30 transition-all group">
                    <Label htmlFor="biometric-file-upload" className="flex flex-col items-center cursor-pointer">
                      <div className="w-14 h-14 bg-gray-100 group-hover:bg-purple-100 rounded-2xl flex items-center justify-center mb-3 transition-colors">
                        <Upload className="w-7 h-7 text-gray-400 group-hover:text-purple-600 transition-colors" />
                      </div>
                      <span className="text-sm font-medium text-gray-700 group-hover:text-purple-600 transition-colors">Click to upload</span>
                      <span className="text-xs text-gray-400 mt-1">or drag and drop</span>
                      <p className="text-xs text-gray-400 mt-3">Supported: .dat</p>
                    </Label>
                    <Input
                      id="biometric-file-upload"
                      type="file"
                      accept=".dat"
                      ref={biometricFileInputRef}
                      onChange={handleBiometricImport}
                      disabled={biometricImporting}
                      className="hidden"
                    />
                  </div>

                  {biometricImporting && (
                    <div className="flex items-center justify-center gap-3 py-4 bg-purple-50 rounded-xl">
                      <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-sm font-medium text-purple-700">Importing biometric data...</p>
                    </div>
                  )}
                  {biometricImportResult && (
                    <div className={`rounded-2xl p-5 ${biometricImportResult.failed === 0 ? 'bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200' : 'bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200'}`}>
                      <div className="flex items-center gap-3 mb-4">
                        {biometricImportResult.failed === 0 ? (
                          <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/30">
                            <CheckCircle2 className="w-5 h-5 text-white" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/30">
                            <AlertCircle className="w-5 h-5 text-white" />
                          </div>
                        )}
                        <div>
                          <p className={`font-bold ${biometricImportResult.failed === 0 ? 'text-green-700' : 'text-amber-700'}`}>
                            Import {biometricImportResult.failed === 0 ? 'Successful' : 'Completed with Issues'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {biometricImportResult.success} imported, {biometricImportResult.failed} failed
                          </p>
                        </div>
                      </div>
                      {biometricImportResult.errors.length > 0 && (
                        <div className="mt-3 text-xs bg-white/70 rounded-xl p-3 max-h-28 overflow-y-auto border border-gray-100">
                          {biometricImportResult.errors.slice(0, 5).map((err, i) => (
                            <p key={i} className="text-red-500 py-1 px-2 rounded bg-red-50/50 mb-1 last:mb-0">{err}</p>
                          ))}
                          {biometricImportResult.errors.length > 5 && <p className="text-gray-500 py-1">...and {biometricImportResult.errors.length - 5} more errors</p>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="px-6 pb-6">
                  <Button 
                    variant="outline" 
                    onClick={() => { resetBiometricImport(); setBiometricImportOpen(false); }} 
                    className="w-full py-6 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl border-gray-200"
                  >
                    Close
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
```

- [ ] **Step 2: Verify the dialog was added**

Run: `grep -n "Import Biometric Data" app/\(dashboard\)/time-logs/page.tsx`
Expected: Should find the DialogTitle text

- [ ] **Step 3: Commit the UI changes**

```bash
git add app/\(dashboard\)/time-logs/page.tsx
git commit -m "feat: add biometric import dialog with date format selection"
```

### Task 3: Test the Import Feature

**Files:**
- Test: Manual testing with sample .dat file

- [ ] **Step 1: Create a sample .dat file for testing**

Create a test file at `test-biometric.dat`:
```
1001	01-15-2026	08:30
1001	01-16-2026	08:25
1002	01-15-2026	08:35
1002	01-16-2026	09:00
```

- [ ] **Step 2: Start the development server**

Run: `npm run dev`
Expected: Server starts on http://localhost:3000

- [ ] **Step 3: Test the import flow**

1. Navigate to http://localhost:3000/time-logs
2. Login as admin or manager
3. Click "Import Biometric" button
4. Select date format (MM-DD-YYYY for test file)
5. Upload test-biometric.dat
6. Verify success message appears
7. Check time logs table for new entries

- [ ] **Step 4: Verify database entries**

Run: `npx prisma studio`
Expected: TimeLog records created for employees 1001 and 1002

- [ ] **Step 5: Test error handling**

Create invalid test file with:
- Missing fields
- Invalid dates
- Non-existent employee IDs

Verify errors are displayed in the UI

- [ ] **Step 6: Clean up test file**

Run: `rm test-biometric.dat`

- [ ] **Step 7: Run lint check**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 8: Test production build**

Run: `npm run build`
Expected: Build succeeds without errors

- [ ] **Step 9: Commit any fixes**

If any fixes were needed during testing:
```bash
git add .
git commit -m "fix: address issues found during biometric import testing"
```

---

## Verification Checklist

- [ ] API endpoint accepts .dat files
- [ ] Date format selection works (all 3 formats)
- [ ] Employee matching by employeeNumber works
- [ ] Employee matching by employeeId works as fallback
- [ ] TimeLog records are created correctly
- [ ] Existing TimeLog records are updated (not duplicated)
- [ ] Error messages are displayed for failed rows
- [ ] Success/failure counts are accurate
- [ ] UI follows existing design patterns
- [ ] No TypeScript errors
- [ ] Lint passes
- [ ] Build succeeds

---

## Notes

- ZKTeco .dat format is tab-separated with fields: UserID, Date, Time, AccessRight, ...
- Only first 3 fields are required for basic clock-in import
- Employee matching tries employeeNumber first, then employeeId
- Clock-in times are imported; clock-out must be handled separately or in a second pass
- The existing `handleBiometricImport` function skeleton in page.tsx is already correctly implemented
- Dialog state variables are already declared (biometricImportOpen, biometricImporting, biometricImportResult, biometricDateFormat, biometricFileInputRef)
