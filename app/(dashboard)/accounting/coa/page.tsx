/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Plus, Search, FolderTree, Pencil, Database, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useBranch } from '@/lib/branch-context';
import { BranchSelector } from '@/components/branch-selector';

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [search, setSearch] = useState('');

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'ASSET',
    parentCode: '',
    description: '',
    normalBalance: 'DEBIT',
    isActive: true,
    hasSubsidiaryLedger: false,
    subsidiaryType: '',
    beginningBalance: 0,
  });
  const { selectedBranch } = useBranch();

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBranch) params.set('branchId', selectedBranch.id);
      const res = await fetch(`/api/accounting/accounts?${params}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setAccounts(data);
      } else {
        setAccounts([]);
      }
    } catch (err) {
      console.error('Error fetching accounts:', err);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [selectedBranch]);

  useEffect(() => {
    fetchAccounts();
  }, [selectedBranch, fetchAccounts]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/accounting/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setCreateDialogOpen(false);
        resetForm();
        fetchAccounts();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create account');
      }
    } catch (err) {
      console.error('Error creating account:', err);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAccount) return;

    try {
      const res = await fetch('/api/accounting/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingAccount.id,
          ...formData,
        }),
      });

      if (res.ok) {
        setEditDialogOpen(false);
        setEditingAccount(null);
        resetForm();
        fetchAccounts();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update account');
      }
    } catch (err) {
      console.error('Error updating account:', err);
    }
  }

  function resetForm() {
    setFormData({
      code: '',
      name: '',
      type: 'ASSET',
      parentCode: '',
      description: '',
      normalBalance: 'DEBIT',
      isActive: true,
      hasSubsidiaryLedger: false,
      subsidiaryType: '',
      beginningBalance: 0,
    });
  }

  function openEditDialog(account: any) {
    setEditingAccount(account);
    setFormData({
      code: account.code,
      name: account.name,
      type: account.type,
      parentCode: account.parentCode || '',
      description: account.description || '',
      normalBalance: account.normalBalance,
      isActive: account.isActive,
      hasSubsidiaryLedger: account.hasSubsidiaryLedger || false,
      subsidiaryType: account.subsidiaryType || '',
      beginningBalance: account.beginningBalance || 0,
    });
    setEditDialogOpen(true);
  }

  function exportToExcel() {
    const data = filteredAccounts.map(acc => ({
      Code: acc.code,
      Name: acc.name,
      Type: acc.type,
      'Normal Balance': acc.normalBalance,
      Balance: acc.balance || 0,
      Status: acc.isActive ? 'Active' : 'Inactive',
      'Subsidiary Ledger': acc.hasSubsidiaryLedger ? 'Yes' : 'No',
      'Subsidiary Type': acc.subsidiaryType || '',
      Description: acc.description || '',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Chart of Accounts');
    XLSX.writeFile(wb, 'chart-of-accounts.xlsx');
  }

  function exportToCSV() {
    const data = filteredAccounts.map(acc => ({
      Code: acc.code,
      Name: acc.name,
      Type: acc.type,
      'Normal Balance': acc.normalBalance,
      Balance: acc.balance || 0,
      Status: acc.isActive ? 'Active' : 'Inactive',
      'Subsidiary Ledger': acc.hasSubsidiaryLedger ? 'Yes' : 'No',
      'Subsidiary Type': acc.subsidiaryType || '',
      Description: acc.description || '',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'chart-of-accounts.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  const filteredAccounts = Array.isArray(accounts) ? accounts.filter(acc =>
    acc.name.toLowerCase().includes(search.toLowerCase()) ||
    acc.code.toLowerCase().includes(search.toLowerCase())
  ) : [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Chart of Accounts</h1>
          <p className="text-muted-foreground">Manage your organization&apos;s financial account structure</p>
        </div>
        <div className="flex items-center gap-2">
          <BranchSelector />
          <Dialog open={isCreateDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Account</DialogTitle>
                <DialogDescription>Add a new account to your Chart of Accounts</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Account Code *</Label>
                    <Input
                      placeholder="e.g. 1000"
                      value={formData.code}
                      onChange={e => setFormData({...formData, code: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Name *</Label>
                    <Input
                      placeholder="e.g. Cash in Bank"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Account Type *</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      value={formData.type}
                      onChange={e => setFormData({...formData, type: e.target.value})}
                      required
                    >
                      <option value="ASSET">Asset</option>
                      <option value="LIABILITY">Liability</option>
                      <option value="EQUITY">Equity</option>
                      <option value="REVENUE">Revenue</option>
                      <option value="EXPENSE">Expense</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Normal Balance *</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      value={formData.normalBalance}
                      onChange={e => setFormData({...formData, normalBalance: e.target.value})}
                      required
                    >
                      <option value="DEBIT">Debit</option>
                      <option value="CREDIT">Credit</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Parent Account Code</Label>
                    <Input
                      placeholder="e.g. 1000"
                      value={formData.parentCode}
                      onChange={e => setFormData({...formData, parentCode: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      value={formData.isActive ? 'true' : 'false'}
                      onChange={e => setFormData({...formData, isActive: e.target.value === 'true'})}
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    placeholder="Optional details about this account"
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Initial Balance (Beginning Balance)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.beginningBalance}
                    onChange={e => setFormData({...formData, beginningBalance: parseFloat(e.target.value) || 0})}
                    disabled={!!editingAccount}
                  />
                  <p className="text-[0.75rem] text-muted-foreground italic">
                    {editingAccount 
                      ? "Initial balance cannot be changed after creation. Use journal entries for adjustments."
                      : "Enter current balance. (Equity accounts use negative for Credit balance)."}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.hasSubsidiaryLedger}
                      onChange={e => setFormData({...formData, hasSubsidiaryLedger: e.target.checked, subsidiaryType: e.target.checked ? formData.subsidiaryType : ''})}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    Has Subsidiary Ledger (Control Account)
                  </Label>
                </div>

                {formData.hasSubsidiaryLedger && (
                  <div className="space-y-2">
                    <Label>Subsidiary Type *</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      value={formData.subsidiaryType}
                      onChange={e => setFormData({...formData, subsidiaryType: e.target.value})}
                    >
                      <option value="">Select type...</option>
                      <option value="CUSTOMER">Customer (Accounts Receivable)</option>
                      <option value="SUPPLIER">Supplier (Accounts Payable)</option>
                      <option value="INVENTORY_ITEM">Inventory Item</option>
                      <option value="ASSET">Fixed Asset</option>
                      <option value="EMPLOYEE">Employee (Receivable/Payable)</option>
                    </select>
                  </div>
                )}

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                  <Button type="submit">Save Account</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Button variant="outline" className="flex items-center gap-2" onClick={exportToExcel}>
            <Download className="w-4 h-4" />
            Export Excel
          </Button>

          <Button variant="outline" className="flex items-center gap-2" onClick={exportToCSV}>
            <Download className="w-4 h-4" />
            Export CSV
          </Button>

          <Dialog open={isEditDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Account</DialogTitle>
                <DialogDescription>Update account details</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleUpdate} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Account Code *</Label>
                    <Input
                      placeholder="e.g. 1000"
                      value={formData.code}
                      onChange={e => setFormData({...formData, code: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Name *</Label>
                    <Input
                      placeholder="e.g. Cash in Bank"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Account Type *</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      value={formData.type}
                      onChange={e => setFormData({...formData, type: e.target.value})}
                      required
                    >
                      <option value="ASSET">Asset</option>
                      <option value="LIABILITY">Liability</option>
                      <option value="EQUITY">Equity</option>
                      <option value="REVENUE">Revenue</option>
                      <option value="EXPENSE">Expense</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Normal Balance *</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      value={formData.normalBalance}
                      onChange={e => setFormData({...formData, normalBalance: e.target.value})}
                      required
                    >
                      <option value="DEBIT">Debit</option>
                      <option value="CREDIT">Credit</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Parent Account Code</Label>
                    <Input
                      placeholder="e.g. 1000"
                      value={formData.parentCode}
                      onChange={e => setFormData({...formData, parentCode: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      value={formData.isActive ? 'true' : 'false'}
                      onChange={e => setFormData({...formData, isActive: e.target.value === 'true'})}
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    placeholder="Optional details about this account"
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Initial Balance (Beginning Balance)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.beginningBalance}
                    onChange={e => setFormData({...formData, beginningBalance: parseFloat(e.target.value) || 0})}
                    disabled={!!editingAccount}
                  />
                  <p className="text-[0.75rem] text-muted-foreground italic">
                    {editingAccount 
                      ? "Initial balance cannot be changed after creation. Use journal entries for adjustments."
                      : "Enter current balance. (Equity accounts use negative for Credit balance)."}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.hasSubsidiaryLedger}
                      onChange={e => setFormData({...formData, hasSubsidiaryLedger: e.target.checked, subsidiaryType: e.target.checked ? formData.subsidiaryType : ''})}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    Has Subsidiary Ledger (Control Account)
                  </Label>
                </div>

                {formData.hasSubsidiaryLedger && (
                  <div className="space-y-2">
                    <Label>Subsidiary Type *</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      value={formData.subsidiaryType}
                      onChange={e => setFormData({...formData, subsidiaryType: e.target.value})}
                    >
                      <option value="">Select type...</option>
                      <option value="CUSTOMER">Customer (Accounts Receivable)</option>
                      <option value="SUPPLIER">Supplier (Accounts Payable)</option>
                      <option value="INVENTORY_ITEM">Inventory Item</option>
                      <option value="ASSET">Fixed Asset</option>
                      <option value="EMPLOYEE">Employee (Receivable/Payable)</option>
                    </select>
                  </div>
                )}

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                  <Button type="submit">Update Account</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Account List</CardTitle>
          <div className="relative w-72">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search accounts..."
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
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Normal Balance</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Subsidiary</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">Loading accounts...</TableCell>
                </TableRow>
              ) : filteredAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No accounts found. Create your first account to begin.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAccounts.map(acc => (
                  <TableRow key={acc.id}>
                    <TableCell className="font-mono font-medium">{acc.code}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {acc.parentCode && <FolderTree className="w-3 h-3 text-muted-foreground" />}
                        {acc.id ? (
                          <Link
                            href={`/accounting/coa/${acc.id}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {acc.name}
                          </Link>
                        ) : (
                          <span className="text-primary font-medium">{acc.name}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="px-2 py-1 rounded-full text-xs bg-slate-100 dark:bg-slate-800 border">
                        {acc.type}
                      </span>
                    </TableCell>
                    <TableCell>{acc.normalBalance}</TableCell>
                    <TableCell className="text-right font-mono">
                      {acc.balance !== undefined && acc.balance !== null ? (
                        <span className={acc.balance < 0 ? 'text-red-600' : ''}>
                          ₱{Math.abs(acc.balance).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          {acc.balance < 0 && ' (Cr)'}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">₱0.00</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {acc.isActive ? (
                        <span className="text-green-600 text-xs font-medium">Active</span>
                      ) : (
                        <span className="text-red-600 text-xs font-medium">Inactive</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {acc.hasSubsidiaryLedger && (
                        <Database className="h-4 w-4 text-blue-600" />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(acc)}
                        className="h-8 w-8 p-0"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
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
