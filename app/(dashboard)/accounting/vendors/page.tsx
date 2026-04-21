'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Plus, Search, Building, Pencil, Trash2, Eye } from 'lucide-react';

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

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setViewDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [viewingVendor, setViewingVendor] = useState<VendorWithTransactions | null>(null);
  const [search, setSearch] = useState('');

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
  }, []);

  async function fetchVendors() {
    setLoading(true);
    try {
      const res = await fetch('/api/accounting/vendors');
      if (!res.ok) {
        console.error('Failed to fetch vendors:', res.status, res.statusText);
        return;
      }
      const data = await res.json();
      console.log('Vendors API response:', data);
      const vendorsList = Array.isArray(data) ? data : [];
      setVendors(vendorsList);
    } catch (err) {
      console.error('Error fetching vendors:', err);
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
    // Parse description to extract fields if they exist
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
    // Fetch vendor details with transactions
    fetch(`/api/accounting/vendors?id=${vendor.id}`)
      .then((res: Response) => res.json() as Promise<VendorWithTransactions>)
      .then((data: VendorWithTransactions) => {
        setViewingVendor(data);
        setViewDialogOpen(true);
      })
      .catch((err: Error) => {
        console.error('Error fetching vendor details:', err);
      });
  }

  const filteredVendors = vendors.filter(v =>
    (v.entityName || '').toLowerCase().includes((search || '').toLowerCase()) ||
    (v.entityCode || '').toLowerCase().includes((search || '').toLowerCase()) ||
    (v.description || '').toLowerCase().includes((search || '').toLowerCase())
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
                    <p className="font-semibold text-right text-right">
                      ₱{viewingVendor.balance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="font-semibold text-right">
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
                  <TableRow key={vendor.id}>
                    <TableCell className="font-mono font-medium">{vendor.entityCode}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{vendor.entityName}</span>
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
                          onClick={() => openViewDialog(vendor)}
                          className="h-8 w-8 p-0"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(vendor)}
                          className="h-8 w-8 p-0"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(vendor)}
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
