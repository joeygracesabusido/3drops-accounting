'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Wallet, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Account {
  name: string;
  code: string;
  type: string;
  normalBalance: string;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

interface ReportData {
  account: Account;
  transactions: Transaction[];
  error?: string;
}

export default function AccountTransactionsPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTransactions() {
      try {
        const res = await fetch(`/api/accounting/accounts/${params.id}/transactions`);
        const result = await res.json();
        setData(result);
      } catch (err) {
        console.error('Error fetching transactions:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchTransactions();
  }, [params.id]);

  function exportToExcel() {
    if (!transactions.length) return;
    const data = transactions.map(tx => ({
      Date: new Date(tx.date).toLocaleDateString('en-PH'),
      Description: tx.description,
      Debit: tx.debit,
      Credit: tx.credit,
      Balance: tx.balance,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ledger');
    XLSX.writeFile(wb, `${account.code}-${account.name}.xlsx`.replace(/[^a-z0-9.-]/gi, '_'));
  }

  function exportToCSV() {
    if (!transactions.length) return;
    const data = transactions.map(tx => ({
      Date: new Date(tx.date).toLocaleDateString('en-PH'),
      Description: tx.description,
      Debit: tx.debit,
      Credit: tx.credit,
      Balance: tx.balance,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${account.code}-${account.name}.csv`.replace(/[^a-z0-9.-]/gi, '_');
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading ledger entries...</p>
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Account transactions not found.</p>
        <Button onClick={() => router.push('/accounting/coa')}>Return to COA</Button>
      </div>
    );
  }

  const { account, transactions } = data;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.push('/accounting/coa')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Wallet className="h-6 w-6 text-primary" />
              {account.name}
            </h1>
            <p className="text-muted-foreground">
              Code: <span className="font-mono">{account.code}</span> | Type: {account.type}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="flex items-center gap-2" onClick={exportToExcel}>
            <Download className="w-4 h-4" />
            Export Excel
          </Button>
          <Button variant="outline" className="flex items-center gap-2" onClick={exportToCSV}>
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General Ledger History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No transactions found for this account.
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx: Transaction) => (
                  <TableRow key={tx.id}>
                    <TableCell>{new Date(tx.date).toLocaleDateString('en-PH')}</TableCell>
                    <TableCell>{tx.description}</TableCell>
                    <TableCell className="text-right font-mono">
                      {tx.debit > 0 ? `₱${tx.debit.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {tx.credit > 0 ? `₱${tx.credit.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      ₱{tx.balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
