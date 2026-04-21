// ============================================================================
// TypeScript Type Definitions
// ============================
// Shared types used across the HRIS application
// ============================================================================
// User & Authentication Types
// ============================================================================

export type UserRole = 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE'

export interface UserSession {
  id: string
  email: string
  name: string | null
  role: string
  image?: string | null
  employeeId?: string | null
}

// ============================================================================
// Employee Types
// ============================================================================

export interface EmployeeFormData {
  fullName: string
  email: string
  employeeId: string
  position: string
  department: string
  basicSalary: number
  payrollFrequency: string
  hireDate: string // ISO date string for form handling
  tin: string
  sssNo: string
  philhealthNo: string
  pagibigNo: string
  bankName?: string
  bankAccountNo?: string
}

export interface EmployeeWithUser {
  id: string
  userId: string | null
  fullName: string
  email: string
  employeeId: string
  position: string
  department: string
  basicSalary: number
  payrollFrequency: string
  hireDate: Date
  endDate: Date | null
  isActive: boolean
  tin: string
  sssNo: string
  philhealthNo: string
  pagibigNo: string
  bankName: string | null
  bankAccountNo: string | null
  createdAt: Date
  updatedAt: Date
  user?: {
    id: string
    email: string
    name: string | null
    role: string
  } | null
}

// ============================================================================
// Time Log Types
// ============================================================================

export interface TimeLogFormData {
  employeeId: string
  date: string // ISO date string
  clockIn: string // Time string (HH:mm)
  clockOut: string // Time string (HH:mm)
  notes?: string
}

export interface TimeLogWithEmployee {
  id: string
  employeeId: string
  date: Date
  clockIn: Date | null
  clockOut: Date | null
  workHours: number
  otHours: number
  lateMinutes: number
  undertimeMinutes: number
  notes: string | null
  isEdited: boolean
  editedBy: string | null
  editReason: string | null
  createdAt: Date
  updatedAt: Date
  employee: {
    id: string
    fullName: string
    employeeId: string
    department: string
    position: string
  }
}

// ============================================================================
// Payroll Types
// ============================================================================

export interface PayrollFormData {
  employeeId: string
  month: number
  year: number
}

export interface PayrollWithEmployee {
  id: string
  employeeId: string
  month: number
  year: number
  periodStart: Date
  periodEnd: Date
  basicSalary: number
  workDays: number
  daysWorked: number
  otHours: number
  otPay: number
  grossPay: number
  sssEmployee: number
  sssEmployer: number
  philhealthEmployee: number
  philhealthEmployer: number
  pagibigEmployee: number
  pagibigEmployer: number
  withholdingTax: number
  otherDeductions: number
  totalDeductions: number
  netPay: number
  status: string
  createdAt: Date
  updatedAt: Date
  processedAt: Date | null
  approvedBy: string | null
  approvedAt: Date | null
  employee: {
    id: string
    fullName: string
    employeeId: string
    department: string
    position: string
    tin: string
    sssNo: string
    philhealthNo: string
    pagibigNo: string
  }
}

// ============================================================================
// Dashboard Statistics Types
// ============================================================================

export interface DashboardStats {
  totalEmployees: number
  activeEmployees: number
  totalDepartments: number
  pendingPayrolls: number
  currentMonthPayroll: number
  averageSalary: number
}

export interface EmployeeDashboardData {
  employee: {
    id: string
    fullName: string
    employeeId: string
    position: string
    department: string
    basicSalary: number
  }
  recentTimeLogs: TimeLogWithEmployee[]
  recentPayrolls: PayrollWithEmployee[]
  monthStats: {
    workHours: number
    otHours: number
    daysPresent: number
    daysLate: number
  }
}

// ============================================================================
// Leave Request Types
// ============================================================================

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export interface LeaveRequest {
  id: string
  employeeId: string
  approverId: string | null
  leaveType: string
  startDate: Date
  endDate: Date
  daysCount: number
  reason: string
  status: LeaveStatus
  adminNotes: string | null
  createdAt: Date
  updatedAt: Date
  employee?: {
    id: string
    fullName: string
    employeeId: string
  }
  approver?: {
    id: string
    fullName: string
  } | null
}

// ============================================================================
// Overtime Request Types
// ============================================================================

export type OtStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface OvertimeRequest {
  id: string
  employeeId: string
  approverId: string | null
  date: Date
  hours: number
  reason: string
  status: OtStatus
  adminNotes: string | null
  createdAt: Date
  updatedAt: Date
  employee?: {
    id: string
    fullName: string
    employeeId: string
  }
  approver?: {
    id: string
    fullName: string
  } | null
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ============================================================================
// Leave Credit Types (Philippine Labor Law Compliance)
// ============================================================================

export type EmployeeStatus = 'PROBATIONARY' | 'REGULAR'

export type LeaveCreditType = 'MONTHLY_ACCRUAL' | 'ADJUSTMENT' | 'USED' | 'CARRY_FORWARD' | 'EXPIRED'

export interface LeaveCredit {
  id: string
  employeeId: string
  leaveType: string
  totalDays: number
  usedDays: number
  availableDays: number
  year: number
  createdAt: Date
  updatedAt: Date
}

export interface LeaveCreditWithEmployee extends LeaveCredit {
  employee: {
    id: string
    fullName: string
    employeeId: string
    hireDate: Date
    employeeStatus: EmployeeStatus
  }
}

export interface LeaveCreditTransaction {
  id: string
  leaveCreditId: string
  type: LeaveCreditType
  days: number
  balanceBefore: number
  balanceAfter: number
  description: string
  referenceId?: string
  createdAt: Date
}

export interface LeaveCreditBalance {
  employeeId: string
  leaveType: string
  available: number
  used: number
  total: number
  year: number
}