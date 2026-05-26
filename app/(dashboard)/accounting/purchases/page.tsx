/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Plus, Search, Trash2, Edit, DollarSign, History } from 'lucide-react';
import { useBranch } from '@/lib/branch-context';
import { BranchSelector } from '@/components/branch-selector';

interface Vendor {
  id: string;
  entityCode: string;
  entityName: string;
}

export default function PurchasesPage() {
  const { selectedBranch, branches } = useBranch();
  const [bills, setBills] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isVendorsLoading, setIsVendorsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    supplierId: '',
    supplierName: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    expenseAccountId: '',
    apAccountId: '',
    isVatInclusive: false,
    noInputVat: false,
    ewtAccountId: '',
    ewtPercentage: '',
    branchId: '',
    items: [{ description: '', quantity: '1', unitPrice: '0', total: 0 }],
    totalAmount: 0,
  });
  const [payFormData, setPayFormData] = useState({
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    referenceNumber: '',
    notes: '',
    cashAccountId: '',
  });
  const [editingBill, setEditingBill] = useState<any>(null);
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
  const [payingBill, setPayingBill] = useState<any>(null);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [cashAccounts, setCashAccounts] = useState<any[]>([]);
  const [editingPayment, setEditingPayment] = useState<any>(null);
  const [isPaymentEditDialogOpen, setIsPaymentEditDialogOpen] = useState(false);
  const [deleteConfirmPayment, setDeleteConfirmPayment] = useState<any>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const resetForm = () => {
    setFormData({
      supplierId: '', supplierName: '', date: new Date().toISOString().split('T')[0],
      dueDate: new Date().toISOString().split('T')[0], expenseAccountId: '', apAccountId: '',
      isVatInclusive: false, noInputVat: false, ewtAccountId: '', ewtPercentage: '', branchId: selectedBranch?.id || '', items: [{ description: '', quantity: '1', unitPrice: '0', total: 0 }], totalAmount: 0,
    });
    setEditingBill(null);
  }

  useEffect(() => {
    fetchData();
  }, [selectedBranch]);

  useEffect(() => {
    if (isDialogOpen && selectedBranch) {
      setFormData(prev => ({ ...prev, branchId: selectedBranch.id }));
    }
  }, [isDialogOpen, selectedBranch]);

  async function fetchData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBranch) params.append('branchId', selectedBranch.id);
      const [billsRes, accRes] = await Promise.all([
        fetch(`/api/accounting/purchases?${params.toString()}`),
        fetch('/api/accounting/accounts'),
      ]);
      const billsData = billsRes.ok ? await billsRes.json() : [];
      const accountsData = accRes.ok ? await accRes.json() : [];
      
      setBills(Array.isArray(billsData) ? billsData : []);
      setAccounts(Array.isArray(accountsData) ? accountsData : []);
      
      if (Array.isArray(accountsData)) {
        const cashAccts = accountsData
          .filter((a: any) => a.type === 'ASSET' && a.code.startsWith('11'))
          .sort((a: any, b: any) => a.code.localeCompare(b.code));
        setCashAccounts(cashAccts);
      }
    } catch (err) {
      console.error('Error fetching bills:', err);
      setBills([]);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchVendors() {
    setIsVendorsLoading(true);
    try {
      const res = await fetch('/api/accounting/vendors');
      const data = await res.json() as Vendor[];
      if (Array.isArray(data)) {
        setVendors(data);
      } else {
        setVendors([]);
      }
    } catch (err) {
      console.error('Error fetching vendors:', err);
      setVendors([]);
    } finally {
      setIsVendorsLoading(false);
    }
  }

  const filteredVendors = Array.isArray(vendors) ? vendors.filter(v =>
    (v.entityName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.entityCode || '').toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 10) : [];

  function handleSelectVendor(vendor: Vendor) {
    setFormData(prev => ({
      ...prev,
      supplierId: vendor.id,
      supplierName: vendor.entityName,
    }));
    setSearchTerm(vendor.entityName);
    setShowDropdown(false);
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-combobox]')) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: '', quantity: '1', unitPrice: '0', total: 0 }],
    });
  };

  const updateItem = (index: number, field: string, value: unknown) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'quantity' || field === 'unitPrice') {
      const qty = parseFloat(newItems[index].quantity) || 0;
      const price = parseFloat(newItems[index].unitPrice) || 0;
      newItems[index].total = qty * price;
    }

    const newTotal = newItems.reduce((sum, item) => sum + item.total, 0);
    setFormData({ ...formData, items: newItems, totalAmount: newTotal });
  };

  const handleTotalAmountChange = (value: number) => {
    setFormData(prev => ({ ...prev, totalAmount: value }));
  };

  const toggleVatInclusive = () => {
    setFormData(prev => ({ ...prev, isVatInclusive: !prev.isVatInclusive }));
  };

  const removeItem = (index: number) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    const newTotal = newItems.reduce((sum, item) => sum + item.total, 0);
    setFormData({ ...formData, items: newItems, totalAmount: newTotal });
  };

  function handleEditBill(bill: any) {
    if (bill.status !== 'UNPAID') {
      alert('Only unpaid bills can be edited');
      return;
    }
    setEditingBill(bill);

    let expenseAccountId = '';
    let apAccountId = '';
    let ewtAccountId = '';
    let ewtPercentage = '';
    let hasInputVat = false;

    if (bill.journalEntry && bill.journalEntry.lines) {
      for (const line of bill.journalEntry.lines) {
        if (line.debit > 0 && line.account?.type === 'EXPENSE') {
          expenseAccountId = line.accountId;
        }
        if (line.credit > 0 && line.account?.type === 'LIABILITY') {
          apAccountId = line.accountId;
        }
        if (line.credit > 0 && line.account?.code?.startsWith('234')) {
          ewtAccountId = line.accountId;
          // Try to extract percentage from memo like "Bill BILL-2026-5857 EWT (1%)"
          const match = line.memo?.match(/\((\d+(?:\.\d+)?)\%\)/);
          if (match) {
            ewtPercentage = match[1];
          }
        }
        if (line.account?.code === '2320') {
          hasInputVat = true;
        }
      }
      if (!expenseAccountId && bill.journalEntry.lines.length > 0) {
        expenseAccountId = bill.journalEntry.lines.find((l: any) => l.debit > 0)?.accountId || '';
      }
      if (!apAccountId && bill.journalEntry.lines.length > 0) {
        apAccountId = bill.journalEntry.lines.find((l: any) => l.credit > 0)?.accountId || '';
      }
    }

    setFormData({
      supplierId: bill.supplierId,
      supplierName: bill.supplierName,
      date: new Date(bill.date).toISOString().split('T')[0],
      dueDate: new Date(bill.dueDate).toISOString().split('T')[0],
      expenseAccountId,
      apAccountId,
      isVatInclusive: false, // Hard to determine after the fact, default to false
      noInputVat: !hasInputVat,
      ewtAccountId,
      ewtPercentage,
      branchId: selectedBranch?.id || '',
      items: bill.items.map((item: any) => ({
        description: item.description,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
        total: item.total,
      })),
      totalAmount: bill.totalAmount,
    });
    setSearchTerm(bill.supplierName);
    setShowDropdown(false);
    setIsDialogOpen(true);
  }

  async function handleResetBill(bill: any) {
    if (!confirm(`Are you sure you want to reset bill ${bill.billNumber} to UNPAID? This will delete all associated payments.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/accounting/purchases?id=${bill.id}&action=reset`, {
        method: 'PUT',
      });
      if (res.ok) {
        alert('Bill has been reset to UNPAID');
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to reset bill');
      }
    } catch (err) {
      console.error('Error resetting bill:', err);
      alert('Failed to reset bill');
    }
  }

  function handleOpenPayDialog(bill: any) {
    if (bill.status === 'PAID' || bill.status === 'VOID') {
      alert('Cannot pay a settled bill');
      return;
    }
    setPayingBill(bill);
    const remaining = bill.totalAmount - bill.amountPaid;
    setPayFormData({
      amount: remaining.toFixed(2),
      paymentDate: new Date().toISOString().split('T')[0],
      referenceNumber: '',
      notes: '',
      cashAccountId: cashAccounts[0]?.id || '',
    });
    setIsPayDialogOpen(true);
  }

  async function fetchPayments(billId: string) {
    try {
      const res = await fetch(`/api/accounting/payments?billId=${billId}`);
      if (!res.ok) throw new Error(`Failed to fetch payments: ${res.status}`);
      setPayments(await res.json());
    } catch (err) {
      console.error('Error fetching payments:', err);
    }
  }

  async function handlePayBill(e: React.FormEvent) {
    e.preventDefault();
    if (!payingBill) return;
    try {
      const res = await fetch('/api/accounting/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billId: payingBill.id,
          amount: parseFloat(payFormData.amount),
          paymentDate: payFormData.paymentDate,
          referenceNumber: payFormData.referenceNumber,
          notes: payFormData.notes,
          cashAccountId: payFormData.cashAccountId,
          branchId: selectedBranch?.id,
        }),
      });
      if (res.ok) {
        setIsPayDialogOpen(false);
        setPayingBill(null);
        setPayments([]);
        setPayFormData({
          amount: '',
          paymentDate: new Date().toISOString().split('T')[0],
          referenceNumber: '',
          notes: '',
          cashAccountId: cashAccounts[0]?.id || '',
        });
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to record payment');
      }
    } catch (err) {
      console.error('Error paying bill:', err);
    }
  }

  async function handleViewPayments(bill: any) {
    setPayingBill(bill);
    setShowPaymentHistory(true);
    await fetchPayments(bill.id);
  }

  function handleEditPayment(payment: any) {
    if (payment.bill.status === 'PAID' || payment.bill.status === 'VOID') {
      alert('Cannot modify payment for a settled bill');
      return;
    }
    setEditingPayment(payment);
    setPayFormData({
      amount: payment.amount.toString(),
      paymentDate: new Date(payment.paymentDate).toISOString().split('T')[0],
      referenceNumber: payment.referenceNumber || '',
      notes: payment.notes || '',
      cashAccountId: payment.cashAccountId,
    });
    setIsPaymentEditDialogOpen(true);
  }

  async function handleDeletePayment(payment: any) {
    setDeleteConfirmPayment(payment);
    setIsDeleteConfirmOpen(true);
  }

  async function handleConfirmDeletePayment() {
    if (!deleteConfirmPayment) return;
    try {
      const res = await fetch(`/api/accounting/payments?id=${deleteConfirmPayment.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setIsDeleteConfirmOpen(false);
        setDeleteConfirmPayment(null);
        if (showPaymentHistory && payingBill) {
          await fetchPayments(payingBill.id);
          fetchData();
        }
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete payment');
      }
    } catch (err) {
      console.error('Error deleting payment:', err);
    }
  }

  async function handlePaymentEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPayment) return;
    try {
      const res = await fetch(`/api/accounting/payments?id=${editingPayment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(payFormData.amount),
          paymentDate: payFormData.paymentDate,
          referenceNumber: payFormData.referenceNumber,
          notes: payFormData.notes,
          cashAccountId: payFormData.cashAccountId,
          branchId: selectedBranch?.id,
        }),
      });
      if (res.ok) {
        setIsPaymentEditDialogOpen(false);
        setEditingPayment(null);
        setPayFormData({
          amount: '',
          paymentDate: new Date().toISOString().split('T')[0],
          referenceNumber: '',
          notes: '',
          cashAccountId: cashAccounts[0]?.id || '',
        });
        if (showPaymentHistory && payingBill) {
          await fetchPayments(payingBill.id);
          fetchData();
        }
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update payment');
      }
    } catch (err) {
      console.error('Error updating payment:', err);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const url = editingBill
        ? `/api/accounting/purchases?id=${editingBill.id}`
        : '/api/accounting/purchases';
      const method = editingBill ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, branchId: formData.branchId || selectedBranch?.id || '' }),
      });

      if (res.ok) {
        setIsDialogOpen(false);
        resetForm();
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save bill');
      }
    } catch (err) {
      console.error('Error saving bill:', err);
    }
  }

  const filteredBills = bills.filter(bill =>
    (bill.supplierName || '').toLowerCase().includes(search.toLowerCase()) ||
    (bill.billNumber || '').toLowerCase().includes(search.toLowerCase())
  );

  const netOfVat = formData.isVatInclusive ? formData.totalAmount / 1.12 : formData.totalAmount;
  const ewtPercent = parseFloat(formData.ewtPercentage) || 0;
  const ewtAmount = netOfVat * (ewtPercent / 100);

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Purchase Bills</h1>
            <p className="text-muted-foreground">Manage supplier bills and accounts payable</p>
          </div>
          <div className="flex items-center gap-4">
          <BranchSelector />
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
          if (open) {
            setSearchTerm('');
            setShowDropdown(false);
            fetchVendors();
          }
        }}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2"><Plus className="w-4 h-4" /> New Bill</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingBill ? 'Edit Purchase Bill' : 'Create Purchase Bill'}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6 pt-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2 col-span-3">
                  <Label>Supplier</Label>
                  <div className="relative" data-combobox>
                    <Input
                      placeholder="Search vendor by name or code..."
                      value={searchTerm}
                      onChange={e => {
                        setSearchTerm(e.target.value);
                        setShowDropdown(true);
                        setFormData(prev => ({ ...prev, supplierId: '', supplierName: '' }));
                      }}
                      onFocus={() => {
                        if (!isVendorsLoading) setShowDropdown(true);
                      }}
                      className="bg-background"
                    />
                    {showDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {isVendorsLoading ? (
                          <div className="p-3 text-sm text-muted-foreground">Loading vendors...</div>
                        ) : filteredVendors.length === 0 ? (
                          <div className="p-3 text-sm text-muted-foreground">
                            No vendors found. Add vendors from Vendor Management first.
                          </div>
                        ) : (
                          filteredVendors.map(vendor => (
                            <div
                              key={vendor.id}
                              className="p-3 hover:bg-muted cursor-pointer flex items-center gap-2 border-b last:border-b-0"
                              onClick={() => handleSelectVendor(vendor)}
                            >
                              <span className="font-mono text-xs text-muted-foreground shrink-0">{vendor.entityCode}</span>
                              <span className="font-medium truncate">{vendor.entityName}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Bill Date</Label>
                  <Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input type="date" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Total Amount</Label>
                  <Input type="number" value={formData.totalAmount} onChange={e => handleTotalAmountChange(parseFloat(e.target.value) || 0)} className={formData.isVatInclusive ? '' : 'bg-muted'} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Expense Account (Debit)</Label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formData.expenseAccountId} onChange={e => setFormData({...formData, expenseAccountId: e.target.value})} required>
                    <option value="">Select Expense Account...</option>
                    {accounts.filter(a => a.type === 'EXPENSE').sort((a, b) => a.name.localeCompare(b.name)).map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>AP Account (Credit)</Label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formData.apAccountId} onChange={e => setFormData({...formData, apAccountId: e.target.value})} required>
                    <option value="">Select AP Account...</option>
                    {accounts.filter(a => a.type === 'LIABILITY').sort((a, b) => a.name.localeCompare(b.name)).map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                  </select>
                </div>
              </div>
              {branches.length > 0 && (
              <div className="space-y-2 mb-4">
                <Label>Branch</Label>
                <Input value={branches.find(b => b.id === formData.branchId)?.name || ''} disabled />
              </div>
              )}
              <div className="grid grid-cols-2 gap-4">
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
                      onChange={toggleVatInclusive}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-sm">VAT Inclusive (Gross amount includes 12% VAT)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.noInputVat}
                      onChange={(e) => setFormData(prev => ({ ...prev, noInputVat: e.target.checked }))}        
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-sm">No Input VAT</span>
                  </label>
                </div>
              </div>
              {formData.totalAmount > 0 && (
                <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <div className="text-xs text-muted-foreground">Net Amount</div>
                    <div className="text-lg font-semibold">{formData.isVatInclusive
                      ? '₱' + (formData.totalAmount / 1.12).toFixed(2)
                      : '₱' + formData.totalAmount.toFixed(2)
                    }</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">VAT Amount (12%)</div>
                    <div className="text-lg font-semibold">{formData.isVatInclusive
                      ? '₱' + (formData.totalAmount - formData.totalAmount / 1.12).toFixed(2)
                      : '₱' + (formData.totalAmount * 0.12).toFixed(2)
                    }</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Total (with VAT)</div>
                    <div className="text-lg font-semibold">{formData.isVatInclusive
                      ? '₱' + formData.totalAmount.toFixed(2)
                      : '₱' + (formData.totalAmount * 1.12).toFixed(2)
                    }</div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>EWT Account (2340)</Label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formData.ewtAccountId} onChange={e => setFormData({...formData, ewtAccountId: e.target.value})}>
                    <option value="">Select EWT Account...</option>
                    {accounts.filter(a => a.code.startsWith('234')).sort((a, b) => a.code.localeCompare(b.code)).map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>EWT %</Label>
                  <Input type="number" step="0.01" value={formData.ewtPercentage} onChange={e => setFormData({...formData, ewtPercentage: e.target.value})} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label>EWT Amount</Label>
                  <Input type="text" value={`₱${ewtAmount.toFixed(2)}`} disabled className="bg-muted" />
                </div>
              </div>
              {ewtAmount > 0 && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <div className="text-xs text-muted-foreground">EWT Base (Net of VAT)</div>
                    <div className="text-lg font-semibold">₱{netOfVat.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">EWT Amount</div>
                    <div className="text-lg font-semibold text-red-600">₱{ewtAmount.toFixed(2)}</div>
                  </div>
                </div>
              )}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-base font-semibold">Line Items</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItem} className="flex items-center gap-2"><Plus className="w-3 h-3" /> Add Item</Button>
                </div>
                <Table className="border rounded-lg">
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-24">Qty</TableHead>
                      <TableHead className="w-32">Price</TableHead>
                      <TableHead className="w-32">Total</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formData.items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell><Input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} required /></TableCell>
                        <TableCell><Input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} required /></TableCell>
                        <TableCell><Input type="number" value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', e.target.value)} required /></TableCell>
                        <TableCell className="text-right font-medium">₱{item.total > 0 ? item.total.toFixed(2) : '-'}</TableCell>
                        <TableCell><Button variant="ghost" size="icon" onClick={() => removeItem(idx)} disabled={formData.items.length <= 1}><Trash2 className="w-4 h-4" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter><Button type="submit">{editingBill ? 'Update Bill' : 'Create Bill'}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Pay Bill Dialog */}
      <Dialog open={isPayDialogOpen} onOpenChange={(open) => {
        setIsPayDialogOpen(open);
        if (!open) {
          setPayingBill(null);
          setPayments([]);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Pay Purchase Bill {payingBill?.billNumber}</DialogTitle></DialogHeader>    
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <div className="text-xs text-muted-foreground">Supplier</div>
                <div className="font-medium">{payingBill?.supplierName}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Total Amount</div>
                <div className="font-medium">₱{(payingBill?.totalAmount ?? 0).toLocaleString()}</div>     
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Amount Paid</div>
                <div className="font-medium">₱{(payingBill?.amountPaid ?? 0).toLocaleString()}</div>      
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Remaining Balance</div>
                <div className="font-semibold text-red-600">₱{((payingBill?.totalAmount ?? 0) - (payingBill?.amountPaid ?? 0)).toLocaleString()}</div>
              </div>
            </div>
            <form onSubmit={handlePayBill} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payment Amount</Label>
                  <Input type="number" step="0.01" value={payFormData.amount} onChange={e => setPayFormData({...payFormData, amount: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Payment Date</Label>
                  <Input type="date" value={payFormData.paymentDate} onChange={e => setPayFormData({...payFormData, paymentDate: e.target.value})} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cash/Bank Account</Label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={payFormData.cashAccountId} onChange={e => setPayFormData({...payFormData, cashAccountId: e.target.value})} required>
                    <option value="">Select account...</option>
                    {cashAccounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Reference Number</Label>
                  <Input value={payFormData.referenceNumber} onChange={e => setPayFormData({...payFormData, referenceNumber: e.target.value})} placeholder="Check #, Transfer ref..." />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={payFormData.notes} onChange={e => setPayFormData({...payFormData, notes: e.target.value})} placeholder="Optional notes..." />
              </div>
              <DialogFooter><Button type="submit">Record Payment</Button></DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment History Dialog */}
      <Dialog open={showPaymentHistory} onOpenChange={(open) => {
        setShowPaymentHistory(open);
        if (!open) {
          setPayingBill(null);
          setPayments([]);
        }
      }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Payment History - Bill {payingBill?.billNumber}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            {payments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No payments recorded for this bill</div>  
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment: any) => (
                    <TableRow key={payment.id}>
                      <TableCell>{new Date(payment.paymentDate).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right font-medium">₱{payment.amount.toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-sm">{payment.referenceNumber || '-'}</TableCell>
                      <TableCell>{payment.cashAccount?.code} - {payment.cashAccount?.name}</TableCell>
                      <TableCell className="text-sm">{payment.notes || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEditPayment(payment)} title="Edit payment" disabled={payment.bill.status === 'PAID' || payment.bill.status === 'VOID'}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeletePayment(payment)} title="Delete payment" disabled={payment.bill.status === 'PAID' || payment.bill.status === 'VOID'}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Edit Dialog */}
      <Dialog open={isPaymentEditDialogOpen} onOpenChange={(open) => {
        setIsPaymentEditDialogOpen(open);
        if (!open) {
          setEditingPayment(null);
          setPayFormData({
            amount: '',
            paymentDate: new Date().toISOString().split('T')[0],
            referenceNumber: '',
            notes: '',
            cashAccountId: cashAccounts[0]?.id || '',
          });
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Edit Payment - Bill {payingBill?.billNumber}</DialogTitle></DialogHeader>  
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <div className="text-xs text-muted-foreground">Current Amount</div>
                <div className="font-medium">₱{editingPayment?.amount.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Payment Date</div>
                <div className="font-medium">{editingPayment ? new Date(editingPayment.paymentDate).toLocaleDateString() : '-'}</div>
              </div>
            </div>
            <form onSubmit={handlePaymentEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payment Amount</Label>
                  <Input type="number" step="0.01" value={payFormData.amount} onChange={e => setPayFormData({...payFormData, amount: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Payment Date</Label>
                  <Input type="date" value={payFormData.paymentDate} onChange={e => setPayFormData({...payFormData, paymentDate: e.target.value})} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cash/Bank Account</Label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={payFormData.cashAccountId} onChange={e => setPayFormData({...payFormData, cashAccountId: e.target.value})} required>
                    <option value="">Select account...</option>
                    {cashAccounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}       
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Reference Number</Label>
                  <Input value={payFormData.referenceNumber} onChange={e => setPayFormData({...payFormData, referenceNumber: e.target.value})} placeholder="Check #, Transfer ref..." />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={payFormData.notes} onChange={e => setPayFormData({...payFormData, notes: e.target.value})} placeholder="Optional notes..." />
              </div>
              <DialogFooter><Button type="submit">Update Payment</Button></DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Payment Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={(open) => {
        setIsDeleteConfirmOpen(open);
        if (!open) setDeleteConfirmPayment(null);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 className="w-5 h-5" /> Confirm Delete Payment</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <p>Are you sure you want to delete this payment?</p>
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Amount:</span>
                <span className="font-medium">₱{deleteConfirmPayment?.amount.toLocaleString()}</span>     
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Date:</span>
                <span className="font-medium">{deleteConfirmPayment ? new Date(deleteConfirmPayment.paymentDate).toLocaleDateString() : '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Reference:</span>
                <span className="font-mono text-sm">{deleteConfirmPayment?.referenceNumber || '-'}</span>       
              </div>
            </div>
            <p className="text-sm text-red-600">This action cannot be undone. The payment, journal entry, and subsidiary transaction will be permanently deleted.</p>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setDeleteConfirmPayment(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleConfirmDeletePayment}>Delete Payment</Button>        
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle>Bill History</CardTitle>
          <div className="relative w-72">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search suppliers or bills..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bill #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow> :
                filteredBills.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No bills found.</TableCell></TableRow> :
                filteredBills.map(bill => (
                  <TableRow key={bill.id}>
                    <TableCell className="font-mono">{bill.billNumber}</TableCell>
                    <TableCell>{bill.supplierName}</TableCell>
                    <TableCell>{new Date(bill.date).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(bill.dueDate).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right font-medium">₱{(bill.totalAmount ?? 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        bill.status === 'PAID' ? 'bg-green-100 text-green-800' :
                        bill.status === 'PARTIALLY_PAID' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>{bill.status}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleViewPayments(bill)} title="View payments">
                          <History className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleOpenPayDialog(bill)} disabled={bill.status === 'PAID' || bill.status === 'VOID'} title="Pay bill">
                          <DollarSign className="w-4 h-4" />
                        </Button>
                        {(bill.status === 'PAID' || bill.status === 'PARTIALLY_PAID') && (
                          <Button variant="ghost" size="icon" onClick={() => handleResetBill(bill)} title="Reset to unpaid" className="text-red-600 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => handleEditBill(bill)} disabled={bill.status !== 'UNPAID'} title="Edit bill">
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
