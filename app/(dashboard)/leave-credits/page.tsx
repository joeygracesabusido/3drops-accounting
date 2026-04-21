'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, PlusCircle, MinusCircle, Settings, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns/format';
import type { LeaveCredit, LeaveCreditTransaction } from '@/types';

interface LeaveCreditBalance {
  vacation: {
    available: number;
    used: number;
    total: number;
  };
  sick: {
    available: number;
    used: number;
    total: number;
  };
}

interface LeaveCreditWithTransactions extends LeaveCredit {
  transactions: LeaveCreditTransaction[];
}

export default function LeaveCreditsPage() {
  const [credits, setCredits] = useState<LeaveCreditWithTransactions[]>([]);
  const [balance, setBalance] = useState<LeaveCreditBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showAccrualModal, setShowAccrualModal] = useState(false);
  const [accruing, setAccruing] = useState(false);
  const [accrualResult, setAccrualResult] = useState<{ successful: number; failed: number } | null>(null);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

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

    const { role, loggedIn } = getCookies();
    if (!loggedIn) {
      window.location.href = '/login';
      return;
    }
    setUserRole(role);
    fetchBalance();
    fetchCredits();
  }, []);

  const fetchBalance = async () => {
    try {
      const res = await fetch(`/api/leave-credits/balance?year=${selectedYear}`, { credentials: 'include' });
      const data = await res.json();
      if (data && !data.error) {
        setBalance(data);
      }
    } catch (err) {
      console.error('Failed to fetch balance:', err);
    }
  };

  const fetchCredits = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leave-credits?year=${selectedYear}`, { credentials: 'include' });
      const data = await res.json();
      if (Array.isArray(data)) {
        setCredits(data);
      }
    } catch (err) {
      console.error('Failed to fetch credits:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchBalance(), fetchCredits()]);
    setRefreshing(false);
  };

  const handleYearChange = async (year: number) => {
    setSelectedYear(year);
    try {
      const [balanceRes, creditsRes] = await Promise.all([
        fetch(`/api/leave-credits/balance?year=${year}`, { credentials: 'include' }),
        fetch(`/api/leave-credits?year=${year}`, { credentials: 'include' })
      ]);
      const [balanceData, creditsData] = await Promise.all([balanceRes.json(), creditsRes.json()]);
      if (balanceData && !balanceData.error) setBalance(balanceData);
      if (Array.isArray(creditsData)) setCredits(creditsData);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
  };

  const handleRunAccrual = async () => {
    setAccruing(true);
    setAccrualResult(null);
    try {
      const res = await fetch('/api/leave-credits/accrue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ year: selectedYear }),
      });
      const data = await res.json();
      if (data.summary) {
        setAccrualResult({ successful: data.summary.successful, failed: data.summary.failed });
      }
      await fetchBalance();
      await fetchCredits();
    } catch (err) {
      console.error('Failed to run accrual:', err);
    } finally {
      setAccruing(false);
    }
  };

  const getTransactionColor = (type: string, days: number) => {
    if (type === 'MONTHLY_ACCRUAL' || type === 'CARRY_FORWARD') return 'text-green-600';
    if (type === 'USED') return 'text-red-600';
    if (type === 'ADJUSTMENT') return days >= 0 ? 'text-green-600' : 'text-red-600';
    return 'text-blue-600';
  };

  const getTransactionIcon = (type: string, days: number) => {
    if (type === 'MONTHLY_ACCRUAL' || type === 'CARRY_FORWARD') return <PlusCircle className="w-4 h-4" />;
    if (type === 'USED') return <MinusCircle className="w-4 h-4" />;
    if (type === 'ADJUSTMENT') return days >= 0 ? <PlusCircle className="w-4 h-4" /> : <MinusCircle className="w-4 h-4" />;
    return <Settings className="w-4 h-4" />;
  };

  const isAdmin = userRole === 'ADMIN';

  const allTransactions = credits
    .flatMap(c => c.transactions.map(t => ({ ...t, leaveType: c.leaveType })))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leave Credits</h1>
          <p className="text-gray-500">View your leave balance and transaction history</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => handleYearChange(parseInt(e.target.value))}
            className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Vacation Leave</p>
                <p className="text-3xl font-bold text-gray-900">
                  {balance?.vacation?.available ?? 0}
                  <span className="text-lg font-normal text-gray-400">/{balance?.vacation?.total ?? 0}</span>
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Used</p>
              <p className="text-lg font-semibold text-red-500">{balance?.vacation?.used ?? 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-50 rounded-lg">
                <Calendar className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Sick Leave</p>
                <p className="text-3xl font-bold text-gray-900">
                  {balance?.sick?.available ?? 0}
                  <span className="text-lg font-normal text-gray-400">/{balance?.sick?.total ?? 0}</span>
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Used</p>
              <p className="text-lg font-semibold text-red-500">{balance?.sick?.used ?? 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Actions */}
      {isAdmin && (
        <div className="bg-white rounded-xl border p-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Admin Actions</h3>
            <p className="text-sm text-gray-500">Run monthly accrual for all regular employees</p>
          </div>
          <button
            onClick={() => setShowAccrualModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <PlusCircle className="w-4 h-4" />
            Run Monthly Accrual
          </button>
        </div>
      )}

      {/* Transaction History */}
      <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
        <div className="p-4 border-b bg-gray-50/50">
          <h2 className="font-semibold text-gray-900">Transaction History</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : allTransactions.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-gray-300" />
            </div>
            <p className="font-medium">No transactions found</p>
            <p className="text-sm mt-1">Your leave transactions will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Balance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {allTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {format(new Date(transaction.createdAt), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4">
                      <div className={`flex items-center gap-2 ${getTransactionColor(transaction.type, transaction.days)}`}>
                        {getTransactionIcon(transaction.type, transaction.days)}
                        <span className="text-sm font-medium capitalize">
                          {transaction.leaveType.toLowerCase()} - {transaction.type.toLowerCase().replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-bold ${transaction.days >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {transaction.days >= 0 ? '+' : ''}{transaction.days}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {transaction.balanceAfter}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {transaction.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Run Accrual Modal */}
      {showAccrualModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-blue-600 text-white">
              <h2 className="text-xl font-bold">Run Monthly Accrual</h2>
              <button
                onClick={() => { setShowAccrualModal(false); setAccrualResult(null); }}
                className="p-1 hover:bg-blue-500 rounded-lg transition-colors"
              >
                <AlertCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {!accrualResult ? (
                <>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex gap-3">
                      <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-yellow-800 font-medium">This action will:</p>
                        <ul className="text-sm text-yellow-700 mt-2 space-y-1">
                          <li>Accrue leave credits for all regular employees</li>
                          <li>Apply 1.25 days vacation + 1 day sick leave per month</li>
                          <li>Cannot be undone</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => setShowAccrualModal(false)}
                      className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRunAccrual}
                      disabled={accruing}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md disabled:opacity-50"
                    >
                      {accruing ? 'Processing...' : 'Run Accrual'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Accrual Complete</h3>
                  <div className="mt-4 space-y-2 text-sm">
                    <p className="text-green-600 font-medium">{accrualResult.successful} employees processed</p>
                    {accrualResult.failed > 0 && (
                      <p className="text-red-600 font-medium">{accrualResult.failed} employees failed</p>
                    )}
                  </div>
                  <button
                    onClick={() => { setShowAccrualModal(false); setAccrualResult(null); }}
                    className="mt-6 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
