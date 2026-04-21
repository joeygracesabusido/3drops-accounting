'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AddAssetPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<{
    id: string;
    name: string;
  }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/assets/categories')
      .then(res => res.json())
      .then(data => setCategories(data || []));
  }, []);

  const [formData, setFormData] = useState({
    assetCode: '',
    name: '',
    brand: '',
    description: '',
    categoryId: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    supplier: '',
    purchaseCost: '',
    usefulLife: '',
    residualValue: '0',
    depreciationMethod: 'STRAIGHT_LINE',
    location: '',
    quantity: '1',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        router.push('/asset-inventory');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create asset');
      }
    } catch (error) {
      console.error('Error adding asset:', error);
      alert('An error occurred while creating the asset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Register New Asset</h1>
        <Button variant="outline" onClick={() => router.push('/asset-inventory')}>
          Cancel
        </Button>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Asset Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="assetCode">Asset Code (Optional)</Label>
                <Input 
                  id="assetCode" 
                  value={formData.assetCode} 
                  onChange={e => setFormData({ ...formData, assetCode: e.target.value })} 
                  placeholder="Auto-generated if left blank"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Asset Name</Label>
                <Input 
                  id="name" 
                  value={formData.name} 
                  onChange={e => setFormData({ ...formData, name: e.target.value })} 
                  required 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select onValueChange={(val) => setFormData({ ...formData, categoryId: val })} required>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand">Brand / Make (Optional)</Label>
                <Input 
                  id="brand" 
                  value={formData.brand} 
                  onChange={e => setFormData({ ...formData, brand: e.target.value })} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location / Department</Label>
                <Input 
                  id="location" 
                  value={formData.location} 
                  onChange={e => setFormData({ ...formData, location: e.target.value })} 
                  required 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input 
                  id="quantity" 
                  type="number" 
                  min="1"
                  value={formData.quantity} 
                  onChange={e => setFormData({ ...formData, quantity: e.target.value })} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
              <Textarea 
                id="description" 
                value={formData.description} 
                onChange={e => setFormData({ ...formData, description: e.target.value })} 
              />
            </div>
          </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchaseDate">Purchase Date</Label>
                <Input 
                  id="purchaseDate" 
                  type="date" 
                  value={formData.purchaseDate} 
                  onChange={e => setFormData({ ...formData, purchaseDate: e.target.value })} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier">Supplier/Vendor (Optional)</Label>
                <Input 
                  id="supplier" 
                  value={formData.supplier} 
                  onChange={e => setFormData({ ...formData, supplier: e.target.value })} 
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchaseCost">Purchase Cost</Label>
                <Input 
                  id="purchaseCost" 
                  type="number" 
                  step="0.01" 
                  min="0"
                  value={formData.purchaseCost} 
                  onChange={e => setFormData({ ...formData, purchaseCost: e.target.value })} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="residualValue">Residual Value</Label>
                <Input 
                  id="residualValue" 
                  type="number" 
                  step="0.01" 
                  min="0"
                  value={formData.residualValue} 
                  onChange={e => setFormData({ ...formData, residualValue: e.target.value })} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="usefulLife">Useful Life (Years)</Label>
                <Input 
                  id="usefulLife" 
                  type="number" 
                  min="1"
                  value={formData.usefulLife} 
                  onChange={e => setFormData({ ...formData, usefulLife: e.target.value })} 
                  required 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="depreciationMethod">Depreciation Method</Label>
                <Select value={formData.depreciationMethod} onValueChange={(val) => setFormData({ ...formData, depreciationMethod: val })}>
                  <SelectTrigger id="depreciationMethod">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STRAIGHT_LINE">Straight Line</SelectItem>
                    <SelectItem value="DECLINING_BALANCE">Declining Balance</SelectItem>
                    <SelectItem value="NONE">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : 'Register Asset'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
