'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, Filter, Trash2, Save, Edit,
  Calendar as CalendarIcon,
  User, FileText, Eye, Download
} from 'lucide-react';
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { useBranch } from '@/lib/branch-context';
import { BranchSelector } from '@/components/branch-selector';

interface ExpenseItem {
  id?: string;
  description: string;
  amount: number;
  accountId: string;
}

interface Expense {
  id: string;
  expenseNumber: string;
  date: string;
  payee: string;
  description: string;
  status: string;
  totalAmount: number;
  items: ExpenseItem[];
  branchId?: string;
  branch?: { id: string; name: string };
  journalEntryId?: string;
  journalEntry?: {
    id: string;
    lines: Array<{
      id: string;
      accountId: string;
      debit: number;
      credit: number;
      memo?: string;
      account?: { id: string; code: string; name: string };
    }>;
  };
}

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

export default function ExpensesPage() {
  const { selectedBranch, branches } = useBranch();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cashAccounts, setCashAccounts] = useState<Account[]>([]);
  const [apAccounts, setApAccounts] = useState<Account[]>([]);
  const [vendors, setVendors] = useState<{ id: string; entityName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Details Modal State
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Subsidiary Ledgers (for AP)
  const [subsidiaryLedgers, setSubsidiaryLedgers] = useState<{ id: string; entityCode: string; entityName: string; accountId: string; entityType: string }[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    payee: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    cashAccountId: '',
    apAccountId: '',
    subsidiaryLedgerId: '',
    isVatInclusive: false,
    noInputVat: false,
    ewtAccountId: '',
    ewtPercentage: '',
    branchId: '',
    items: [{ description: '', amount: 0, accountId: '' }]
  });

  // Edit Mode State
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Export State
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportLimit, setExportLimit] = useState(200);
  const [exporting, setExporting] = useState(false);

  // Delete Confirmation State
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchInitialData = useCallback(async () => {
    try {
      const [accRes, vendorsRes, subsRes] = await Promise.all([
        fetch('/api/accounting/accounts').then(res => res.json()),
        fetch('/api/accounting/vendors').then(res => res.json()),
        fetch('/api/accounting/subsidiary-ledgers').then(res => res.json()),
      ]);

      const allAccounts = accRes;
      setVendors(Array.isArray(vendorsRes) ? vendorsRes : []);
      setAccounts(allAccounts.filter((a: Account) => a.type === 'EXPENSE'));
      setSubsidiaryLedgers(Array.isArray(subsRes) ? subsRes : []);

      // Typically Cash/Bank accounts are ASSET type
      const cashAccs = allAccounts.filter((a: Account) => a.type === 'ASSET' && (a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank')));
      setCashAccounts(cashAccs);

      // AP accounts - Liability accounts with subsidiary ledger (code starting with 21)
      const apAccs = allAccounts.filter((a: Account) => a.type === 'LIABILITY' && (a.code?.startsWith('21') || a.name.toLowerCase().includes('payable')));
      setApAccounts(apAccs);

      if (cashAccs.length > 0) {
        setFormData(prev => ({ ...prev, cashAccountId: cashAccs[0].id }));
      }
    } catch {
      console.error('Error fetching initial data');
    }
  }, []);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (selectedBranch) params.append('branchId', selectedBranch.id);

      const res = await fetch(`/api/accounting/expenses?${params.toString()}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setExpenses(data);
      } else {
        setExpenses([]);
        toast.error('Failed to load expenses');
      }
    } catch {
      setExpenses([]);
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, selectedBranch]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const handleExport = async (limit: number | 'all') => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (selectedBranch) params.append('branchId', selectedBranch.id);

      const res = await fetch(`/api/accounting/expenses?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data)) {
        toast.error('Failed to export expenses');
        return;
      }

      const capped = limit === 'all' ? data : data.slice(0, limit);

      const rows: Record<string, string | number>[] = [];
      for (const exp of capped) {
        const description = `${exp.expenseNumber} - ${exp.payee}${exp.description ? `: ${exp.description}` : ''}`;
        const lines = exp.journalEntry?.lines || [];
        if (lines.length > 0) {
          for (const line of lines) {
            rows.push({
              Date: new Date(exp.date).toLocaleDateString(),
              Reference: exp.expenseNumber,
              Description: description,
              Branch: exp.branch?.name || '',
              'Account Code': line.account?.code || '',
              'Account Name': line.account?.name || '',
              Subsidiary: '',
              Memo: line.memo || '',
              Debit: Number(line.debit) || 0,
              Credit: Number(line.credit) || 0,
            });
          }
        } else {
          for (const item of exp.items || []) {
            rows.push({
              Date: new Date(exp.date).toLocaleDateString(),
              Reference: exp.expenseNumber,
              Description: description,
              Branch: exp.branch?.name || '',
              'Account Code': '',
              'Account Name': '',
              Subsidiary: '',
              Memo: item.description || '',
              Debit: Number(item.amount) || 0,
              Credit: 0,
            });
          }
        }
      }

      const totalDebit = rows.reduce((sum, r) => sum + (Number(r.Debit) || 0), 0);
      const totalCredit = rows.reduce((sum, r) => sum + (Number(r.Credit) || 0), 0);
      rows.push({
        Date: '',
        Reference: '',
        Description: 'TOTAL',
        Branch: '',
        'Account Code': '',
        'Account Name': '',
        Subsidiary: '',
        Memo: '',
        Debit: totalDebit,
        Credit: totalCredit,
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 12 }, { wch: 14 }, { wch: 40 }, { wch: 16 },
        { wch: 14 }, { wch: 30 }, { wch: 24 }, { wch: 24 },
        { wch: 14 }, { wch: 14 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
      XLSX.writeFile(wb, `expense-export-${new Date().toISOString().split('T')[0]}.xlsx`);
      setIsExportDialogOpen(false);
    } catch {
      console.error('Error exporting expenses');
      toast.error('Failed to export expenses');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses, selectedBranch]);

  useEffect(() => {
    if (isDialogOpen && selectedBranch) {
      setFormData(prev => ({ ...prev, branchId: selectedBranch.id }));
    }
  }, [isDialogOpen, selectedBranch]);

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { description: '', amount: 0, accountId: '' }]
    }));
  };

  const removeItem = (index: number) => {
    if (formData.items.length === 1) return;
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateItem = (index: number, field: keyof ExpenseItem, value: string | number) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, items: newItems };
    });
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + item.amount, 0);
  };

  const netOfVat = formData.isVatInclusive ? calculateTotal() / 1.12 : calculateTotal();
  const ewtPercent = parseFloat(formData.ewtPercentage) || 0;
  const ewtAmount = netOfVat * (ewtPercent / 100);
  const vatAmount = formData.isVatInclusive ? calculateTotal() - netOfVat : calculateTotal() * 0.12;

  const openEdit = (expense: Expense) => {
    setEditingExpense(expense);

    // Extract cash account, VAT, EWT, AP, and subsidiary settings from journal entry lines
    let cashAccountId = cashAccounts[0]?.id || ''
    let ewtAccountId = ''
    let ewtPercentage = ''
    let isVatInclusive = false
    let noInputVat = true
    let apAccountId = ''
    let subsidiaryLedgerId = ''
    const itemSum = expense.items.reduce((s, i) => s + i.amount, 0)

    if (expense.journalEntry?.lines) {
      const lines = expense.journalEntry.lines
      const creditLines = lines.filter(l => l.credit > 0)

      // Find AP line (account code starting with 21 - Accounts Payable)
      const apLine = creditLines.find(l => l.account?.code?.startsWith('21'))
      if (apLine) {
        apAccountId = apLine.accountId
        // Extract subsidiary from the AP line
        const apJournalLine = lines.find(l => l.accountId === apLine.accountId && (l as { subsidiaryLedgerId?: string }).subsidiaryLedgerId)
        if (apJournalLine) {
          subsidiaryLedgerId = (apJournalLine as { subsidiaryLedgerId?: string }).subsidiaryLedgerId || ''
        }
      }

      // Find EWT lines (account code starting with 234)
      const ewtLine = creditLines.find(l => l.account?.code?.startsWith('234'))
      if (ewtLine) {
        ewtAccountId = ewtLine.accountId
        const ewtRate = itemSum > 0 ? (ewtLine.credit / itemSum) * 100 : 0
        ewtPercentage = ewtRate > 0 ? ewtRate.toFixed(2) : ''
      }

      // Find cash account (the largest non-EWT, non-AP credit line)
      const nonEwtApCredit = creditLines.find(l => !l.account?.code?.startsWith('234') && !l.account?.code?.startsWith('21'))
      if (nonEwtApCredit) {
        cashAccountId = nonEwtApCredit.accountId
      }

      // Check if Input VAT line exists
      const vatLine = lines.find(l => l.account?.code === '2320' && l.debit > 0)
      if (vatLine) {
        noInputVat = false
        // If Input VAT was recorded, check if items are VAT-inclusive
        if (itemSum > 0) {
          const vatRate = vatLine.debit / itemSum
          isVatInclusive = vatRate < 0.12 && vatRate > 0
        }
      }
    }

    setFormData({
      payee: expense.payee,
      date: new Date(expense.date).toISOString().split('T')[0],
      description: expense.description || '',
      cashAccountId,
      apAccountId,
      subsidiaryLedgerId,
      isVatInclusive,
      noInputVat,
      ewtAccountId,
      ewtPercentage,
      branchId: expense.branchId || selectedBranch?.id || '',
      items: expense.items.map(item => ({
        description: item.description,
        amount: item.amount,
        accountId: item.accountId
      }))
    });
    setIsEditDialogOpen(true);
  };

  async function handleUpdate() {
    if (!editingExpense) return;
    if (!formData.payee || (!formData.cashAccountId && !formData.apAccountId)) {
      toast.error('Please provide payee and payment account');
      return;
    }

    if (formData.apAccountId && !formData.subsidiaryLedgerId) {
      toast.error('Please select a subsidiary (vendor) when using Accounts Payable');
      return;
    }

    if (formData.items.some(item => !item.accountId || item.amount <= 0)) {
      toast.error('Please provide valid account and amount for all items');
      return;
    }

    try {
      const res = await fetch('/api/accounting/expenses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
          id: editingExpense.id,
          ...formData,
          totalAmount: calculateTotal(),
          netAmount: netOfVat,
          vatAmount,
          ewtAmount,
          branchId: formData.branchId || selectedBranch?.id || '',
          cashAccountId: formData.apAccountId ? '' : formData.cashAccountId,
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to update expense');
      }

      toast.success('Expense updated successfully');
      setIsEditDialogOpen(false);
      setEditingExpense(null);
      setFormData({
        payee: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        cashAccountId: cashAccounts[0]?.id || '',
        apAccountId: '',
        subsidiaryLedgerId: '',
        isVatInclusive: false,
        noInputVat: false,
        ewtAccountId: '',
        ewtPercentage: '',
        branchId: selectedBranch?.id || '',
        items: [{ description: '', amount: 0, accountId: '' }]
      });
      fetchExpenses();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An error occurred while updating');
    }
  }

  async function handleSubmit() {
    if (!formData.payee || (!formData.cashAccountId && !formData.apAccountId)) {
      toast.error('Please provide payee and payment account');
      return;
    }

    if (formData.apAccountId && !formData.subsidiaryLedgerId) {
      toast.error('Please select a subsidiary (vendor) when using Accounts Payable');
      return;
    }

    if (formData.items.some(item => !item.accountId || item.amount <= 0)) {
      toast.error('Please provide valid account and amount for all items');
      return;
    }

    try {
      const res = await fetch('/api/accounting/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
          ...formData,
          totalAmount: calculateTotal(),
          netAmount: netOfVat,
          vatAmount,
          ewtAmount,
          branchId: formData.branchId || selectedBranch?.id || '',
          cashAccountId: formData.apAccountId ? '' : formData.cashAccountId,
        })
      });

      if (!res.ok) throw new Error('Failed to create expense');

      toast.success('Expense recorded successfully');
      setIsDialogOpen(false);
      setFormData({
        payee: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        cashAccountId: cashAccounts[0]?.id || '',
        apAccountId: '',
        subsidiaryLedgerId: '',
        isVatInclusive: false,
        noInputVat: false,
        ewtAccountId: '',
        ewtPercentage: '',
        branchId: selectedBranch?.id || '',
        items: [{ description: '', amount: 0, accountId: '' }]
      });
      fetchExpenses();
    } catch {
      toast.error('An error occurred while saving');
    }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    try {
      const res = await fetch('/api/accounting/expenses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus })
      });

      if (!res.ok) throw new Error('Failed to update status');

      toast.success(`Expense marked as ${newStatus}`);
      fetchExpenses();
    } catch {
      toast.error('An error occurred while updating status');
    }
  }

  const openDetails = (expense: Expense) => {
    setSelectedExpense(expense);
    setIsDetailsOpen(true);
  };

  async function handleDelete() {
    if (!expenseToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/accounting/expenses?id=${expenseToDelete.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete expense');
      }

      toast.success('Expense and linked journal entry deleted');
      setExpenseToDelete(null);
      fetchExpenses();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An error occurred while deleting');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground">Manage and track operational expenses</p>
        </div>
        <div className="flex items-center gap-4">
          <BranchSelector />
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> New Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record New Expense</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>Payee</Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input
                    list="payee-options"
                    className="pl-9"
                    placeholder="Vendor or person name"
                    value={formData.payee}
                    onChange={e => setFormData({...formData, payee: e.target.value})}
                  />
                  <datalist id="payee-options">
                    {vendors.map(v => (
                      <option key={v.id} value={v.entityName} />
                    ))}
                    {Array.from(new Set(expenses.map(e => e.payee)))
                      .filter(p => !vendors.some(v => v.entityName === p))
                      .map((p, i) => (
                        <option key={`exp-${i}`} value={p} />
                    ))}
                  </datalist>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="date"
                    className="pl-9"
                    value={formData.date}
                    onChange={e => setFormData({...formData, date: e.target.value})}
                  />
                </div>
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Details about this expense..."
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Payment Account (Credit)</Label>
                <Select
                  value={formData.apAccountId ? '' : formData.cashAccountId}
                  onValueChange={val => setFormData({...formData, cashAccountId: val, apAccountId: '', subsidiaryLedgerId: ''})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Cash/Bank account" />
                  </SelectTrigger>
                  <SelectContent>
                    {cashAccounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Accounts Payable (Optional)</Label>
                <Select
                  value={formData.apAccountId}
                  onValueChange={val => setFormData({...formData, apAccountId: val, subsidiaryLedgerId: '', cashAccountId: val ? '' : cashAccounts[0]?.id || ''})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select AP Account (if on credit)" />
                  </SelectTrigger>
                  <SelectContent>
                    {apAccounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.apAccountId && (
                  <p className="text-xs text-muted-foreground">Credit will go to Accounts Payable instead of Cash/Bank</p>
                )}
              </div>
              {formData.apAccountId && (
                <div className="col-span-2 space-y-2">
                  <Label>Subsidiary (Vendor) *</Label>
                  <Select
                    value={formData.subsidiaryLedgerId}
                    onValueChange={val => setFormData({...formData, subsidiaryLedgerId: val})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Vendor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {subsidiaryLedgers.filter(sl => sl.entityType === 'SUPPLIER').map(sl => (
                        <SelectItem key={sl.id} value={sl.id}>{sl.entityCode} - {sl.entityName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Input VAT Account</Label>
                <select className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={accounts.find(a => a.code === '2320')?.id || ''} disabled>
                  <option value="">Input VAT (2320)</option>
                  {accounts.filter(a => a.code === '2320').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                </select>
              </div>
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isVatInclusive}
                    onChange={e => setFormData(prev => ({ ...prev, isVatInclusive: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm">VAT Inclusive</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.noInputVat}
                    onChange={e => setFormData(prev => ({ ...prev, noInputVat: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm">No Input VAT</span>
                </label>
              </div>
              <div className="space-y-2">
                <Label>EWT Account (2340)</Label>
                <Select
                  value={formData.ewtAccountId}
                  onValueChange={val => setFormData({...formData, ewtAccountId: val})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select EWT Account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.filter(a => a.code.startsWith('234')).sort((a, b) => a.code.localeCompare(b.code)).map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>EWT %</Label>
                <Input type="number" step="0.01" value={formData.ewtPercentage}
                  onChange={e => setFormData({...formData, ewtPercentage: e.target.value})} placeholder="0" />
              </div>
              {branches.length > 0 && (
              <div className="space-y-2">
                <Label>Branch</Label>
                <Input value={branches.find(b => b.id === formData.branchId)?.name || ''} disabled />
              </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-semibold">Expense Items</Label>
                <Button variant="outline" size="sm" onClick={addItem} className="gap-1">
                  <Plus className="w-3 h-3" /> Add Item
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-64">Category (COA)</TableHead>
                      <TableHead className="w-32 text-right">Amount</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formData.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Input
                            placeholder="Item description"
                            value={item.description}
                            onChange={e => updateItem(index, 'description', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={item.accountId}
                            onValueChange={val => updateItem(index, 'accountId', val)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select Category" />
                            </SelectTrigger>
                            <SelectContent>
                              {[...accounts].sort((a, b) => a.name.localeCompare(b.name)).map(acc => (
                                <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>    
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="text-right"
                            value={item.amount || ''}
                            onChange={e => updateItem(index, 'amount', parseFloat(e.target.value) || 0)}        
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(index)}
                            className="text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end items-center gap-4 pt-4">
                <div className="text-right">
                  <span className="text-sm text-muted-foreground">Total Amount:</span>
                  <div className="text-2xl font-bold">₱{calculateTotal().toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                </div>
                <Button onClick={handleSubmit} className="gap-2">
                  <Save className="w-4 h-4" /> Save Expense
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>

        {/* Edit Expense Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Expense: {editingExpense?.expenseNumber}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>Payee</Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input
                    list="payee-options-edit"
                    className="pl-9"
                    placeholder="Vendor or person name"
                    value={formData.payee}
                    onChange={e => setFormData({...formData, payee: e.target.value})}
                  />
                  <datalist id="payee-options-edit">
                    {vendors.map(v => (
                      <option key={v.id} value={v.entityName} />
                    ))}
                    {Array.from(new Set(expenses.map(e => e.payee)))
                      .filter(p => !vendors.some(v => v.entityName === p))
                      .map((p, i) => (
                        <option key={`exp-edit-${i}`} value={p} />
                    ))}
                  </datalist>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="date"
                    className="pl-9"
                    value={formData.date}
                    onChange={e => setFormData({...formData, date: e.target.value})}
                  />
                </div>
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Details about this expense..."
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Payment Account (Credit)</Label>
                <Select
                  value={formData.apAccountId ? '' : formData.cashAccountId}
                  onValueChange={val => setFormData({...formData, cashAccountId: val, apAccountId: '', subsidiaryLedgerId: ''})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Cash/Bank account" />
                  </SelectTrigger>
                  <SelectContent>
                    {cashAccounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Accounts Payable (Optional)</Label>
                <Select
                  value={formData.apAccountId}
                  onValueChange={val => setFormData({...formData, apAccountId: val, subsidiaryLedgerId: '', cashAccountId: val ? '' : cashAccounts[0]?.id || ''})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select AP Account (if on credit)" />
                  </SelectTrigger>
                  <SelectContent>
                    {apAccounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.apAccountId && (
                  <p className="text-xs text-muted-foreground">Credit will go to Accounts Payable instead of Cash/Bank</p>
                )}
              </div>
              {formData.apAccountId && (
                <div className="col-span-2 space-y-2">
                  <Label>Subsidiary (Vendor) *</Label>
                  <Select
                    value={formData.subsidiaryLedgerId}
                    onValueChange={val => setFormData({...formData, subsidiaryLedgerId: val})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Vendor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {subsidiaryLedgers.filter(sl => sl.entityType === 'SUPPLIER').map(sl => (
                        <SelectItem key={sl.id} value={sl.id}>{sl.entityCode} - {sl.entityName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Input VAT Account</Label>
                <select className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={accounts.find(a => a.code === '2320')?.id || ''} disabled>
                  <option value="">Input VAT (2320)</option>
                  {accounts.filter(a => a.code === '2320').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                </select>
              </div>
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isVatInclusive}
                    onChange={e => setFormData(prev => ({ ...prev, isVatInclusive: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm">VAT Inclusive</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.noInputVat}
                    onChange={e => setFormData(prev => ({ ...prev, noInputVat: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm">No Input VAT</span>
                </label>
              </div>
              <div className="space-y-2">
                <Label>EWT Account (2340)</Label>
                <Select
                  value={formData.ewtAccountId}
                  onValueChange={val => setFormData({...formData, ewtAccountId: val})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select EWT Account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.filter(a => a.code.startsWith('234')).sort((a, b) => a.code.localeCompare(b.code)).map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>EWT %</Label>
                <Input type="number" step="0.01" value={formData.ewtPercentage}
                  onChange={e => setFormData({...formData, ewtPercentage: e.target.value})} placeholder="0" />
              </div>
              {branches.length > 0 && (
              <div className="space-y-2">
                <Label>Branch</Label>
                <Input value={branches.find(b => b.id === formData.branchId)?.name || ''} disabled />
              </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-semibold">Expense Items</Label>
                <Button variant="outline" size="sm" onClick={addItem} className="gap-1">
                  <Plus className="w-3 h-3" /> Add Item
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-64">Category (COA)</TableHead>
                      <TableHead className="w-32 text-right">Amount</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formData.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Input
                            placeholder="Item description"
                            value={item.description}
                            onChange={e => updateItem(index, 'description', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={item.accountId}
                            onValueChange={val => updateItem(index, 'accountId', val)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select Category" />
                            </SelectTrigger>
                            <SelectContent>
                              {[...accounts].sort((a, b) => a.name.localeCompare(b.name)).map(acc => (
                                <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>    
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="text-right"
                            value={item.amount || ''}
                            onChange={e => updateItem(index, 'amount', parseFloat(e.target.value) || 0)}        
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(index)}
                            className="text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end items-center gap-4 pt-4">
                <div className="text-right">
                  <span className="text-sm text-muted-foreground">Total Amount:</span>
                  <div className="text-2xl font-bold">₱{calculateTotal().toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                </div>
                <Button onClick={handleUpdate} className="gap-2">
                  <Save className="w-4 h-4" /> Update Expense
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Expense History</CardTitle>
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2" disabled={exporting}>
                  <Download className="w-4 h-4" />
                  {exporting ? 'Exporting...' : 'Export'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('all')}>
                  Export All
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport(200)}>
                  Export Latest 200
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setExportLimit(200); setIsExportDialogOpen(true); }}>
                  Export Custom...
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search expenses..."
                className="pl-9 w-64"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={setStatusFilter}
            >
              <SelectTrigger className="w-40">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
                <SelectItem value="VOID">Void</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground">Loading expenses...</div>
          ) : expenses.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground space-y-2">    
              <FileText className="w-12 h-12 opacity-20" />
              <p>No expenses found matching your criteria.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Expense #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Payee</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map(exp => (
                    <TableRow key={exp.id}>
                      <TableCell className="font-medium">{exp.expenseNumber}</TableCell>
                      <TableCell>{new Date(exp.date).toLocaleDateString()}</TableCell>
                      <TableCell>{exp.payee}</TableCell>
                      <TableCell className="text-right font-semibold">
                        ₱{exp.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          exp.status === 'PAID' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          exp.status === 'VOID' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          exp.status === 'APPROVED' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        }`}>
                          {exp.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button variant="ghost" size="sm" className="gap-1" onClick={() => openDetails(exp)}>
                            <Eye className="w-3 h-3" /> Details
                          </Button>
                          {exp.status === 'PENDING' && (
                            <Button variant="ghost" size="sm" className="gap-1" onClick={() => openEdit(exp)}>
                              <Edit className="w-3 h-3" /> Edit
                            </Button>
                          )}
                          {exp.status === 'PENDING' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                              onClick={() => handleStatusChange(exp.id, 'APPROVED')}
                            >
                              Approve
                            </Button>
                          )}
                          {exp.status === 'PENDING' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setExpenseToDelete(exp)}
                              title="Delete expense"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expense Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Expense Voucher: {selectedExpense?.expenseNumber}</DialogTitle>
          </DialogHeader>
          {selectedExpense && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Payee</div>
                  <div className="font-medium text-base">{selectedExpense.payee}</div>
                </div>
                <div className="text-right">
                  <div className="text-muted-foreground">Date</div>
                  <div className="font-medium text-base">{new Date(selectedExpense.date).toLocaleDateString()}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-muted-foreground">Description</div>
                  <div className="mt-1">{selectedExpense.description || 'No description provided'}</div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-base font-semibold">Expense Items</Label>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right w-32">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedExpense.items.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{item.description}</TableCell>
                          <TableCell className="text-right font-medium">₱{item.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/20 font-bold">
                        <TableCell>Total Amount</TableCell>
                        <TableCell className="text-right">₱{selectedExpense.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex justify-between items-center text-sm pt-4 border-t">
                <div>
                  <span className="text-muted-foreground mr-2">Status:</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    selectedExpense.status === 'PAID' ? 'bg-green-100 text-green-700' :
                    selectedExpense.status === 'VOID' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {selectedExpense.status}
                  </span>
                </div>
                {selectedExpense.journalEntryId && (
                  <div className="text-muted-foreground italic text-xs">
                    Linked to Journal Entry: {selectedExpense.journalEntryId}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>Close</Button>
            {selectedExpense?.status === 'PENDING' && (
              <Button onClick={() => {
                handleStatusChange(selectedExpense.id, 'APPROVED');
                setIsDetailsOpen(false);
              }}>Approve Expense</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Export Expenses</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-base">Number of expenses to export</Label>
              <Input
                type="number"
                min={1}
                max={10000}
                className="h-11 text-base"
                value={exportLimit}
                onChange={e => setExportLimit(Number(e.target.value))}
              />
              <p className="text-sm text-muted-foreground">
                Exports the most recent {exportLimit || '...'} expenses matching the current filters ({selectedBranch ? selectedBranch.name : 'all branches'}).
              </p>
            </div>
          </div>
          <DialogFooter className="gap-4">
            <Button variant="outline" className="h-11 px-8" onClick={() => setIsExportDialogOpen(false)}>Cancel</Button>
            <Button
              className="h-11 px-8 font-bold"
              disabled={!exportLimit || exportLimit < 1 || exporting}
              onClick={() => handleExport(exportLimit)}
            >
              <Download className="w-4 h-4 mr-2" />
              {exporting ? 'Exporting...' : 'Export'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!expenseToDelete} onOpenChange={(open) => !open && setExpenseToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm">
              Are you sure you want to delete expense <strong>{expenseToDelete?.expenseNumber}</strong> for <strong>{expenseToDelete?.payee}</strong>?
            </p>
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <p className="font-medium text-destructive">This action cannot be undone.</p>
              <p className="text-muted-foreground mt-1">
                This will permanently delete the expense record{expenseToDelete?.journalEntryId ? ' and its linked journal entry (including all journal lines)' : ''}.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setExpenseToDelete(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
