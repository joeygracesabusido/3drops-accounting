/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle2, XCircle, Download } from 'lucide-react';
import { useBranch } from '@/lib/branch-context';
import { BranchSelector } from '@/components/branch-selector';

export default function ReconciliationPage() {
  const { selectedBranch } = useBranch();
  const [reconciliations, setReconciliations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function fetchReconciliation() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBranch) params.set('branchId', selectedBranch.id);
      const res = await fetch(`/api/accounting/subsidiary-transactions?${params}`, {
        method: 'DELETE', // Using DELETE for reconciliation check
      });
      const data = await res.json();
      setReconciliations(data.reconciliations || []);
    } catch (err) {
      console.error('Error fetching reconciliation:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">GL-SL Reconciliation</h1>
          <p className="text-muted-foreground">
            Verify General Ledger balances match Subsidiary Ledger totals (GAAP compliance)
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <BranchSelector />
          <Button onClick={fetchReconciliation} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Control Account Reconciliation</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account Code</TableHead>
                <TableHead>Account Name</TableHead>
                <TableHead className="text-right">GL Balance</TableHead>
                <TableHead className="text-right">SL Total</TableHead>
                <TableHead className="text-right">Difference</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : reconciliations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Click Refresh to load reconciliation data
                  </TableCell>
                </TableRow>
              ) : (
                reconciliations.map((rec) => (
                  <TableRow key={rec.accountId} className={
                    !rec.isBalanced ? 'bg-red-50 dark:bg-red-950/20' : ''
                  }>
                    <TableCell className="font-mono font-medium">{rec.accountCode}</TableCell>
                    <TableCell>{rec.accountName}</TableCell>
                    <TableCell className="text-right font-mono">
                      ₱{Math.abs(rec.glBalance).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ₱{Math.abs(rec.slBalance).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={
                        Math.abs(rec.difference) > 0.01 ? 'text-red-600 font-bold' : 'text-green-600'
                      }>
                        ₱{Math.abs(rec.difference).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {rec.isBalanced ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600 mx-auto" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600 mx-auto" />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="bg-slate-50 dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="text-sm uppercase text-muted-foreground">GAAP Compliance Note</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Under GAAP, the General Ledger control account balance must always equal the sum of all
            subsidiary ledger balances. Any difference indicates:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Transactions posted to GL but not to SL (or vice versa)</li>
            <li>Posting errors (wrong amounts or accounts)</li>
            <li>Timing differences in batch postings</li>
          </ul>
          <p className="mt-2 text-foreground">
            <strong>Action Required:</strong> Accounts marked with red must be investigated and reconciled
            before financial statements can be prepared.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
