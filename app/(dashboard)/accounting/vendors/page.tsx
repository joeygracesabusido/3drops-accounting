'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Plus, Search, Building, Pencil, Trash2, Eye, DollarSign } from 'lucide-react';

interface CashAccount {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface UnpaidBill {
  id: string;
  billNumber: string;
  supplierName?: string;
  status?: string;
  totalAmount: number;
  amountPaid: number;
  date: string;
}

interface Vendor {
  id: string;
  entityCode: string;
  entityName: string;
  description?: string;
  balance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  entityType: 'SUPPLIER';
  accountId: string;
  debitTotal: number;
  creditTotal: number;
}

interface VendorTransaction {
  id: string;
  date: string;
  referenceNo: string;
  description: string;
  debit: number;
  credit: number;
  balanceAfter: number;
  subsidiaryLedgerId: string;
  createdAt: string;
  updatedAt: string;
}

interface VendorWithTransactions extends Vendor {
  transactions?: VendorTransaction[];
  account?: {
    id: string;
    code: string;
    name: string;
    type: string;
  };
}

interface PurchaseBill {
  id: string;
  billNumber: string;
  supplierName: string;
  totalAmount: number;
  amountPaid: number;
  status: string;
  date: string;
}

interface JournalLine {
  id: string;
  debit: number;
  credit: number;
  account?: {
    id: string;
    code: string;
    type: string;
  };
}

interface JournalEntry {
  id: string;
  reference: string;
  description: string;
  date: string;
  lines?: JournalLine[];
}

interface UnpaidJournalEntry {
  id: string;
  jeNumber: string;
  description: string;
  totalAmount: number;
  date: string;
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setViewDialogOpen] = useState(false);
  const [isPayAllDialogOpen, setPayAllDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [viewingVendor, setViewingVendor] = useState<VendorWithTransactions | null>(null);
  const [search, setSearch] = useState('');

  const [payAllData, setPayAllData] = useState({
    vendorId: '',
    vendorName: '',
    vendorBalance: 0,
    paymentAmount: 0,
    paymentDate: new Date().toISOString().split('T')[0],
    referenceNumber: '',
    notes: '',
    cashAccountId: '',
  });
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [unpaidBills, setUnpaidBills] = useState<UnpaidBill[]>([]);
  const [unpaidJournalEntries, setUnpaidJournalEntries] = useState<UnpaidJournalEntry[]>([]);
  const [selectedBillIds, setSelectedBillIds] = useState<string[]>([]);
  const [selectedJeIds, setSelectedJeIds] = useState<string[]>([]);
  const [payAllLoading, setPayAllLoading] = useState(false);

  const [formData, setFormData] = useState({
    entityCode: '',
    entityName: '',
    description: '',
    email: '',
    phone: '',
    address: '',
    tin: '',
    paymentTerms: 'NET 30',
  });

  useEffect(() => {
    fetchVendors();
    fetchCashAccounts();
  }, []);

  async function fetchCashAccounts() {
    try {
      const res = await fetch('/api/accounting/accounts');
      const data = (await res.json()) as CashAccount[];
      if (Array.isArray(data)) {
        setCashAccounts(data);
      } else {
        setCashAccounts([]);
      }
    } catch (err) {
      console.error('Error fetching accounts:', err);
      setCashAccounts([]);
    }
  }

  async function fetchUnpaidBills(supplierName: string) {
    try {
      // Fetch purchase bills
      const billsRes = await fetch('/api/accounting/purchases');
      const bills = (await billsRes.json()) as PurchaseBill[];
      
      const unpaid = Array.isArray(bills) 
        ? bills
          .filter((b: PurchaseBill) => b.supplierName === supplierName && b.status !== 'PAID' && b.status !== 'VOID')
          .map((b: PurchaseBill) => ({ id: b.id, billNumber: b.billNumber, totalAmount: b.totalAmount, amountPaid: b.amountPaid || 0, date: b.date }))
        : [];
      setUnpaidBills(unpaid);

      // Fetch all journal entries for liability accounts (payables)
      const jeRes = await fetch('/api/accounting/journal');
      const journalEntries = (await jeRes.json()) as JournalEntry[];
      
      if (!Array.isArray(journalEntries)) {
        setUnpaidJournalEntries([]);
        return;
      }
      
      // Get all unpaid purchase bill IDs for this vendor
      const unpaidBillIds = unpaid.map(b => b.id);
      
      // Filter JEs that:
      // 1. Are not payments (skip PAY- references)
      // 2. Have credit to liability accounts (21xx)
      // 3. Don't have associated purchase bills (standalone JEs)
      const relevantJEs = journalEntries.filter((je: JournalEntry) => {
        // Skip payment entries
        if (je.reference?.startsWith('PAY-') || je.reference?.includes('PAY-') || je.reference?.includes('BILL-')) {
          return false;
        }
        
        // Check if JE has credit to liability accounts
        const hasLiabCredit = je.lines?.some((line: JournalLine) => 
          line.credit > 0 && (line.account?.type === 'LIABILITY' || line.account?.code?.startsWith('21'))
        );
        
        return hasLiabCredit;
      }).map((je: JournalEntry) => {
        // Calculate liability credit amount
        const liabCredit = je.lines?.reduce((sum: number, line: JournalLine) => {
          if (line.credit > 0 && (line.account?.type === 'LIABILITY' || line.account?.code?.startsWith('21'))) {
            return sum + line.credit;
          }
          return sum;
        }, 0) || 0;
        
        return {
          id: je.id,
          jeNumber: je.reference || 'JE-' + je.id.slice(-6).toUpperCase(),
          description: je.description,
          totalAmount: liabCredit,
          date: je.date,
        };
      });

      setUnpaidJournalEntries(relevantJEs);
    } catch (err) {
      console.error('Error fetching bills and journal entries:', err);
    }
  }

  async function fetchVendors() {
    setLoading(true);
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
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/accounting/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setCreateDialogOpen(false);
        resetForm();
        fetchVendors();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create vendor');
      }
    } catch (err) {
      console.error('Error creating vendor:', err);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingVendor) return;

