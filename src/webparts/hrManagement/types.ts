
export enum LeaveStatus {
  Pending = 'Pending',
  Approved = 'Approved',
  Rejected = 'Rejected',
}

export enum AttendanceStatus {
  Present = 'Present',
  Absent = 'Absent',
  OnLeave = 'On Leave',
  Weekend = 'Weekend',
  Upcoming = 'Upcoming',
}

export enum UserRole {
  HR = 'HR',
  Employee = 'Employee',
}

export enum ConcernStatus {
  Open = 'Open',
  Resolved = 'Resolved',
}

export enum ConcernType {
  Leave = 'Leave',
  Attendance = 'Attendance',
  Salary = 'Salary',
  General = 'General'
}

export interface LeaveBalance {
  vacation: number;
  sick: number;
  personal: number;
  totalEntitled: number;
  wfh: number;
  restrictedHoliday: number;
  paternity?: number;
}

export interface Employee {
  id: string;
  itemId?: number; // Internal SharePoint ID for CRUD
  name: string;
  department: string;
  avatar: string;
  balance?: LeaveBalance;
  // Professional Details
  joiningDate: string; // From DOJ
  email?: string;
  company?: string;
  position?: string;
  site?: string;
  role?: string;
  team?: string;
  // Payroll & Bank Details
  pan?: string;
  accountNumber?: string;
  bankName?: string;
  ifscCode?: string;
  basicSalary?: number;
  hra?: number;
  others?: number;
  pf?: number;
  total?: number;
}

export interface LeaveRequest {
  id: number;
  employee: Employee;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  approverComment?: string;
  approverName?: string;
  submittedAt: string;
  isHalfDay?: boolean;
  halfDayType?: 'first' | 'second';
  isRecurring?: boolean;
  recurringFrequency?: string;
}

export interface AttendanceRecord {
  id?: number;
  employeeId: string;
  employeeName?: string;
  department?: string;
  date: string;
  status: AttendanceStatus;
  clockIn?: string;
  clockOut?: string;
  workDuration?: string;
  remarks?: string;
}

export interface SalarySlip {
  id: string;
  employeeId: string;
  month: string;
  year: string;
  yearlyCtc?: number;
  monthlyCtc?: number;
  basic: number;
  hra: number;
  allowances: number;
  deductions: number;
  gross?: number;
  employerPF?: number;
  employeePF?: number;
  bonus?: number;
  netPay: number;
  insurance?: number;
  esi?: number;
  employerEsi?: number;
  payrollKey?: string;
  slipPdfUrl?: string;
  description?: string;
  generatedDate: string;
}

export interface Holiday {
  id: number;
  name: string;
  date: string;
  type: 'Public' | 'Restricted';
}

export interface Policy {
  id: number;
  title: string;
  content: string;
  lastUpdated: string;
}

export interface Concern {
  id: number;
  employeeId: string;
  type: ConcernType;
  referenceId: string | number; // ID of Leave, Date of Attendance, or ID of Salary Slip
  description: string;
  reply?: string;
  status: ConcernStatus;
  submittedAt: string;
  repliedAt?: string;
}

export interface TeamEvent {
  id: number;
  name: string;
  type: 'Birthday' | 'Work Anniversary' | 'Meeting' | 'Festival' | 'Other';
  date: string;
  employee?: Employee;
}
