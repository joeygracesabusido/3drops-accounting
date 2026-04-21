/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { Calculator, DollarSign, Clock, CalendarDays, CheckCircle, FileText, Download, Printer, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

interface Employee {
  id: string;
  fullName: string;
  employeeNumber: number;
  department: string;
  position: string;
  basicSalary: number;
  payrollFrequency: string;
  payType?: string;
  dailyRate?: number;
  email?: string;
}

interface PayrollRecord {
  id: string;
  employeeId: string;
  month: number;
  year: number;
  periodStart: string;
  periodEnd: string;
  basicSalary: number;
  workDays: number;
  daysWorked: number;
  otHours: number;
  otPay: number;
  holidayPay: number;
  grossPay: number;
  sssEmployee: number;
  philhealthEmployee: number;
  pagibigEmployee: number;
  withholdingTax: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
  status: string;
  createdAt: string;
  employee: Employee;
  adjustmentAdd?: number;
  adjustmentDeduct?: number;
  adjustmentReason?: string;
  lateMinutes?: number;
  undertimeMinutes?: number;
}

interface PayrollResult {
  payroll: {
    id: string;
    basicSalary: number;
    otHours: number;
    otPay: number;
    grossPay: number;
    sssEmployee: number;
    philhealthEmployee: number;
    pagibigEmployee: number;
    withholdingTax: number;
    otherDeductions: number;
    totalDeductions: number;
    netPay: number;
    periodStart: string;
    periodEnd: string;
    adjustmentAdd?: number;
    adjustmentDeduct?: number;
    adjustmentReason?: string;
    daysWorked: number;
  };
  details: {
    employee: Employee;
    period: { frequency: string };
    earnings: { baseSalary: number; overtimePay: number; holidayPay: number; grossPay: number };
    deductions: {
      absences: number;
      lates: number;
      undertime: number;
      cashAdvance?: number;
      sss: number;
      philHealth: number;
      pagIbig: number;
      withholdingTax: number;
      totalDeductions: number;
    };
    totals: {
      totalOtHours: number;
      holidayDays: number;
      regularHolidayDays?: number;
      specialHolidayDays?: number;
      leaveDays: number;
      offDays?: number;
      absentDays: number;
      lateMinutes: number;
      undertimeMinutes: number;
    };
    netPay: number;
  };
}

export default function PayrollPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [result, setResult] = useState<PayrollResult | null>(null);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [expandedPayrollId, setExpandedPayrollId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    employeeId: '',
    frequency: 'MONTHLY',
    periodStart: '',
    periodEnd: '',
    deductions: ['sss', 'philhealth', 'pagibig', 'tax', 'cash_advance', 'sss_loan', 'pagibig_loan'],
    adjustmentAdd: '',
    adjustmentDeduct: '',
    adjustmentReason: '',
  });
  const [userRole, setUserRole] = useState<string>('');
  const [userEmployeeId, setUserEmployeeId] = useState<string>('');

  const toggleDeduction = (deduction: string) => {
    setFormData(prev => {
      const isSelected = prev.deductions.includes(deduction);
      const newDeductions = isSelected
        ? prev.deductions.filter(d => d !== deduction)
        : [...prev.deductions, deduction];
      
      return {
        ...prev,
        deductions: newDeductions
      };
    });
  };

  const isAllEmployees = formData.employeeId === 'all';

  const filteredPayrollRecords = payrollRecords.filter((record) => {
    if (userRole === 'EMPLOYEE' && userEmployeeId) {
      return record.employeeId === userEmployeeId;
    }
    return (
      record.employee.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.employee.position?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.employee.department?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const fetchEmployees = async (userEmail: string) => {
    try {
      const res = await fetch('/api/employees', { credentials: 'include' });
      
      if (!res.ok) {
        console.error('Failed to fetch employees, status:', res.status);
        setLoading(false);
        return;
      }
      
      const text = await res.text();
      if (!text) {
        console.error('Empty response from employees API');
        setLoading(false);
        return;
      }
      
      const data = JSON.parse(text);
      console.log('Employees response:', data);
      if (Array.isArray(data)) {
        setEmployees(data);
        const currentUserEmployee = data.find((emp: Employee) => emp.email === userEmail);
        if (currentUserEmployee) {
          setUserEmployeeId(currentUserEmployee.id);
        }
      } else if (data.error) {
        console.error('Error fetching employees:', data.error);
      }
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPayrollRecords = async () => {
    try {
      const res = await fetch('/api/payroll', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        setPayrollRecords(data);
      }
    } catch (err) {
      console.error('Failed to fetch payroll records:', err);
    }
  };

  useEffect(() => {
    setMounted(true);
    if (typeof document === 'undefined') return;
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
    if (cookies.isLoggedIn !== 'true') {
      window.location.href = '/login';
      return;
    }
    const role = cookies.userRole || '';
    const email = cookies.userEmail || '';
    setUserRole(role);
    fetchEmployees(email);
    fetchPayrollRecords();
  }, []);

  if (!mounted) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setResult(null);
  };

  const handleCompute = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setComputing(true);
    setResult(null);

    const payload = {
      ...formData,
      adjustmentAdd: parseFloat(formData.adjustmentAdd) || 0,
      adjustmentDeduct: parseFloat(formData.adjustmentDeduct) || 0,
    };

    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      if (!text) {
        setError('Empty response from server');
        setComputing(false);
        return;
      }

      const data = JSON.parse(text);

      if (!res.ok) {
        setError(data.error || 'Failed to compute payroll');
        return;
      }

      if (isAllEmployees) {
        setResult({
          payroll: {
            id: 'all',
            basicSalary: data.results?.reduce((sum: number, r: { payroll: { basicSalary: number } }) => sum + r.payroll.basicSalary, 0) || 0,
            otHours: data.results?.reduce((sum: number, r: { payroll: { otHours: number } }) => sum + r.payroll.otHours, 0) || 0,
            otPay: data.results?.reduce((sum: number, r: { payroll: { otPay: number } }) => sum + r.payroll.otPay, 0) || 0,
            grossPay: data.results?.reduce((sum: number, r: { payroll: { grossPay: number } }) => sum + r.payroll.grossPay, 0) || 0,
            sssEmployee: data.results?.reduce((sum: number, r: { payroll: { sssEmployee: number } }) => sum + r.payroll.sssEmployee, 0) || 0,
            philhealthEmployee: data.results?.reduce((sum: number, r: { payroll: { philhealthEmployee: number } }) => sum + r.payroll.philhealthEmployee, 0) || 0,
            pagibigEmployee: data.results?.reduce((sum: number, r: { payroll: { pagibigEmployee: number } }) => sum + r.payroll.pagibigEmployee, 0) || 0,
            withholdingTax: data.results?.reduce((sum: number, r: { payroll: { withholdingTax: number } }) => sum + r.payroll.withholdingTax, 0) || 0,
            otherDeductions: data.results?.reduce((sum: number, r: { payroll: { otherDeductions: number } }) => sum + r.payroll.otherDeductions, 0) || 0,
            totalDeductions: data.results?.reduce((sum: number, r: { payroll: { totalDeductions: number } }) => sum + r.payroll.totalDeductions, 0) || 0,
            netPay: data.results?.reduce((sum: number, r: { payroll: { netPay: number } }) => sum + r.payroll.netPay, 0) || 0,
            periodStart: formData.periodStart,
            periodEnd: formData.periodEnd,
          },
          details: {
            employee: { id: 'all', fullName: 'All Employees', employeeNumber: 0, department: '', position: '', basicSalary: 0, payrollFrequency: '', payType: 'MONTHLY', dailyRate: 0 },
            period: { frequency: formData.frequency },
            earnings: { baseSalary: 0, overtimePay: 0, holidayPay: 0, grossPay: 0 },
            deductions: { absences: 0, lates: 0, undertime: 0, sss: 0, philHealth: 0, pagIbig: 0, withholdingTax: 0, totalDeductions: 0 },
            totals: { totalOtHours: 0, holidayDays: 0, leaveDays: 0, absentDays: 0, lateMinutes: 0, undertimeMinutes: 0 },
            netPay: 0,
          },
        } as unknown as PayrollResult);
        fetchPayrollRecords();
      } else {
        setResult(data);
      }
    } catch (err) {
      console.error('Payroll computation error:', err);
      setError('Failed to compute payroll');
    } finally {
      setComputing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  const handleExport = (result: PayrollResult) => {
    const employee = result.details.employee;
    const periodStart = new Date(result.payroll.periodStart).toLocaleDateString();
    const periodEnd = new Date(result.payroll.periodEnd).toLocaleDateString();

    const csvContent = [
      'PAYSLIP EXPORT',
      `Employee: ${employee.fullName}`,
      `Position: ${employee.position}`,
      `Department: ${employee.department}`,
      `Pay Period: ${periodStart} - ${periodEnd}`,
      '',
      'EARNINGS',
      `Base Salary ${employee.payType === 'DAILY' ? `(${result.payroll.daysWorked || 0} days @ ${formatCurrency(employee.dailyRate || 0)}/day)` : ''},${formatCurrency(result.details.earnings.baseSalary)}`,
      `Overtime (${result.details.totals.totalOtHours} hrs),${formatCurrency(result.details.earnings.overtimePay)}`,
      result.details.totals.holidayDays > 0 ? `Holiday (${result.details.totals.holidayDays} day(s)),${formatCurrency(result.details.earnings.holidayPay)}` : null,
      (result.payroll.adjustmentAdd ?? 0) > 0 ? `Adjustment (+),${formatCurrency(result.payroll.adjustmentAdd!)}` : null,
      `GROSS PAY,${formatCurrency(result.details.earnings.grossPay)}`,
      '',
      'DEDUCTIONS',
      result.details.deductions.absences > 0 ? `Absences (${result.details.totals.absentDays} days),${formatCurrency(result.details.deductions.absences)}` : null,
      result.details.deductions.lates > 0 ? `Lates (${result.details.totals.lateMinutes} min),${formatCurrency(result.details.deductions.lates)}` : null,
      result.details.deductions.undertime > 0 ? `Undertime (${result.details.totals.undertimeMinutes} min),${formatCurrency(result.details.deductions.undertime)}` : null,
      (result.details.deductions.cashAdvance ?? 0) > 0 ? `Cash Advance,${formatCurrency(result.details.deductions.cashAdvance!)}` : null,
      `SSS,${formatCurrency(result.details.deductions.sss)}`,
      `PhilHealth,${formatCurrency(result.details.deductions.philHealth)}`,
      `Pag-IBIG,${formatCurrency(result.details.deductions.pagIbig)}`,
      `Withholding Tax,${formatCurrency(result.details.deductions.withholdingTax)}`,
      `TOTAL DEDUCTIONS,${formatCurrency(result.details.deductions.totalDeductions)}`,
      '',
      `NET PAY,${formatCurrency(result.payroll.netPay)}`,
    ].filter(Boolean).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `payslip_${employee.fullName.replace(/\s+/g, '_')}_${periodStart}_${periodEnd}.csv`;
    link.click();
  };

  const handlePrint = (result: PayrollResult) => {
    const employee = result.details.employee;
    const periodStart = new Date(result.payroll.periodStart).toLocaleDateString();
    const periodEnd = new Date(result.payroll.periodEnd).toLocaleDateString();

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payslip - ${employee.fullName}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          h1 { color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px; }
          .header { margin-bottom: 30px; }
          .employee-info { background: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          .employee-info p { margin: 5px 0; }
          .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin: 20px 0; }
          .section { border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; }
          .section h3 { margin-top: 0; color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
          .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
          .row:last-child { border-bottom: none; }
          .total { font-weight: bold; font-size: 18px; border-top: 2px solid #374151; padding-top: 10px; margin-top: 10px; }
          .gross { color: #059669; }
          .deductions { color: #dc2626; }
          .net { color: #059669; font-size: 24px; font-weight: bold; }
          .footer { margin-top: 40px; text-align: center; color: #6b7280; font-size: 12px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <h1>PAYSLIP</h1>
        <div class="header">
          <div class="employee-info">
            <p><strong>Employee:</strong> ${employee.fullName}</p>
            <p><strong>Position:</strong> ${employee.position}</p>
            <p><strong>Department:</strong> ${employee.department}</p>
            <p><strong>Pay Period:</strong> ${periodStart} - ${periodEnd}</p>
          </div>
        </div>
        <div class="grid">
          <div class="section">
            <h3>Earnings</h3>
            <div class="row">
              <span>Base Salary ${employee.payType === 'DAILY' ? `<br/><small class="text-gray-500">(${result.payroll.daysWorked || 0} days @ ${formatCurrency(employee.dailyRate || 0)}/day)</small>` : ''}</span>
              <span>${formatCurrency(result.details.earnings.baseSalary)}</span>
            </div>
            <div className="row"><span>Overtime (${result.details.totals.totalOtHours} hrs)</span><span>+${formatCurrency(result.details.earnings.overtimePay)}</span></div>
            ${result.details.totals.holidayDays > 0 ? `<div className="row"><span>Holiday (${result.details.totals.holidayDays} day(s))</span><span>+${formatCurrency(result.details.earnings.holidayPay)}</span></div>` : ''}
            ${(result.payroll.adjustmentAdd ?? 0) > 0 ? `<div class="row"><span>Adjustment (+)</span><span>+${formatCurrency(result.payroll.adjustmentAdd!)}</span></div>` : ''}
            <div className="row total gross"><span>Gross Pay</span><span>${formatCurrency(result.details.earnings.grossPay)}</span></div>
          </div>
          <div class="section">
            <h3>Deductions</h3>
            ${result.details.deductions.absences > 0 ? `<div class="row"><span>Absences (${result.details.totals.absentDays} days)</span><span>-${formatCurrency(result.details.deductions.absences)}</span></div>` : ''}
            ${result.details.deductions.lates > 0 ? `<div class="row"><span>Lates (${result.details.totals.lateMinutes} min)</span><span>-${formatCurrency(result.details.deductions.lates)}</span></div>` : ''}
            ${result.details.deductions.undertime > 0 ? `<div class="row"><span>Undertime (${result.details.totals.undertimeMinutes} min)</span><span>-${formatCurrency(result.details.deductions.undertime)}</span></div>` : ''}
            ${(result.details.deductions.cashAdvance ?? 0) > 0 ? `<div class="row"><span>Cash Advance</span><span>-${formatCurrency(result.details.deductions.cashAdvance!)}</span></div>` : ''}
            <div class="row"><span>SSS</span><span>-${formatCurrency(result.details.deductions.sss)}</span></div>
            <div class="row"><span>PhilHealth</span><span>-${formatCurrency(result.details.deductions.philHealth)}</span></div>
            <div class="row"><span>Pag-IBIG</span><span>-${formatCurrency(result.details.deductions.pagIbig)}</span></div>
            <div class="row"><span>Withholding Tax</span><span>-${formatCurrency(result.details.deductions.withholdingTax)}</span></div>
            <div class="row total deductions"><span>Total Deductions</span><span>-${formatCurrency(result.details.deductions.totalDeductions)}</span></div>
          </div>
          <div class="section" style="background: #ecfdf5; border-color: #059669;">
            <h3 style="color: #059669;">NET PAY</h3>
            <div class="net">${formatCurrency(result.payroll.netPay)}</div>
          </div>
        </div>
        <div class="footer">
          <p>Generated on ${new Date().toLocaleDateString()} | HRIS Philippines</p>
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handlePrintRecord = (record: PayrollRecord) => {
    const employee = record.employee;
    const periodStart = new Date(record.periodStart).toLocaleDateString();
    const periodEnd = new Date(record.periodEnd).toLocaleDateString();

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payslip - ${employee.fullName}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          h1 { color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px; }
          .header { margin-bottom: 30px; }
          .employee-info { background: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          .employee-info p { margin: 5px 0; }
          .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin: 20px 0; }
          .section { border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; }
          .section h3 { margin-top: 0; color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
          .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
          .row:last-child { border-bottom: none; }
          .total { font-weight: bold; font-size: 18px; border-top: 2px solid #374151; padding-top: 10px; margin-top: 10px; }
          .gross { color: #059669; }
          .deductions { color: #dc2626; }
          .net { color: #059669; font-size: 24px; font-weight: bold; }
          .footer { margin-top: 40px; text-align: center; color: #6b7280; font-size: 12px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <h1>PAYSLIP</h1>
        <div class="header">
          <div class="employee-info">
            <p><strong>Employee:</strong> ${employee.fullName}</p>
            <p><strong>Position:</strong> ${employee.position}</p>
            <p><strong>Department:</strong> ${employee.department}</p>
            <p><strong>Pay Period:</strong> ${periodStart} - ${periodEnd}</p>
          </div>
        </div>
        <div class="grid">
          <div class="section">
            <h3>Earnings</h3>
            <div class="row">
              <span>Base Salary ${employee.payType === 'DAILY' ? `<br/><small class="text-gray-500">(${record.daysWorked} days @ ${formatCurrency(employee.dailyRate || 0)}/day)</small>` : ''}</span>
              <span>${formatCurrency(record.basicSalary || (employee.payType === 'DAILY' && employee.dailyRate ? employee.dailyRate * record.daysWorked : 0))}</span>
            </div>
            <div class="row"><span>Overtime (${record.otHours} hrs)</span><span>+${formatCurrency(record.otPay)}</span></div>
            ${record.holidayPay && record.holidayPay > 0 ? `<div class="row"><span>Holiday Pay</span><span>+${formatCurrency(record.holidayPay)}</span></div>` : ''}
            ${record.adjustmentAdd && record.adjustmentAdd > 0 ? `<div class="row"><span>Adjustment (+)</span><span>+${formatCurrency(record.adjustmentAdd)}</span></div>` : ''}
            ${record.adjustmentReason ? `<div class="row" style="font-size:11px;"><span>Reason:</span><span>${record.adjustmentReason}</span></div>` : ''}
            <div class="row total gross"><span>Gross Pay</span><span>${formatCurrency(record.grossPay)}</span></div>
          </div>
          <div class="section">
            <h3>Deductions</h3>
            <div class="row"><span>SSS</span><span>-${formatCurrency(record.sssEmployee)}</span></div>
            <div class="row"><span>PhilHealth</span><span>-${formatCurrency(record.philhealthEmployee)}</span></div>
            <div class="row"><span>Pag-IBIG</span><span>-${formatCurrency(record.pagibigEmployee)}</span></div>
            <div class="row"><span>Withholding Tax</span><span>-${formatCurrency(record.withholdingTax)}</span></div>
            <div class="row"><span>Other Deductions</span><span>-${formatCurrency(record.otherDeductions)}</span></div>
            <div class="row total deductions"><span>Total Deductions</span><span>-${formatCurrency(record.totalDeductions)}</span></div>
          </div>
          <div class="section" style="background: #ecfdf5; border-color: #059669;">
            <h3 style="color: #059669;">NET PAY</h3>
            <div class="net">${formatCurrency(record.netPay)}</div>
          </div>
        </div>
        <div class="footer">
          <p>Generated on ${new Date().toLocaleDateString()} | HRIS Philippines</p>
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleDeletePayroll = async (payrollId: string) => {
    if (!confirm('Are you sure you want to delete this payroll record? This action cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch(`/api/payroll?id=${payrollId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to delete payroll');
        return;
      }

      fetchPayrollRecords();
    } catch (err) {
      console.error('Delete payroll error:', err);
      alert('Failed to delete payroll');
    }
  };

  const frequencies = [
    { value: 'WEEKLY', label: 'Weekly' },
    { value: 'SEMIMONTHLY', label: 'Semi-monthly' },
    { value: 'MONTHLY', label: 'Monthly' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{userRole === 'EMPLOYEE' ? 'My Payroll' : 'Payroll'}</h1>
        <p className="text-gray-500">
          {userRole === 'EMPLOYEE' ? 'View your payroll history and payslips' : 'Compute employee payroll with Philippine labor law deductions'}
        </p>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <p className="text-gray-500">Loading employees...</p>
        </div>
      ) : employees.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <p className="text-red-500">No employees found. Please add employees first.</p>
        </div>
      ) : null}

      {!loading && employees.length > 0 && userRole !== 'EMPLOYEE' && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Compute Payroll
          </h2>

          <form onSubmit={handleCompute} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Employee
              </label>
              <select
                name="employeeId"
                value={formData.employeeId}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Employee</option>
                <option value="all">All Employees</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} - {emp.position}
                  </option>
                ))}
              </select>
            </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pay Frequency
            </label>
            <select
              name="frequency"
              value={formData.frequency}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {frequencies.map((freq) => (
                <option key={freq.value} value={freq.value}>
                  {freq.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Period Start
            </label>
            <input
              type="date"
              name="periodStart"
              value={formData.periodStart}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Period End
            </label>
            <input
              type="date"
              name="periodEnd"
              value={formData.periodEnd}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="md:col-span-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Include Deductions
            </label>
            <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg border border-dashed">
              {[
                { id: 'sss', label: 'SSS' },
                { id: 'philhealth', label: 'PhilHealth' },
                { id: 'pagibig', label: 'Pag-IBIG' },
                { id: 'tax', label: 'Withholding Tax' },
                { id: 'cash_advance', label: 'Cash Advance' },
                { id: 'sss_loan', label: 'SSS Loan' },
                { id: 'pagibig_loan', label: 'Pag-IBIG Loan' },
              ].map((d) => (
                <label key={d.id} className="flex items-center gap-2 cursor-pointer group px-2 py-1 hover:bg-white rounded transition-colors">
                  <input
                    type="checkbox"
                    id={`deduction-${d.id}`}
                    checked={formData.deductions.includes(d.id)}
                    onChange={() => toggleDeduction(d.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors cursor-pointer select-none">
                    {d.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="md:col-span-4 border-t pt-4 mt-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payroll Adjustments (for missing/previous period corrections)
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Additional Earnings (+)
                </label>
                <input
                  type="number"
                  name="adjustmentAdd"
                  value={formData.adjustmentAdd}
                  onChange={(e) => setFormData({ ...formData, adjustmentAdd: e.target.value })}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
                <p className="text-xs text-gray-500 mt-1">Backpay, bonus, etc.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Deductions (-)
                </label>
                <input
                  type="number"
                  name="adjustmentDeduct"
                  value={formData.adjustmentDeduct}
                  onChange={(e) => setFormData({ ...formData, adjustmentDeduct: e.target.value })}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
                <p className="text-xs text-gray-500 mt-1">Overpayment recovery</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Reason
                </label>
                <input
                  type="text"
                  name="adjustmentReason"
                  value={formData.adjustmentReason}
                  onChange={(e) => setFormData({ ...formData, adjustmentReason: e.target.value })}
                  placeholder="e.g., Backpay for January 2026"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          <div className="md:col-span-4">
            <button
              type="submit"
              disabled={computing || !formData.employeeId}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {computing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Computing...
                </>
              ) : (
                <>
                  <Calculator className="w-4 h-4" />
                  {isAllEmployees ? 'Compute All Payroll' : 'Compute Payroll'}
                </>
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
      </div>
      )}

      {result && userRole !== 'EMPLOYEE' && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-6 border-b bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">{result.details.employee.fullName}</h2>
                <p className="text-gray-500">
                  {result.details.employee.position} - {result.details.employee.department}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Pay Period: {new Date(result.payroll.periodStart).toLocaleDateString()} - {new Date(result.payroll.periodEnd).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleExport(result)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
                <button 
                  onClick={() => handlePrint(result)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Earnings
                </h3>
                  <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">
                      Base Salary 
                      {result.details.employee.payType === 'DAILY' && (
                        <span className="text-xs ml-1 text-gray-500">
                           ({result.details.earnings.baseSalary / (result.details.employee.dailyRate || 1)} days @ {formatCurrency(result.details.employee.dailyRate || 0)}/day)
                        </span>
                      )}
                    </span>
                    <span className="font-medium">{formatCurrency(result.details.earnings.baseSalary)}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Overtime ({result.details.totals.totalOtHours} hrs)
                    </span>
                    <span className="font-medium">+{formatCurrency(result.details.earnings.overtimePay)}</span>
                  </div>
                  {result.details.totals.holidayDays > 0 && (
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-green-600">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          Holiday ({result.details.totals.holidayDays} day(s))
                        </span>
                        <span className="font-medium">+{formatCurrency(result.details.earnings.holidayPay)}</span>
                      </div>
                      {result.details.totals.regularHolidayDays && result.details.totals.regularHolidayDays > 0 && (
                        <div className="text-xs text-gray-500 pl-4">
                          Regular Holiday: {result.details.totals.regularHolidayDays} day(s) × 100%
                        </div>
                      )}
                      {result.details.totals.specialHolidayDays && result.details.totals.specialHolidayDays > 0 && (
                        <div className="text-xs text-gray-500 pl-4">
                          Special Holiday: {result.details.totals.specialHolidayDays} day(s) × 30%
                        </div>
                      )}
                    </div>
                  )}
                  {(result.payroll.adjustmentAdd ?? 0) > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span className="text-gray-600">Adjustment (+)</span>
                      <span className="font-medium">+{formatCurrency(result.payroll.adjustmentAdd!)}</span>
                    </div>
                  )}
                  {(result.payroll.adjustmentDeduct ?? 0) > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span className="text-gray-600">Adjustment (-)</span>
                      <span className="font-medium">-{formatCurrency(result.payroll.adjustmentDeduct!)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t font-semibold">
                    <span>Gross Pay</span>
                    <span className="text-green-600">{formatCurrency(result.details.earnings.grossPay)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Deductions
                </h3>
                <div className="space-y-1 text-sm bg-gray-50 p-2 rounded">
                  <div className="text-gray-500 text-xs mb-2">Expected: 13 | Off: {result.details.totals.offDays ?? 0} | Leave: {result.details.totals.leaveDays ?? 0}</div>
                  {result.details.deductions.absences > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span className="text-gray-600">Absences ({result.details.totals.absentDays} days)</span>
                      <span className="font-medium">-{formatCurrency(result.details.deductions.absences)}</span>
                    </div>
                  )}
                  {(result.details.deductions.lates > 0 || result.details.totals.lateMinutes > 0) && (
                    <div className="flex justify-between text-red-600">
                      <span className="text-gray-600">Lates ({result.details.totals.lateMinutes} min)</span>
                      <span className="font-medium">-{formatCurrency(result.details.deductions.lates)}</span>
                    </div>
                  )}
                  {(result.details.deductions.undertime > 0 || result.details.totals.undertimeMinutes > 0) && (
                    <div className="flex justify-between text-red-600">
                      <span className="text-gray-600">Undertime ({result.details.totals.undertimeMinutes} min)</span>
                      <span className="font-medium">-{formatCurrency(result.details.deductions.undertime)}</span>
                    </div>
                  )}
                  {(result.details.deductions.cashAdvance ?? 0) > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span className="text-gray-600">Cash Advance</span>
                      <span className="font-medium">-{formatCurrency(result.details.deductions.cashAdvance!)}</span>
                    </div>
                  )}
                  {(result.details.deductions.cashAdvance ?? 0) === 0 && formData.deductions.includes('cash_advance') && (
                    <div className="flex justify-between text-gray-400">
                      <span className="text-gray-600">Cash Advance</span>
                      <span className="font-medium">-0.00</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">SSS</span>
                    <span className="font-medium">-{formatCurrency(result.details.deductions.sss)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">PhilHealth</span>
                    <span className="font-medium">-{formatCurrency(result.details.deductions.philHealth)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pag-IBIG</span>
                    <span className="font-medium">-{formatCurrency(result.details.deductions.pagIbig)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Withholding Tax</span>
                    <span className="font-medium">-{formatCurrency(result.details.deductions.withholdingTax)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t font-semibold">
                    <span>Total Deductions</span>
                    <span className="text-red-600">-{formatCurrency(result.details.deductions.totalDeductions)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 bg-green-50 rounded-xl p-4">
                <h3 className="font-semibold text-green-900 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Net Pay
                </h3>
                <div className="text-3xl font-bold text-green-700">
                  {formatCurrency(result.payroll.netPay)}
                </div>
                <p className="text-sm text-green-600">
                  For the period: {new Date(result.payroll.periodStart).toLocaleDateString()} - {new Date(result.payroll.periodEnd).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 border-t text-sm text-gray-500">
            <p>
              Note: Approved overtime, all approved leaves, absences, lates, and undertime are included in the computation.
              Semi-monthly frequency divides monthly salary by 2.
            </p>
          </div>
        </div>
      )}

      {payrollRecords.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-6 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {userRole === 'EMPLOYEE' ? 'My Payroll History' : 'Payroll History'}
            </h2>
            {userRole !== 'EMPLOYEE' && (
            <div className="relative">
              <input
                type="text"
                placeholder="Search by employee name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 pl-4 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {searchQuery && '×'}
              </button>
            </div>
            )}
          </div>
          {filteredPayrollRecords.length === 0 && searchQuery ? (
            <div className="p-6 text-center text-gray-500">
              No payroll records found for &quot;{searchQuery}&quot;
            </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Basic Salary</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gross Pay</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Deductions</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net Pay</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Payslip</th>
                  {userRole === 'ADMIN' && (
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredPayrollRecords.map((record) => (
                  <>
                    <tr key={record.id} className="hover:bg-gray-50">
                      {userRole !== 'EMPLOYEE' && (
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{record.employee.fullName}</div>
                        <div className="text-sm text-gray-500">{record.employee.position}</div>
                      </td>
                      )}
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(record.periodStart).toLocaleDateString()} - {new Date(record.periodEnd).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(record.basicSalary)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(record.grossPay)}</td>
                      <td className="px-4 py-3 text-right text-red-600">{formatCurrency(record.totalDeductions)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600">{formatCurrency(record.netPay)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          record.status === 'PROCESSED' ? 'bg-green-100 text-green-700' :
                          record.status === 'APPROVED' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handlePrintRecord(record)}
                          className="p-1 hover:bg-blue-50 text-blue-600 rounded mr-1"
                          title="Print payslip"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setExpandedPayrollId(expandedPayrollId === record.id ? null : record.id)}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          {expandedPayrollId === record.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {userRole === 'ADMIN' && (
                          <button
                            onClick={() => handleDeletePayroll(record.id)}
                            className="p-1 hover:bg-red-50 text-red-600 rounded"
                            title="Delete payroll record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedPayrollId === record.id && (
                      <tr>
                        <td colSpan={userRole === 'EMPLOYEE' ? 7 : 9} className="bg-gray-50 px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                              <h4 className="font-medium text-gray-900 mb-2">Earnings</h4>
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between"><span className="text-gray-600">Base Salary</span><span>{formatCurrency(record.basicSalary)}</span></div>
                                <div className="flex justify-between"><span className="text-gray-600">OT Hours</span><span>{record.otHours} hrs</span></div>
                                <div className="flex justify-between"><span className="text-gray-600">OT Pay</span><span>{formatCurrency(record.otPay)}</span></div>
                                {record.holidayPay && record.holidayPay > 0 && (
                                  <>
                                    <div className="flex justify-between text-green-600"><span className="text-gray-600">Holiday Pay</span><span>{formatCurrency(record.holidayPay)}</span></div>
                                    <div className="text-xs text-gray-500 pl-4">Holiday computation included in gross pay</div>
                                  </>
                                )}
                                {(record.adjustmentAdd ?? 0) > 0 && (
                                  <div className="flex justify-between text-green-600"><span className="text-gray-600">Adjustment (+)</span><span>+{formatCurrency(record.adjustmentAdd!)}</span></div>
                                )}
                                {(record.adjustmentDeduct ?? 0) > 0 && (
                                  <div className="flex justify-between text-red-600"><span className="text-gray-600">Adjustment (-)</span><span>-{formatCurrency(record.adjustmentDeduct!)}</span></div>
                                )}
                                {record.adjustmentReason && (
                                  <div className="text-xs text-gray-500 italic">Reason: {record.adjustmentReason}</div>
                                )}
                                <div className="flex justify-between font-medium border-t pt-1"><span>Gross Pay</span><span>{formatCurrency(record.grossPay)}</span></div>
                              </div>
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900 mb-2">Deductions</h4>
                              <div className="space-y-1 text-sm">
                                {(record.lateMinutes ?? 0) > 0 && (
                                  <div className="flex justify-between"><span className="text-gray-600">Lates ({(record.lateMinutes ?? 0)} min)</span><span className="text-red-600">{formatCurrency(((record.lateMinutes ?? 0) / 60) * (record.basicSalary / 22 / 8))}</span></div>
                                )}
                                {(record.undertimeMinutes ?? 0) > 0 && (
                                  <div className="flex justify-between"><span className="text-gray-600">Undertime ({(record.undertimeMinutes ?? 0)} min)</span><span className="text-red-600">{formatCurrency(((record.undertimeMinutes ?? 0) / 60) * (record.basicSalary / 22 / 8))}</span></div>
                                )}
                                <div className="flex justify-between"><span className="text-gray-600">SSS</span><span>{formatCurrency(record.sssEmployee)}</span></div>
                                <div className="flex justify-between"><span className="text-gray-600">PhilHealth</span><span>{formatCurrency(record.philhealthEmployee)}</span></div>
                                <div className="flex justify-between"><span className="text-gray-600">Pag-IBIG</span><span>{formatCurrency(record.pagibigEmployee)}</span></div>
                                <div className="flex justify-between"><span className="text-gray-600">Withholding Tax</span><span>{formatCurrency(record.withholdingTax)}</span></div>
                                {record.otherDeductions > 0 && (
                                  <div className="flex justify-between"><span className="text-gray-600">Other (Absences/Cash Advance)</span><span>{formatCurrency(record.otherDeductions)}</span></div>
                                )}
                                <div className="flex justify-between font-medium border-t pt-1"><span>Total Deductions</span><span className="text-red-600">{formatCurrency(record.totalDeductions)}</span></div>
                              </div>
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900 mb-2">Summary</h4>
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between"><span className="text-gray-600">Work Days</span><span>{record.daysWorked} / {record.workDays}</span></div>
                                <div className="flex justify-between font-medium border-t pt-1"><span>Net Pay</span><span className="text-green-600 text-lg">{formatCurrency(record.netPay)}</span></div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}
    </div>
  );
}
