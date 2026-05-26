/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download, RefreshCcw } from 'lucide-react';
import { useBranch } from '@/lib/branch-context';
import { BranchSelector } from '@/components/branch-selector';

interface TrialBalanceItem {
  code: string;
  name: string;
  type: string;
  totalDebit: number;
  totalCredit: number;
}

interface IncomeStatementItem {
  code: string;
  name: string;
  balance: number;
}

interface BalanceSheetItem {
  code: string;
  name: string;
  balance: number;
}

interface ReportData {
  data?: TrialBalanceItem[];
  grandTotalDebit?: number;
  grandTotalCredit?: number;
  isBalanced?: boolean;
  revenue?: IncomeStatementItem[];
  expenses?: IncomeStatementItem[];
  totalRevenue?: number;
  totalExpenses?: number;
  netIncome?: number;
  assets?: BalanceSheetItem[];
  liabilities?: BalanceSheetItem[];
  equity?: BalanceSheetItem[];
  totalAssets?: number;
  totalLiabilities?: number;
  totalEquity?: number;
  totalLiabilitiesEquity?: number;
}

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState('trial-balance');
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const { selectedBranch } = useBranch();

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/accounting/reports/${activeReport}${selectedBranch ? `?branchId=${selectedBranch.id}` : ''}`;
      const res = await fetch(url);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Error fetching report:', err);
    } finally {
      setLoading(false);
    }
  }, [activeReport, selectedBranch]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Financial Reports</h1>
          <p className="text-muted-foreground">Real-time financial statements based on your General Ledger</p>
        </div>
        <div className="flex items-center gap-4">
          <BranchSelector />
          <Button variant="outline" onClick={fetchReport} disabled={loading} className="flex items-center gap-2">
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        </div>
      </div>

      <div className="flex justify-between items-center bg-white p-4 rounded-lg border shadow-sm">
        <div className="flex items-center gap-4">
          <label className="font-medium text-sm">Select Report Type:</label>
          <select 
            value={activeReport} 
            onChange={(e) => setActiveReport(e.target.value)}
            className="flex h-10 w-64 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="trial-balance">Trial Balance</option>
            <option value="income-statement">Income Statement (Profit & Loss)</option>
            <option value="balance-sheet">Balance Sheet (Financial Position)</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchReport} disabled={loading} className="flex items-center gap-2">
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export PDF
          </Button>
        </div>
      </div>

      {activeReport === 'trial-balance' && (
        <Card>
          <CardHeader className="text-center border-b pb-6">
            <CardTitle className="text-2xl uppercase tracking-wider">Trial Balance</CardTitle>
            <p className="text-sm text-muted-foreground">As of {new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </CardHeader>
          <CardContent className="pt-6">
            {loading ? (
              <div className="py-20 text-center flex flex-col items-center gap-2">
                <RefreshCcw className="w-8 h-8 animate-spin text-primary" />
                <p>Calculating ledger balances...</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Account Code</TableHead>
                    <TableHead>Account Name</TableHead>
                    <TableHead className="text-right w-48">Debit (₱)</TableHead>
                    <TableHead className="text-right w-48">Credit (₱)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.data && data.data.length > 0 ? (
                    data.data.map((acc: TrialBalanceItem) => (
                      <TableRow key={acc.code}>
                        <TableCell className="font-mono text-sm">{acc.code}</TableCell>
                        <TableCell className="font-medium">{acc.name}</TableCell>
                        <TableCell className="text-right font-mono">
                          {acc.totalDebit > 0 ? acc.totalDebit.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {acc.totalCredit > 0 ? acc.totalCredit.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                        No transactions found. Go to Journal Entries to record your first transaction.
                      </TableCell>
                    </TableRow>
                  )}
                  {data?.data && data.data.length > 0 && (
                    <TableRow className="border-t-4 border-double hover:bg-transparent">
                      <TableCell colSpan={2} className="text-right font-bold py-4">GRAND TOTALS</TableCell>
                      <TableCell className="text-right font-bold font-mono py-4 border-t-2">
                        ₱{(data?.grandTotalDebit ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-bold font-mono py-4 border-t-2">
                        ₱{(data?.grandTotalCredit ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </TableCell>                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
            {!loading && !data?.isBalanced && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-center font-bold">
                ⚠️ THE TRIAL BALANCE IS UNBALANCED. PLEASE CHECK YOUR JOURNAL ENTRIES.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeReport === 'income-statement' && (
        <Card className="max-w-4xl mx-auto">
          <CardHeader className="text-center border-b pb-6">
            <CardTitle className="text-2xl uppercase tracking-wider">Income Statement</CardTitle>
            <p className="text-sm text-muted-foreground italic">For the period ended {new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </CardHeader>
          <CardContent className="pt-8 px-12">
            {loading ? (
              <div className="py-20 text-center">Loading P&L details...</div>
            ) : (
              <div className="space-y-10">
                {/* Revenue Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold border-b pb-2">REVENUES</h3>
                  <div className="space-y-2">
                    {data?.revenue && data.revenue.length > 0 ? (
                      data.revenue.map((rev: IncomeStatementItem) => (
                        <div key={rev.code} className="flex justify-between items-center text-sm pl-4">
                          <span>{rev.name}</span>
                          <span className="font-mono">₱{rev.balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground pl-4">No revenue recorded</p>
                    )}
                    <div className="flex justify-between items-center font-bold pt-2 border-t mt-4">
                      <span>TOTAL REVENUES</span>
                      <span className="font-mono underline underline-offset-4 decoration-double">
                        ₱{(data?.totalRevenue ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expenses Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold border-b pb-2">EXPENSES</h3>
                  <div className="space-y-2">
                    {data?.expenses && data.expenses.length > 0 ? (
                      data.expenses.map((exp: IncomeStatementItem) => (
                        <div key={exp.code} className="flex justify-between items-center text-sm pl-4">
                          <span>{exp.name}</span>
                          <span className="font-mono">₱{exp.balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground pl-4">No expenses recorded</p>
                    )}
                    <div className="flex justify-between items-center font-bold pt-2 border-t mt-4">
                      <span>TOTAL EXPENSES</span>
                      <span className="font-mono">
                        ₱{(data?.totalExpenses ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Net Income Section */}
                <div className="flex justify-between items-center p-6 bg-slate-50 rounded-xl border-2 border-slate-200">
                  <span className="text-xl font-black uppercase tracking-widest">Net Income / (Loss)</span>
                  <span className={`text-2xl font-black font-mono ${(data?.netIncome ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    ₱{(data?.netIncome ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeReport === 'balance-sheet' && (
        <Card className="max-w-5xl mx-auto">
          <CardHeader className="text-center border-b pb-6">
            <CardTitle className="text-2xl uppercase tracking-wider">Statement of Financial Position</CardTitle>
            <p className="text-sm text-muted-foreground italic">As of {new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </CardHeader>
          <CardContent className="pt-8">
            {loading ? (
              <div className="py-20 text-center">Preparing financial statement...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 px-6">
                {/* Left Column: Assets */}
                <div className="space-y-6">
                  <h3 className="text-lg font-bold border-b-2 border-slate-800 pb-1">ASSETS</h3>
                  <div className="space-y-4">
                    {data?.assets && data.assets.length > 0 ? (
                      data.assets.map((asset: BalanceSheetItem) => (
                        <div key={asset.code} className="flex justify-between text-sm">
                          <span>{asset.name}</span>
                          <span className="font-mono">₱{asset.balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No assets found</p>
                    )}
                  </div>
                  <div className="flex justify-between items-center font-bold pt-4 border-t-2 border-slate-800 mt-auto">
                    <span>TOTAL ASSETS</span>
                    <span className="font-mono text-lg underline underline-offset-4 decoration-double">
                      ₱{(data?.totalAssets ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Right Column: Liabilities & Equity */}
                <div className="space-y-8">
                  <div className="space-y-6">
                    <h3 className="text-lg font-bold border-b-2 border-slate-800 pb-1">LIABILITIES</h3>
                    <div className="space-y-4">
                      {data?.liabilities && data.liabilities.length > 0 ? (
                        data.liabilities.map((liab: BalanceSheetItem) => (
                          <div key={liab.code} className="flex justify-between text-sm">
                            <span>{liab.name}</span>
                            <span className="font-mono">₱{liab.balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No liabilities found</p>
                      )}
                      <div className="flex justify-between items-center font-semibold pt-2 border-t">
                        <span className="text-xs uppercase">Total Liabilities</span>
                        <span className="font-mono">₱{(data?.totalLiabilities ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-lg font-bold border-b-2 border-slate-800 pb-1">EQUITY</h3>
                    <div className="space-y-4">
                      {data?.equity && data.equity.length > 0 ? (
                        data.equity.map((eq: BalanceSheetItem) => (
                          <div key={eq.code} className="flex justify-between text-sm">
                            <span>{eq.name}</span>
                            <span className="font-mono">₱{eq.balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No equity accounts found</p>
                      )}
                      <div className="flex justify-between items-center font-semibold pt-2 border-t">
                        <span className="text-xs uppercase">Total Equity</span>
                        <span className="font-mono">₱{(data?.totalEquity ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center font-bold pt-4 border-t-2 border-slate-800 bg-slate-50 p-2">
                    <span className="text-sm">TOTAL LIABILITIES & EQUITY</span>
                    <span className="font-mono text-lg underline underline-offset-4 decoration-double">
                      ₱{(data?.totalLiabilitiesEquity ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            )}
            {!loading && Math.abs((data?.totalAssets ?? 0) - (data?.totalLiabilitiesEquity ?? 0)) > 0.01 && (
              <div className="mt-8 p-3 bg-amber-50 border border-amber-200 rounded text-amber-800 text-xs text-center">
                Note: Total Assets do not match Total Liabilities & Equity. Difference: ₱{Math.abs((data?.totalAssets ?? 0) - (data?.totalLiabilitiesEquity ?? 0)).toLocaleString()}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
