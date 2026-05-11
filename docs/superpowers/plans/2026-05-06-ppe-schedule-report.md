# PPE Schedule Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a new `/asset-inventory/reports` page that displays assets in Schedule of PPE format with quarterly depreciation tracking per the Excel template.

**Architecture:** New reports page that fetches assets from existing `/api/assets` endpoint, groups by category, calculates quarterly depreciation, and exports to Excel matching the template format.

**Tech Stack:** Next.js 14, React, xlsx, existing depreciation library

---

## File Structure

- **Create:** `app/(dashboard)/asset-inventory/reports/page.tsx` - Main reports page
- **Modify:** `app/(dashboard)/layout.tsx` - Add navigation entry for PPE Reports

---

### Task 1: Add Navigation Entry

**Files:**
- Modify: `app/(dashboard)/layout.tsx:60-65`

- [ ] **Step 1: Add PPE Reports nav item**

In `layout.tsx`, find the asset-inventory subItems array (lines 60-65) and add a new entry:

```typescript
{
  href: '/asset-inventory/reports',
  label: 'PPE Reports',
  icon: FileText,
},
```

Add import for FileText at top if not present (already imported as FileText from lucide-react).

- [ ] **Step 2: Commit**

```bash
git add app/(dashboard)/layout.tsx
git commit -m "feat: add PPE Reports nav item under Asset Inventory"
```

---

### Task 2: Create PPE Reports Page

**Files:**
- Create: `app/(dashboard)/asset-inventory/reports/page.tsx`

- [ ] **Step 1: Write the PPE Reports page**

Create the following file with complete implementation:

