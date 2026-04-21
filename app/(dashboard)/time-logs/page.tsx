'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Clock, MapPin, NavigationOff, CheckCircle2, AlertCircle, Search, Play, Square, Upload, Download, FileSpreadsheet, LogOut, Trash2, User, X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import FaceCapture from '@/components/facial-recognition/FaceCapture';

interface Employee {
  id: string;
  employeeNumber: number;
  fullName: string;
  employeeId: string;
  email?: string;
  userId?: string;
}

interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

interface TimeLog {
  id: string;
  employeeId: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  workHours: number;
  shift: Shift | null;
  employee: {
    fullName: string;
    employeeId: string;
  };
}

export default function TimeLogsPage() {
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [userRole, setUserRole] = useState('');
  const [storedDescriptor, setStoredDescriptor] = useState<number[] | undefined>(undefined);
  const [employeeId, setEmployeeId] = useState('');
  const [todayLog, setTodayLog] = useState<TimeLog | null>(null);
  const [clockingIn, setClockingIn] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [biometricImportOpen, setBiometricImportOpen] = useState(false);
  const [biometricImporting, setBiometricImporting] = useState(false);
  const [biometricImportResult, setBiometricImportResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const biometricFileInputRef = useRef<HTMLInputElement>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [officeLocation, setOfficeLocation] = useState<{ name: string; lat: number; lon: number; radius: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [withinRange, setWithinRange] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [timeLogToDelete, setTimeLogToDelete] = useState<TimeLog | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [xclsImportOpen, setXclsImportOpen] = useState(false);
  const [xclsImporting, setXclsImporting] = useState(false);
  const [xclsImportResult, setXclsImportResult] = useState<{ success: number; absent: number; failed: number; errors: string[] } | null>(null);
  const xclsFileInputRef = useRef<HTMLInputElement>(null);
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    const getCookies = () => {
      if (typeof document === 'undefined') return { loggedIn: false };
      const cookies = document.cookie.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);
      return { 
        loggedIn: cookies.isLoggedIn === 'true',
        role: cookies.userRole || '',
        id: cookies.userId || '',
        email: cookies.userEmail || ''
      };
    };
    
    const { loggedIn, role, id, email } = getCookies();
    if (!loggedIn) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return;
    }
    setUserRole(role || '');
    setUserId(id || '');
    fetchEmployees(role || '', email || '');
    fetchTimeLogs();
    fetchOfficeLocation();
    getUserLocation();
  }, []);

