/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, Scale, FileText, Search } from 'lucide-react';

interface JournalLine {
  accountId: string;
  accountName: string;
  debit: number;
  credit: number;
  memo: string;
}

export default function JournalPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewEntry, setViewEntry] = useState<any>(null);
  const [search, setSearch] = useState('');

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    reference: '',
    lines: [
      { accountId: '', accountName: '', debit: 0, credit: 0, memo: '' },
      { accountId: '', accountName: '', debit: 0, credit: 0, memo: '' },
    ],
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [entriesRes, accountsRes] = await Promise.all([
        fetch('/api/accounting/journal'),
        fetch('/api/accounting/accounts'),
      ]);
      const entriesData = await entriesRes.json();
      const accountsData = await accountsRes.json();
      setEntries(entriesData);
      setAccounts(accountsData);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, { accountId: '', accountName: '', debit: 0, credit: 0, memo: '' }],
    });
  };

  const removeLine = (index: number) => {
    const newLines = formData.lines.filter((_, i) => i !== index);
    setFormData({ ...formData, lines: newLines });
  };

  const updateLine = (index: number, field: keyof JournalLine, value: string | number) => {
    const newLines = [...formData.lines];
    newLines[index] = { ...newLines[index], [field]: value };

    // Update account name if accountId changed
    if (field === 'accountId') {
      const account = accounts.find(a => a.id === value);
      newLines[index].accountName = account ? account.name : '';
    }

    setFormData({ ...formData, lines: newLines });
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/accounting/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setIsDialogOpen(false);
        setFormData({
          date: new Date().toISOString().split('T')[0],
          description: '',
          reference: '',
          lines: [
            { accountId: '', accountName: '', debit: 0, credit: 0, memo: '' },
            { accountId: '', accountName: '', debit: 0, credit: 0, memo: '' },
          ],
        });
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to post journal entry');
      }
    } catch (err) {
      console.error('Error posting entry:', err);
    }
  }

  const totalDebit = formData.lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  const totalCredit = formData.lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const filteredEntries = entries.filter(entry =>
    entry.description.toLowerCase().includes(search.toLowerCase()) ||
    entry.reference?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Journal Entries</h1>
          <p className="text-muted-foreground">Record and manage your double-entry transactions</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              New Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Post Journal Entry</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6 pt-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Description</Label>
                  <Input placeholder="Reason for transaction" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Reference #</Label>
                  <Input placeholder="Invoice # or Bill #" value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Balance Check</Label>
                  <div className={`flex items-center gap-2 p-2 rounded-md border ${isBalanced ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                    <Scale className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      {isBalanced ? 'Balanced' : `Out of Balance: ₱${(totalDebit - totalCredit).toFixed(2)}`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-base font-semibold">Transaction Lines</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addLine} className="flex items-center gap-2">
                    <Plus className="w-3 h-3" /> Add Line
                  </Button>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-1/3">Account</TableHead>
                        <TableHead>Debit</TableHead>
                        <TableHead>Credit</TableHead>
                        <TableHead>Memo</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.lines.map((line, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <select
                              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                              value={line.accountId}
                              onChange={e => updateLine(index, 'accountId', e.target.value)}
                              required
                            >
                              <option value="">Select Account...</option>
                              {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                              ))}
                            </select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={line.debit}
                              onChange={e => updateLine(index, 'debit', parseFloat(e.target.value) || 0)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={line.credit}
                              onChange={e => updateLine(index, 'credit', parseFloat(e.target.value) || 0)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              placeholder="Optional note"
                              value={line.memo}
                              onChange={e => updateLine(index, 'memo', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => removeLine(index)} disabled={formData.lines.length <= 2}>
                              <Trash2 className="w-4 h-4 text-muted-foreground" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={!isBalanced}>Post Transaction</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>View Journal Entry</DialogTitle>
          </DialogHeader>
          {viewEntry && (
            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-3 gap-4 bg-muted/50 p-4 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">{new Date(viewEntry.date).toLocaleDateString()}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="font-medium">{viewEntry.description}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Reference #</p>
                  <p className="font-medium">{viewEntry.reference || 'N/A'}</p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Memo</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewEntry.lines.map((line: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{line.account?.name || 'Unknown Account'} {line.account?.code ? `(${line.account.code})` : ''}</TableCell>
                        <TableCell>{line.memo || '-'}</TableCell>
                        <TableCell className="text-right">{line.debit > 0 ? `₱${line.debit.toLocaleString()}` : '-'}</TableCell>
                        <TableCell className="text-right">{line.credit > 0 ? `₱${line.credit.toLocaleString()}` : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end gap-12 px-4 py-2 bg-muted/20 rounded-md font-semibold">
                <span>Total:</span>
                <span className="w-24 text-right">₱{viewEntry.lines.reduce((sum: number, l: any) => sum + l.debit, 0).toLocaleString()}</span>
                <span className="w-24 text-right">₱{viewEntry.lines.reduce((sum: number, l: any) => sum + l.credit, 0).toLocaleString()}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsViewDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Journal History</CardTitle>
          <div className="relative w-72">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by description or ref..."
              className="pl-8"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Total Debit/Credit</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">Loading entries...</TableCell>
                </TableRow>
              ) : filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No journal entries found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredEntries.map(entry => {
                  const total = entry.lines.reduce((sum: number, l: any) => sum + l.debit, 0);
                  return (
                    <TableRow key={entry.id}>
                      <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-mono text-sm">{entry.reference || '-'}</TableCell>
                      <TableCell>{entry.description}</TableCell>
                      <TableCell className="text-right font-medium">₱{total.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="flex items-center gap-2"
                          onClick={() => {
                            setViewEntry(entry);
                            setIsViewDialogOpen(true);
                          }}
                        >
                          <FileText className="w-4 h-4" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
