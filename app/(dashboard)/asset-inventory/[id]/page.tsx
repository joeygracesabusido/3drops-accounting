'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { calculateDepreciation } from '@/lib/depreciation';
import { ArrowLeft, Pencil } from 'lucide-react';
import { useBranch } from '@/lib/branch-context';

export default function AssetDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { selectedBranch } = useBranch();
  const [asset, setAsset] = useState<{
    id: string;
    assetCode: string;
    name: string;
    purchaseCost: number;
    residualValue: number;
    usefulLife: number;
    purchaseDate: string;
    depreciationMethod: string;
    category?: { name: string };
    location: string;
    brand?: string;
    quantity?: number;
    status: string;
    assignedTo?: { fullName: string };
    supplier?: string;
    description?: string;
    transactions: Array<{
      id: string;
      date: string;
      type: string;
      notes?: string;
      cost?: number;
    }>;
    error?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/assets/${params.id}${selectedBranch ? `?branchId=${selectedBranch.id}` : ''}`)
      .then(res => res.json())
      .then(data => {
        setAsset(data);
        setLoading(false);
      });
  }, [params.id, selectedBranch]);

  if (loading) return <div className="p-8 text-center text-lg">Loading...</div>;
  if (!asset || asset.error) return <div className="p-8 text-center text-lg text-red-500">Asset not found</div>;

  const { accumulatedDepreciation, netBookValue } = calculateDepreciation({
    purchaseCost: asset.purchaseCost,
    residualValue: asset.residualValue,
    usefulLife: asset.usefulLife,
    purchaseDate: new Date(asset.purchaseDate),
    method: asset.depreciationMethod
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/asset-inventory')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-3xl font-bold">{asset.name}</h1>
          <Badge className="text-sm bg-blue-100 text-blue-800">{asset.assetCode}</Badge>
          <Button variant="outline" size="sm" className="ml-4" onClick={() => router.push(`/asset-inventory/${params.id}/edit`)}>
            <Pencil className="w-4 h-4 mr-2" />
            Edit Asset
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Asset Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-y-4 text-sm">
              <div className="text-slate-500">Category</div>
              <div className="font-medium flex justify-end">{asset.category?.name || '-'}</div>

              <div className="text-slate-500">Location</div>
              <div className="font-medium flex justify-end">{asset.location}</div>

              <div className="text-slate-500">Brand / Make</div>
              <div className="font-medium flex justify-end">{asset.brand || '-'}</div>

              <div className="text-slate-500">Quantity</div>
              <div className="font-medium flex justify-end">{asset.quantity || 1}</div>

              <div className="text-slate-500">Status</div>
              <div className="flex justify-end pr-0">
                <Badge>{asset.status}</Badge>
              </div>

              <div className="text-slate-500">Assigned To</div>
              <div className="font-medium flex justify-end">{asset.assignedTo?.fullName || 'Unassigned'}</div>

              <div className="text-slate-500">Supplier</div>
              <div className="font-medium flex justify-end">{asset.supplier || '-'}</div>

              <div className="text-slate-500">Description</div>
              <div className="font-medium flex justify-end text-right">{asset.description || '-'}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financial & Depreciation Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-y-4 text-sm">
              <div className="text-slate-500">Purchase Date</div>
              <div className="font-medium flex justify-end">{new Date(asset.purchaseDate).toLocaleDateString()}</div>
              
              <div className="text-slate-500">Purchase Cost</div>
              <div className="font-medium flex justify-end">₱{asset.purchaseCost.toLocaleString()}</div>

              <div className="text-slate-500">Useful Life</div>
              <div className="font-medium flex justify-end">{asset.usefulLife} Years</div>

              <div className="text-slate-500">Residual Value</div>
              <div className="font-medium flex justify-end">₱{asset.residualValue.toLocaleString()}</div>

              <div className="text-slate-500">Depreciation Method</div>
              <div className="font-medium flex justify-end capitalize">{asset.depreciationMethod.replace('_', ' ').toLowerCase()}</div>

              <div className="text-slate-500 font-semibold border-t pt-2">Accumulated Depreciation</div>
              <div className="font-semibold text-red-600 flex justify-end border-t pt-2">₱{accumulatedDepreciation.toLocaleString()}</div>

              <div className="text-slate-500 font-bold border-t pt-2 text-lg">Net Book Value</div>
              <div className="font-bold text-green-600 flex justify-end border-t pt-2 text-lg">₱{netBookValue.toLocaleString()}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Audit History & Transactions</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!asset.transactions || asset.transactions.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-4 text-slate-500">No transactions found.</TableCell>
                </TableRow>
              ) : (
                asset.transactions.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell className="whitespace-nowrap">{new Date(txn.date).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="outline">{txn.type}</Badge></TableCell>
                    <TableCell>{txn.notes || '-'}</TableCell>
                    <TableCell className="text-right">{txn.cost ? `₱${txn.cost.toLocaleString()}` : '-'}</TableCell>
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
