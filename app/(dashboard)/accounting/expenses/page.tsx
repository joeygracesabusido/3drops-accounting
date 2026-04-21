'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus, Search, Filter, Trash2, Save,
  ArrowUpRight, Calendar as CalendarIcon,
  User, FileText
} from 'lucide-react';
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface ExpenseItem {
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
}

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cashAccounts, setCashAccounts] = useState<Account[]>([]);
  const [vendors, setVendors] = useState<{ id: string; entityName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    payee: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    cashAccountId: '',
    items: [{ description: '', amount: 0, accountId: '' }]
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [search, statusFilter]);

  async function fetchInitialData() {
    try {
      const [accRes, vendorsRes] = await Promise.all([
        fetch('/api/accounting/accounts').then(res => res.json()),
        fetch('/api/accounting/vendors').then(res => res.json()),
      ]);

      const allAccounts = accRes;
      setVendors(Array.isArray(vendorsRes) ? vendorsRes : []);
      setAccounts(allAccounts.filter((a: Account) => a.type === 'EXPENSE'));

      // Typically Cash/Bank accounts are ASSET type
      const cashAccs = allAccounts.filter((a: Account) => a.type === 'ASSET' && (a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank')));
      setCashAccounts(cashAccs);

      if (cashAccs.length > 0) {
        setFormData(prev => ({ ...prev, cashAccountId: cashAccs[0].id }));
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
    }
  }

  async function fetchExpenses() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);

      const res = await fetch(`/api/accounting/expenses?${params.toString()}`);
      const data = await res.json();
      setExpenses(data);
    } catch (error) {
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }

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

  async function handleSubmit() {
    if (!formData.payee || !formData.cashAccountId) {
      toast.error('Please provide payee and payment account');
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
          totalAmount: calculateTotal()
        })
      });

      if (!res.ok) throw new Error('Failed to create expense');

      toast.success('Expense recorded successfully');
      setIsDialogOpen(false);
      setFormData({
        payee: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        cashAccountId: '',
        items: [{ description: '', amount: 0, accountId: '' }]
      });
      fetchExpenses();
    } catch (error) {
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
    } catch (error) {
      toast.error('An error occurred while updating status');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground">Manage and track operational expenses</p>
        </div>
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
                  value={formData.cashAccountId}
                  onValueChange={val => setFormData({...formData, cashAccountId: val})}
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
                              {accounts.map(acc => (
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Expense History</CardTitle>
          <div className="flex items-center gap-3">
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
                          <Button variant="ghost" size="sm" className="gap-1 pointer-events-none opacity-50">
                            <ArrowUpRight className="w-3 h-3" /> Details
                          </Button>
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
    </div>
  );
}
