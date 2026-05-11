'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, DollarSign, Clock, ArrowLeft, Trash2, Pencil } from 'lucide-react';
import { format } from 'date-fns/format';
import Link from 'next/link';

interface Employee {
  id: string;
  fullName: string;
  employeeId: string;
}

interface AdvancePayment {
  id: string;
  amount: number;
  balanceAfter: number;
  paymentDate: string;
  notes: string;
  payroll?: {
    periodStart: string;
    periodEnd: string;
  };
}

interface Advance {
  id: string;
  employeeId: string;
  employee: Employee;
  type: string;
  totalAmount: number;
  remainingBalance: number;
  deductionAmount: number;
  status: string;
  date?: string;
  reference?: string;
  createdAt: string;
  payments?: AdvancePayment[];
}

export default function AdvancesPage() {
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAdvance, setSelectedAdvance] = useState<Advance | null>(null);
  const [editFormData, setEditFormData] = useState({
    id: '',
    deductionAmount: '',
    totalAmount: '',
    date: '',
    reference: '',
  });
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form state
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [showEmployeeList, setShowEmployeeList] = useState(false);
  const [formData, setFormData] = useState({
    employeeId: '',
    type: 'CASH_ADVANCE',
    totalAmount: '',
    deductionAmount: '',
    date: new Date().toISOString().split('T')[0],
    reference: '',
  });

  useEffect(() => {
    fetchAdvances();
    fetchEmployees();
  }, []);

  const fetchAdvances = async () => {
    try {
      const res = await fetch('/api/advances', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch advances');
      const data: Advance[] = await res.json();
      setAdvances(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/employees', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch employees');
      const data: Employee[] = await res.json();
      setEmployees(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!formData.employeeId) {
      setError('Please select an employee');
      return;
    }

    try {
      const res = await fetch('/api/advances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json().then(d => d as { error?: string; details?: string });
        throw new Error(data.details ? `${data.error}: ${data.details}` : (data.error || 'Failed to create advance'));
      }

      alert('Advance record created successfully!');
      setShowModal(false);
      setFormData({ 
        employeeId: '', 
        type: 'CASH_ADVANCE', 
        totalAmount: '', 
        deductionAmount: '', 
        date: new Date().toISOString().split('T')[0], 
        reference: '' 
      });
      setEmployeeSearch('');
      fetchAdvances();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this advance record?')) return;

    try {
      const res = await fetch(`/api/advances?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete advance');
      fetchAdvances();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'An unknown error occurred');
    }
  };

  const handleEdit = (advance: Advance) => {
    let dateValue = '';
    if (advance.date) {
      const d = new Date(advance.date);
      if (!isNaN(d.getTime())) {
        dateValue = d.toISOString().split('T')[0];
      }
    }
    setEditFormData({
      id: advance.id,
      deductionAmount: advance.deductionAmount.toString(),
      totalAmount: advance.totalAmount.toString(),
      date: dateValue,
      reference: advance.reference || '',
    });
    setSelectedAdvance(advance);
    setShowEditModal(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!editFormData.id) {
      setError('Invalid advance ID');
      return;
    }

    try {
      const res = await fetch('/api/advances', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData),
      });

      if (!res.ok) {
        const data = await res.json().then(d => d as { error?: string });
        throw new Error(data.error || 'Failed to update advance');
      }

      alert('Advance updated successfully!');
      setShowEditModal(false);
      setEditFormData({ id: '', deductionAmount: '', totalAmount: '', date: '', reference: '' });
      fetchAdvances();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    }
  };

  const fetchAdvanceDetails = async (id: string) => {
    try {
      const res = await fetch(`/api/advances?id=${id}`);
      if (!res.ok) throw new Error('Failed to fetch details');
      const data: Advance = await res.json();
      setSelectedAdvance(data);
      setShowDetails(true);
    } catch (err) {
      console.error('Failed to load advance details:', err);
      alert('Failed to load advance details');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'CASH_ADVANCE': return 'Cash Advance';
      case 'SSS_LOAN': return 'SSS Loan';
      case 'PAGIBIG_LOAN': return 'Pag-IBIG Loan';
      default: return type;
    }
  };

  const filteredAdvances = advances.filter(advance => {
    const searchStr = searchTerm.toLowerCase();
    return (
      advance.employee.fullName.toLowerCase().includes(searchStr) ||
      advance.employee.employeeId.toLowerCase().includes(searchStr) ||
      advance.type.toLowerCase().includes(searchStr) ||
      advance.status.toLowerCase().includes(searchStr)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/payroll" className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Advances Management</h1>
            <p className="text-gray-500">Manage employee loans and repayments</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Add New Advance
        </button>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="font-semibold text-gray-900">All Advances</h2>
          <div className="relative w-full sm:w-64">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Search by name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : filteredAdvances.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <DollarSign className="w-8 h-8 text-gray-300" />
            </div>
            <p className="font-medium">No advances found</p>
            {searchTerm && <p className="text-sm mt-1">Try adjusting your search</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Employee</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Type / Ref</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">Original</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">Balance</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">Deduction</th>
                  <th className="px-6 py-3 text-center font-medium text-gray-500">Status</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredAdvances.map((advance) => (
                  <tr key={advance.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{advance.employee.fullName}</div>
                      <div className="text-xs text-gray-500">{advance.employee.employeeId}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      <div className="font-medium text-gray-900">{getTypeName(advance.type)}</div>
                      {advance.reference && <div className="text-xs text-gray-400">Ref: {advance.reference}</div>}
                      {advance.date && <div className="text-[10px] text-gray-400">{format(new Date(advance.date), 'MMM dd, yyyy')}</div>}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900">
                      {formatCurrency(advance.totalAmount)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-bold ${advance.remainingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(advance.remainingBalance)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-blue-600 font-medium">
                      {formatCurrency(advance.deductionAmount)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        advance.status === 'ACTIVE' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {advance.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button 
                        onClick={() => handleEdit(advance)}
                        className="text-green-600 hover:text-green-800"
                        title="Edit deduction amount"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => fetchAdvanceDetails(advance.id)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        SOA / History
                      </button>
                      <button 
                        onClick={() => handleDelete(advance.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl my-8">
            <div className="p-6 border-b flex justify-between items-center bg-blue-600 text-white">
              <h2 className="text-xl font-bold">New Advance Record</h2>
              <button onClick={() => setShowModal(false)} className="hover:opacity-80">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
              
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Employee *</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search employee name..."
                    value={employeeSearch}
                    onChange={(e) => {
                      setEmployeeSearch(e.target.value);
                      setShowEmployeeList(true);
                    }}
                    onFocus={() => setShowEmployeeList(true)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                {showEmployeeList && employees.length > 0 && (
                  <div className="absolute z-[100] left-0 right-0 mt-1 bg-white border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {employees
                      .filter(emp => emp.fullName.toLowerCase().includes(employeeSearch.toLowerCase()))
                      .map(emp => (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, employeeId: emp.id });
                            setEmployeeSearch(emp.fullName);
                            setShowEmployeeList(false);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b last:border-0 text-gray-900"
                        >
                          <p className="text-sm font-medium">{emp.fullName}</p>
                        </button>
                      ))
                    }
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Advance Type *</label>
                <select 
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="CASH_ADVANCE">Cash Advance</option>
                  <option value="SSS_LOAN">SSS Loan</option>
                  <option value="PAGIBIG_LOAN">Pag-IBIG Loan</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount / Balance *</label>
                <input 
                  type="number"
                  step="0.01"
                  required
                  value={formData.totalAmount}
                  onChange={(e) => setFormData({...formData, totalAmount: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deductible Amount per Payroll *</label>
                <input 
                  type="number"
                  step="0.01"
                  required
                  value={formData.deductionAmount}
                  onChange={(e) => setFormData({...formData, deductionAmount: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date Incurred *</label>
                  <input 
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference No.</label>
                  <input 
                    type="text"
                    value={formData.reference}
                    onChange={(e) => setFormData({...formData, reference: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 text-gray-700">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Save Advance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SOA / History Modal */}
      {showDetails && selectedAdvance && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <div>
                <h2 className="text-xl font-bold">Statement of Account</h2>
                <p className="text-sm text-gray-500">{getTypeName(selectedAdvance.type)} - {selectedAdvance.employee.fullName}</p>
              </div>
              <button onClick={() => setShowDetails(false)} className="hover:bg-gray-200 p-1 rounded-full">
                <XCircle className="w-6 h-6 text-gray-400" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="bg-gray-50 p-4 rounded-xl border space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Date Incurred:</span>
                  <span className="font-medium text-gray-900">
                    {selectedAdvance.date ? format(new Date(selectedAdvance.date), 'MMMM dd, yyyy') : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Reference No:</span>
                  <span className="font-medium text-gray-900">{selectedAdvance.reference || 'None'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div>
                  <p className="text-xs text-blue-600 font-bold uppercase">Original Amount</p>
                  <p className="text-lg font-bold text-blue-900">{formatCurrency(selectedAdvance.totalAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-blue-600 font-bold uppercase">Current Balance</p>
                  <p className="text-lg font-bold text-red-600">{formatCurrency(selectedAdvance.remainingBalance)}</p>
                </div>
                <div>
                  <p className="text-xs text-blue-600 font-bold uppercase">Deduction / Pay</p>
                  <p className="text-lg font-bold text-blue-900">{formatCurrency(selectedAdvance.deductionAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-blue-600 font-bold uppercase">Status</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    selectedAdvance.status === 'ACTIVE' ? 'bg-blue-200 text-blue-800' : 'bg-green-200 text-green-800'
                  }`}>
                    {selectedAdvance.status}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  Payment History
                </h3>
                <div className="border rounded-lg overflow-hidden text-sm">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">Date</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">Payroll Period</th>
                        <th className="px-4 py-2 text-right font-medium text-gray-500">Amount</th>
                        <th className="px-4 py-2 text-right font-medium text-gray-500">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedAdvance.payments && selectedAdvance.payments.length > 0 ? (
                        selectedAdvance.payments.map((p) => (
                          <tr key={p.id}>
                            <td className="px-4 py-2">{format(new Date(p.paymentDate), 'MMM dd, yyyy')}</td>
                            <td className="px-4 py-2">
                              {p.payroll ? (
                                `${format(new Date(p.payroll.periodStart), 'MMM dd')} - ${format(new Date(p.payroll.periodEnd), 'MMM dd')}`
                              ) : (
                                <span className="text-gray-400 italic">Manual / Other</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right font-medium text-green-600">-{formatCurrency(p.amount)}</td>
                            <td className="px-4 py-2 text-right">{formatCurrency(p.balanceAfter)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-gray-500 italic">No payments recorded yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
              <button 
                onClick={() => window.print()}
                className="px-4 py-2 bg-white border rounded-lg flex items-center gap-2 hover:bg-gray-100"
              >
                <Printer className="w-4 h-4" />
                Print Statement
              </button>
              <button onClick={() => setShowDetails(false)} className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Edit Modal */}
      {showEditModal && selectedAdvance && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl my-8">
            <div className="p-6 border-b flex justify-between items-center bg-green-600 text-white">
              <h2 className="text-xl font-bold">Edit Advance</h2>
              <button onClick={() => setShowEditModal(false)} className="hover:opacity-80">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
              
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">Employee: <span className="font-medium text-gray-900">{selectedAdvance.employee.fullName}</span></p>
                <p className="text-sm text-gray-600">Current Balance: <span className="font-medium text-red-600">{formatCurrency(selectedAdvance.remainingBalance)}</span></p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount / Balance *</label>
                <input 
                  type="number"
                  step="0.01"
                  required
                  value={editFormData.totalAmount}
                  onChange={(e) => setEditFormData({...editFormData, totalAmount: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deductible Amount per Payroll *</label>
                <input 
                  type="number"
                  step="0.01"
                  required
                  value={editFormData.deductionAmount}
                  onChange={(e) => setEditFormData({...editFormData, deductionAmount: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="0.00"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date Incurred *</label>
                  <input 
                    type="date"
                    required
                    value={editFormData.date}
                    onChange={(e) => setEditFormData({...editFormData, date: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference No.</label>
                  <input 
                    type="text"
                    value={editFormData.reference}
                    onChange={(e) => setEditFormData({...editFormData, reference: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 text-gray-700">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Printer({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

function XCircle({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}
