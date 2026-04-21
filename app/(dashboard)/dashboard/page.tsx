'use client';

import { useState, useEffect } from 'react';
import { Users, DollarSign, Clock, TrendingUp, UserMinus, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Stats {
  totalEmployees: number;
  presentToday: number;
  onLeaveToday: number;
  absentPerDepartment: {
    name: string;
    absent: number;
    total: number;
  }[];
  personalStats?: {
    isPresent: boolean;
    isOnLeave: boolean;
    employeeName: string | undefined;
    department: string | undefined;
  };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
    setUserRole(cookies.userRole || '');
    
    async function fetchStats() {
      try {
        const response = await fetch('/api/dashboard/stats', { credentials: 'include' });
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // EMPLOYEE role view
  if (userRole === 'EMPLOYEE' && stats?.personalStats) {
    const { isPresent, isOnLeave, employeeName, department } = stats.personalStats;
    
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Dashboard</h1>
          <p className="text-gray-500">Welcome back, {employeeName}!</p>
        </div>

        {/* Personal Status Card */}
        <Card className="shadow-sm border">
          <CardHeader className="p-6 border-b">
            <CardTitle className="text-lg font-semibold">Today&apos;s Status</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex items-center justify-between p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-lg">
              <div className="flex items-center gap-4">
                {isPresent ? (
                  <div className="p-3 bg-green-500 rounded-full">
                    <CheckCircle className="w-8 h-8 text-white" />
                  </div>
                ) : isOnLeave ? (
                  <div className="p-3 bg-orange-500 rounded-full">
                    <DollarSign className="w-8 h-8 text-white" />
                  </div>
                ) : (
                  <div className="p-3 bg-red-500 rounded-full">
                    <AlertCircle className="w-8 h-8 text-white" />
                  </div>
                )}
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {isPresent ? 'Present Today' : isOnLeave ? 'On Leave' : 'Not Yet Clocked In'}
                  </p>
                  <p className="text-sm text-gray-500">{department || 'Unassigned Department'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Admin roles view
  const summaryStats = [
    { label: 'Total Employees', value: stats?.totalEmployees.toString() || '0', icon: Users, color: 'bg-blue-500' },
    { label: 'Present Today', value: stats?.presentToday.toString() || '0', icon: Clock, color: 'bg-green-500' },
    { label: 'On Leave Today', value: stats?.onLeaveToday.toString() || '0', icon: UserMinus, color: 'bg-orange-500' },
    { label: 'Total Absents', value: (stats?.totalEmployees || 0) - (stats?.presentToday || 0) + '', icon: TrendingUp, color: 'bg-purple-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Welcome back! Here&apos;s what&apos;s happening today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {summaryStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-xl p-6 shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Absent per Department */}
        <Card className="shadow-sm border">
          <CardHeader className="p-6 border-b">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <UserMinus className="w-5 h-5 text-red-500" />
              Employee Absent per Department
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {stats?.absentPerDepartment.map((dept) => (
                <div key={dept.name} className="flex flex-col gap-1">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-gray-700">{dept.name}</span>
                    <span className="text-gray-500">
                      {dept.absent} / {dept.total} absent
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        (dept.absent / dept.total) > 0.5 ? 'bg-red-500' : 
                        (dept.absent / dept.total) > 0.2 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${(dept.absent / dept.total) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              {stats?.absentPerDepartment.length === 0 && (
                <p className="text-center text-gray-500 py-4">No department data available.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Legend / Breakdown */}
        <Card className="shadow-sm border">
          <CardHeader className="p-6 border-b">
            <CardTitle className="text-lg font-semibold">Attendance Overview</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
             <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between p-4 bg-green-50 border border-green-100 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-sm font-medium text-green-900">Present</span>
                  </div>
                  <span className="text-xl font-bold text-green-900">{stats?.presentToday}</span>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-orange-50 border border-orange-100 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-orange-500" />
                    <span className="text-sm font-medium text-orange-900">On Leave (Approved)</span>
                  </div>
                  <span className="text-xl font-bold text-orange-900">{stats?.onLeaveToday}</span>
                </div>

                <div className="flex items-center justify-between p-4 bg-red-50 border border-red-100 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-sm font-medium text-red-900">Unaccounted (No log)</span>
                  </div>
                  <span className="text-xl font-bold text-red-900">
                    {Math.max(0, (stats?.totalEmployees || 0) - (stats?.presentToday || 0) - (stats?.onLeaveToday || 0))}
                  </span>
                </div>
              </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
