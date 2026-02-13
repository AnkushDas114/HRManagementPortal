import type { Employee, LeaveRequest, AttendanceRecord, SalarySlip, Holiday, Policy } from './types';
import { LeaveStatus, AttendanceStatus } from './types';
import { formatDateIST, getNowIST } from './utils/dateTime';

export const MOCK_EMPLOYEES: Employee[] = [
  {
    id: 'E001',
    name: 'Alice Johnson',
    department: 'Engineering',
    avatar: 'https://i.pravatar.cc/150?u=E001',
    joiningDate: '2022-01-15',
    balance: { vacation: 12, sick: 5, personal: 3, totalEntitled: 25, wfh: 10, restrictedHoliday: 2 }
  },
  {
    id: 'E002',
    name: 'Bob Williams',
    department: 'Product',
    avatar: 'https://i.pravatar.cc/150?u=E002',
    joiningDate: '2022-03-10',
    balance: { vacation: 8, sick: 4, personal: 2, totalEntitled: 25, wfh: 15, restrictedHoliday: 1 }
  },
  {
    id: 'E003',
    name: 'Charlie Brown',
    department: 'Design',
    avatar: 'https://i.pravatar.cc/150?u=E003',
    joiningDate: '2021-11-20',
    balance: { vacation: 15, sick: 6, personal: 5, totalEntitled: 30, wfh: 5, restrictedHoliday: 3 }
  },
  {
    id: 'E004',
    name: 'Diana Miller',
    department: 'Engineering',
    avatar: 'https://i.pravatar.cc/150?u=E004',
    joiningDate: '2023-05-02',
    balance: { vacation: 5, sick: 2, personal: 1, totalEntitled: 25, wfh: 20, restrictedHoliday: 0 }
  },
  {
    id: 'E005',
    name: 'Ethan Davis',
    department: 'QA',
    avatar: 'https://i.pravatar.cc/150?u=E005',
    joiningDate: '2022-08-14',
    balance: { vacation: 10, sick: 3, personal: 3, totalEntitled: 25, wfh: 12, restrictedHoliday: 2 }
  },
  {
    id: 'E006',
    name: 'Fiona Garcia',
    department: 'Marketing',
    avatar: 'https://i.pravatar.cc/150?u=E006',
    joiningDate: '2023-02-28',
    balance: { vacation: 14, sick: 5, personal: 4, totalEntitled: 30, wfh: 8, restrictedHoliday: 1 }
  },
  {
    id: 'E007',
    name: 'George Miller',
    department: 'Management',
    avatar: 'https://i.pravatar.cc/150?u=E007',
    joiningDate: '2020-05-15',
    balance: { vacation: 20, sick: 10, personal: 5, totalEntitled: 35, wfh: 0, restrictedHoliday: 4 }
  },
];

const today = getNowIST();
const formatDate = (date: Date): string => formatDateIST(date);

const getPastDate = (daysAgo: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return formatDate(d);
};

export const MOCK_LEAVE_REQUESTS: LeaveRequest[] = [
  {
    id: 1,
    employee: MOCK_EMPLOYEES[0],
    leaveType: 'Vacation',
    startDate: formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5)),
    endDate: formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 10)),
    days: 6,
    reason: 'Family trip to the mountains.',
    status: LeaveStatus.Pending,
    submittedAt: formatDate(today)
  },
  {
    id: 2,
    employee: MOCK_EMPLOYEES[1],
    leaveType: 'Sick',
    startDate: formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)),
    endDate: formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)),
    days: 3,
    reason: 'Flu and fever.',
    status: LeaveStatus.Approved,
    submittedAt: getPastDate(2),
    approverName: 'HR Manager'
  },
  {
    id: 3,
    employee: MOCK_EMPLOYEES[0],
    leaveType: 'Un-Planned',
    startDate: formatDate(today),
    endDate: formatDate(today),
    days: 0.5,
    reason: 'Emergency personal work.',
    status: LeaveStatus.Approved,
    submittedAt: formatDate(today),
    isHalfDay: true,
    halfDayType: 'first',
    approverName: 'HR Manager'
  },
  {
    id: 4,
    employee: MOCK_EMPLOYEES[3],
    leaveType: 'Sick',
    startDate: getPastDate(15),
    endDate: getPastDate(14),
    days: 2,
    reason: 'Food poisoning.',
    status: LeaveStatus.Approved,
    submittedAt: getPastDate(15),
    approverName: 'HR Manager'
  },
  {
    id: 5,
    employee: MOCK_EMPLOYEES[4],
    leaveType: 'Planned Leave',
    startDate: getPastDate(40),
    endDate: getPastDate(35),
    days: 6,
    reason: 'Sister\'s wedding ceremony.',
    status: LeaveStatus.Approved,
    submittedAt: getPastDate(50),
    approverName: 'HR Manager'
  },
  {
    id: 6,
    employee: MOCK_EMPLOYEES[2],
    leaveType: 'Restricted Holiday',
    startDate: '2025-03-20',
    endDate: '2025-03-20',
    days: 1,
    reason: 'Regional festival celebration.',
    status: LeaveStatus.Pending,
    submittedAt: formatDate(today)
  }
];

export const MOCK_ATTENDANCE_RECORDS: AttendanceRecord[] = [
  { employeeId: 'E001', date: formatDate(today), status: AttendanceStatus.Present, clockIn: '09:03', clockOut: '17:35' },
  { employeeId: 'E002', date: formatDate(today), status: AttendanceStatus.Present, clockIn: '08:55', clockOut: '17:30' },
  { employeeId: 'E003', date: formatDate(today), status: AttendanceStatus.Present, clockIn: '09:15', clockOut: '18:00' },
  { employeeId: 'E001', date: getPastDate(1), status: AttendanceStatus.Present, clockIn: '09:10', clockOut: '17:40' },
];

export const MOCK_SALARY_SLIPS: SalarySlip[] = [
  {
    id: 'S001',
    employeeId: 'E001',
    month: 'December',
    year: '2024',
    basic: 50000,
    hra: 20000,
    allowances: 10000,
    deductions: 5000,
    netPay: 75000,
    generatedDate: '2024-12-31'
  }
];

export const MOCK_HOLIDAYS: Holiday[] = [
  { id: 1, name: "New Year's Day", date: '2025-01-01', type: 'Public' },
  { id: 2, name: "Pongal", date: '2025-01-14', type: 'Public' },
  { id: 3, name: "Makar Sankranti", date: '2025-01-15', type: 'Restricted' },
  { id: 4, name: "Republic Day", date: '2025-01-26', type: 'Public' },
  { id: 5, name: "Maha Shivaratri", date: '2025-02-26', type: 'Public' },
  { id: 6, name: "Holi", date: '2025-03-14', type: 'Public' },
  { id: 7, name: "Eid al-Fitr", date: '2025-03-31', type: 'Public' },
  { id: 8, name: "Mahavir Jayanti", date: '2025-04-10', type: 'Public' },
  { id: 9, name: "Good Friday", date: '2025-04-18', type: 'Public' },
  { id: 10, name: "Independence Day", date: '2025-08-15', type: 'Public' },
  { id: 11, name: "Gandhi Jayanti", date: '2025-10-02', type: 'Public' },
  { id: 12, name: "Christmas", date: '2025-12-25', type: 'Public' },
];

export const MOCK_POLICIES: Policy[] = [
  {
    id: 1,
    title: "Quarterly Leave Policy",
    content: "Employees are entitled to 4 paid leaves per quarter.",
    lastUpdated: "2025-01-01"
  }
];
