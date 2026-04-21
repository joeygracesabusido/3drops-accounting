'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Wallet, ArrowUpRight, ArrowDownRight, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface JournalEntry {
  id: string;
  date: string;
  description: string;
  reference?: string;
}

export default function AccountingDashboard() {
  const [stats, setStats] = useState({
    cashBalance: 0,
    totalReceivables: 0,
    totalPayables: 0,
    netIncome: 0,
  });
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, entriesRes] = await Promise.all([
          fetch('/api/accounting/stats'),
          fetch('/api/accounting/journal?limit=5')
        ]);
        
        const statsData = await statsRes.json();
        const entriesData = await entriesRes.json();
        
        if (!statsData.error) setStats(statsData);
        if (!entriesData.error) setEntries(Array.isArray(entriesData) ? entriesData : []);
      } catch (err) {
        console.error('Error fetching accounting dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <div className="p-8 text-center flex flex-col items-center gap-2">
    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    <p>Loading Accounting Overview...</p>
  </div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Accounting Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Cash on Hand" value={stats.cashBalance} icon={Wallet} color="text-green-600" />
        <StatCard title="Accounts Receivable" value={stats.totalReceivables} icon={ArrowUpRight} color="text-blue-600" />
        <StatCard title="Accounts Payable" value={stats.totalPayables} icon={ArrowDownRight} color="text-red-600" />
        <StatCard title="Net Income (Period)" value={stats.netIncome} icon={FileText} color="text-purple-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Journal Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">No recent entries</TableCell>
                  </TableRow>
                ) : (
                  entries.slice(0, 5).map((entry: JournalEntry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{new Date(entry.date).toLocaleDateString('en-PH')}</TableCell>
                      <TableCell className="font-medium">{entry.description}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{entry.reference || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <Button variant="link" className="mt-2 w-full text-xs" onClick={() => window.location.href='/accounting/journal'}>
              View All Entries
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Button variant="outline" className="h-24 flex flex-col gap-2" onClick={() => window.location.href='/accounting/journal/new'}>
              <FileText className="w-6 h-6" />
              <span>New Journal Entry</span>
            </Button>
            <Button variant="outline" className="h-24 flex flex-col gap-2" onClick={() => window.location.href='/accounting/coa'}>
              <Wallet className="w-6 h-6" />
              <span>Chart of Accounts</span>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: { title: string; value: number; icon: React.ElementType; color: string }) {
  return (
    <Card>

      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className={`text-2xl font-bold ${color}`}>₱{value.toLocaleString()}</p>
        </div>
        <div className={`p-3 rounded-full bg-muted`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
      </CardContent>
    </Card>
  );
}

// Remove the trailing import note
