'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Eye, Pencil, FileDown, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { calculateDepreciation } from '@/lib/depreciation';
import * as XLSX from 'xlsx';

export default function AssetListPage() {
  const router = useRouter();
  const [assets, setAssets] = useState<{
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
    quantity?: number;
    status: string;
    supplier?: string;
  }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [deleting, setDeleting] = useState<string | null>(null);
  const itemsPerPage = 10;

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this asset?')) return;
    
    setDeleting(id);
    try {
      const res = await fetch(`/api/assets?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setAssets(assets.filter(a => a.id !== id));
      } else {
        alert('Failed to delete asset');
      }
    } catch {
      alert('Error deleting asset');
    }
    setDeleting(null);
  };

  useEffect(() => {
    fetch('/api/assets')
      .then(res => res.json())
      .then(data => {
        setAssets(data || []);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'ACTIVE': return <Badge className="bg-green-500">Active</Badge>;
      case 'DISPOSED': return <Badge variant="destructive">Disposed</Badge>;
      case 'UNDER_MAINTENANCE': return <Badge className="bg-orange-500">Maintenance</Badge>;
      case 'INACTIVE': return <Badge variant="secondary">Inactive</Badge>;
      case 'LOST': return <Badge variant="destructive">Lost</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const filteredAssets = assets.filter(asset =>
    asset.name.toLowerCase().includes(search.toLowerCase()) ||
    asset.assetCode.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filteredAssets.length / itemsPerPage);
  const paginatedAssets = filteredAssets.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleExport = () => {
    const exportData = filteredAssets.map(asset => {
      const { netBookValue, accumulatedDepreciation, monthsElapsed } = calculateDepreciation({
        purchaseCost: asset.purchaseCost,
        residualValue: asset.residualValue,
        usefulLife: asset.usefulLife,
        purchaseDate: new Date(asset.purchaseDate),
        method: asset.depreciationMethod
      });

      return {
        'Asset Code': asset.assetCode,
        'Name': asset.name,
        'Category': asset.category?.name || '-',
        'Quantity': asset.quantity || 1,
        'Location': asset.location,
        'Status': asset.status,
        'Purchase Cost': asset.purchaseCost,
        'Accumulated Depreciation': accumulatedDepreciation,
        'Net Book Value': netBookValue,
        'Months Elapsed': monthsElapsed,
        'Purchase Date': asset.purchaseDate,
        'Supplier': asset.supplier || '-',
        'Useful Life (Years)': asset.usefulLife,
        'Residual Value': asset.residualValue,
        'Depreciation Method': asset.depreciationMethod
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Asset Inventory');
    XLSX.writeFile(workbook, `Asset_Inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Asset Inventory</h1>
        <Button onClick={() => router.push('/asset-inventory/new')} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Asset
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <CardTitle>All Assets</CardTitle>
          <div className="flex items-center gap-2">
            <div className="w-72">
              <Input
                placeholder="Search by name or code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={handleExport} className="flex items-center gap-2">
              <FileDown className="w-4 h-4" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset Code</TableHead>
                  <TableHead>Purchase Date</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Monthly Amort.</TableHead>
                  <TableHead>Months</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Net Book Value</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8">Loading...</TableCell>
                  </TableRow>
                ) : filteredAssets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8 text-slate-500">No assets found.</TableCell>
                  </TableRow>
                ) : (
                  paginatedAssets.map(asset => {
                    const { netBookValue, accumulatedDepreciation, monthsElapsed } = calculateDepreciation({
                      purchaseCost: asset.purchaseCost,
                      residualValue: asset.residualValue,
                      usefulLife: asset.usefulLife,
                      purchaseDate: new Date(asset.purchaseDate),
                      method: asset.depreciationMethod
                    });

                    const monthlyAmortization = asset.usefulLife > 0
                      ? (asset.purchaseCost - asset.residualValue) / (asset.usefulLife * 12)
                      : 0;

                    return (
                      <TableRow key={asset.id}>
                        <TableCell className="font-mono text-sm">{asset.assetCode}</TableCell>
                        <TableCell>{new Date(asset.purchaseDate).toLocaleDateString()}</TableCell>
                        <TableCell className="font-medium">{asset.name}</TableCell>
                        <TableCell>{asset.category?.name || '-'}</TableCell>
                        <TableCell>{asset.quantity || 1}</TableCell>
                        <TableCell>{asset.location}</TableCell>
                        <TableCell>{getStatusBadge(asset.status)}</TableCell>
                        <TableCell className="text-right">₱{monthlyAmortization.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                        <TableCell className="text-center">{monthsElapsed} mos</TableCell>
                        <TableCell className="text-right">₱{asset.purchaseCost.toLocaleString()}</TableCell>
                        <TableCell className="text-right">₱{netBookValue.toLocaleString()}</TableCell>
<TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => router.push(`/asset-inventory/${asset.id}`)}>
                                <Eye className="w-4 h-4 mr-2" />
                                View
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => router.push(`/asset-inventory/${asset.id}/edit`)}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Edit
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleDelete(asset.id)}
                                disabled={deleting === asset.id}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between px-4 py-4 border-t bg-muted/50">
              <div className="text-sm text-muted-foreground">
                Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredAssets.length)} to {Math.min(currentPage * itemsPerPage, filteredAssets.length)} of {filteredAssets.length} assets
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <div className="text-sm font-medium">
                  Page {currentPage} of {totalPages || 1}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages || totalPages === 0}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
