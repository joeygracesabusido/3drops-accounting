/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download, RefreshCcw, ChevronDown, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useBranch } from '@/lib/branch-context';
import { BranchSelector } from '@/components/branch-selector';

interface ExpenseReportItem {
  date: string;
  reference: string | null;
  description: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

interface ExpenseAccountSummary {
  code: string;
  name: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
  entries: ExpenseReportItem[];
}

interface ReportData {
  accounts: ExpenseAccountSummary[];
  grandTotalDebit: number;
  grandTotalCredit: number;
  grandTotalBalance: number;
}

export default function ExpensesReportPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const { selectedBranch } = useBranch();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBranch) params.set('branchId', selectedBranch.id);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const qs = params.toString();
      const url = `/api/accounting/reports/expenses-report${qs ? `?${qs}` : ''}`;
      const res = await fetch(url);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Error fetching expenses report:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedBranch, startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const toggleAccount = (code: string) => {
    setExpandedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const formatDate = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });

  const todayLabel = new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });

  const exportToExcel = () => {
    if (!data) return;

    const wb = XLSX.utils.book_new();
    const today = new Date().toISOString().split('T')[0];
    const rows: (string | number)[][] = [
      ['Expenses Report'],
      [`As of ${endDate ? formatDate(endDate) : todayLabel}`],
      [],
      ['Account Code', 'Account Name', 'Total Debit (₱)', 'Total Credit (₱)', 'Balance (₱)'],
    ];

    let grandDebit = 0;
    let grandCredit = 0;

    data.accounts.forEach((account) => {
      rows.push([
        account.code,
        account.name,
        account.totalDebit,
        account.totalCredit,
        account.balance,
      ]);
      grandDebit += account.totalDebit;
      grandCredit += account.totalCredit;
    });

    rows.push([]);
    rows.push(['', 'GRAND TOTALS', grandDebit, grandCredit, grandDebit - grandCredit]);
    rows.push([]);
    rows.push([]);

    rows.push(['DETAILED TRANSACTIONS']);
    rows.push(['Date', 'Reference', 'Description', 'Debit (₱)', 'Credit (₱)']);

    data.accounts.forEach((account) => {
      account.entries.forEach((entry) => {
        rows.push([
          new Date(entry.date).toLocaleDateString('en-PH'),
          entry.reference ?? '',
          entry.description,
          entry.debit || '',
          entry.credit || '',
        ]);
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses Report');
    XLSX.writeFile(wb, `expenses-report-${today}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Expenses Report</h1>
          <p className="text-muted-foreground">Detailed breakdown of all expense accounts and their journal entries</p>
        </div>
        <div className="flex items-center gap-4">
          <BranchSelector />
          <Button variant="outline" onClick={fetchReport} disabled={loading} className="flex items-center gap-2">
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-lg border shadow-sm">
        <div className="flex items-center gap-2">
          <label className="font-medium text-sm">From:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
          <label className="font-medium text-sm">To:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" onClick={fetchReport} disabled={loading} className="flex items-center gap-2">
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportToExcel} disabled={loading || !data} className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="text-center border-b pb-6">
          <CardTitle className="text-2xl uppercase tracking-wider">Expenses Report</CardTitle>
          <p className="text-sm text-muted-foreground">
            {startDate && endDate
              ? `For the period ${formatDate(startDate)} to ${formatDate(endDate)}`
              : endDate
                ? `As of ${formatDate(endDate)}`
                : `As of ${todayLabel}`}
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          {loading ? (
            <div className="py-20 text-center flex flex-col items-center gap-2">
              <RefreshCcw className="w-8 h-8 animate-spin text-primary" />
              <p>Loading expenses report...</p>
            </div>
          ) : (
            <div className="space-y-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="w-32">Account Code</TableHead>
                    <TableHead>Account Name</TableHead>
                    <TableHead className="text-right w-48">Total Debit (₱)</TableHead>
                    <TableHead className="text-right w-48">Total Credit (₱)</TableHead>
                    <TableHead className="text-right w-48">Balance (₱)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.accounts && data.accounts.length > 0 ? (
                    data.accounts.map((account) => (
                      <>
                        <TableRow
                          key={account.code}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleAccount(account.code)}
                        >
                          <TableCell>
                            {expandedAccounts.has(account.code) ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{account.code}</TableCell>
                          <TableCell className="font-medium">{account.name}</TableCell>
                          <TableCell className="text-right font-mono">
                            {account.totalDebit > 0 ? account.totalDebit.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {account.totalCredit > 0 ? account.totalCredit.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {account.balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                        {expandedAccounts.has(account.code) && account.entries.map((entry, idx) => (
                          <TableRow key={`${account.code}-${idx}`} className="bg-muted/30">
                            <TableCell></TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(entry.date).toLocaleDateString('en-PH')}
                            </TableCell>
                            <TableCell className="text-xs">
                              <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs border">{entry.reference}</span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {entry.description}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {entry.debit > 0 ? entry.debit.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {entry.credit > 0 ? entry.credit.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                        No expense entries found. Go to Expenses to record your first expense.
                      </TableCell>
                    </TableRow>
                  )}
                  {data?.accounts && data.accounts.length > 0 && (
                    <TableRow className="border-t-4 border-double hover:bg-transparent">
                      <TableCell colSpan={3} className="text-right font-bold py-4">GRAND TOTALS</TableCell>
                      <TableCell className="text-right font-bold font-mono py-4 border-t-2">
                        ₱{(data?.grandTotalDebit ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-bold font-mono py-4 border-t-2">
                        ₱{(data?.grandTotalCredit ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-bold font-mono py-4 border-t-2">
                        ₱{(data?.grandTotalBalance ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
