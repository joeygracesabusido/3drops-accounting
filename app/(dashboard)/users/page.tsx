'use client';

import { useState, useEffect } from 'react';
import { Check, X, Clock, UserCheck, UserX, Shield, Briefcase, Users, UserCog } from 'lucide-react';

type UserRole = 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE';

interface User {
  id: string;
  username: string;
  email: string;
  name: string | null;
  role: UserRole;
  status: string;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [mounted, setMounted] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<UserRole>('EMPLOYEE');

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users', { credentials: 'include' });
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchUsers();

    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    setUserRole(cookies.userRole || '');
  }, []);

  if (!mounted) return null;

  const handleStatusChange = async (userId: string, status: string) => {
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status }),
      });

      if (res.ok) {
        setUsers(users.map(user => 
          user.id === userId ? { ...user, status } : user
        ));
      }
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  };

  const handleRoleUpdate = async (userId: string) => {
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });

      if (res.ok) {
        setUsers(users.map(user => 
          user.id === userId ? { ...user, role: newRole } : user
        ));
        setEditingUserId(null);
      }
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  const startEditingRole = (user: User) => {
    setEditingUserId(user.id);
    setNewRole(user.role);
  };

  const cancelRoleEdit = () => {
    setEditingUserId(null);
  };

  const getRoleBadge = (role: UserRole) => {
    const config = {
      ADMIN: { icon: Shield, color: 'bg-purple-100 text-purple-700' },
      HR: { icon: UserCog, color: 'bg-pink-100 text-pink-700' },
      MANAGER: { icon: Briefcase, color: 'bg-blue-100 text-blue-700' },
      EMPLOYEE: { icon: Users, color: 'bg-gray-100 text-gray-700' },
    };

    const { icon: Icon, color } = config[role];
    return (
      <span className={`flex items-center gap-1 px-2 py-1 ${color} rounded text-xs`}>
        <Icon className="w-3 h-3" />
        {role}
      </span>
    );
  };

  const canEditRoles = userRole === 'ADMIN' || userRole === 'HR';

  const filteredUsers = users.filter(user => {
    if (filter === 'all') return true;
    return user.status === filter;
  });

  const pendingUsers = users.filter(u => u.status === 'FOR_APPROVAL');
  const approvedUsers = users.filter(u => u.status === 'APPROVED');
  const rejectedUsers = users.filter(u => u.status === 'REJECTED');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'FOR_APPROVAL':
        return <span className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs"><Clock className="w-3 h-3" /> Pending</span>;
      case 'APPROVED':
        return <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs"><UserCheck className="w-3 h-3" /> Approved</span>;
      case 'REJECTED':
        return <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs"><UserX className="w-3 h-3" /> Rejected</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500">Manage user registrations and approvals</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl border">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pending Approval</p>
              <p className="text-2xl font-bold">{pendingUsers.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <UserCheck className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Approved</p>
              <p className="text-2xl font-bold">{approvedUsers.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <UserX className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Rejected</p>
              <p className="text-2xl font-bold">{rejectedUsers.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            filter === 'all'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          All Users ({users.length})
        </button>
        <button
          onClick={() => setFilter('FOR_APPROVAL')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            filter === 'FOR_APPROVAL'
              ? 'border-yellow-500 text-yellow-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Pending ({pendingUsers.length})
        </button>
        <button
          onClick={() => setFilter('APPROVED')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            filter === 'APPROVED'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Approved ({approvedUsers.length})
        </button>
        <button
          onClick={() => setFilter('REJECTED')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            filter === 'REJECTED'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Rejected ({rejectedUsers.length})
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No users found</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Registered</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-medium">
                          {user.name?.[0] || user.username[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{user.name || 'N/A'}</p>
                        <p className="text-sm text-gray-500">@{user.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                  <td className="px-6 py-4">
                    {editingUserId === user.id && canEditRoles ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={newRole}
                          onChange={(e) => setNewRole(e.target.value as UserRole)}
                          className="px-2 py-1 border rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="ADMIN">Admin</option>
                          <option value="HR">HR</option>
                          <option value="MANAGER">Manager</option>
                          <option value="EMPLOYEE">Employee</option>
                        </select>
                        <button
                          onClick={() => handleRoleUpdate(user.id)}
                          className="p-1 bg-green-100 text-green-600 rounded hover:bg-green-200"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          onClick={cancelRoleEdit}
                          className="p-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {getRoleBadge(user.role)}
                        {canEditRoles && (
                          <button
                            onClick={() => startEditingRole(user)}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="Edit role"
                          >
                            <UserCog className="w-3 h-3 text-gray-400" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(user.status)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    {userRole === 'ADMIN' && user.status === 'FOR_APPROVAL' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleStatusChange(user.id, 'APPROVED')}
                          className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
                          title="Approve"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleStatusChange(user.id, 'REJECTED')}
                          className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                          title="Reject"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
