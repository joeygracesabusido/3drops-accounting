/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { Printer, Calendar, CheckSquare, Square } from 'lucide-react';
import { jsPDF } from 'jspdf';

interface PayrollRecord {
  id: string;
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  basicSalary: number;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  otPay: number;
  holidayPay: number;
  status: string;
  daysWorked: number;
  employee: {
    id: string;
    fullName: string;
    employeeId: string;
    department: string;
    position: string;
    tin: string;
    sssNo: string;
    philhealthNo: string;
    pagibigNo: string;
  };
}

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface Employee {
  id: string;
  fullName: string;
  employeeId: string;
  department: string;
  position: string;
}

export default function PrintPayrollPage() {
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accountants, setAccountants] = useState<Employee[]>([]);
  const [managers, setManagers] = useState<Employee[]>([]);
  const [selectedAccountant, setSelectedAccountant] = useState('');
  const [selectedManager, setSelectedManager] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [mounted, setMounted] = useState(false);
  const [filterApplied, setFilterApplied] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setMounted(true);
    if (typeof document === 'undefined') return;
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    const storedName = decodeURIComponent(cookies.userName || '');
    
    if (storedName) {
      setCurrentUser({
        id: cookies.userId || '',
        name: storedName,
        email: cookies.userEmail || '',
        role: cookies.userRole || '',
      });
    } else if (cookies.userId) {
      fetch(`/api/current-user?userId=${cookies.userId}`)
        .then(res => res.json())
        .then(userData => {
          setCurrentUser({
            id: userData.id || '',
            name: userData.name || '',
            email: userData.email || '',
            role: userData.role || '',
          });
        })
        .catch(err => console.error('Error fetching user:', err));
    }

    fetchEmployees(setAccountants, setManagers);
    fetchPayrollRecords();
  }, []);

  const fetchEmployees = async (accountantSetter: (employees: Employee[]) => void, managerSetter: (employees: Employee[]) => void) => {
    try {
      const res = await fetch('/api/employees', { credentials: 'include' });
      if (res.ok) {
        const data: Employee[] = await res.json();
        accountantSetter(data);
        managerSetter(data);
      }
    } catch (error) {
      console.error('Error fetching employees: ', error);
    }
  };

  const fetchPayrollRecords = async () => {
    try {
      const res = await fetch('/api/payroll', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPayrollRecords(data);
      }
    } catch (error) {
      console.error('Error fetching payroll records:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    const start = periodStart ? new Date(periodStart) : null;
    const end = periodEnd ? new Date(periodEnd) : null;

    if (!start && !end) {
      setFilteredRecords(payrollRecords);
      setFilterApplied(true);
      return;
    }

    const filtered = payrollRecords.filter((record) => {
      const recordStart = new Date(record.periodStart);
      const recordEnd = new Date(record.periodEnd);

      if (start && end) {
        return recordStart <= end && recordEnd >= start;
      }

      if (start) {
        return recordEnd >= start;
      }

      if (end) {
        return recordStart <= end;
      }

      return true;
    });

    setFilteredRecords(filtered);
    setFilterApplied(true);
    setSelectedIds(new Set()); // Reset selection on new filter
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRecords.length && filteredRecords.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRecords.map(r => r.id)));
    }
  };

  const toggleRecordSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const formatCurrency = (amount: number | string) => {
    let num: number;
    if (typeof amount === 'string') {
      num = parseFloat(amount.replace(/[+,]/g, '')) || 0;
    } else if (amount === null || amount === undefined || isNaN(amount)) {
      num = 0;
    } else {
      num = Number(amount);
    }
    
    if (isNaN(num)) {
      return '0.00';
    }
    
    const absNum = Math.abs(num);
    const formatted = absNum.toFixed(2);
    const parts = formatted.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  const handlePrintPDF = () => {
    const recordsToPrint = filteredRecords.filter(r => selectedIds.has(r.id));
    
    if (recordsToPrint.length === 0) {
      alert('Please select at least one record to print');
      return;
    }

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'legal',
    });

    doc.deletePage(1);
    doc.addPage('legal', 'landscape');

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 12;

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 51, 102);
    doc.text('HRIS PHILIPPINES', pageWidth / 2, yPos, { align: 'center' });

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('PAYROLL REGISTER', pageWidth / 2, yPos + 8, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Pay Period: ${periodStart ? new Date(periodStart).toLocaleDateString() : 'All'} - ${periodEnd ? new Date(periodEnd).toLocaleDateString() : 'All'}`,
      pageWidth / 2,
      yPos + 15,
      { align: 'center' }
    );

    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, yPos + 20, { align: 'center' });

    doc.setTextColor(0, 0, 0);
    yPos = 32;

    doc.setFillColor(0, 51, 102);
    doc.rect(8, yPos, pageWidth - 16, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);

    const headers = ['No.', 'Employee Name', 'Department', 'Position', 'Rate/Day', 'No. of Days', 'Basic Salary', 'OT Pay', 'Holiday Pay', 'Gross Pay', 'Deductions', 'Net Pay'];
    const colWidths = [8, 35, 25, 28, 22, 16, 28, 22, 22, 26, 22, 30];
    let xPos = 10;

    headers.forEach((header, i) => {
      doc.text(header, xPos, yPos + 5.5);
      xPos += colWidths[i];
    });

    doc.setTextColor(0, 0, 0);
    yPos += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    recordsToPrint.forEach((record, index) => {
      if (yPos > pageHeight - 55) {
        doc.addPage('legal', 'landscape');
        yPos = 12;

        doc.setFillColor(0, 51, 102);
        doc.rect(8, yPos, pageWidth - 16, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);

        xPos = 10;
        headers.forEach((header, i) => {
          doc.text(header, xPos, yPos + 5.5);
          xPos += colWidths[i];
        });

        doc.setTextColor(0, 0, 0);
        yPos += 8;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
      }

      xPos = 10;

      if (index % 2 === 0) {
        doc.setFillColor(240, 245, 250);
        doc.rect(8, yPos, pageWidth - 16, 6, 'F');
      }

      doc.text(String(index + 1), xPos, yPos + 4.2);
      xPos += colWidths[0];

      const empName = record.employee.fullName.length > 22 
        ? record.employee.fullName.substring(0, 22) + '...' 
        : record.employee.fullName;
      doc.text(empName, xPos, yPos + 4.2);
      xPos += colWidths[1];

      const dept = record.employee.department.length > 16 
        ? record.employee.department.substring(0, 16) + '...' 
        : record.employee.department;
      doc.text(dept, xPos, yPos + 4.2);
      xPos += colWidths[2];

      const pos = record.employee.position.length > 17 
        ? record.employee.position.substring(0, 17) + '...' 
        : record.employee.position;
      doc.text(pos, xPos, yPos + 4.2);
      xPos += colWidths[3];

      const ratePerDay = record.daysWorked > 0 
        ? record.basicSalary / record.daysWorked 
        : record.basicSalary / 26;
      doc.text(formatCurrency(ratePerDay), xPos, yPos + 4.2);
      xPos += colWidths[4];

      doc.text(String(record.daysWorked || 0), xPos, yPos + 4.2);
      xPos += colWidths[5];

      doc.text(formatCurrency(record.basicSalary), xPos, yPos + 4.2);
      xPos += colWidths[6];

      doc.text(formatCurrency(record.otPay || 0), xPos, yPos + 4.2);
      xPos += colWidths[6];

      doc.text(formatCurrency(record.holidayPay || 0), xPos, yPos + 4.2);
      xPos += colWidths[7];

      doc.text(formatCurrency(record.grossPay), xPos, yPos + 4.2);
      xPos += colWidths[8];

      doc.setTextColor(180, 0, 0);
      doc.text(`(${formatCurrency(record.totalDeductions)})`, xPos, yPos + 4.2);
      doc.setTextColor(0, 0, 0);
      xPos += colWidths[9];

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 100, 0);
      doc.text(formatCurrency(record.netPay), xPos, yPos + 4.2);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);

      yPos += 6;
    });

    yPos += 2;
    doc.setFillColor(220, 230, 241);
    doc.rect(8, yPos, pageWidth - 16, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);

    const totalBasic = recordsToPrint.reduce((sum, r) => sum + r.basicSalary, 0);
    const totalOtPay = recordsToPrint.reduce((sum, r) => sum + (r.otPay || 0), 0);
    const totalHolidayPay = recordsToPrint.reduce((sum, r) => sum + (r.holidayPay || 0), 0);
    const totalGross = recordsToPrint.reduce((sum, r) => sum + r.grossPay, 0);
    const totalDeductions = recordsToPrint.reduce((sum, r) => sum + r.totalDeductions, 0);
    const totalNet = recordsToPrint.reduce((sum, r) => sum + r.netPay, 0);

xPos = 10 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3];
    doc.text('TOTAL:', xPos, yPos + 4.5);
    xPos += colWidths[4];
    xPos += colWidths[5];
    doc.text(formatCurrency(totalBasic), xPos, yPos + 4.5);
    xPos += colWidths[6];
    doc.text(formatCurrency(totalOtPay), xPos, yPos + 4.5);
    xPos += colWidths[7];
    doc.text(formatCurrency(totalHolidayPay), xPos, yPos + 4.5);
    xPos += colWidths[8];
    doc.text(formatCurrency(totalGross), xPos, yPos + 4.5);
    xPos += colWidths[9];
    doc.text(`(${formatCurrency(totalDeductions)})`, xPos, yPos + 4.5);
    xPos += colWidths[10];
    doc.text(formatCurrency(totalNet), xPos, yPos + 4.5);

    yPos = pageHeight - 80;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 51, 102);
    doc.text('CERTIFICATION', 10, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);

    yPos += 6;
    doc.setFontSize(8);
    doc.text('We hereby certify that the above payroll is correct and in accordance with the records.', 10, yPos);

    yPos += 8;

    const boxWidth = (pageWidth - 25) / 3;
    const boxHeight = 25;

    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.2);
    doc.setFillColor(252, 252, 252);
    doc.rect(10, yPos, boxWidth, boxHeight, 'FD');
    doc.rect(10 + boxWidth + 5, yPos, boxWidth, boxHeight, 'FD');
    doc.rect(10 + (boxWidth + 5) * 2, yPos, boxWidth, boxHeight, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Prepared By:', 12, yPos + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(currentUser?.name || '________________', 12, yPos + 12);
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('HR/Admin', 12, yPos + 18);
    doc.setTextColor(0, 0, 0);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Checked By:', 12 + boxWidth + 5, yPos + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(selectedAccountant || '________________', 12 + boxWidth + 5, yPos + 12);
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Accountant', 12 + boxWidth + 5, yPos + 18);
    doc.setTextColor(0, 0, 0);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Approved By:', 12 + (boxWidth + 5) * 2, yPos + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(selectedManager || '________________', 12 + (boxWidth + 5) * 2, yPos + 12);
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Manager', 12 + (boxWidth + 5) * 2, yPos + 18);
    doc.setTextColor(0, 0, 0);

    yPos += boxHeight + 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Date: ________________    ', 12, yPos);
    doc.text('Date: ________________    ', 12 + boxWidth + 5, yPos);
    doc.text('Date: ________________    ', 12 + (boxWidth + 5) * 2, yPos);

    const footerY = pageHeight - 6;
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text('HRIS Philippines - Payroll Register', pageWidth / 2, footerY, { align: 'center' });
    doc.text(`Page 1 of ${(doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages()}`, pageWidth - 12, footerY, { align: 'right' });

    const fileName = `payroll_register_${periodStart || 'all'}_${periodEnd || 'all'}.pdf`;
    doc.save(fileName);
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Print Payroll</h1>
        <p className="text-gray-500">Generate and print payroll reports with signature blocks</p>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <p className="text-gray-500">Loading payroll records...</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center gap-4 mb-4">
              <Calendar className="w-5 h-5 text-gray-500" />
              <h2 className="text-lg font-semibold">Filter by Cut-off Period</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Period Start</label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Period End</label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => { handleFilter(); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Filter
                </button>
              </div>
            </div>
            {filterApplied && (
              <p className="text-sm text-gray-500 mt-2">
                Showing {filteredRecords.length} payroll record(s) 
                {selectedIds.size > 0 && ` | ${selectedIds.size} selected for printing`}
              </p>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold mb-4">Signature Block</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prepared By</label>
                <input
                  type="text"
                  value={currentUser?.name || ''}
                  onChange={(e) => setCurrentUser(prev => prev ? { ...prev, name: e.target.value } : { id: '', name: e.target.value, email: '', role: '' })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Checked By (Accountant)</label>
                <select
                  value={selectedAccountant}
                  onChange={(e) => setSelectedAccountant(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Accountant</option>
                  {accountants.map((acc) => (
                    <option key={acc.id} value={acc.fullName}>
                      {acc.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Approved By (Manager)</label>
                <select
                  value={selectedManager}
                  onChange={(e) => setSelectedManager(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Manager</option>
                  {managers.map((mgr) => (
                    <option key={mgr.id} value={mgr.fullName}>
                      {mgr.fullName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold">Payroll Records</h2>
                {filteredRecords.length > 0 && (
                  <button 
                    onClick={toggleSelectAll}
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                  >
                    {selectedIds.size === filteredRecords.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>
              <button
                onClick={handlePrintPDF}
                disabled={selectedIds.size === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-all"
              >
                <Printer className="w-4 h-4" />
                {selectedIds.size > 0 
                  ? `Print Selected (${selectedIds.size})` 
                  : 'Print to PDF'}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left w-10">
                      <button onClick={toggleSelectAll} className="flex items-center justify-center">
                        {selectedIds.size === filteredRecords.length && filteredRecords.length > 0 ? (
                          <CheckSquare className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Basic Salary</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">OT Pay</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Holiday Pay</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gross Pay</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Deductions</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net Pay</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredRecords.map((record) => (
                    <tr 
                      key={record.id} 
                      className={`hover:bg-gray-50 cursor-pointer transition-colors ${selectedIds.has(record.id) ? 'bg-blue-50/50' : ''}`}
                      onClick={() => toggleRecordSelection(record.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center">
                          {selectedIds.has(record.id) ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{record.employee.fullName}</div>
                        <div className="text-sm text-gray-500">{record.employee.position}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(record.periodStart).toLocaleDateString()} -{' '}
                        {new Date(record.periodEnd).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(record.basicSalary)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(record.otPay || 0)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(record.holidayPay || 0)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(record.grossPay)}</td>
                      <td className="px-4 py-3 text-right text-red-600">{formatCurrency(record.totalDeductions)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600">
                        {formatCurrency(record.netPay)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            record.status === 'PROCESSED'
                              ? 'bg-green-100 text-green-700'
                              : record.status === 'APPROVED'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredRecords.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                        {filterApplied 
                          ? "No payroll records found for the selected period" 
                          : "Please select a period and click 'Filter' to display payroll data"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// this is sample