    try {
      const res = await fetch('/api/accounting/vendors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingVendor.id,
          ...formData,
        }),
      });

      if (res.ok) {
        setEditDialogOpen(false);
        setEditingVendor(null);
        resetForm();
        fetchVendors();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update vendor');
      }
    } catch (err) {
      console.error('Error updating vendor:', err);
    }
  }

  async function handleDelete(vendor: Vendor) {
    if (!confirm(`Are you sure you want to delete vendor "${vendor.entityName}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/accounting/vendors?id=${vendor.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchVendors();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete vendor');
      }
    } catch (err) {
      console.error('Error deleting vendor:', err);
    }
  }

  function resetForm() {
    setFormData({
      entityCode: '',
      entityName: '',
      description: '',
      email: '',
      phone: '',
      address: '',
      tin: '',
      paymentTerms: 'NET 30',
    });
  }

  function openEditDialog(vendor: Vendor) {
    setEditingVendor(vendor);
    const desc = vendor.description || '';
    const emailMatch = desc.match(/Email:\s*(.+)$/m);
    const phoneMatch = desc.match(/Phone:\s*(.+)$/m);
    const addressMatch = desc.match(/Address:\s*(.+)$/m);
    const tinMatch = desc.match(/TIN:\s*(.+)$/m);
    const termsMatch = desc.match(/Payment Terms:\s*(.+)$/m);

    setFormData({
      entityCode: vendor.entityCode,
      entityName: vendor.entityName,
      description: desc.replace(/Email:\s*.+\n?/g, '').replace(/Phone:\s*.+\n?/g, '').replace(/Address:\s*.+\n?/g, '').replace(/TIN:\s*.+\n?/g, '').replace(/Payment Terms:\s*.+\n?/g, '').trim(),
      email: emailMatch ? emailMatch[1] : '',
      phone: phoneMatch ? phoneMatch[1] : '',
      address: addressMatch ? addressMatch[1] : '',
      tin: tinMatch ? tinMatch[1] : '',
      paymentTerms: termsMatch ? termsMatch[1] : 'NET 30',
    });
    setEditDialogOpen(true);
  }

  function openViewDialog(vendor: Vendor) {
    fetch(`/api/accounting/vendors?id=${vendor.id}`)
      .then((res: Response) => res.json() as Promise<VendorWithTransactions>)
      .then((data: VendorWithTransactions) => {
        if (data.transactions) {
          data.transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }
        setViewingVendor(data);
        setViewDialogOpen(true);
      })
      .catch((err: Error) => {
        console.error('Error fetching vendor details:', err);
      });
  }

  function openPayAllDialog(vendor: Vendor) {
    setPayAllData({
      vendorId: vendor.id,
      vendorName: vendor.entityName,
      vendorBalance: vendor.balance,
      paymentAmount: vendor.balance > 0 ? vendor.balance : 0,
      paymentDate: new Date().toISOString().split('T')[0],
      referenceNumber: '',
      notes: '',
      cashAccountId: '',
    });
    setSelectedBillIds([]);
    setSelectedJeIds([]);
    setPayAllDialogOpen(true);
    fetchUnpaidBills(vendor.entityName);
  }

  async function handlePaySelectedBills() {
    if (!payAllData.cashAccountId) {
      alert('Please select a cash account');
      return;
    }
    if (payAllData.paymentAmount <= 0) {
      alert('Please enter payment amount');
      return;
    }

    // Use selected items or default to all if nothing selected
    const finalBillIds = selectedBillIds.length > 0 ? selectedBillIds : (unpaidBills.length > 0 ? unpaidBills.map(b => b.id) : []);
    const finalJeIds = selectedJeIds.length > 0 ? selectedJeIds : (unpaidJournalEntries.length > 0 ? unpaidJournalEntries.map(je => je.id) : []);

    if (finalBillIds.length === 0 && finalJeIds.length === 0) {
      alert('No payable items found for this vendor');
      return;
    }

    const payload = {
      vendorName: payAllData.vendorName,
      amount: payAllData.paymentAmount,
      paymentDate: payAllData.paymentDate,
      referenceNumber: payAllData.referenceNumber,
      notes: payAllData.notes,
      cashAccountId: payAllData.cashAccountId,
      billIds: finalBillIds,
      journalEntryIds: finalJeIds,
    };
    
    console.log('=== SENDING PAYMENT ===');
    console.log('Payload:', JSON.stringify(payload, null, 2));

    setPayAllLoading(true);
    try {
      const res = await fetch('/api/accounting/payments/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      console.log('Payment response:', data);
      if (res.ok) {
        alert(`Payment of ₱${payAllData.paymentAmount.toLocaleString('en-PH')} successful!`);
        setPayAllDialogOpen(false);
        fetchVendors();
      } else {
        alert(data.error || 'Failed to process payment');
      }
    } catch (err) {
      console.error('Error paying:', err);
      alert('Failed to process payment');
    } finally {
      setPayAllLoading(false);
    }
  }

  function toggleBillSelection(billId: string) {
    setSelectedBillIds(prev => 
      prev.includes(billId) 
        ? prev.filter(id => id !== billId)
        : [...prev, billId]
    );
  }

  function toggleSelectAllBills() {
    if (selectedBillIds.length === unpaidBills.length) {
      setSelectedBillIds([]);
    } else {
      setSelectedBillIds(unpaidBills.map(b => b.id));
    }
  }

  function getSelectedBillsTotal() {
    return unpaidBills
      .filter(b => selectedBillIds.includes(b.id))
      .reduce((sum, b) => sum + (b.totalAmount - b.amountPaid), 0);
  }

  function toggleJeSelection(jeId: string) {
    setSelectedJeIds(prev => 
      prev.includes(jeId) 
        ? prev.filter(id => id !== jeId)
        : [...prev, jeId]
    );
  }

  function toggleSelectAllJEs() {
    if (selectedJeIds.length === unpaidJournalEntries.length) {
      setSelectedJeIds([]);
    } else {
      setSelectedJeIds(unpaidJournalEntries.map(je => je.id));
    }
  }

  function getSelectedJEsTotal() {
    return unpaidJournalEntries
      .filter(je => selectedJeIds.includes(je.id))
      .reduce((sum, je) => sum + je.totalAmount, 0);
  }

  function getTotalSelectedAmount() {
    return getSelectedBillsTotal() + getSelectedJEsTotal();
  }

  const filteredVendors = vendors.filter(v =>
    v.entityName.toLowerCase().includes(search.toLowerCase()) ||
    v.entityCode.toLowerCase().includes(search.toLowerCase()) ||
    (v.description && v.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Vendor Management</h1>
          <p className="text-muted-foreground">Manage your suppliers and vendors</p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Vendor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>New Vendor</DialogTitle>
              <DialogDescription>Add a new vendor to your supplier list</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vendor Code <span className="text-xs text-muted-foreground font-normal">(auto if blank)</span></Label>
                  <Input
                    placeholder="Auto-generated (e.g., SUP-0001)"
                    value={formData.entityCode}
                    onChange={e => setFormData({...formData, entityCode: e.target.value.toUpperCase()})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vendor Name *</Label>
                  <Input
                    placeholder="e.g., ABC Supplies Inc."
                    value={formData.entityName}
                    onChange={e => setFormData({...formData, entityName: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="vendor@example.com"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    placeholder="(02) 1234-5678"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  placeholder="Complete address"
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>TIN (Tax ID)</Label>
                  <Input
                    placeholder="123-456-789-000"
                    value={formData.tin}
                    onChange={e => setFormData({...formData, tin: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Payment Terms</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    value={formData.paymentTerms}
                    onChange={e => setFormData({...formData, paymentTerms: e.target.value})}
                  >
                    <option value="CASH">Cash</option>
                    <option value="NET 15">NET 15</option>
                    <option value="NET 30">NET 30</option>
                    <option value="NET 60">NET 60</option>
                    <option value="NET 90">NET 90</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  placeholder="Additional notes about this vendor"
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                <Button type="submit">Save Vendor</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Vendor</DialogTitle>
              <DialogDescription>Update vendor details</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdate} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vendor Code *</Label>
                  <Input
                    placeholder="e.g., SUP-001"
                    value={formData.entityCode}
                    onChange={e => setFormData({...formData, entityCode: e.target.value.toUpperCase()})}
                    required
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vendor Name *</Label>
                  <Input
                    placeholder="e.g., ABC Supplies Inc."
                    value={formData.entityName}
                    onChange={e => setFormData({...formData, entityName: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="vendor@example.com"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    placeholder="(02) 1234-5678"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  placeholder="Complete address"
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>TIN (Tax ID)</Label>
                  <Input
                    placeholder="123-456-789-000"
                    value={formData.tin}
                    onChange={e => setFormData({...formData, tin: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Payment Terms</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    value={formData.paymentTerms}
                    onChange={e => setFormData({...formData, paymentTerms: e.target.value})}
                  >
                    <option value="CASH">Cash</option>
                    <option value="NET 15">NET 15</option>
                    <option value="NET 30">NET 30</option>
                    <option value="NET 60">NET 60</option>
                    <option value="NET 90">NET 90</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  placeholder="Additional notes about this vendor"
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                <Button type="submit">Update Vendor</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isViewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Vendor Details</DialogTitle>
              <DialogDescription>View vendor information and transaction history</DialogDescription>
            </DialogHeader>
            {viewingVendor && (
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Vendor Code</p>
                    <p className="font-semibold">{viewingVendor.entityCode}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Vendor Name</p>
                    <p className="font-semibold">{viewingVendor.entityName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Balance</p>
                    <p className="font-semibold">
                      ₱{viewingVendor.balance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="font-semibold">
                      <span className={viewingVendor.isActive ? 'text-green-600' : 'text-red-600'}>
                        {viewingVendor.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </p>
                  </div>
                </div>

                {viewingVendor.description && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Description/Notes</p>
                    <p className="text-sm whitespace-pre-wrap">{viewingVendor.description}</p>
                  </div>
                )}

                <div>
                  <h3 className="font-semibold mb-2">Recent Transactions</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingVendor.transactions && viewingVendor.transactions.length > 0 ? (
                        viewingVendor.transactions.map((tx: VendorTransaction) => (
                          <TableRow key={tx.id}>
                            <TableCell>{new Date(tx.date).toLocaleDateString('en-PH')}</TableCell>
                            <TableCell>{tx.referenceNo}</TableCell>
                            <TableCell>{tx.description}</TableCell>
                            <TableCell className="text-right">
                              {tx.debit > 0 ? `₱${tx.debit.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {tx.credit > 0 ? `₱${tx.credit.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '-'}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                            No transactions yet
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isPayAllDialogOpen} onOpenChange={setPayAllDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Pay Vendor - {payAllData.vendorName}</DialogTitle>
              <DialogDescription>Enter payment amount</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="p-4 bg-muted rounded-lg flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted-foreground">Total Outstanding Balance</p>
                  <p className="font-semibold text-2xl text-red-600">
                    ₱{(payAllData.vendorBalance + unpaidJournalEntries.reduce((sum, je) => sum + je.totalAmount, 0)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Unpaid Items</p>
                  <p className="font-semibold text-lg">{unpaidBills.length} bills + {unpaidJournalEntries.length} JEs</p>
                </div>
              </div>

              {unpaidBills.length > 0 && (
                <div className="border rounded-lg">
                  <div className="flex items-center justify-between p-3 bg-muted/50 border-b">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="selectAll"
                        checked={selectedBillIds.length === unpaidBills.length && unpaidBills.length > 0}
                        onChange={toggleSelectAllBills}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label htmlFor="selectAll" className="text-sm font-medium cursor-pointer">
                        Select All Bills
                      </Label>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Selected: </span>
                      <span className="font-semibold">{selectedBillIds.length} bills</span>
                      <span className="text-muted-foreground"> (</span>
                      <span className="font-semibold text-green-600">₱{getSelectedBillsTotal().toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                      <span className="text-muted-foreground">)</span>
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10"></TableHead>
                          <TableHead>Bill No.</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">Balance Due</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {unpaidBills.map(bill => (
                          <TableRow key={bill.id} className={selectedBillIds.includes(bill.id) ? 'bg-green-50 dark:bg-green-950/20' : ''}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selectedBillIds.includes(bill.id)}
                                onChange={() => toggleBillSelection(bill.id)}
                                className="h-4 w-4 rounded border-gray-300"
                              />
                            </TableCell>
                            <TableCell className="font-mono">{bill.billNumber}</TableCell>
                            <TableCell>{new Date(bill.date).toLocaleDateString('en-PH')}</TableCell>
                            <TableCell className="text-right">₱{bill.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-right text-red-600 font-semibold">
                              ₱{(bill.totalAmount - bill.amountPaid).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {unpaidJournalEntries.length > 0 && (
                <div className="border rounded-lg mt-4">
                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/30 border-b">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="selectAllJEs"
                        checked={selectedJeIds.length === unpaidJournalEntries.length && unpaidJournalEntries.length > 0}
                        onChange={toggleSelectAllJEs}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label htmlFor="selectAllJEs" className="text-sm font-medium cursor-pointer">
                        Select All Journal Entries
                      </Label>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Selected: </span>
                      <span className="font-semibold">{selectedJeIds.length} entries</span>
                      <span className="text-muted-foreground"> (</span>
                      <span className="font-semibold text-blue-600">₱{getSelectedJEsTotal().toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                      <span className="text-muted-foreground">)</span>
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10"></TableHead>
                          <TableHead>JE No.</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {unpaidJournalEntries.map(je => (
                          <TableRow key={je.id} className={selectedJeIds.includes(je.id) ? 'bg-blue-50 dark:bg-blue-950/20' : ''}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selectedJeIds.includes(je.id)}
                                onChange={() => toggleJeSelection(je.id)}
                                className="h-4 w-4 rounded border-gray-300"
                              />
                            </TableCell>
                            <TableCell className="font-mono">{je.jeNumber}</TableCell>
                            <TableCell>{new Date(je.date).toLocaleDateString('en-PH')}</TableCell>
                            <TableCell className="max-w-[200px] truncate" title={je.description}>{je.description}</TableCell>
                            <TableCell className="text-right text-red-600 font-semibold">
                              ₱{je.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="space-y-3 border-t pt-4">
                <div className="space-y-1">
                  <Label className="font-semibold">Payment Amount *</Label>
                  <Input
                    type="number"
                    placeholder="Enter amount to pay"
                    value={payAllData.paymentAmount || ''}
                    onChange={(e) => setPayAllData({...payAllData, paymentAmount: parseFloat(e.target.value) || 0})}
                    className="text-lg font-semibold"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Payment Date</Label>
                    <Input
                      type="date"
                      value={payAllData.paymentDate}
                      onChange={e => setPayAllData({...payAllData, paymentDate: e.target.value})}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Reference Number</Label>
                    <Input
                      placeholder="Auto-generated if blank"
                      value={payAllData.referenceNumber}
                      onChange={e => setPayAllData({...payAllData, referenceNumber: e.target.value})}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Cash Account *</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={payAllData.cashAccountId}
                      onChange={e => setPayAllData({...payAllData, cashAccountId: e.target.value})}
                    >
                      <option value="">Select Account</option>
                      {cashAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label>Notes</Label>
                    <Input
                      placeholder="Payment notes"
                      value={payAllData.notes}
                      onChange={e => setPayAllData({...payAllData, notes: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <DialogFooter className="sticky bottom-0 bg-background pt-4 mt-4 border-t">
                <Button variant="outline" onClick={() => setPayAllDialogOpen(false)}>Cancel</Button>
                <Button 
                  onClick={handlePaySelectedBills} 
                  disabled={payAllLoading || !payAllData.cashAccountId || payAllData.paymentAmount <= 0}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {payAllLoading ? 'Processing...' : `Pay ₱${(payAllData.paymentAmount || 0).toLocaleString('en-PH')}`}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Vendor List</CardTitle>
          <div className="relative w-72">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search vendors..."
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
                <TableHead>Payment Terms</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Loading vendors...</TableCell>
                </TableRow>
              ) : filteredVendors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No vendors found. Create your first vendor to begin.
                  </TableCell>
                </TableRow>
              ) : (
                filteredVendors.map(vendor => (
                  <TableRow key={vendor.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openViewDialog(vendor)}>
                    <TableCell className="font-mono font-medium">{vendor.entityCode}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium text-blue-600 hover:text-blue-800 hover:underline">{vendor.entityName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="px-2 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        {vendor.description?.match(/Payment Terms:\s*(.+)$/m)?.[1] || 'N/A'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={vendor.balance < 0 ? 'text-red-600' : 'text-green-600'}>
                        ₱{Math.abs(vendor.balance).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </TableCell>
                    <TableCell>
                      {vendor.isActive ? (
                        <span className="text-green-600 text-xs font-medium">Active</span>
                      ) : (
                        <span className="text-red-600 text-xs font-medium">Inactive</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); openViewDialog(vendor); }}
                          className="h-8 w-8 p-0"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); openPayAllDialog(vendor); }}
                          className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                          title="Pay Bills"
                        >
                          <DollarSign className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); openEditDialog(vendor); }}
                          className="h-8 w-8 p-0"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleDelete(vendor); }}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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