'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, DollarSign, Receipt, RefreshCw, ArrowRight } from 'lucide-react';

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface PettyCashFund {
  id: string;
  name: string;
  fundAmount: number;
  currentBalance: number;
  cashAccountId: string;
  expenseAccountId: string;
  custodianId: string;
  status: string;
  createdAt: string;
  _count?: { disbursements: number };
}

interface Disbursement {
  id: string;
  pettyCashId: string;
  amount: number;
  date: string;
  description: string;
  payeeName: string;
  status: string;
  createdAt: string;
  approvedAt?: string;
}

interface Liquidation {
  id: string;
  pettyCashId: string;
  disbursementId: string;
  amount: number;
  date: string;
  notes?: string;
  status: string;
  approvedAt?: string;
  createdAt: string;
  pettyCash?: {
    name: string;
  };
}

export default function PettyCashPage() {
  const [funds, setFunds] = useState<PettyCashFund[]>([]);
  const [cashAccounts, setCashAccounts] = useState<Account[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<Account[]>([]);
  const [disbursements, setDisbursements] = useState<Disbursement[]>([]);
  const [liquidations, setLiquidations] = useState<Liquidation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [isDisburseDialogOpen, setDisburseDialogOpen] = useState(false);
  const [isLiquidateDialogOpen, setLiquidateDialogOpen] = useState(false);
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  
  const [editFormData, setEditFormData] = useState({
    name: '',
    fundAmount: 0 as string | number,
    custodianId: '',
    status: '',
  });

  const [selectedDisbursement, setSelectedDisbursement] = useState<Disbursement | null>(null);
  const [selectedFund, setSelectedFund] = useState<PettyCashFund | null>(null);
  const [activeTab, setActiveTab] = useState<'funds' | 'disbursements' | 'liquidations'>('funds');

  const [formData, setFormData] = useState({
    name: '',
    fundAmount: 0 as string | number,
    cashAccountId: '',
    expenseAccountId: '',
    description: '',
  });

  const [disburseData, setDisburseData] = useState({
    amount: 0 as string | number,
    date: new Date().toISOString().split('T')[0],
    description: '',
    payeeName: '',
    expenseAccountId: '',
  });

  const [liquidateData, setLiquidateData] = useState({
    amount: 0 as string | number,
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  useEffect(() => {
    fetchFunds();
    fetchAccounts();
    fetchDisbursements();
    fetchLiquidations();
  }, []);

  async function fetchFunds() {
    setLoading(true);
    try {
      const res = await fetch('/api/accounting/petty-cash');
      const data = await res.json();
      if (Array.isArray(data)) {
        setFunds(data);
      } else {
        setFunds([]);
      }
    } catch (err) {
      console.error('Error fetching funds:', err);
      setFunds([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAccounts() {
    try {
      const res = await fetch('/api/accounting/accounts');
      const data = await res.json();
      if (Array.isArray(data)) {
        const expenseData = data.filter((a: Account) => a.type === 'EXPENSE' || a.code.startsWith('5'));
        const cashData = data.filter((a: Account) => a.code.startsWith('11') || a.code.startsWith('10'));
        setExpenseAccounts(expenseData);
        setCashAccounts(cashData);
      }
    } catch (err) {
      console.error('Error fetching accounts:', err);
    }
  }

  async function fetchDisbursements() {
    try {
      const res = await fetch('/api/accounting/petty-cash/disbursements');
      const data = await res.json();
      if (Array.isArray(data)) {
        setDisbursements(data);
      } else {
        setDisbursements([]);
      }
    } catch (err) {
      console.error('Error fetching disbursements:', err);
      setDisbursements([]);
    }
  }

  async function fetchLiquidations() {
    try {
      const res = await fetch('/api/accounting/petty-cash/liquidations');
      const data = await res.json();
      if (Array.isArray(data)) {
        setLiquidations(data);
      } else {
        setLiquidations([]);
      }
    } catch (err) {
      console.error('Error fetching liquidations:', err);
      setLiquidations([]);
    }
  }

  async function handleLiquidationAction(id: string, status: 'APPROVED' | 'REJECTED') {
    try {
      const res = await fetch('/api/accounting/petty-cash/liquidations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });

      if (res.ok) {
        fetchLiquidations();
        fetchDisbursements();
        fetchFunds();
      } else {
        const data = await res.json();
        alert(data.error || `Failed to ${status.toLowerCase()} liquidation`);
      }
    } catch (err) {
      console.error(`Error ${status.toLowerCase()} liquidation:`, err);
    }
  }

  async function handleCreateFund(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        fundAmount: parseFloat(String(formData.fundAmount)) || 0,
      };
      const res = await fetch('/api/accounting/petty-cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setCreateDialogOpen(false);
        resetForm();
        fetchFunds();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create fund');
      }
    } catch (err) {
      console.error('Error creating fund:', err);
    }
  }

  async function handleDisburse(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFund) return;

    try {
      const res = await fetch('/api/accounting/petty-cash/disbursements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pettyCashId: selectedFund.id,
          ...disburseData,
        }),
      });

      if (res.ok) {
        setDisburseDialogOpen(false);
        setSelectedFund(null);
        resetDisburseForm();
        fetchFunds();
        fetchDisbursements();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create disbursement');
      }
    } catch (err) {
      console.error('Error creating disbursement:', err);
    }
  }

  async function handleReplenish(fund: PettyCashFund) {
    try {
      const res = await fetch('/api/accounting/petty-cash', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: fund.id,
          fundAmount: fund.fundAmount,
        }),
      });

      if (res.ok) {
        fetchFunds();
      }
    } catch (err) {
      console.error('Error replenishing fund:', err);
    }
  }

  function handleLiquidate(disb: Disbursement) {
    setSelectedDisbursement(disb);
    setLiquidateData({
      amount: disb.amount,
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setLiquidateDialogOpen(true);
  }

  async function submitLiquidation(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDisbursement) return;

    try {
      const res = await fetch('/api/accounting/petty-cash/liquidations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pettyCashId: selectedDisbursement.pettyCashId,
          disbursementId: selectedDisbursement.id,
          amount: parseFloat(String(liquidateData.amount)) || 0,
          date: liquidateData.date,
          notes: liquidateData.notes,
        }),
      });

      if (res.ok) {
        setLiquidateDialogOpen(false);
        setSelectedDisbursement(null);
        fetchDisbursements();
        fetchLiquidations();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to submit liquidation');
      }
    } catch (err) {
      console.error('Error submitting liquidation:', err);
    }
  }

  function resetForm() {
    setFormData({
      name: '',
      fundAmount: '',
      cashAccountId: '',
      expenseAccountId: '',
      description: '',
    });
  }

  function resetDisburseForm() {
    setDisburseData({
      amount: '',
      date: new Date().toISOString().split('T')[0],
      description: '',
      payeeName: '',
      expenseAccountId: '',
    });
  }

  async function handleUpdateFund(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFund) return;

    try {
      const payload = {
        id: selectedFund.id,
        ...editFormData,
        fundAmount: parseFloat(String(editFormData.fundAmount)) || 0,
      };
      const res = await fetch('/api/accounting/petty-cash', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setEditDialogOpen(false);
        fetchFunds();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update fund');
      }
    } catch (err) {
      console.error('Error updating fund:', err);
    }
  }

  function openEditDialog(fund: PettyCashFund) {
    setSelectedFund(fund);
    setEditFormData({
      name: fund.name,
      fundAmount: fund.fundAmount.toString(),
      custodianId: fund.custodianId || '',
      status: fund.status,
    });
    setEditDialogOpen(true);
  }

  const activeFunds = Array.isArray(funds) ? funds.filter(f => f.status === 'ACTIVE') : [];
  const pendingDisbursements = Array.isArray(disbursements) ? disbursements.filter(d => d.status === 'PENDING') : [];
  const pendingLiquidations = Array.isArray(liquidations) ? liquidations.filter(l => l.status === 'PENDING') : [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Petty Cash</h1>
          <p className="text-muted-foreground">Manage petty cash funds and liquidations</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create Fund
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Petty Cash Fund</DialogTitle>
              <DialogDescription>Set up a new petty cash fund</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateFund} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Fund Name *</Label>
                <Input
                  placeholder="e.g., Office Petty Cash"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Fund Amount *</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.fundAmount}
                  onChange={e => setFormData({...formData, fundAmount: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Cash Account *</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  value={formData.cashAccountId}
                  onChange={e => setFormData({...formData, cashAccountId: e.target.value})}
                  required
                >
                  <option value="">Select cash account...</option>
                  {cashAccounts.map((acc: Account) => (
                    <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Expense Account</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  value={formData.expenseAccountId}
                  onChange={e => setFormData({...formData, expenseAccountId: e.target.value})}
                >
                  <option value="">Select expense account (optional)...</option>
                  {expenseAccounts.map((acc: Account) => (
                    <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  placeholder="Optional description"
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                <Button type="submit">Create Fund</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4 border-b">
        <button
          className={`pb-2 px-1 ${activeTab === 'funds' ? 'border-b-2 border-primary font-medium' : 'text-muted-foreground'}`}
          onClick={() => setActiveTab('funds')}
        >
          Funds ({activeFunds.length})
        </button>
        <button
          className={`pb-2 px-1 ${activeTab === 'disbursements' ? 'border-b-2 border-primary font-medium' : 'text-muted-foreground'}`}
          onClick={() => setActiveTab('disbursements')}
        >
          Disbursements ({pendingDisbursements.length} pending)
        </button>
        <button
          className={`pb-2 px-1 ${activeTab === 'liquidations' ? 'border-b-2 border-primary font-medium' : 'text-muted-foreground'}`}
          onClick={() => setActiveTab('liquidations')}
        >
          Liquidations ({pendingLiquidations.length} pending)
        </button>
      </div>

      {activeTab === 'funds' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {funds.map(fund => (
            <Card key={fund.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg">{fund.name}</CardTitle>
                <span className={`text-xs px-2 py-1 rounded ${fund.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                  {fund.status}
                </span>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Fund Amount</span>
                    <span className="font-medium">₱{fund.fundAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Current Balance</span>
                    <span className={`font-medium ${fund.currentBalance < fund.fundAmount * 0.25 ? 'text-red-600' : ''}`}>
                      ₱{fund.currentBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="h-px bg-border my-2" />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => openEditDialog(fund)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setSelectedFund(fund);
                        setDisburseDialogOpen(true);
                      }}
                      disabled={fund.currentBalance <= 0}
                    >
                      <DollarSign className="w-4 h-4 mr-1" />
                      Disburse
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleReplenish(fund)}
                    >
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Replenish
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {funds.length === 0 && !loading && (
            <div className="col-span-full">
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Receipt className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No petty cash funds yet.</p>
                  <Button onClick={() => setCreateDialogOpen(true)} className="mt-4">
                    Create First Fund
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {activeTab === 'disbursements' && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Disbursements</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Payee</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Approval Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disbursements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No disbursements yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  disbursements.map(disb => (
                    <TableRow key={disb.id}>
                      <TableCell>{new Date(disb.date || disb.createdAt).toLocaleDateString('en-PH')}</TableCell>
                      <TableCell>{disb.description || '-'}</TableCell>
                      <TableCell>{disb.payeeName || '-'}</TableCell>
                      <TableCell className="text-right font-mono">
                        ₱{disb.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-1 rounded ${
                          disb.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                          disb.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                          disb.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100'
                        }`}>
                          {disb.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {disb.approvedAt ? new Date(disb.approvedAt).toLocaleDateString('en-PH') : '-'}
                      </TableCell>
                      <TableCell>
                        {disb.status === 'PENDING' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleLiquidate(disb)}
                          >
                            Liquidate
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {activeTab === 'liquidations' && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Liquidations</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Fund</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Approval Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liquidations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No liquidations found.
                    </TableCell>
                  </TableRow>
                ) : (
                  liquidations.map(liq => (
                    <TableRow key={liq.id}>
                      <TableCell>{new Date(liq.date || liq.createdAt).toLocaleDateString('en-PH')}</TableCell>
                      <TableCell>{liq.pettyCash?.name || '-'}</TableCell>
                      <TableCell className="text-right font-mono">
                        ₱{liq.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>{liq.notes || '-'}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-1 rounded ${
                          liq.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                          liq.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                          liq.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100'
                        }`}>
                          {liq.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {liq.approvedAt ? new Date(liq.approvedAt).toLocaleDateString('en-PH') : '-'}
                      </TableCell>
                      <TableCell>
                        {liq.status === 'PENDING' && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 hover:text-green-700"
                              onClick={() => handleLiquidationAction(liq.id, 'APPROVED')}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleLiquidationAction(liq.id, 'REJECTED')}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={isDisburseDialogOpen} onOpenChange={setDisburseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Disbursement</DialogTitle>
            <DialogDescription>
              From: {selectedFund?.name} (Balance: ₱{(selectedFund?.currentBalance || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })})
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDisburse} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={disburseData.amount}
                onChange={e => setDisburseData({...disburseData, amount: parseFloat(e.target.value) || 0})}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input
                type="date"
                value={disburseData.date}
                onChange={e => setDisburseData({...disburseData, date: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Payee Name</Label>
              <Input
                placeholder="Who receives the cash"
                value={disburseData.payeeName}
                onChange={e => setDisburseData({...disburseData, payeeName: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Input
                placeholder="Purpose of disbursement"
                value={disburseData.description}
                onChange={e => setDisburseData({...disburseData, description: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Expense Account</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                value={disburseData.expenseAccountId}
                onChange={e => setDisburseData({...disburseData, expenseAccountId: e.target.value})}
              >
                <option value="">Select expense account...</option>
                {expenseAccounts.map((acc: Account) => (
                  <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDisburseDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={!selectedFund || Number(disburseData.amount) > (selectedFund?.currentBalance || 0)}>
                Disburse
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isLiquidateDialogOpen} onOpenChange={setLiquidateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Liquidate Disbursement</DialogTitle>
            <DialogDescription>
              Submit liquidation receipt for: {selectedDisbursement?.description}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitLiquidation} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Amount to Liquidate *</Label>
              <Input
                type="number"
                step="0.01"
                value={liquidateData.amount}
                onChange={e => setLiquidateData({...liquidateData, amount: parseFloat(e.target.value) || 0})}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input
                type="date"
                value={liquidateData.date}
                onChange={e => setLiquidateData({...liquidateData, date: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Notes / Remarks</Label>
              <Input
                placeholder="Any notes about the expense"
                value={liquidateData.notes}
                onChange={e => setLiquidateData({...liquidateData, notes: e.target.value})}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLiquidateDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Submit Liquidation</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}