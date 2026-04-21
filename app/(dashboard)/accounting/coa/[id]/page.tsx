'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Wallet } from 'lucide-react';

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
