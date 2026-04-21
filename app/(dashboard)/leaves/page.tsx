'use client';

import { useState, useEffect } from 'react';
import { Plus, Calendar, CheckCircle, XCircle, Clock, Search, Filter, Info, FileText } from 'lucide-react';
import { format } from 'date-fns/format';
import type { LeaveRequest, LeaveStatus, EmployeeWithUser } from '@/types';

export default function LeavesPage() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<EmployeeWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Autocomplete state
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [showEmployeeList, setShowEmployeeList] = useState(false);

  const [formData, setFormData] = useState({
    employeeId: '',
    leaveType: 'VACATION',
    startDate: '',
    endDate: '',
    reason: '',
    daysCount: '1',
  });

  const [approvalData, setApprovalData] = useState({
    status: 'APPROVED' as LeaveStatus,
    adminNotes: '',
  });

  const [leaveBalance, setLeaveBalance] = useState({ vacation: 0, sick: 0 });

  const fetchLeaveBalance = async () => {
    try {
      const res = await fetch('/api/leave-credits/balance', { credentials: 'include' });
      const data = await res.json();
      if (data.vacation !== undefined) {
        setLeaveBalance({ vacation: data.vacation, sick: data.sick });
      }
    } catch (err) {
      console.error('Failed to fetch leave balance:', err);
    }
  };

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const getCookies = () => {
      const cookies = document.cookie.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);
      return { 
        role: cookies.userRole || '', 
        id: cookies.userId || '',
        loggedIn: cookies.isLoggedIn === 'true' 
      };
    };
    
    const { role, id, loggedIn } = getCookies();
    if (!loggedIn) {
      window.location.href = '/login';
      return;
    }
    setUserRole(role);
    fetchLeaves();
    fetchEmployees();
    fetchCurrentUser(id);
  }, []);

  useEffect(() => {
    if (showModal) {
      fetchLeaveBalance();
    }
  }, [showModal]);

  const fetchCurrentUser = async (uid: string) => {
    try {
      const res = await fetch(`/api/current-user?userId=${uid}`, { credentials: 'include' });
      const data = await res.json();
      if (data.role) {
        setUserRole(data.role);
      }
    } catch (err) {
      console.error('Failed to fetch current user info:', err);
    }
  };

  const fetchLeaves = async () => {
    try {
      const res = await fetch('/api/leaves', { credentials: 'include' });
      const data = await res.json();
      
      if (!res.ok) {
        console.error('API Error:', data.error);
        setError(data.error || 'Failed to fetch leaves');
        setLeaves([]);
        return;
      }
      
      if (Array.isArray(data)) {
        setLeaves(data);
      }
    } catch (err) {
      console.error('Failed to fetch leaves:', err);
      setLeaves([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/employees', { credentials: 'include' });
      const data = await res.json();
      if (Array.isArray(data)) {
        setEmployees(data);
      }
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit leave request');
      }

      alert('Leave request submitted successfully!');
      setShowModal(false);
      setFormData({
        employeeId: formData.employeeId,
        leaveType: 'VACATION',
        startDate: '',
        endDate: '',
        reason: '',
        daysCount: '1',
      });
      fetchLeaves();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    }
  };

  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeave) return;

    try {
      const res = await fetch('/api/leaves', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: selectedLeave.id,
          ...approvalData
        }),
      });

      if (!res.ok) throw new Error('Failed to update leave request');

      alert(`Leave request ${approvalData.status.toLowerCase()} successfully!`);
      setShowApproveModal(false);
      setSelectedLeave(null);
      setApprovalData({ status: 'APPROVED', adminNotes: '' });
      fetchLeaves();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'An unknown error occurred');
    }
  };

  const getStatusColor = (status: LeaveStatus) => {
    switch (status) {
      case 'APPROVED': return 'bg-green-100 text-green-700';
      case 'REJECTED': return 'bg-red-100 text-red-700';
      case 'PENDING': return 'bg-yellow-100 text-yellow-700';
      case 'CANCELLED': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const isAdmin = userRole === 'ADMIN';

  const filteredLeaves = leaves.filter(leave => {
    const searchStr = searchTerm.toLowerCase();
    return (
      leave.employee?.fullName.toLowerCase().includes(searchStr) ||
      leave.employee?.employeeId.toLowerCase().includes(searchStr) ||
      leave.leaveType.toLowerCase().includes(searchStr) ||
      leave.status.toLowerCase().includes(searchStr)
    );
  });

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leave Management</h1>
          <p className="text-gray-500">Track and manage employee leaves</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          File Leave
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl border shadow-sm flex items-center gap-4">
          <div className="p-3 bg-yellow-50 rounded-lg">
            <Clock className="w-6 h-6 text-yellow-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Pending Requests</p>
            <p className="text-2xl font-bold">{filteredLeaves.filter(l => l.status === 'PENDING').length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-50 rounded-lg">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Approved Leaves</p>
            <p className="text-2xl font-bold">{filteredLeaves.filter(l => l.status === 'APPROVED').length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <Calendar className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Days Taken</p>
            <p className="text-2xl font-bold">
              {filteredLeaves.filter(l => l.status === 'APPROVED').reduce((acc, curr) => acc + curr.daysCount, 0)}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
        <div className="p-4 border-b flex items-center justify-between bg-gray-50/50">
          <h2 className="font-semibold text-gray-900">Recent Leave Requests</h2>
          <div className="flex gap-2">
            <div className="relative">
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Search leaves..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <button className="p-2 hover:bg-white rounded-lg border text-gray-500">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : filteredLeaves.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-gray-300" />
            </div>
            <p className="font-medium">No leave requests found</p>
            <p className="text-sm mt-1">{searchTerm ? 'Try adjusting your search' : 'Start by filing a leave request.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredLeaves.map((leave) => (
                  <tr key={leave.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{leave.employee?.fullName}</p>
                        <p className="text-xs text-gray-500">{leave.employee?.employeeId}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-gray-700 capitalize">
                        {leave.leaveType.toLowerCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {format(new Date(leave.startDate), 'MMM dd')} - {format(new Date(leave.endDate), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {leave.daysCount}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(leave.status)}`}>
                        {leave.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => {
                          setSelectedLeave(leave);
                          setShowApproveModal(true);
                        }}
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        <Info className="w-4 h-4" />
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* File Leave Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-blue-600 text-white">
              <h2 className="text-xl font-bold">File Leave Request</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-blue-500 rounded-lg transition-colors">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleApply} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
              
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">Available Balance</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Vacation</p>
                    <p className="text-lg font-bold text-green-600">{leaveBalance.vacation.toFixed(2)} days</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Sick</p>
                    <p className="text-lg font-bold text-orange-600">{leaveBalance.sick.toFixed(2)} days</p>
                  </div>
                </div>
              </div>

              {/* Employee Selection - Show for Admins */}
              {(isAdmin) && (
                <div className="relative mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Employee *</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <Search className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      placeholder="Search employee name..."
                      autoComplete="off"
                      value={employeeSearch}
                      onChange={(e) => {
                        setEmployeeSearch(e.target.value);
                        setShowEmployeeList(true);
                      }}
                      onFocus={() => setShowEmployeeList(true)}
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  {showEmployeeList && (
                    <div className="absolute z-[100] left-0 right-0 mt-1 bg-white border rounded-lg shadow-2xl max-h-60 overflow-y-auto">
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
                            className="w-full text-left px-4 py-3 hover:bg-blue-50 flex items-center gap-3 border-b last:border-0"
                          >
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs font-bold">
                              {emp.fullName[0]}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{emp.fullName}</p>
                              <p className="text-xs text-gray-500">{emp.employeeId}</p>
                            </div>
                          </button>
                        ))
                      }
                      {employees.filter(emp => emp.fullName.toLowerCase().includes(employeeSearch.toLowerCase())).length === 0 && (
                        <div className="p-4 text-center text-sm text-gray-500">No employees found</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type *</label>
                <select name="leaveType" value={formData.leaveType} onChange={handleChange} required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option value="VACATION">Vacation Leave</option>
                  <option value="SICK">Sick Leave</option>
                  <option value="EMERGENCY">Emergency Leave</option>
                  <option value="MATERNITY">Maternity Leave</option>
                  <option value="PATERNITY">Paternity Leave</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                  <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} required
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
                  <input type="date" name="endDate" value={formData.endDate} onChange={handleChange} required
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Days Count *</label>
                <input type="number" step="0.5" name="daysCount" value={formData.daysCount} onChange={handleChange} required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                <textarea name="reason" value={formData.reason} onChange={handleChange} required rows={3}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="State your reason for leave..." />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md">
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review/Details Modal */}
      {showApproveModal && selectedLeave && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold">Leave Details</h2>
              <button onClick={() => setShowApproveModal(false)} className="p-1 hover:bg-gray-200 rounded-lg transition-colors">
                <XCircle className="w-6 h-6 text-gray-400" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-start border-b pb-4">
                <div>
                  <p className="text-sm text-gray-500 uppercase font-semibold">Employee</p>
                  <p className="text-lg font-bold">{selectedLeave.employee?.fullName}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500 uppercase font-semibold">Status</p>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${getStatusColor(selectedLeave.status)}`}>
                    {selectedLeave.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Type</p>
                  <p className="font-semibold capitalize">{selectedLeave.leaveType.toLowerCase()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Duration</p>
                  <p className="font-semibold">{selectedLeave.daysCount} Day(s)</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Dates</p>
                  <p className="font-semibold">{format(new Date(selectedLeave.startDate), 'MMM dd')} - {format(new Date(selectedLeave.endDate), 'MMM dd, yyyy')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Filed On</p>
                  <p className="font-semibold">{format(new Date(selectedLeave.createdAt), 'MMM dd, yyyy')}</p>
                </div>
              </div>

              <div className="bg-blue-50 p-3 rounded-lg flex gap-3">
                <FileText className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-blue-600 uppercase font-bold">Reason</p>
                  <p className="text-sm text-blue-900">{selectedLeave.reason}</p>
                </div>
              </div>

              {selectedLeave.adminNotes && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase font-bold">Approver Notes</p>
                  <p className="text-sm text-gray-900">{selectedLeave.adminNotes}</p>
                </div>
              )}

              {/* Approval Actions - Show only if status is PENDING and user is ADMIN */}
              {selectedLeave.status === 'PENDING' && isAdmin && (
                <form onSubmit={handleReview} className="pt-4 border-t space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Approval Notes</label>
                    <textarea 
                      value={approvalData.adminNotes}
                      onChange={(e) => setApprovalData({...approvalData, adminNotes: e.target.value})}
                      rows={2}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Optional notes for approval/rejection..."
                    />
                  </div>
                  <div className="flex gap-3">
                    <button 
                      type="submit" 
                      onClick={() => setApprovalData({...approvalData, status: 'REJECTED'})}
                      className="flex-1 px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Reject
                    </button>
                    <button 
                      type="submit" 
                      onClick={() => setApprovalData({...approvalData, status: 'APPROVED'})}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-md transition-colors"
                    >
                      Approve
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
