/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, Scale, FileText, Search, Edit } from 'lucide-react';
import { useBranch } from '@/lib/branch-context';
import { BranchSelector } from '@/components/branch-selector';

interface JournalLine {
  accountId: string;
  accountName: string;
  subsidiaryLedgerId: string;
  debit: number | string;
  credit: number | string;
  memo: string;
}

export default function JournalPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [subsidiaryLedgers, setSubsidiaryLedgers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewEntry, setViewEntry] = useState<any>(null);
  const [search, setSearch] = useState('');

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    reference: '',
    lines: [
      { accountId: '', accountName: '', subsidiaryLedgerId: '', debit: '', credit: '', memo: '' },
      { accountId: '', accountName: '', subsidiaryLedgerId: '', debit: '', credit: '', memo: '' },
    ],
  });
  const { selectedBranch } = useBranch();

  useEffect(() => {
    fetchData();
  }, [selectedBranch]);

  async function fetchData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBranch) params.set('branchId', selectedBranch.id);

      const [entriesRes, accountsRes, subsidiaryRes] = await Promise.all([
        fetch(`/api/accounting/journal?${params}`),
        fetch(`/api/accounting/accounts?${params}`),
        fetch(`/api/accounting/subsidiary-ledgers?${params}`),
      ]);
      const entriesData = await entriesRes.json();
      const accountsData = await accountsRes.json();
      const subsidiaryData = await subsidiaryRes.json();
      setEntries(entriesData);
      setAccounts(accountsData);
      setSubsidiaryLedgers(subsidiaryData);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, { accountId: '', accountName: '', subsidiaryLedgerId: '', debit: '', credit: '', memo: '' }],
    });
  };

  const removeLine = (index: number) => {
    const newLines = formData.lines.filter((_, i) => i !== index);
    setFormData({ ...formData, lines: newLines });
  };

  const updateLine = (index: number, field: keyof JournalLine, value: any) => {
    const newLines = [...formData.lines];
    newLines[index] = { ...newLines[index], [field]: value };

    // Update account name if accountId changed
    if (field === 'accountId') {
      const account = accounts.find(a => a.id === value);
      newLines[index].accountName = account ? account.name : '';
      // Clear subsidiary if account doesn't have it
      if (!account?.hasSubsidiaryLedger) {
        newLines[index].subsidiaryLedgerId = '';
      }
    }

    setFormData({ ...formData, lines: newLines });
    };

    const handleEdit = (entry: any) => {
    setEditingId(entry.id);
    setFormData({
      date: new Date(entry.date).toISOString().split('T')[0],
      description: entry.description,
      reference: entry.reference || '',
      lines: entry.lines.map((l: any) => ({
        accountId: l.accountId,
        accountName: l.account?.name || '',
        subsidiaryLedgerId: l.subsidiaryLedgerId || '',
        debit: l.debit || '',
        credit: l.credit || '',
        memo: l.memo || '',
      })),
    });
    setIsDialogOpen(true);
    };

    async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const hasDebitOrCredit = formData.lines.some(l => l.debit || l.credit);
    if (!hasDebitOrCredit) {
      alert('Please enter at least one debit or credit amount');
      return;
    }

    try {
      const url = '/api/accounting/journal';
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId ? { ...formData, id: editingId, branchId: selectedBranch?.id } : { ...formData, branchId: selectedBranch?.id };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setIsDialogOpen(false);
        setEditingId(null);
        setFormData({
          date: new Date().toISOString().split('T')[0],
          description: '',
          reference: '',
          lines: [
            { accountId: '', accountName: '', subsidiaryLedgerId: '', debit: '', credit: '', memo: '' },
            { accountId: '', accountName: '', subsidiaryLedgerId: '', debit: '', credit: '', memo: '' },
          ],
        });
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || `Failed to ${editingId ? 'update' : 'post'} journal entry`);
      }
    } catch (err) {
      console.error('Error processing entry:', err);
    }
    }


  const totalDebit = formData.lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  const totalCredit = formData.lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;
  const hasAnyValue = formData.lines.some(l => l.debit || l.credit);

  const filteredEntries = Array.isArray(entries) ? entries.filter(entry =>
    (entry.description?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (entry.reference?.toLowerCase() || '').includes(search.toLowerCase())
  ) : [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Journal Entries</h1>
          <p className="text-muted-foreground">Record and manage your double-entry transactions</p>
        </div>
        <div className="flex items-center gap-2">
          <BranchSelector />
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingId(null);
            setFormData({
              date: new Date().toISOString().split('T')[0],
              description: '',
              reference: '',
              lines: [
                { accountId: '', accountName: '', subsidiaryLedgerId: '', debit: '', credit: '', memo: '' },
                { accountId: '', accountName: '', subsidiaryLedgerId: '', debit: '', credit: '', memo: '' },
              ],
            });
          }
        }}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2" onClick={() => setEditingId(null)}>
              <Plus className="w-4 h-4" />
              New Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-6xl">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Journal Entry' : 'Post Journal Entry'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6 pt-4 text-lg">
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-base">Date</Label>
                  <Input type="date" className="h-11 text-base" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label className="text-base">Description</Label>
                  <Input placeholder="Reason for transaction" className="h-11 text-base" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-base">Reference #</Label>
                  <Input placeholder="Invoice # or Bill #" className="h-11 text-base" value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label className="text-base">Balance Check</Label>
                  <div className={`flex items-center gap-2 p-2.5 rounded-md border ${isBalanced ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                    <Scale className="w-5 h-5" />
                    <span className="text-base font-bold">
                      {isBalanced ? 'Balanced' : `Out of Balance: ₱${(totalDebit - totalCredit).toFixed(2)}`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-lg font-bold">Transaction Lines</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addLine} className="flex items-center gap-2 h-10 px-4">
                    <Plus className="w-4 h-4" /> Add Line
                  </Button>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-[300px] text-base font-bold">Account</TableHead>
                        <TableHead className="w-[280px] text-base font-bold">Subsidiary</TableHead>
                        <TableHead className="w-[160px] text-base font-bold">Debit</TableHead>
                        <TableHead className="w-[160px] text-base font-bold">Credit</TableHead>
                        <TableHead className="text-base font-bold">Memo</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.lines.map((line, index) => {
                        const selectedAccount = accounts.find(a => a.id === line.accountId);
                        const filteredSubsidiaries = subsidiaryLedgers.filter(sl => 
                          sl.accountId === line.accountId || (selectedAccount?.subsidiaryType && sl.entityType === selectedAccount.subsidiaryType)
                        );

                        return (
                          <TableRow key={index} className="hover:bg-muted/30">
                            <TableCell>
                              <select
                                className="w-full h-11 rounded-md border border-input bg-background px-3 py-1 text-base focus:ring-2 focus:ring-primary"
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
                              {selectedAccount?.hasSubsidiaryLedger ? (
                                <select
                                  className="w-full h-11 rounded-md border border-input bg-background px-3 py-1 text-base focus:ring-2 focus:ring-primary"
                                  value={line.subsidiaryLedgerId}
                                  onChange={e => updateLine(index, 'subsidiaryLedgerId', e.target.value)}
                                  required
                                >
                                  <option value="">Select Subsidiary...</option>
                                  {filteredSubsidiaries.map(sl => (
                                    <option key={sl.id} value={sl.id}>{sl.entityCode} - {sl.entityName}</option>
                                  ))}
                                </select>
                              ) : (
                                <div className="text-sm text-muted-foreground px-3 italic">Not required</div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                className="h-11 text-base font-semibold text-primary"
                                value={line.debit}
                                onChange={e => updateLine(index, 'debit', e.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                className="h-11 text-base font-semibold text-primary"
                                value={line.credit}
                                onChange={e => updateLine(index, 'credit', e.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                placeholder="Optional note"
                                className="h-11 text-base"
                                value={line.memo}
                                onChange={e => updateLine(index, 'memo', e.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => removeLine(index)} disabled={formData.lines.length <= 2}>
                                <Trash2 className="w-5 h-5 text-muted-foreground hover:text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <DialogFooter className="gap-4">
                <Button variant="outline" className="h-11 px-8 text-base" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" className="h-11 px-8 text-base font-bold" disabled={!isBalanced || !hasAnyValue}>
                  {editingId ? 'Update Transaction' : 'Post Transaction'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      </div>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">View Journal Entry</DialogTitle>
          </DialogHeader>
          {viewEntry && (
            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-3 gap-6 bg-muted/50 p-6 rounded-lg">
                <div>
                  <p className="text-base text-muted-foreground mb-1">Date</p>
                  <p className="text-lg font-bold">{new Date(viewEntry.date).toLocaleDateString()}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-base text-muted-foreground mb-1">Description</p>
                  <p className="text-lg font-bold">{viewEntry.description}</p>
                </div>
                <div>
                  <p className="text-base text-muted-foreground mb-1">Reference #</p>
                  <p className="text-lg font-bold font-mono">{viewEntry.reference || 'N/A'}</p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="text-base font-bold">Account</TableHead>
                      <TableHead className="text-base font-bold">Subsidiary</TableHead>
                      <TableHead className="text-base font-bold">Memo</TableHead>
                      <TableHead className="text-right text-base font-bold">Debit</TableHead>
                      <TableHead className="text-right text-base font-bold">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(viewEntry.lines || []).map((line: any, idx: number) => (
                      <TableRow key={idx} className="hover:bg-muted/10">
                        <TableCell className="font-bold text-base py-4">
                          {line.account?.name || 'Unknown Account'} {line.account?.code ? `(${line.account.code})` : ''}
                        </TableCell>
                        <TableCell>
                          {line.subsidiaryLedger ? (
                            <div className="text-base">
                              <span className="font-bold text-primary">{line.subsidiaryLedger.entityName}</span>
                              <span className="text-muted-foreground ml-1 text-sm">({line.subsidiaryLedger.entityCode})</span>
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-base">{line.memo || '-'}</TableCell>
                        <TableCell className="text-right text-lg font-bold text-primary">{line.debit > 0 ? `₱${line.debit.toLocaleString()}` : '-'}</TableCell>
                        <TableCell className="text-right text-lg font-bold text-primary">{line.credit > 0 ? `₱${line.credit.toLocaleString()}` : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end gap-12 px-6 py-4 bg-muted/20 rounded-md font-bold text-xl">
                <span>Total:</span>
                <span className="w-32 text-right">₱{(viewEntry.lines || []).reduce((sum: number, l: any) => sum + (l.debit || 0), 0).toLocaleString()}</span>
                <span className="w-32 text-right">₱{(viewEntry.lines || []).reduce((sum: number, l: any) => sum + (l.credit || 0), 0).toLocaleString()}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button className="h-11 px-8 text-base font-bold" onClick={() => setIsViewDialogOpen(false)}>Close</Button>
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
                  const total = (entry.lines || []).reduce((sum: number, l: any) => sum + (l.debit || 0), 0);
                  return (
                    <TableRow key={entry.id}>
                      <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-mono text-sm">{entry.reference || '-'}</TableCell>
                      <TableCell>{entry.description}</TableCell>
                      <TableCell className="text-right font-medium">₱{total.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
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
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                            onClick={() => handleEdit(entry)}
                          >
                            <Edit className="w-4 h-4" /> Edit
                          </Button>
                        </div>
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
