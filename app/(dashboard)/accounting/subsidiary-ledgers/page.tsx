/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { useBranch } from '@/lib/branch-context';
import { BranchSelector } from '@/components/branch-selector';

export default function SubsidiaryLedgerPage() {
  const { selectedBranch } = useBranch();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [reconciliation, setReconciliation] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [formData, setFormData] = useState({
    entityCode: '',
    entityName: '',
    description: '',
  });

  // Fetch accounts with subsidiary ledgers
  const fetchAccounts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedBranch) params.set('branchId', selectedBranch.id);
      const res = await fetch(`/api/accounting/accounts?${params}`);
      const data = await res.json();
      // Filter accounts that have subsidiary ledgers
      const controlAccounts = data.filter((acc: any) => acc.hasSubsidiaryLedger === true || acc.subsidiaryType !== undefined);
      setAccounts(controlAccounts);
    } catch (err) {
      console.error('Error fetching accounts:', err);
    }
  }, [selectedBranch]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Fetch subsidiary ledgers when account selected
  const fetchLedgers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ accountId: selectedAccountId });
      if (selectedBranch) params.set('branchId', selectedBranch.id);
      const res = await fetch(`/api/accounting/subsidiary-ledgers?${params}`);
      const data = await res.json();
      setLedgers(data.ledgers || []);
      setReconciliation(data.reconciliation);
      setSelectedAccount(data.account);
    } catch (err) {
      console.error('Error fetching ledgers:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId, selectedBranch]);

  useEffect(() => {
    if (selectedAccountId) {
      fetchLedgers();
    }
  }, [selectedAccountId, fetchLedgers]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const account = accounts.find(a => a.id === selectedAccountId);
      const res = await fetch('/api/accounting/subsidiary-ledgers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: selectedAccountId,
          entityCode: formData.entityCode,
          entityName: formData.entityName,
          entityType: account?.subsidiaryType,
          description: formData.description,
          branchId: selectedBranch?.id || null,
        }),
      });

      if (res.ok) {
        setIsDialogOpen(false);
        setFormData({ entityCode: '', entityName: '', description: '' });
        fetchLedgers();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create ledger');
      }
    } catch (err) {
      console.error('Error creating ledger:', err);
    }
  }

  async function handleSync() {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/accounting/subsidiary-ledgers/sync', {
        method: 'POST',
      });
      if (res.ok) {
        if (selectedAccountId) fetchLedgers();
        alert('Balances synchronized successfully!');
      } else {
        alert('Failed to sync balances');
      }
    } catch (err) {
      console.error('Error syncing:', err);
    } finally {
      setIsSyncing(false);
    }
  }

  const getEntityTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      CUSTOMER: 'Customer',
      SUPPLIER: 'Supplier',
      INVENTORY_ITEM: 'Inventory Item',
      ASSET: 'Fixed Asset',
      EMPLOYEE: 'Employee',
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Subsidiary Ledgers</h1>
          <p className="text-muted-foreground">
            Detailed records supporting General Ledger control accounts (GAAP compliant)
          </p>
        </div>
        <BranchSelector />
      </div>

      {/* Account Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Control Account</CardTitle>
          <CardDescription>
            Choose a General Ledger account to view its subsidiary ledger details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select control account..." />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.code} - {acc.name} ({getEntityTypeLabel(acc.subsidiaryType || '')})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {selectedAccount && (
              <div className="space-y-2">
                <Label>Account Details</Label>
                <div className="text-sm text-muted-foreground">
                  <div><strong>Code:</strong> {selectedAccount.code}</div>
                  <div><strong>Type:</strong> {selectedAccount.type}</div>
                  <div><strong>Subsidiary Type:</strong> {getEntityTypeLabel(selectedAccount.subsidiaryType || '')}</div>
                </div>
              </div>
            )}

            <div className="flex items-end gap-2">
              <Button 
                onClick={fetchLedgers} 
                disabled={!selectedAccountId || loading}
                className="flex-1"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Load Ledgers
              </Button>
              <Button 
                variant="outline"
                onClick={handleSync} 
                disabled={isSyncing}
                title="Recalculate all subsidiary balances from transactions"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reconciliation Status */}
      {reconciliation && selectedAccount && (
        <Card className={`border-${reconciliation.isBalanced ? 'green' : 'red'}-500`}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              {reconciliation.isBalanced ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600" />
              )}
              Reconciliation Status: {reconciliation.isBalanced ? 'Balanced' : 'Out of Balance'}
            </CardTitle>
          </CardHeader>
          <CardContent>
             <div className="grid grid-cols-3 gap-4 text-sm">
               <div>
                 <div className="text-muted-foreground">General Ledger Balance</div>
                 <div className="text-lg font-bold font-mono">
                   ₱{reconciliation.glBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                 </div>
               </div>
               <div>
                 <div className="text-muted-foreground">Subsidiary Ledger Total</div>
                 <div className="text-lg font-bold font-mono">
                   ₱{reconciliation.slBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                 </div>
               </div>
               <div>
                 <div className="text-muted-foreground">Difference</div>
                 <div className={`text-lg font-bold font-mono ${
                   Math.abs(reconciliation.difference) > 0.01 ? 'text-red-600' : 'text-green-600'
                 }`}>
                   ₱{reconciliation.difference.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                 </div>
               </div>
             </div>
             {!reconciliation.isBalanced && (
               <p className="text-sm text-red-600 mt-2">
                 Warning: General Ledger and Subsidiary Ledger do not match. Review transactions.
               </p>
             )}
          </CardContent>
        </Card>
      )}

      {/* Subsidiary Ledger Table */}
      {selectedAccount && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle>Subsidiary Ledger: {selectedAccount.name}</CardTitle>
              <CardDescription>
                Individual {getEntityTypeLabel(selectedAccount.subsidiaryType || '').toLowerCase()} records
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add {getEntityTypeLabel(selectedAccount.subsidiaryType || '')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New {getEntityTypeLabel(selectedAccount.subsidiaryType || '')}</DialogTitle>
                  <DialogDescription>
                    Create a new subsidiary ledger entry for this control account
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Entity Code *</Label>
                    <Input
                      placeholder={`e.g. ${selectedAccount.subsidiaryType === 'CUSTOMER' ? 'CUST-001' : selectedAccount.subsidiaryType === 'SUPPLIER' ? 'SUP-001' : 'ITEM-001'}`}
                      value={formData.entityCode}
                      onChange={e => setFormData({...formData, entityCode: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Entity Name *</Label>
                    <Input
                      placeholder="e.g. ABC Corporation"
                      value={formData.entityName}
                      onChange={e => setFormData({...formData, entityName: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      placeholder="Optional notes"
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button type="submit">Create</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Debit Total</TableHead>
                  <TableHead className="text-right">Credit Total</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">Loading...</TableCell>
                  </TableRow>
                ) : ledgers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No subsidiary records found. Click &apos;Add&apos; to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  ledgers.map((ledger: any) => (
                    <TableRow key={ledger.id}>
                      <TableCell className="font-mono font-medium">{ledger.entityCode}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{ledger.entityName}</div>
                          {ledger.description && (
                            <div className="text-xs text-muted-foreground">{ledger.description}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ₱{ledger.debitTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ₱{ledger.creditTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <span className={ledger.balance < 0 ? 'text-red-600' : 'text-green-600'}>
                          ₱{Math.abs(ledger.balance).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          {ledger.balance < 0 && ' (Cr)'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">
                          {ledger._count?.transactions || 0} transactions
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* GAAP Info Card */}
      <Card className="bg-slate-50 dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="text-sm uppercase text-muted-foreground">GAAP Reference</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>Subsidiary Ledgers</strong> provide detailed transaction records that support General Ledger control accounts.
            The sum of all subsidiary ledger balances must equal the General Ledger control account balance.
          </p>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <div className="font-semibold text-foreground">Common Subsidiary Ledgers:</div>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Accounts Receivable → Customer Ledger</li>
                <li>Accounts Payable → Supplier Ledger</li>
                <li>Inventory → Inventory Item Ledger</li>
                <li>Fixed Assets → Asset Register</li>
              </ul>
            </div>
            <div>
              <div className="font-semibold text-foreground">Reconciliation:</div>
              <p className="mt-1">
                GL Balance must = Sum of SL Balances. Differences indicate posting errors or timing differences.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
