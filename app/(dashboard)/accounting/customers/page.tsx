'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Plus, Search, Users, Pencil, Trash2, Eye } from 'lucide-react';

interface Customer {
  id: string;
  entityCode: string;
  entityName: string;
  description?: string;
  balance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SubsidiaryTransaction {
  id: string;
  date: string;
  referenceNo: string;
  description: string;
  debit: number;
  credit: number;
}

interface CustomerWithTransactions extends Customer {
  transactions?: SubsidiaryTransaction[];
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setViewDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<CustomerWithTransactions | null>(null);
  const [search, setSearch] = useState('');

  const [formData, setFormData] = useState({
    entityCode: '',
    entityName: '',
    description: '',
    email: '',
    phone: '',
    address: '',
    tin: '',
    creditLimit: '',
    paymentTerms: 'NET 30',
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function fetchCustomers() {
    setLoading(true);
    try {
      const res = await fetch('/api/accounting/customers');
      const data = await res.json();
      setCustomers(data);
    } catch (err) {
      console.error('Error fetching customers:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/accounting/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setCreateDialogOpen(false);
        resetForm();
        fetchCustomers();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create customer');
      }
    } catch (err) {
      console.error('Error creating customer:', err);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCustomer) return;

    try {
      const res = await fetch('/api/accounting/customers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingCustomer.id,
          ...formData,
        }),
      });

      if (res.ok) {
        setEditDialogOpen(false);
        setEditingCustomer(null);
        resetForm();
        fetchCustomers();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update customer');
      }
    } catch (err) {
      console.error('Error updating customer:', err);
    }
  }

  async function handleDelete(customer: Customer) {
    if (!confirm(`Are you sure you want to delete customer "${customer.entityName}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/accounting/customers?id=${customer.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchCustomers();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete customer');
      }
    } catch (err) {
      console.error('Error deleting customer:', err);
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
      creditLimit: '',
      paymentTerms: 'NET 30',
    });
  }

  function openEditDialog(customer: Customer) {
    setEditingCustomer(customer);
    // Parse description to extract fields if they exist
    const desc = customer.description || '';
    const emailMatch = desc.match(/Email:\s*(.+)$/m);
    const phoneMatch = desc.match(/Phone:\s*(.+)$/m);
    const addressMatch = desc.match(/Address:\s*(.+)$/m);
    const tinMatch = desc.match(/TIN:\s*(.+)$/m);
    const creditMatch = desc.match(/Credit Limit:\s*(.+)$/m);
    const termsMatch = desc.match(/Payment Terms:\s*(.+)$/m);

    setFormData({
      entityCode: customer.entityCode,
      entityName: customer.entityName,
      description: desc.replace(/Email:\s*.+\n?/g, '').replace(/Phone:\s*.+\n?/g, '').replace(/Address:\s*.+\n?/g, '').replace(/TIN:\s*.+\n?/g, '').replace(/Credit Limit:\s*.+\n?/g, '').replace(/Payment Terms:\s*.+\n?/g, '').trim(),
      email: emailMatch ? emailMatch[1] : '',
      phone: phoneMatch ? phoneMatch[1] : '',
      address: addressMatch ? addressMatch[1] : '',
      tin: tinMatch ? tinMatch[1] : '',
      creditLimit: creditMatch ? creditMatch[1] : '',
      paymentTerms: termsMatch ? termsMatch[1] : 'NET 30',
    });
    setEditDialogOpen(true);
  }

  function openViewDialog(customer: Customer) {
    // Fetch customer details with transactions
    fetch(`/api/accounting/customers?id=${customer.id}`)
      .then(res => res.json())
      .then(data => {
        setViewingCustomer(data);
        setViewDialogOpen(true);
      });
  }

  const filteredCustomers = customers.filter(c =>
    c.entityName.toLowerCase().includes(search.toLowerCase()) ||
    c.entityCode.toLowerCase().includes(search.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Customer Management</h1>
          <p className="text-muted-foreground">Manage your customers and accounts receivable</p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>New Customer</DialogTitle>
              <DialogDescription>Add a new customer to your accounts receivable</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer Code *</Label>
                  <Input
                    placeholder="e.g., CUST-001"
                    value={formData.entityCode}
                    onChange={e => setFormData({...formData, entityCode: e.target.value.toUpperCase()})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Customer Name *</Label>
                  <Input
                    placeholder="e.g., ABC Corporation"
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
                    placeholder="customer@example.com"
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
                  <Label>Credit Limit (₱)</Label>
                  <Input
                    type="number"
                    placeholder="100000"
                    value={formData.creditLimit}
                    onChange={e => setFormData({...formData, creditLimit: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                  placeholder="Additional notes about this customer"
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                <Button type="submit">Save Customer</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Customer</DialogTitle>
              <DialogDescription>Update customer details</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdate} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer Code *</Label>
                  <Input
                    placeholder="e.g., CUST-001"
                    value={formData.entityCode}
                    onChange={e => setFormData({...formData, entityCode: e.target.value.toUpperCase()})}
                    required
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label>Customer Name *</Label>
                  <Input
                    placeholder="e.g., ABC Corporation"
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
                    placeholder="customer@example.com"
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
                  <Label>Credit Limit (₱)</Label>
                  <Input
                    type="number"
                    placeholder="100000"
                    value={formData.creditLimit}
                    onChange={e => setFormData({...formData, creditLimit: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                  placeholder="Additional notes about this customer"
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                <Button type="submit">Update Customer</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isViewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Customer Details</DialogTitle>
              <DialogDescription>View customer information and transaction history</DialogDescription>
            </DialogHeader>
            {viewingCustomer && (
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Customer Code</p>
                    <p className="font-semibold">{viewingCustomer.entityCode}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Customer Name</p>
                    <p className="font-semibold">{viewingCustomer.entityName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Balance (Debit)</p>
                    <p className="font-semibold text-right">
                      ₱{viewingCustomer.balance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="font-semibold text-right">
                      <span className={viewingCustomer.isActive ? 'text-green-600' : 'text-red-600'}>
                        {viewingCustomer.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </p>
                  </div>
                </div>

                {viewingCustomer.description && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Description/Notes</p>
                    <p className="text-sm whitespace-pre-wrap">{viewingCustomer.description}</p>
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
                      {viewingCustomer.transactions && viewingCustomer.transactions.length > 0 ? (
                        viewingCustomer.transactions.map((tx: SubsidiaryTransaction) => (
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
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Customer List</CardTitle>
          <div className="relative w-72">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
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
                <TableHead>Credit Limit</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Loading customers...</TableCell>
                </TableRow>
              ) : filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No customers found. Create your first customer to begin.
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map(customer => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-mono font-medium">{customer.entityCode}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{customer.entityName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="px-2 py-1 rounded-full text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
                        {customer.description?.match(/Credit Limit:\s*(.+)$/m)?.[1] || 'N/A'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={customer.balance < 0 ? 'text-green-600' : 'text-blue-600'}>
                        ₱{Math.abs(customer.balance).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </TableCell>
                    <TableCell>
                      {customer.isActive ? (
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
                          onClick={() => openViewDialog(customer)}
                          className="h-8 w-8 p-0"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(customer)}
                          className="h-8 w-8 p-0"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(customer)}
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