```typescript
'use client';

import { useState, useEffect, useMemo } from 'react';
import { FileDown, ChevronDown } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { calculateDepreciation } from '@/lib/depreciation';
import * as XLSX from 'xlsx';

interface Asset {
  id: string;
  assetCode: string;
  name: string;
  description?: string | null;
  purchaseDate: string;
  purchaseCost: number;
  usefulLife: number;
  residualValue: number;
  depreciationMethod: string;
  quantity: number;
  status: string;
  category?: { id: string; name: string; unit?: string | null };
}

interface AssetGroup {
  categoryName: string;
  assets: Asset[];
  totals: {
    amount: number;
    q1Accumulated: number;
    q1NBV: number;
    q2Accumulated: number;
    q2NBV: number;
    q3Accumulated: number;
    q3NBV: number;
    q4Accumulated: number;
    q4NBV: number;
  };
}

const QUARTERS = [
  { name: 'Q1', endMonth: 2, label: 'JAN TO MARCH' },   // March
  { name: 'Q2', endMonth: 5, label: 'APRIL TO JUNE' },  // June
  { name: 'Q3', endMonth: 8, label: 'JULY TO SEPTEMBER' }, // Sept
  { name: 'Q4', endMonth: 11, label: 'OCTOBER TO DECEMBER' }, // Dec
];

export default function PPEReportsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  useEffect(() => {
    fetch('/api/assets')
      .then(res => res.json())
      .then(data => {
        setAssets(data || []);
        setLoading(false);
      });
  }, []);

  const year = parseInt(selectedYear);

  const groupedAssets = useMemo((): AssetGroup[] => {
    const activeAssets = assets.filter(a => a.status === 'ACTIVE');
    
    const groups: Record<string, Asset[]> = {};
    activeAssets.forEach(asset => {
      const catName = asset.category?.name || 'UNCATEGORIZED';
      if (!groups[catName]) groups[catName] = [];
      groups[catName].push(asset);
    });

    return Object.entries(groups).map(([categoryName, catAssets]) => {
      const sortedAssets = catAssets.sort((a, b) => 
        new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime()
      );

      const totals = {
        amount: 0,
        q1Accumulated: 0, q1NBV: 0,
        q2Accumulated: 0, q2NBV: 0,
        q3Accumulated: 0, q3NBV: 0,
        q4Accumulated: 0, q4NBV: 0,
      };

      sortedAssets.forEach(asset => {
        const amount = asset.purchaseCost;
        const monthlyDep = asset.usefulLife > 0 
          ? (asset.purchaseCost - asset.residualValue) / (asset.usefulLife * 12)
          : 0;

        totals.amount += amount;

        QUARTERS.forEach((q, idx) => {
          const quarterEnd = new Date(year, q.endMonth, 31);
          const purchaseDate = new Date(asset.purchaseDate);
          
          const { accumulatedDepreciation, netBookValue } = calculateDepreciation({
            purchaseCost: asset.purchaseCost,
            residualValue: asset.residualValue,
            usefulLife: asset.usefulLife,
            purchaseDate,
            method: asset.depreciationMethod,
            asOfDate: quarterEnd,
          });

          const accKey = `q${idx + 1}Accumulated` as keyof typeof totals;
          const nbvKey = `q${idx + 1}NBV` as keyof typeof totals;
          totals[accKey] += accumulatedDepreciation;
          totals[nbvKey] += netBookValue;
        });
      });

      return { categoryName, assets: sortedAssets, totals };
    }).sort((a, b) => a.categoryName.localeCompare(b.categoryName));
  }, [assets, year]);

  const grandTotals = useMemo(() => {
    return groupedAssets.reduce((acc, group) => ({
      amount: acc.amount + group.totals.amount,
      q1Accumulated: acc.q1Accumulated + group.totals.q1Accumulated,
      q1NBV: acc.q1NBV + group.totals.q1NBV,
      q2Accumulated: acc.q2Accumulated + group.totals.q2Accumulated,
      q2NBV: acc.q2NBV + group.totals.q2NBV,
      q3Accumulated: acc.q3Accumulated + group.totals.q3Accumulated,
      q3NBV: acc.q3NBV + group.totals.q3NBV,
      q4Accumulated: acc.q4Accumulated + group.totals.q4Accumulated,
      q4NBV: acc.q4NBV + group.totals.q4NBV,
    }), { amount: 0, q1Accumulated: 0, q1NBV: 0, q2Accumulated: 0, q2NBV: 0, q3Accumulated: 0, q3NBV: 0, q4Accumulated: 0, q4NBV: 0 });
  }, [groupedAssets]);

  const handleExport = () => {
    const rows: Record<string, unknown>[] = [];

    groupedAssets.forEach(group => {
      rows.push({ 'CATEGORY': group.categoryName });
      
      group.assets.forEach(asset => {
        const monthlyDep = asset.usefulLife > 0 
          ? (asset.purchaseCost - asset.residualValue) / (asset.usefulLife * 12)
          : 0;

        const row: Record<string, unknown> = {
          'QTY': asset.quantity,
          'UNIT OF MEASURE': asset.category?.unit || 'PC',
          'PARTICULARS/DESCRIPTION': asset.name,
          'Date of Purchase': new Date(asset.purchaseDate).toLocaleDateString('en-US'),
          'UNIT COST': asset.purchaseCost,
          'VAT INPUT': 0,
          'AMOUNT': asset.purchaseCost,
          'USEFUL LIFE (MONTHS)': asset.usefulLife * 12,
          'MONTHLY DEPRECIATION': monthlyDep,
        };

        QUARTERS.forEach((q, idx) => {
          const quarterEnd = new Date(year, q.endMonth, 31);
          const { accumulatedDepreciation, netBookValue } = calculateDepreciation({
            purchaseCost: asset.purchaseCost,
            residualValue: asset.residualValue,
            usefulLife: asset.usefulLife,
            purchaseDate: new Date(asset.purchaseDate),
            method: asset.depreciationMethod,
            asOfDate: quarterEnd,
          });
          row[`${q.label} DEPRECIATION`] = monthlyDep;
          row[`${q.label} ACCUMULATED`] = accumulatedDepreciation;
          row[`${q.label} NET BOOK VALUE`] = netBookValue;
        });

        rows.push(row);
      });

      rows.push({
        'QTY': '',
        'UNIT OF MEASURE': '',
        'PARTICULARS/DESCRIPTION': `TOTAL ${group.categoryName.toUpperCase()}`,
        'Date of Purchase': '',
        'UNIT COST': '',
        'VAT INPUT': '',
        'AMOUNT': group.totals.amount,
        'USEFUL LIFE (MONTHS)': '',
        'MONTHLY DEPRECIATION': '',
        [`${QUARTERS[0].label} ACCUMULATED`]: group.totals.q1Accumulated,
        [`${QUARTERS[0].label} NET BOOK VALUE`]: group.totals.q1NBV,
        [`${QUARTERS[1].label} ACCUMULATED`]: group.totals.q2Accumulated,
        [`${QUARTERS[1].label} NET BOOK VALUE`]: group.totals.q2NBV,
        [`${QUARTERS[2].label} ACCUMULATED`]: group.totals.q3Accumulated,
        [`${QUARTERS[2].label} NET BOOK VALUE`]: group.totals.q3NBV,
        [`${QUARTERS[3].label} ACCUMULATED`]: group.totals.q4Accumulated,
        [`${QUARTERS[3].label} NET BOOK VALUE`]: group.totals.q4NBV,
      });

      rows.push({});
    });

    rows.push({
      'QTY': '',
      'UNIT OF MEASURE': '',
      'PARTICULARS/DESCRIPTION': 'GRAND TOTAL',
      'Date of Purchase': '',
      'UNIT COST': '',
      'VAT INPUT': '',
      'AMOUNT': grandTotals.amount,
      'USEFUL LIFE (MONTHS)': '',
      'MONTHLY DEPRECIATION': '',
      [`${QUARTERS[0].label} ACCUMULATED`]: grandTotals.q1Accumulated,
      [`${QUARTERS[0].label} NET BOOK VALUE`]: grandTotals.q1NBV,
      [`${QUARTERS[1].label} ACCUMULATED`]: grandTotals.q2Accumulated,
      [`${QUARTERS[1].label} NET BOOK VALUE`]: grandTotals.q2NBV,
      [`${QUARTERS[2].label} ACCUMULATED`]: grandTotals.q3Accumulated,
      [`${QUARTERS[2].label} NET BOOK VALUE`]: grandTotals.q3NBV,
      [`${QUARTERS[3].label} ACCUMULATED`]: grandTotals.q4Accumulated,
      [`${QUARTERS[3].label} NET BOOK VALUE`]: grandTotals.q4NBV,
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `PPE ${year}`);
    XLSX.writeFile(workbook, `PPE_Schedule_${year}.xlsx`);
  };

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Schedule of Property, Plant & Equipment (PPE)</h1>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <CardTitle>Asset Depreciation Schedule</CardTitle>
          <div className="flex items-center gap-4">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleExport} className="flex items-center gap-2">
              <FileDown className="w-4 h-4" />
              Export Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted">
                    <TableHead rowSpan={2} className="text-center align-middle">QTY</TableHead>
                    <TableHead rowSpan={2} className="text-center align-middle">UNIT</TableHead>
                    <TableHead rowSpan={2} className="text-center align-middle">PARTICULARS/DESCRIPTION</TableHead>
                    <TableHead rowSpan={2} className="text-center align-middle">Date of Purchase</TableHead>
                    <TableHead rowSpan={2} className="text-right align-middle">UNIT COST</TableHead>
                    <TableHead rowSpan={2} className="text-right align-middle">VAT INPUT</TableHead>
                    <TableHead rowSpan={2} className="text-right align-middle">AMOUNT</TableHead>
                    <TableHead rowSpan={2} className="text-center align-middle">USEFUL LIFE (MONTHS)</TableHead>
                    <TableHead rowSpan={2} className="text-right align-middle">MONTHLY DEPRECIATION</TableHead>
                    <TableHead colSpan={3} className="text-center align-middle">{QUARTERS[0].label}</TableHead>
                    <TableHead colSpan={3} className="text-center align-middle">{QUARTERS[1].label}</TableHead>
                    <TableHead colSpan={3} className="text-center align-middle">{QUARTERS[2].label}</TableHead>
                    <TableHead colSpan={3} className="text-center align-middle">{QUARTERS[3].label}</TableHead>
                  </TableRow>
                  <TableRow className="bg-muted">
                    {QUARTERS.map(q => (
                      <>{' '}
                        <TableHead className="text-right">DEP</TableHead>
                        <TableHead className="text-right">ACCUM</TableHead>
                        <TableHead className="text-right">NBV</TableHead>
                      </>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedAssets.map(group => (
                    <>
                      <TableRow key={group.categoryName} className="bg-slate-100 font-bold">
                        <TableCell colSpan={6}>{group.categoryName}</TableCell>
                        <TableCell className="text-right">{group.totals.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell colSpan={3}></TableCell>
                        <TableCell className="text-right">{group.totals.q1Accumulated.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right">{group.totals.q1NBV.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right">{group.totals.q2Accumulated.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right">{group.totals.q2NBV.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right">{group.totals.q3Accumulated.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right">{group.totals.q3NBV.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right">{group.totals.q4Accumulated.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right">{group.totals.q4NBV.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                      {group.assets.map(asset => {
                        const monthlyDep = asset.usefulLife > 0 
                          ? (asset.purchaseCost - asset.residualValue) / (asset.usefulLife * 12)
                          : 0;

                        return (
                          <TableRow key={asset.id}>
                            <TableCell className="text-center">{asset.quantity}</TableCell>
                            <TableCell className="text-center">{asset.category?.unit || 'PC'}</TableCell>
                            <TableCell>{asset.name}</TableCell>
                            <TableCell className="text-center">{new Date(asset.purchaseDate).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">{asset.purchaseCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-right">0.00</TableCell>
                            <TableCell className="text-right">{asset.purchaseCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-center">{asset.usefulLife * 12}</TableCell>
                            <TableCell className="text-right">{monthlyDep.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                            {QUARTERS.map((q, idx) => {
                              const quarterEnd = new Date(year, q.endMonth, 31);
                              const { accumulatedDepreciation, netBookValue } = calculateDepreciation({
                                purchaseCost: asset.purchaseCost,
                                residualValue: asset.residualValue,
                                usefulLife: asset.usefulLife,
                                purchaseDate: new Date(asset.purchaseDate),
                                method: asset.depreciationMethod,
                                asOfDate: quarterEnd,
                              });
                              return (
                                <>
                                  <TableCell className="text-right">{monthlyDep.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                  <TableCell className="text-right">{accumulatedDepreciation.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                  <TableCell className="text-right">{netBookValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                </>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                    </>
                  ))}
                  <TableRow className="bg-slate-800 text-white font-bold">
                    <TableCell colSpan={6} className="text-right">GRAND TOTAL</TableCell>
                    <TableCell className="text-right">{grandTotals.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell colSpan={3}></TableCell>
                    <TableCell className="text-right">{grandTotals.q1Accumulated.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{grandTotals.q1NBV.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{grandTotals.q2Accumulated.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{grandTotals.q2NBV.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{grandTotals.q3Accumulated.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{grandTotals.q3NBV.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{grandTotals.q4Accumulated.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{grandTotals.q4NBV.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(dashboard)/asset-inventory/reports/page.tsx
git commit -m "feat: add PPE schedule report page with quarterly depreciation"
```

---

### Task 3: Verify Build

**Files:**
- Run: `npm run build` to ensure no errors

- [ ] **Step 1: Run build**

Run: `npm run build`

Expected: Build completes without errors

- [ ] **Step 2: Commit if changes needed**

---

### Task 4: Final Review

- [ ] **Step 1: Test page in browser**

Navigate to `/asset-inventory/reports` to verify page loads correctly.

- [ ] **Step 2: Test export**

Click "Export Excel" button to verify Excel downloads correctly.

---

## Plan Complete

All tasks written and ready for execution.