useEffect(() => {
    if (timeLogs.length > 0 && employeeId) {
      const today = new Date().toISOString().split('T')[0];
      const todayEntry = timeLogs.find((log: TimeLog) => 
        log.date.startsWith(today) && log.employeeId === employeeId
      );
      setTodayLog(todayEntry || null);
    }
  }, [timeLogs, employeeId]);

  useEffect(() => {
    if (showFaceModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showFaceModal]);

  const fetchTimeLogs = async () => {
    try {
      const res = await fetch('/api/time-logs', { credentials: 'include' });
      if (!res.ok) {
        console.error('Failed to fetch time logs:', res.statusText);
        setTimeLogs([]);
        return;
      }
      const data = await res.json() as TimeLog[];
      setTimeLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch time logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOfficeLocation = async () => {
    try {
      const res = await fetch('/api/office-location', { credentials: 'include' });
      if (!res.ok) {
        console.error('Failed to fetch office location:', res.statusText);
        return;
      }
      const locations = await res.json() as Array<{ isActive: boolean; name: string; latitude: number; longitude: number; radius: number }>;
      const activeLocation = locations.find((loc) => loc.isActive);
      if (activeLocation) {
        setOfficeLocation({
          name: activeLocation.name,
          lat: activeLocation.latitude,
          lon: activeLocation.longitude,
          radius: activeLocation.radius,
        });
      }
    } catch (err) {
      console.error('Failed to fetch office location:', err);
    }
  };

  const getUserLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lon: longitude });
        setGpsError(null);
      },
      (error) => {
        console.error('Geolocation error:', error);
        setGpsError('Unable to access your location. Please enable location services.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  };

  // Calculate distance using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  useEffect(() => {
    if (userLocation && officeLocation) {
      const dist = calculateDistance(
        userLocation.lat,
        userLocation.lon,
        officeLocation.lat,
        officeLocation.lon
      );
      setDistance(dist);
      setWithinRange(dist <= officeLocation.radius);
    }
  }, [userLocation, officeLocation]);

  const fetchEmployees = async (role: string, email: string) => {
    try {
      const res = await fetch('/api/employees', { credentials: 'include' });
      const data = await res.json() as Employee[];
      
      if (role === 'EMPLOYEE' && email) {
        const myEmployee = data.find((emp) => emp.email === email || emp.userId);
        if (myEmployee) {
          setEmployeeId(myEmployee.id);
          setEmployees([myEmployee]);
          return;
        }
      }
      
      setEmployees(data);
      if (data.length > 0) {
        setEmployeeId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    }
  };

  const handleClockIn = async () => {
    if (!employeeId) {
      alert('No employee selected');
      return;
    }

    if (!userLocation && officeLocation) {
      alert('Please enable location services to clock in');
      getUserLocation();
      return;
    }

    if (officeLocation && !withinRange) {
      alert(`You must be within ${officeLocation.radius} meters of ${officeLocation.name} to clock in.\nCurrent distance: ${Math.round(distance || 0)} meters`);
      return;
    }

    setClockingIn(true);
    try {
      const res = await fetch('/api/time-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          employeeId, 
          type: 'clockIn',
          latitude: userLocation?.lat,
          longitude: userLocation?.lon,
        }),
      });

      const data = await res.json() as { error?: string };

      if (!res.ok) {
        alert(data.error || 'Failed to clock in');
        return;
      }

      alert('Clock in recorded successfully!');
      fetchTimeLogs();
    } catch (err) {
      alert('Something went wrong');
    } finally {
      setClockingIn(false);
    }
  };

  const handleClockOut = async () => {
    if (!employeeId) {
      alert('No employee selected');
      return;
    }

    if (!userLocation && officeLocation) {
      alert('Please enable location services to clock out');
      getUserLocation();
      return;
    }

    if (officeLocation && !withinRange) {
      alert(`You must be within ${officeLocation.radius} meters of ${officeLocation.name} to clock out.\nCurrent distance: ${Math.round(distance || 0)} meters`);
      return;
    }

    setClockingIn(true);
    try {
      const res = await fetch('/api/time-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          employeeId, 
          type: 'clockOut',
          latitude: userLocation?.lat,
          longitude: userLocation?.lon,
        }),
      });

      const data = await res.json() as { error?: string };

      if (!res.ok) {
        alert(data.error || 'Failed to clock out');
        return;
      }

      alert('Clock out recorded successfully!');
      fetchTimeLogs();
    } catch (err) {
      alert('Something went wrong');
    } finally {
      setClockingIn(false);
    }
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    // Times are stored as UTC but represent Philippines local time
    // So we display the UTC hours/minutes directly as Philippines time
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getLatenessRemarks = (log: TimeLog) => {
    if (!log.clockIn || !log.shift || log.shift.startTime === '-') {
      return { label: 'Regular', color: 'bg-gray-100 text-gray-600', icon: null };
    }

    try {
      const clockInDate = new Date(log.clockIn);
      const [shiftHour, shiftMinute] = log.shift.startTime.split(':').map(Number);
      
      const scheduledStartTime = new Date(clockInDate);
      scheduledStartTime.setUTCHours(shiftHour, shiftMinute, 0, 0);

      // If clock in is more than 1 minute after scheduled time, it's late
      const diffInMinutes = (clockInDate.getTime() - scheduledStartTime.getTime()) / (1000 * 60);
      
      if (diffInMinutes > 1) {
        const hours = Math.floor(diffInMinutes / 60);
        const mins = Math.floor(diffInMinutes % 60);
        const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        return { 
          label: `Late (${timeStr})`, 
          color: 'bg-red-100 text-red-700 border-red-200', 
          icon: <AlertCircle className="w-3 h-3 mr-1" /> 
        };
      }

      return { 
        label: 'On Time', 
        color: 'bg-green-100 text-green-700 border-green-200', 
        icon: <CheckCircle2 className="w-3 h-3 mr-1" /> 
      };
    } catch (e) {
      return { label: 'Regular', color: 'bg-gray-100 text-gray-600', icon: null };
    }
  };

  const canClockIn = (!todayLog || !todayLog.clockIn) && (!officeLocation || (withinRange && userLocation));
  const canClockOut = (todayLog && todayLog.clockIn && !todayLog.clockOut) && (!officeLocation || (withinRange && userLocation));

  const handleVerifyFace = async (isMatch: boolean, distance: number) => {
    if (isMatch) {
      if (canClockIn) {
        await handleClockIn();
      } else if (canClockOut) {
        await handleClockOut();
      }
      setShowFaceModal(false);
      setIsVerifying(false);
    } else {
      alert(`Identity verification failed. Match distance: ${distance.toFixed(2)}. Please try again.`);
      setIsVerifying(false);
    }
  };

  const initiateVerification = async () => {
    if (!employeeId) {
      alert('No employee selected');
      return;
    }

    setIsVerifying(true);
    try {
      console.log('[Face Verification] Fetching descriptor for employeeId:', employeeId);
      const res = await fetch(`/api/employees/${employeeId}/face-descriptor`);
      const responseData = await res.json().catch(() => ({}));
      
      console.log('[Face Verification] Response status:', res.status, responseData);
      
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Employee has not enrolled their face. Please contact HR to complete face enrollment.');
        } else if (res.status === 401) {
          throw new Error('Session expired. Please login again.');
        }
        throw new Error(responseData.error || 'Failed to load face data');
      }
      
      const data = responseData as { faceDescriptor: number[] };
      
      if (!data.faceDescriptor || data.faceDescriptor.length === 0) {
        throw new Error('Employee has not enrolled their face. Please contact HR to complete face enrollment.');
      }

      console.log('[Face Verification] Descriptor loaded, length:', data.faceDescriptor.length);
      setStoredDescriptor(data.faceDescriptor);
      setShowFaceModal(true);
    } catch (err: unknown) {
      console.error('[Face Verification] Error:', err);
      const error = err instanceof Error ? err : new Error('Unknown error');
      alert(error.message);
      setIsVerifying(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const res = await fetch('/api/employees');
      const employees: Employee[] = await res.json();
      
      const headers = ['Employee Number', 'Date', 'Clock In', 'Clock Out', 'Notes'];
      const sampleRows = employees.slice(0, 3).map(emp => [
        String(emp.employeeNumber),
        '2026-01-15',
        '08:00',
        '17:00',
        ''
      ]);
      
      if (sampleRows.length === 0) {
        sampleRows.push(['1001', '2026-01-15', '08:00', '17:00', '']);
      }

      const csvContent = [
        headers.join(','),
        ...sampleRows.map(row => row.join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'time_logs_template.csv';
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error('Failed to fetch employees for template:', err);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/time-logs/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json() as { error?: string; results?: { success: number; failed: number; errors: string[] } };

      if (!res.ok) {
        setImportResult({ success: 0, failed: 1, errors: [data.error || 'Import failed'] });
        return;
      }

      setImportResult({
        success: data.results?.success ?? 0,
        failed: data.results?.failed ?? 0,
        errors: data.results?.errors || []
      });

      if (data.results?.success ?? 0 > 0) {
        fetchTimeLogs();
      }
    } catch (err) {
      setImportResult({ success: 0, failed: 1, errors: ['Something went wrong during import'] });
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const resetImport = () => {
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const resetBiometricImport = () => {
    setBiometricImportResult(null);
    if (biometricFileInputRef.current) {
      biometricFileInputRef.current.value = '';
    }
  };

  const resetXclsImport = () => {
    setXclsImportResult(null);
    if (xclsFileInputRef.current) {
      xclsFileInputRef.current.value = '';
    }
  };

  const downloadXclsTemplate = () => {
    const headers = ['employee_id', 'Date', 'IN', 'OUT', 'IN', 'OUT', 'IN', 'OUT'];
    // Use Date objects for proper Excel date/time formatting
    const sampleRows = [
      ['EMP-0001', new Date('2026-03-16T07:48:00Z'), new Date('2026-03-16T17:01:00Z'), null, null, null, null],
      ['EMP-0001', new Date('2026-03-17T07:53:00Z'), new Date('2026-03-17T18:00:00Z'), null, null, null, null],
      ['EMP-0001', new Date('2026-03-20T07:46:00Z'), new Date('2026-03-20T17:06:00Z'), null, new Date('2026-03-20T17:06:00Z'), null, null],
      ['EMP-0001', new Date('2026-03-21T02:46:00Z'), null, new Date('2026-03-21T12:56:00Z'), new Date('2026-03-21T17:04:00Z'), null, null],
      ['EMP-0001', new Date('2026-03-23T07:30:00Z'), new Date('2026-03-23T12:05:00Z'), null, new Date('2026-03-23T18:30:00Z'), null, null],
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Time Logs');
    XLSX.writeFile(wb, 'time_logs_template.xlsx');
  };

  const handleXclsImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setXclsImporting(true);
    setXclsImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/time-logs/import-xcls', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json() as { error?: string; results?: { success: number; absent: number; failed: number; errors: string[] } };

      if (!res.ok) {
        setXclsImportResult({ success: 0, absent: 0, failed: 1, errors: [data.error || 'Import failed'] });
        return;
      }

      setXclsImportResult({
        success: data.results?.success ?? 0,
        absent: data.results?.absent ?? 0,
        failed: data.results?.failed ?? 0,
        errors: data.results?.errors || []
      });

      if ((data.results?.success ?? 0) > 0 || (data.results?.absent ?? 0) > 0) {
        fetchTimeLogs();
      }
    } catch (err) {
      setXclsImportResult({ success: 0, absent: 0, failed: 1, errors: ['Something went wrong during import'] });
    } finally {
      setXclsImporting(false);
      if (xclsFileInputRef.current) {
        xclsFileInputRef.current.value = '';
      }
    }
  };

  const handleBiometricImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setBiometricImporting(true);
    setBiometricImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/time-logs/import-biometric', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json() as { error?: string; results?: { success: number; failed: number; errors: string[] } };

      if (!res.ok) {
        setBiometricImportResult({ success: 0, failed: 1, errors: [data.error || 'Import failed'] });
        return;
      }

      setBiometricImportResult({
        success: data.results?.success ?? 0,
        failed: data.results?.failed ?? 0,
        errors: data.results?.errors || []
      });

      if (data.results?.success ?? 0 > 0) {
        fetchTimeLogs();
      }
    } catch (err) {
      setBiometricImportResult({ success: 0, failed: 1, errors: ['Something went wrong during import'] });
    } finally {
      setBiometricImporting(false);
      if (biometricFileInputRef.current) {
        biometricFileInputRef.current.value = '';
      }
    }
  };

  const handleLogout = () => {
    document.cookie = 'isLoggedIn=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC';
    document.cookie = 'userRole=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC';
    document.cookie = 'userId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC';
    window.location.href = '/login';
  };

  const handleDeleteClick = (log: TimeLog) => {
    setTimeLogToDelete(log);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!timeLogToDelete) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/time-logs?id=${timeLogToDelete.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        alert(data.error || 'Failed to delete time log');
        return;
      }

      fetchTimeLogs();
      setDeleteDialogOpen(false);
      setTimeLogToDelete(null);
    } catch (err) {
      alert('Something went wrong');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Time Logs</h1>
          <p className="text-gray-500">Record your daily attendance</p>
        </div>
        {(userRole === 'ADMIN' || userRole === 'MANAGER') && (
          <div className="flex items-center gap-2">
            <Dialog open={biometricImportOpen} onOpenChange={setBiometricImportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Upload className="w-4 h-4" />
                  Import Biometric
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden rounded-2xl shadow-2xl border-0">
                <div className="relative bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-6">
                  <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
                  <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-20 h-20 bg-white/10 rounded-full blur-xl"></div>
                  <div className="relative flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      <Upload className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <DialogTitle className="text-xl font-bold text-white">Import Biometric Data</DialogTitle>
                      <DialogDescription className="text-purple-100 text-sm mt-0.5">
                        Upload .dat file from Touchlink Time Recorder
                      </DialogDescription>
                    </div>
                  </div>
                </div>
                <div className="p-6 space-y-6">
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100 rounded-2xl p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <FileSpreadsheet className="w-6 h-6 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 mb-1">File Format</p>
                        <p className="text-sm text-gray-500 mb-3">Touchlink .dat format (tab-separated)</p>
                        <div className="bg-white/70 rounded-lg p-3 text-xs font-mono text-gray-600">
                          <p>UserID&lt;tab&gt;DateTime&lt;tab&gt;Status</p>
                          <p className="mt-1 text-gray-400">Example: 91311&lt;tab&gt;2026-03-01 07:58:16&lt;tab&gt;1</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-6 hover:border-purple-300 hover:bg-purple-50/30 transition-all group">
                    <Label htmlFor="biometric-file-upload" className="flex flex-col items-center cursor-pointer">
                      <div className="w-14 h-14 bg-gray-100 group-hover:bg-purple-100 rounded-2xl flex items-center justify-center mb-3 transition-colors">
                        <Upload className="w-7 h-7 text-gray-400 group-hover:text-purple-600 transition-colors" />
                      </div>
                      <span className="text-sm font-medium text-gray-700 group-hover:text-purple-600 transition-colors">Click to upload</span>
                      <span className="text-xs text-gray-400 mt-1">or drag and drop</span>
                      <p className="text-xs text-gray-400 mt-3">Supported: .dat</p>
                    </Label>
                    <Input
                      id="biometric-file-upload"
                      type="file"
                      accept=".dat"
                      ref={biometricFileInputRef}
                      onChange={handleBiometricImport}
                      disabled={biometricImporting}
                      className="hidden"
                    />
                  </div>

                  {biometricImporting && (
                    <div className="flex items-center justify-center gap-3 py-4 bg-purple-50 rounded-xl">
                      <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-sm font-medium text-purple-700">Importing biometric data...</p>
                    </div>
                  )}
                  {biometricImportResult && (
                    <div className={`rounded-2xl p-5 ${biometricImportResult.failed === 0 ? 'bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200' : 'bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200'}`}>
                      <div className="flex items-center gap-3 mb-4">
                        {biometricImportResult.failed === 0 ? (
                          <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/30">
                            <CheckCircle2 className="w-5 h-5 text-white" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/30">
                            <AlertCircle className="w-5 h-5 text-white" />
                          </div>
                        )}
                        <div>
                          <p className={`font-bold ${biometricImportResult.failed === 0 ? 'text-green-700' : 'text-amber-700'}`}>
                            Import {biometricImportResult.failed === 0 ? 'Successful' : 'Completed with Issues'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {biometricImportResult.success} imported, {biometricImportResult.failed} failed
                          </p>
                        </div>
                      </div>
                      {biometricImportResult.errors.length > 0 && (
                        <div className="mt-3 text-xs bg-white/70 rounded-xl p-3 max-h-28 overflow-y-auto border border-gray-100">
                          {biometricImportResult.errors.slice(0, 5).map((err, i) => (
                            <p key={i} className="text-red-500 py-1 px-2 rounded bg-red-50/50 mb-1 last:mb-0">{err}</p>
                          ))}
                          {biometricImportResult.errors.length > 5 && <p className="text-gray-500 py-1">...and {biometricImportResult.errors.length - 5} more errors</p>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="px-6 pb-6">
                  <Button 
                    variant="outline" 
                    onClick={() => { resetBiometricImport(); setBiometricImportOpen(false); }} 
                    className="w-full py-6 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl border-gray-200"
                  >
                    Close
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={xclsImportOpen} onOpenChange={setXclsImportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Upload className="w-4 h-4" />
                  Import XCLS
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden rounded-2xl shadow-2xl border-0">
                <div className="relative bg-gradient-to-r from-orange-500 to-red-500 px-6 py-6">
                  <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
                  <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-20 h-20 bg-white/10 rounded-full blur-xl"></div>
                  <div className="relative flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      <FileSpreadsheet className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <DialogTitle className="text-xl font-bold text-white">Import XCLS Time Logs</DialogTitle>
                      <DialogDescription className="text-orange-100 text-sm mt-0.5">
                        Upload Excel file with multiple punches per day
                      </DialogDescription>
                    </div>
                  </div>
                </div>
                <div className="p-6 space-y-6">
                  <div className="bg-gradient-to-br from-orange-50 to-red-50 border border-orange-100 rounded-2xl p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Download className="w-6 h-6 text-orange-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 mb-1">Download Template</p>
                        <p className="text-sm text-gray-500 mb-3">Get the correct format with employee ID and punch times</p>
                        <Button 
                          onClick={downloadXclsTemplate} 
                          className="gap-2 bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20 transition-all hover:scale-105"
                        >
                          <Download className="w-4 h-4" />
                          Download Template
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-dashed border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-white px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Or upload file</span>
                    </div>
                  </div>

                  <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-6 hover:border-orange-300 hover:bg-orange-50/30 transition-all group">
                    <Label htmlFor="xcls-file-upload" className="flex flex-col items-center cursor-pointer">
                      <div className="w-14 h-14 bg-gray-100 group-hover:bg-orange-100 rounded-2xl flex items-center justify-center mb-3 transition-colors">
                        <Upload className="w-7 h-7 text-gray-400 group-hover:text-orange-600 transition-colors" />
                      </div>
                      <span className="text-sm font-medium text-gray-700 group-hover:text-orange-600 transition-colors">Click to upload</span>
                      <span className="text-xs text-gray-400 mt-1">or drag and drop</span>
                      <p className="text-xs text-gray-400 mt-3">Supported: .xlsx, .xls</p>
                    </Label>
                    <Input
                      id="xcls-file-upload"
                      type="file"
                      accept=".xlsx,.xls"
                      ref={xclsFileInputRef}
                      onChange={handleXclsImport}
                      disabled={xclsImporting}
                      className="hidden"
                    />
                  </div>
                  
                  {xclsImporting && (
                    <div className="flex items-center justify-center gap-3 py-4 bg-orange-50 rounded-xl">
                      <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-sm font-medium text-orange-700">Importing your file...</p>
                    </div>
                  )}
                  {xclsImportResult && (
                    <div className={`rounded-2xl p-5 ${xclsImportResult.failed === 0 ? 'bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200' : 'bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200'}`}>
                      <div className="flex items-center gap-3 mb-4">
                        {xclsImportResult.failed === 0 ? (
                          <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/30">
                            <CheckCircle2 className="w-5 h-5 text-white" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/30">
                            <AlertCircle className="w-5 h-5 text-white" />
                          </div>
                        )}
                        <div>
                          <p className={`font-bold ${xclsImportResult.failed === 0 ? 'text-green-700' : 'text-amber-700'}`}>
                            Import {xclsImportResult.failed === 0 ? 'Successful' : 'Completed with Issues'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {xclsImportResult.success} imported, {xclsImportResult.absent} absent, {xclsImportResult.failed} failed
                          </p>
                        </div>
                      </div>
                      {xclsImportResult.errors.length > 0 && (
                        <div className="mt-3 text-xs bg-white/70 rounded-xl p-3 max-h-28 overflow-y-auto border border-gray-100">
                          {xclsImportResult.errors.slice(0, 5).map((err, i) => (
                            <p key={i} className="text-red-500 py-1 px-2 rounded bg-red-50/50 mb-1 last:mb-0">{err}</p>
                          ))}
                          {xclsImportResult.errors.length > 5 && <p className="text-gray-500 py-1">...and {xclsImportResult.errors.length - 5} more errors</p>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="px-6 pb-6">
                  <Button 
                    variant="outline" 
                    onClick={() => { resetXclsImport(); setXclsImportOpen(false); }} 
                    className="w-full py-6 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl border-gray-200"
                  >
                    Close
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Upload className="w-4 h-4" />
                  Import
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden rounded-2xl shadow-2xl border-0">
                <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-6">
                  <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
                  <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-20 h-20 bg-white/10 rounded-full blur-xl"></div>
                  <div className="relative flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      <Upload className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <DialogTitle className="text-xl font-bold text-white">Import Time Logs</DialogTitle>
                      <DialogDescription className="text-blue-100 text-sm mt-0.5">
                        Upload CSV or Excel file with time log data
                      </DialogDescription>
                    </div>
                  </div>
                </div>
                <div className="p-6 space-y-6">
                  <div className="bg-gradient-to-br from-slate-50 to-blue-50 border border-blue-100 rounded-2xl p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <FileSpreadsheet className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 mb-1">Download Template</p>
                        <p className="text-sm text-gray-500 mb-3">Get the correct format with employee numbers</p>
                        <Button 
                          onClick={downloadTemplate} 
                          className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 transition-all hover:scale-105"
                        >
                          <Download className="w-4 h-4" />
                          Download CSV
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-dashed border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-white px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Or upload file</span>
                    </div>
                  </div>

                  <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-6 hover:border-blue-300 hover:bg-blue-50/30 transition-all group">
                    <Label htmlFor="file-upload" className="flex flex-col items-center cursor-pointer">
                      <div className="w-14 h-14 bg-gray-100 group-hover:bg-blue-100 rounded-2xl flex items-center justify-center mb-3 transition-colors">
                        <Upload className="w-7 h-7 text-gray-400 group-hover:text-blue-600 transition-colors" />
                      </div>
                      <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors">Click to upload</span>
                      <span className="text-xs text-gray-400 mt-1">or drag and drop</span>
                      <p className="text-xs text-gray-400 mt-3">Supported: .csv, .xlsx, .xls</p>
                    </Label>
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      ref={fileInputRef}
                      onChange={handleImport}
                      disabled={importing}
                      className="hidden"
                    />
                  </div>
                  
                  {importing && (
                    <div className="flex items-center justify-center gap-3 py-4 bg-blue-50 rounded-xl">
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-sm font-medium text-blue-700">Importing your file...</p>
                    </div>
                  )}
                  {importResult && (
                    <div className={`rounded-2xl p-5 ${importResult.failed === 0 ? 'bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200' : 'bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200'}`}>
                      <div className="flex items-center gap-3 mb-4">
                        {importResult.failed === 0 ? (
                          <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/30">
                            <CheckCircle2 className="w-5 h-5 text-white" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/30">
                            <AlertCircle className="w-5 h-5 text-white" />
                          </div>
                        )}
                        <div>
                          <p className={`font-bold ${importResult.failed === 0 ? 'text-green-700' : 'text-amber-700'}`}>
                            Import {importResult.failed === 0 ? 'Successful' : 'Completed with Issues'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {importResult.success} imported, {importResult.failed} failed
                          </p>
                        </div>
                      </div>
                      {importResult.errors.length > 0 && (
                        <div className="mt-3 text-xs bg-white/70 rounded-xl p-3 max-h-28 overflow-y-auto border border-gray-100">
                          {importResult.errors.slice(0, 5).map((err, i) => (
                            <p key={i} className="text-red-500 py-1 px-2 rounded bg-red-50/50 mb-1 last:mb-0">{err}</p>
                          ))}
                          {importResult.errors.length > 5 && <p className="text-gray-500 py-1">...and {importResult.errors.length - 5} more errors</p>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="px-6 pb-6">
                  <Button 
                    variant="outline" 
                    onClick={() => { resetImport(); setImportOpen(false); }} 
                    className="w-full py-6 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl border-gray-200"
                  >
                    Close
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="outline" className="gap-2" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        )}
        {userRole !== 'ADMIN' && userRole !== 'MANAGER' && (
          <Button variant="outline" className="gap-2" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        )}
      </div>
      <div className="bg-white rounded-xl border p-6">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center">
            <Clock className="w-12 h-12 text-blue-600" />
          </div>
          
          <div className="text-center">
            <p className="text-lg font-medium">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                timeZone: 'Asia/Manila'
              })}
            </p>
            <p className="text-3xl font-bold text-gray-900">
              {new Date().toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit',
                timeZone: 'Asia/Manila'
              })}
            </p>
          </div>

          {/* GPS Status */}
          <div className={`w-full max-w-md rounded-lg p-4 border-2 ${
            !officeLocation 
              ? 'bg-blue-50 border-blue-200'
              : withinRange 
                ? 'bg-green-50 border-green-200' 
                : gpsError
                  ? 'bg-red-50 border-red-200'
                  : 'bg-yellow-50 border-yellow-200'
          }`}>
            <div className="flex items-center gap-3">
              {!officeLocation ? (
                <MapPin className="w-8 h-8 text-blue-600" />
              ) : withinRange ? (
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              ) : (
                <NavigationOff className="w-8 h-8 text-red-600" />
              )}
              <div className="flex-1">
                <p className="font-semibold text-gray-900">
                  {!officeLocation 
                    ? 'GPS Not Required' 
                    : withinRange 
                      ? 'Within Clock-In Range' 
                      : 'Outside Clock-In Range'}
                </p>
                <p className="text-sm text-gray-600">
                  {!officeLocation ? (
                    'No office location configured. Clock-in is allowed from anywhere.'
                  ) : gpsError ? (
                    <span className="text-red-600">{gpsError}</span>
                  ) : userLocation === null ? (
                    'Click refresh to get your location'
                  ) : distance !== null ? (
                    `Distance: ${Math.round(distance)}m from ${officeLocation.name} (Required: ${officeLocation.radius}m)`
                  ) : (
                    'Getting location...'
                  )}
                </p>
              </div>
              {officeLocation && (
                <button 
                  onClick={getUserLocation}
                  className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                  title="Refresh location"
                >
                  <NavigationOff className="w-5 h-5 text-gray-500" />
                </button>
              )}
            </div>
          </div>

          {/* Employee Selector */}
          <div className="w-full max-w-md">
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Employee</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} (#{emp.employeeNumber})
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-4 w-full max-w-md">
              <button
                onClick={() => {
                  if (canClockIn) initiateVerification();
                  else handleClockIn();
                }}
                disabled={!canClockIn || clockingIn}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors ${
                  canClockIn
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Play className="w-5 h-5" />
                {clockingIn ? 'Processing...' : 'Clock In'}
              </button>

              <button
                onClick={() => {
                  if (canClockOut) initiateVerification();
                  else handleClockOut();
                }}
                disabled={!canClockOut || clockingIn}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors ${
                  canClockOut
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Square className="w-5 h-5" />
                {clockingIn ? 'Processing...' : 'Clock Out'}
              </button>
            </div>

          {todayLog && employeeId === todayLog.employeeId && (
            <div className="w-full max-w-md bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Today&apos;s Status</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Clock In</p>
                  <p className="font-medium">{formatTime(todayLog.clockIn)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Clock Out</p>
                  <p className="font-medium">{formatTime(todayLog.clockOut)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500">Hours Worked</p>
                  <p className="font-medium">{todayLog.workHours.toFixed(2)} hours</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

       {/* Time Logs Table for Admin/Manager */}
       {(userRole === 'ADMIN' || userRole === 'MANAGER') && (
         <div className="bg-white rounded-xl border overflow-hidden">
           <div className="p-6 border-b flex flex-col md:flex-row md:items-center justify-between gap-4">
             <h2 className="text-lg font-semibold">All Time Logs</h2>
             <div className="relative w-full md:w-72">
               <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                 <Search className="w-4 h-4" />
               </div>
               <input
                 type="text"
                 placeholder="Search employee name..."
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
               />
             </div>
           </div>
           
           {loading ? (
             <div className="p-8 text-center text-gray-500">Loading...</div>
           ) : timeLogs.filter(log => 
             log.employee?.fullName?.toLowerCase().includes(searchTerm.toLowerCase())
           ).length === 0 ? (
             <div className="p-8 text-center text-gray-500">No time logs found</div>
           ) : (
             <div className="overflow-x-auto">
               <table className="w-full">
                 <thead className="bg-gray-50">
                   <tr>
                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Schedule</th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clock In</th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clock Out</th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remarks</th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-200">
                   {timeLogs
                     .filter(log => 
                       log.employee?.fullName?.toLowerCase().includes(searchTerm.toLowerCase())
                     )
                     .map((log) => {
                       const remarks = getLatenessRemarks(log);
                       return (
                         <tr key={log.id} className="hover:bg-gray-50">
                           <td className="px-6 py-4 text-sm whitespace-nowrap">{formatDate(log.date)}</td>
                           <td className="px-6 py-4">
                             <div className="flex items-center gap-2">
                               <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                 <span className="text-blue-600 text-xs font-medium">
                                   {log.employee?.fullName?.[0] || 'E'}
                                 </span>
                               </div>
                               <div>
                                 <p className="text-sm font-medium">{log.employee?.fullName || 'Unknown'}</p>
                                 <p className="text-xs text-gray-500">{log.employee?.employeeId}</p>
                               </div>
                             </div>
                           </td>
                           <td className="px-6 py-4 text-sm whitespace-nowrap">
                             {log.shift ? (
                               <div className="flex flex-col">
                                 <span className="font-medium text-blue-600 text-xs">{log.shift.name}</span>
                                 <span className="text-xs text-gray-500">{log.shift.startTime} - {log.shift.endTime}</span>
                               </div>
                             ) : (
                               <span className="text-gray-400 text-xs italic">No Schedule</span>
                             )}
                           </td>
                           <td className="px-6 py-4 text-sm">{formatTime(log.clockIn)}</td>
                           <td className="px-6 py-4 text-sm">{formatTime(log.clockOut)}</td>
                           <td className="px-6 py-4 text-sm">{log.workHours.toFixed(2)}</td>
                           <td className="px-6 py-4 text-sm whitespace-nowrap">
                             <Badge variant="outline" className={`${remarks.color} border flex items-center w-fit`}>
                               {remarks.icon}
                               {remarks.label}
                             </Badge>
                           </td>
                           <td className="px-6 py-4">
                             <button
                               onClick={() => handleDeleteClick(log)}
                               className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                               title="Delete time log"
                             >
                               <Trash2 className="w-4 h-4" />
                             </button>
                           </td>
                         </tr>
                       );
                     })}
                 </tbody>
               </table>
             </div>
           )}
         </div>
       )}

       {/* Time Logs Table for Employee (only their own data) */}
       {userRole === 'EMPLOYEE' && (
         <div className="bg-white rounded-xl border overflow-hidden">
           <div className="p-6 border-b">
             <h2 className="text-lg font-semibold">My Time Logs</h2>
           </div>
           
           {loading ? (
             <div className="p-8 text-center text-gray-500">Loading...</div>
           ) : timeLogs.length === 0 ? (
             <div className="p-8 text-center text-gray-500">No time logs found</div>
           ) : (
             <div className="overflow-x-auto">
               <table className="w-full">
                 <thead className="bg-gray-50">
                   <tr>
                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Schedule</th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clock In</th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clock Out</th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remarks</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-200">
                   {timeLogs.map((log) => {
                     const remarks = getLatenessRemarks(log);
                     return (
                       <tr key={log.id} className="hover:bg-gray-50">
                         <td className="px-6 py-4 text-sm whitespace-nowrap">{formatDate(log.date)}</td>
                         <td className="px-6 py-4 text-sm whitespace-nowrap">
                           {log.shift ? (
                             <div className="flex flex-col">
                               <span className="font-medium text-blue-600 text-xs">{log.shift.name}</span>
                               <span className="text-xs text-gray-500">{log.shift.startTime} - {log.shift.endTime}</span>
                             </div>
                           ) : (
                             <span className="text-gray-400 text-xs italic">No Schedule</span>
                           )}
                         </td>
                         <td className="px-6 py-4 text-sm">{formatTime(log.clockIn)}</td>
                         <td className="px-6 py-4 text-sm">{formatTime(log.clockOut)}</td>
                         <td className="px-6 py-4 text-sm">{log.workHours.toFixed(2)}</td>
                         <td className="px-6 py-4 text-sm whitespace-nowrap">
                           <Badge variant="outline" className={`${remarks.color} border flex items-center w-fit`}>
                             {remarks.icon}
                             {remarks.label}
                           </Badge>
                         </td>
                       </tr>
                     );
                   })}
                 </tbody>
               </table>
             </div>
           )}
         </div>
       )}

       <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md bg-black border-2 border-yellow-500/50 shadow-[0_0_30px_rgba(234,179,8,0.3)]">
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 via-transparent to-red-500/10 pointer-events-none rounded-[inherit]" />
          <DialogHeader className="relative">
            <DialogTitle className="text-yellow-400 text-xl font-bold tracking-wide">
              ⚠️ Delete Time Log
            </DialogTitle>
            <DialogDescription className="text-yellow-200/80 text-base mt-2">
              Are you sure you want to delete the time log for{' '}
              <span className="font-bold text-yellow-400">{timeLogToDelete?.employee?.fullName}</span> on{' '}
              <span className="font-bold text-yellow-400">{timeLogToDelete ? formatDate(timeLogToDelete.date) : ''}</span>?
              <br />
              <span className="text-red-400 text-sm">This action cannot be undone.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="relative mt-6">
            <Button 
              variant="outline" 
              onClick={() => setDeleteDialogOpen(false)}
              className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10 hover:text-yellow-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold shadow-lg shadow-red-500/30"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
       </Dialog>

       {/* Face Verification Modal */}
       {showFaceModal && (
         <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
             <div className="p-6 border-b flex justify-between items-center">
               <div className="flex items-center gap-2">
                 <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><User className="w-5 h-5" /></div>
                 <div>
                   <h2 className="text-xl font-bold text-gray-900">Face Verification</h2>
                   <p className="text-xs text-gray-500">Please verify your identity to continue</p>
                 </div>
               </div>
               <button 
                 onClick={() => { setShowFaceModal(false); setIsVerifying(false); }} 
                 className="p-2 hover:bg-gray-100 rounded-full transition-colors"
               >
                 <X className="w-5 h-5" />
               </button>
             </div>
             <div className="p-6 space-y-4">
               <FaceCapture 
                 mode="verify" 
                 storedDescriptor={storedDescriptor} 
                 onVerify={handleVerifyFace} 
               />
             </div>
           </div>
         </div>
       )}
     </div>
   );
 }
