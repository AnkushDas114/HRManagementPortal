
import * as React from 'react';
import { useState, useMemo } from 'react';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { SPFI } from '@pnp/sp';
import '@pnp/sp/lists';
import '@pnp/sp/fields';
import '@pnp/sp/site-users/web';
import '@pnp/sp/site-groups/web';
// import { Web } from '@pnp/sp/webs';
import './App.bootstrap.css';
import { CustomAlertProvider, showAlert } from '../ui/CustomAlert';
import Header from './Header';
import Dashboard from './Dashboard';
import LeaveRequestsTable from './LeaveRequestsTable';
import AttendanceTracker from './AttendanceTracker';
import OnLeaveTodayTable from './OnLeaveTodayTable';
import EmployeePortal from './EmployeePortal';
import CalendarView, { CalendarViewEvent } from './CalendarView';
import Profile from './Profile';
import CarryForwardLeavesAdmin from './CarryForwardLeavesAdmin';
import Modal from '../ui/Modal';
import VersionHistoryModal from '../ui/VersionHistoryModal';
import CommonTable, { ColumnDef } from '../ui/CommonTable';
import Badge from '../ui/Badge';
import type { LeaveRequest, AttendanceRecord, Employee, SalarySlip, Policy, Concern, Holiday, TeamEvent } from '../types';
import { LeaveStatus, UserRole, ConcernStatus, ConcernType } from '../types';
import { getAllLeaveRequests, createLeaveRequest, updateLeaveRequestStatus, deleteLeaveRequest, updateLeaveRequest } from '../services/LeaveRequestsService';
import { getAllEvents, createEvent, updateEvent, deleteEvent } from '../services/EventsService';
import { getAllConcerns, createConcern, updateConcernReply, updateConcernStatus } from '../services/ConcernsService';
import {
  getAllEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  clearEmployeeProfileImage,
  replaceEmployeeProfileImage,
  getImageLibraryFolders,
  getImagesByFolder,
  type ProfileGalleryImage,
  type SPFolder
} from '../services/EmployeeService';
import { deleteAttendanceRecordById, deleteAttendanceRecordsByDate, getAllAttendanceRecords, saveAttendanceRecords, updateAttendanceRecord } from '../services/AttendanceService';
import { getAllSalarySlips, createSalarySlip } from '../services/SalarySlipService';
import { getItemVersionHistory, type VersionHistoryEntry } from '../services/VersionHistoryService';
import { Plus, Minus, X, Send, Download, Edit3, Trash2, Calendar as CalendarIcon, FileText } from 'lucide-react';
import { formatAuditInfo, formatDateForDisplayIST, formatDateIST, getNowIST, monthNameIST, todayIST } from '../utils/dateTime';
import { openOutOfBoxListItemForm } from '../utils/sharePointForm';
import { SalarySlipView } from './SalarySlipView';

interface AppProps {
  sp: SPFI;
}

const OFFICIAL_LEAVES_LIST_ID = 'SmartMetadata';
const LEAVE_MONTHLY_BALANCE_LIST_REF = 'LeaveMonthlyBalance';
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// const HR_ALLOWED_NAMES = ['Juli', 'Umesh Kumar', 'Devendra dixit', 'Thordis Jacobs', 'Stefan Hochhuth', 'Prashant', 'Laxmi Prashanti', 'Satendra Shakya', 'Tanu Jain', 'Prashant Kumar', 'Ranu Trivedi', 'Ranu', 'Nikki Jha', 'Nikky Jha', 'Ankush Das', 'Utkarsh Srivastava', 'Deepak Trivedi', 'Vikas Kumar Yadav', 'Vikas Yadav', 'Stefan Hochhuth (Admin)', 'laxmi.prashanti@hochhuth-consulting.de'];
const HR_ALLOWED_NAMES = ['Juli', 'Thordis Jacobs', 'Stefan Hochhuth', 'Prashant', 'Laxmi Prashanti', 'Satendra Shakya', 'Tanu Jain', 'Prashant Kumar', 'Ankush Das', 'Utkarsh Srivastava', 'Deepak Trivedi', 'Stefan Hochhuth (Admin)', 'laxmi.prashanti@hochhuth-consulting.de'];
// const HR_ALLOWED_EMAILS = ['stefan@hochhuth-consulting.de', 'thordis.jacobs@hochhuth-consulting.de', 'umesh.kumar@hochhuth-consulting.de', 'stefan.hochhuth@hochhuth-consulting.de', 'laxmip@smalsus.com', 'skshakya@hochhuth-consulting.de', 'devendra.dixit@hochhuth-consulting.de', 'laxmi.prashanti@hochhuth-consulting.de'];
const HR_ALLOWED_EMAILS = ['stefan@hochhuth-consulting.de', 'thordis.jacobs@hochhuth-consulting.de', 'stefan.hochhuth@hochhuth-consulting.de', 'laxmip@smalsus.com', 'skshakya@hochhuth-consulting.de', 'laxmi.prashanti@hochhuth-consulting.de'];

const LEAVE_EVENT_COLORS = ['#5f8fbd', '#4a88cc', '#4d7ac7', '#6c63c7', '#557bd6', '#7a6cd6', '#4f70b8', '#7b5fc1', '#6680d2', '#6a57b0'];
const HOLIDAY_EVENT_COLOR = '#1f8f3a';
type SendReportDatePreset =
  | 'Custom'
  | 'Today'
  | 'Yesterday'
  | 'This Week'
  | 'Last Week'
  | 'This Month'
  | 'Last Month'
  | 'Last 3 Months'
  | 'This Year'
  | 'Last Year'
  | 'All Time';

const startOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const toDateValue = (value: string): Date | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split('-').map(Number);
    const parsed = new Date(year, month - 1, day, 12, 0, 0);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const resolveSendReportRange = (
  preset: SendReportDatePreset,
  today: Date
): { start: Date | null; end: Date | null } => {
  const now = new Date(today);
  if (preset === 'All Time') return { start: null, end: null };
  if (preset === 'Today') return { start: startOfDay(now), end: endOfDay(now) };
  if (preset === 'Yesterday') {
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    return { start: startOfDay(y), end: endOfDay(y) };
  }
  if (preset === 'This Week') {
    const first = new Date(now);
    first.setDate(now.getDate() - now.getDay());
    return { start: startOfDay(first), end: endOfDay(now) };
  }
  if (preset === 'Last Week') {
    const first = new Date(now);
    first.setDate(now.getDate() - now.getDay() - 7);
    const last = new Date(now);
    last.setDate(now.getDate() - now.getDay() - 1);
    return { start: startOfDay(first), end: endOfDay(last) };
  }
  if (preset === 'This Month') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: startOfDay(first), end: endOfDay(now) };
  }
  if (preset === 'Last Month') {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: startOfDay(first), end: endOfDay(last) };
  }
  if (preset === 'Last 3 Months') {
    const three = new Date(now);
    three.setMonth(now.getMonth() - 3);
    return { start: startOfDay(three), end: endOfDay(now) };
  }
  if (preset === 'This Year') {
    const first = new Date(now.getFullYear(), 0, 1);
    return { start: startOfDay(first), end: endOfDay(now) };
  }
  if (preset === 'Last Year') {
    const first = new Date(now.getFullYear() - 1, 0, 1);
    const last = new Date(now.getFullYear() - 1, 11, 31);
    return { start: startOfDay(first), end: endOfDay(last) };
  }
  return { start: null, end: null };
};

interface SendReportTypeSummary {
  type: 'Staff' | 'Trainee';
  total: number;
  available: number;
  onLeave: number;
}

interface SendReportTeamMatrixCell {
  team: string;
  total: number;
  available: number;
  onLeave: number;
}

interface SendReportDetailRow {
  no: number;
  name: string;
  employeeId: string;
  employeeType: 'Staff' | 'Trainee';
  attendance: string;
  reason: string;
  expectedLeaveEnd: string;
  team: string;
  status: string;
  totalLeaveThisYear: number;
  maternityUsage?: string;
  paternityUsage?: string;
}

interface SendReportSnapshot {
  generatedAt: string;
  reportPreset: SendReportDatePreset;
  rangeStartDate: string;
  rangeEndDate: string;
  totalTeamCount: number;
  availableCount: number;
  onLeaveCount: number;
  typeSummary: SendReportTypeSummary[];
  teamMatrix: Array<{ type: 'Staff' | 'Trainee'; cells: SendReportTeamMatrixCell[] }>;
  details: SendReportDetailRow[];
}

const getLeaveEventColor = (value: string): string => {
  const key = String(value || 'leave').trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  return LEAVE_EVENT_COLORS[Math.abs(hash) % LEAVE_EVENT_COLORS.length];
};

export const getUserId = async (email: string, sp: SPFI) => {
  // const web = Web([sp.web, 'https://smalsusinfolabs.sharepoint.com/sites/Smalsus/HR']);
  const web = sp.web;
  console.log(web)
  const ensureUser = await web.ensureUser(email);
  return ensureUser.data.Id;
};

const getDaysInMonth = (month: string, year: number): number => {
  const monthIndex = Math.max(0, MONTH_NAMES.indexOf(month));
  return new Date(year, monthIndex + 1, 0).getDate();
};

const normalizeInsuranceTakenValue = (value: unknown): 'Yes' | 'No' => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'no' ? 'No' : 'Yes';
};

const calculateSalary = (monthlyCTC: number, insuranceOptIn = true): {
  basic: number;
  hra: number;
  other: number;
  gross: number;
  employerPF: number;
  employeePF: number;
  bonus: number;
  insurance: number;
  esi: number;
  employerEsi: number;
  inhand: number;
  yearlyCTC: number;
} => {
  const insuranceThreshold = 21000;
  const basic = monthlyCTC * 0.5;
  const hra = basic * 0.5;
  const pfEligibleBasic = Math.min(basic, 15000);
  const employeePF = pfEligibleBasic * 0.12;
  const employerPF = pfEligibleBasic * 0.13;
  const bonus = basic * 0.0833;

  const insurance = (monthlyCTC > insuranceThreshold && insuranceOptIn) ? 800 : 0;
  let esi = 0;
  let employerEsi = 0;

  const grossWithoutInsurance = monthlyCTC - employerPF - bonus;
  let gross = grossWithoutInsurance;

  if (monthlyCTC <= insuranceThreshold) {
    gross = grossWithoutInsurance / 1.0325;
    esi = gross * 0.0075;
    employerEsi = gross * 0.0325;
  }

  const other = gross - basic - hra;
  const ceil = (value: number): number => Math.ceil(value);

  const roundedBasic = ceil(basic);
  const roundedHra = ceil(hra);
  const roundedOther = ceil(other);
  const roundedEmployeePF = ceil(employeePF);
  const roundedEsi = ceil(esi);
  const roundedEmployerPF = ceil(employerPF);
  const roundedEmployerEsi = ceil(employerEsi);
  const roundedBonus = ceil(bonus);
  const roundedInsurance = ceil(insurance);
  const roundedGross = roundedBasic + roundedHra + roundedOther;
  let roundedInhand = roundedGross - roundedEmployeePF - roundedEsi;
  if (roundedInsurance > 0) {
    roundedInhand -= roundedInsurance;
  }

  return {
    basic: roundedBasic,
    hra: roundedHra,
    other: roundedOther,
    gross: roundedGross,
    employerPF: roundedEmployerPF,
    employeePF: roundedEmployeePF,
    bonus: roundedBonus,
    insurance: roundedInsurance,
    esi: roundedEsi,
    employerEsi: roundedEmployerEsi,
    inhand: roundedInhand,
    yearlyCTC: ceil(monthlyCTC * 12)
  };
};

const App: React.FC<AppProps> = ({ sp }) => {



  React.useEffect(() => {
    const bootstrapLinkId = 'hr-bootstrap-css';
    const iconsLinkId = 'hr-bootstrap-icons-css';

    if (!document.getElementById(bootstrapLinkId)) {
      const link = document.createElement('link');
      link.id = bootstrapLinkId;
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css';
      document.head.appendChild(link);
    }

    if (!document.getElementById(iconsLinkId)) {
      const link = document.createElement('link');
      link.id = iconsLinkId;
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css';
      document.head.appendChild(link);
    }
  }, []);

  React.useEffect(() => {
    const openDatePickerOnClick = (event: MouseEvent): void => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const dateInput = (target.closest("input[type='date']") as HTMLInputElement | null);
      if (!dateInput || dateInput.disabled || dateInput.readOnly) return;

      const pickerInput = dateInput as HTMLInputElement & { showPicker?: () => void };
      if (typeof pickerInput.showPicker === 'function') {
        try {
          pickerInput.showPicker();
        } catch {
          // Ignore errors where browser blocks picker invocation.
        }
      }
    };

    document.addEventListener('click', openDatePickerOnClick, true);
    return () => document.removeEventListener('click', openDatePickerOnClick, true);
  }, []);

  const [role, setRole] = useState<UserRole>(UserRole.Employee);
  const [directoryEmployees, setDirectoryEmployees] = useState<Employee[]>([]);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [isDirectoryResolved, setIsDirectoryResolved] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [isLoadingLeaveRequests, setIsLoadingLeaveRequests] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isImportingAttendance, setIsImportingAttendance] = useState(false);
  const [salarySlips, setSalarySlips] = useState<SalarySlip[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoadingPolicies, setIsLoadingPolicies] = useState(false);
  const [policiesError, setPoliciesError] = useState<string | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoadingHolidays, setIsLoadingHolidays] = useState(false);
  const [holidaysError, setHolidaysError] = useState<string | null>(null);
  const [leaveCategories, setLeaveCategories] = useState<string[]>([]);
  const [workFromHomeTypes, setWorkFromHomeTypes] = useState<string[]>([]);
  const [concerns, setConcerns] = useState<Concern[]>([]);
  const [isLoadingQuotas, setIsLoadingQuotas] = useState(false);
  const [quotasError, setQuotasError] = useState<string | null>(null);
  const [teamEvents, setTeamEvents] = useState<TeamEvent[]>([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [leaveFilter, setLeaveFilter] = useState<LeaveStatus | 'All'>('All');
  const [hrCalendarViewByTab, setHrCalendarViewByTab] = useState<Record<string, boolean>>({
    'leaves-request': false,
    'wfh-request': false,
    attendance: false,
    onLeaveToday: false
  });
  const [pendingAttendanceEditRecord, setPendingAttendanceEditRecord] = useState<AttendanceRecord | null>(null);
  const [openLeaveReportKey, setOpenLeaveReportKey] = useState(0);
  const [openWfhReportKey, setOpenWfhReportKey] = useState(0);
  const [isSendReportModalOpen, setIsSendReportModalOpen] = useState(false);
  const [sendReportPreset, setSendReportPreset] = useState<SendReportDatePreset>('Today');
  const [sendReportStartDate, setSendReportStartDate] = useState(todayIST());
  const [sendReportEndDate, setSendReportEndDate] = useState(todayIST());
  const [sendReportPayload, setSendReportPayload] = useState('');
  const [sendReportSnapshot, setSendReportSnapshot] = useState<SendReportSnapshot | null>(null);
  // const [hrGroupUsers, setHrGroupUsers] = useState<any[]>([]);

  // Add Leave Modal State
  const [isAddLeaveModalOpen, setIsAddLeaveModalOpen] = useState(false);
  const [newLeaveTypeName, setNewLeaveTypeName] = useState('');
  const [editingLeaveType, setEditingLeaveType] = useState<string | null>(null);
  const [editingLeaveTypeName, setEditingLeaveTypeName] = useState('');
  const [leaveQuotas, setLeaveQuotas] = useState<Record<string, number>>({});

  // Load Leave Requests
  const loadLeaveRequests = React.useCallback(async () => {
    if (!sp || directoryEmployees.length === 0) return;

    try {
      setIsLoadingLeaveRequests(true);
      const requests = await getAllLeaveRequests(sp, directoryEmployees);
      setLeaveRequests(requests);
    } catch (error) {
      console.error('Failed to load leave requests:', error);
    } finally {
      setIsLoadingLeaveRequests(false);
    }
  }, [sp, directoryEmployees]);

  // Initial load
  React.useEffect(() => {
    if (directoryEmployees.length > 0) {
      void loadLeaveRequests();
    }
  }, [directoryEmployees.length, loadLeaveRequests]);

  const handleUpdateQuota = (type: string, delta: number) => {
    setLeaveQuotas(prev => ({
      ...prev,
      [type]: Math.max(0, prev[type] + delta)
    }));
  };

  const handleAddNewLeaveType = () => {
    if (!newLeaveTypeName.trim()) return;
    if (leaveQuotas[newLeaveTypeName]) {
      showAlert("This leave type already exists.");
      return;
    }
    setLeaveQuotas(prev => ({
      ...prev,
      [newLeaveTypeName]: 0
    }));
    setNewLeaveTypeName('');
  };

  const handleDeleteQuotaType = (type: string) => {
    setLeaveQuotas(prev => {
      const next = { ...prev };
      delete next[type];
      return { ...next };
    });
  };

  const handleRenameLeaveType = (oldName: string, newName: string) => {
    if (!newName.trim() || newName === oldName) {
      setEditingLeaveType(null);
      return;
    }
    if (leaveQuotas[newName]) {
      showAlert("A leave type with this name already exists.");
      return;
    }
    setLeaveQuotas(prev => {
      const next = { ...prev };
      const quota = next[oldName];
      delete next[oldName];
      next[newName] = quota;
      return next;
    });
    setEditingLeaveType(null);
  };

  // Load Events
  const loadEvents = React.useCallback(async () => {
    try {
      const liveEvents = await getAllEvents(sp, directoryEmployees);
      setTeamEvents(liveEvents);
    } catch (error) {
      console.error("Error loading events:", error);
    }
  }, [sp, directoryEmployees]);

  // Initial load for events
  React.useEffect(() => {
    if (directoryEmployees.length > 0) {
      void loadEvents();
    }
  }, [directoryEmployees.length, loadEvents]);

  // Load Concerns
  const loadConcerns = React.useCallback(async () => {
    if (!sp) return;
    try {
      const liveConcerns = await getAllConcerns(sp);
      setConcerns(liveConcerns);
    } catch (error) {
      console.error("Error loading concerns:", error);
    }
  }, [sp]);

  // Initial load for concerns
  React.useEffect(() => {
    void loadConcerns();
  }, [loadConcerns]);

  const handleAddTeamEvent = async (event: Omit<TeamEvent, 'id'>, employeeId?: string) => {
    try {
      await createEvent(sp, event, employeeId);
      await loadEvents();
    } catch (error) {
      console.error("Error adding event:", error);
      showAlert("Failed to add event.");
    }
  };

  const handleDeleteTeamEvent = async (eventId: number) => {
    if (!window.confirm('Delete this team event?')) return;
    try {
      await deleteEvent(sp, eventId);
      await loadEvents();
    } catch (error) {
      console.error("Error deleting event:", error);
      showAlert("Failed to delete event.");
    }
  };

  const handleUpdateTeamEvent = async (eventId: number, event: Omit<TeamEvent, 'id'>, employeeId?: string) => {
    try {
      await updateEvent(sp, eventId, event, employeeId);
      await loadEvents();
    } catch (error) {
      console.error("Error updating event:", error);
      showAlert("Failed to update event.");
    }
  };



  const loadDirectoryEmployees = React.useCallback(async () => {
    if (!sp) return;
    setDirectoryError(null);
    try {
      const allMapped = await getAllEmployees(sp);
      setDirectoryEmployees(allMapped);
    } catch (err: any) {
      setDirectoryError('Failed to load Employee Master directory.');
      setDirectoryEmployees([]);
      console.error('Employee Master load failed', err);
    } finally {
      setIsDirectoryResolved(true);
    }
  }, [sp]);

  const distinctTimeCategories = useMemo<string[]>(() => {
    const departments = directoryEmployees.map(emp => emp.department).filter(Boolean) as string[];
    return departments.filter((dept, index, self) => self.indexOf(dept) === index);
  }, [directoryEmployees]);


  React.useEffect(() => {
    void loadDirectoryEmployees();
  }, [loadDirectoryEmployees]);

  const sortedHolidays = useMemo(() => {
    return [...holidays].sort((a, b) => a.date.localeCompare(b.date));
  }, [holidays]);

  // Salary Modal State
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [targetEmployee, setTargetEmployee] = useState<Employee | null>(null);
  const [salaryFormData, setSalaryFormData] = useState({
    month: 'January',
    year: '2025',
    basic: 0,
    hra: 0,
    allowances: 0,
    deductions: 0,
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    pan: '',
    uan: '',
    workingDays: 31,
    paidDays: 31,
    monthlyCtc: 0,
    gross: 0,
    employerPF: 0,
    employeePF: 0,
    bonus: 0,
    insurance: 0,
    esi: 0,
    employerEsi: 0,
    inhand: 0,
    insuranceTaken: 'Yes' as 'Yes' | 'No'
  });
  const [salaryYearlyCtc, setSalaryYearlyCtc] = useState<string>('');
  const [isSalaryManualMode, setIsSalaryManualMode] = useState(false);

  // Concern Reply Modal State
  const [isConcernReplyModalOpen, setIsConcernReplyModalOpen] = useState(false);
  const [selectedConcern, setSelectedConcern] = useState<Concern | null>(null);
  const [concernReplyText, setConcernReplyText] = useState('');

  // Employee Management Modal State
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeModalTab, setEmployeeModalTab] = useState<'professional' | 'banking' | 'salary' | 'image'>('professional');
  const [profileUploadFile, setProfileUploadFile] = useState<File | null>(null);
  const [selectedGalleryImageUrl, setSelectedGalleryImageUrl] = useState<string>('');
  const [removeProfileImage, setRemoveProfileImage] = useState(false);
  const [profileImageFolders, setProfileImageFolders] = useState<SPFolder[]>([]);
  const [selectedProfileFolder, setSelectedProfileFolder] = useState<SPFolder | null>(null);
  const [profileFolderImages, setProfileFolderImages] = useState<ProfileGalleryImage[]>([]);
  const [isLoadingProfileFolders, setIsLoadingProfileFolders] = useState(false);
  const [isLoadingFolderImages, setIsLoadingFolderImages] = useState(false);
  const selectedProfileFolderRef = React.useRef<SPFolder | null>(null);
  const [employeeFormData, setEmployeeFormData] = useState<Partial<Employee>>({
    name: '',
    id: '',
    email: '',
    department: '',
    position: '',
    joiningDate: todayIST(),
    pan: '',
    uan: '',
    accountNumber: '',
    bankName: '',
    ifscCode: '',
    basicSalary: 0,
    hra: 0,
    others: 0,
    pf: 0,
    total: 0,
    yearlyCTC: 0,
    employeeESI: 0,
    employerESI: 0,
    salaryInsurance: 0,
    salaryBonus: 0,
    insuranceTaken: 'Yes',
    employeeStatus: 'Active Employee'
  });

  // Leave Form Modal State
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isSavingLeave, setIsSavingLeave] = useState(false);
  const [leaveModalTab, setLeaveModalTab] = useState<'leave' | 'workFromHome'>('leave');
  const [selectedEmployeeForLeave, setSelectedEmployeeForLeave] = useState<Employee | null>(null);
  const [editingRequest, setEditingRequest] = useState<LeaveRequest | null>(null);
  const [leaveEmployeeSearch, setLeaveEmployeeSearch] = useState('');
  const [isLeaveEmployeeDropdownOpen, setIsLeaveEmployeeDropdownOpen] = useState(false);

  const filteredLeaveEmployees = useMemo(() => {
    const sorted = directoryEmployees
      .filter(emp => emp.employeeStatus !== 'Ex-Staff')
      .slice()
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
    if (!leaveEmployeeSearch.trim()) return sorted;
    const term = leaveEmployeeSearch.trim().toLowerCase();
    return sorted.filter(emp =>
      emp.name.toLowerCase().includes(term) ||
      emp.id.toLowerCase().includes(term) ||
      (emp.email && emp.email.toLowerCase().includes(term)) ||
      (emp.department && emp.department.toLowerCase().includes(term))
    );
  }, [directoryEmployees, leaveEmployeeSearch]);
  const [leaveFormData, setLeaveFormData] = useState({
    leaveType: 'Sick',
    startDate: '',
    endDate: '',
    reason: '',
    isHalfDay: false,
    halfDayType: 'first' as 'first' | 'second',
    isRecurring: false,
    recurringFrequency: 'Daily' as 'Daily' | 'Weekly' | 'Monthly' | 'Yearly',
    // Daily pattern
    dailyInterval: 1,
    dailyWeekdaysOnly: false,
    // Weekly pattern
    weeklyInterval: 1,
    weeklyDays: [] as string[],
    // Monthly pattern
    monthlyPattern: 'day' as 'day' | 'the',
    monthlyDay: 1,
    monthlyInterval: 1,
    monthlyWeekNumber: 'first' as 'first' | 'second' | 'third' | 'fourth' | 'last',
    monthlyWeekDay: 'Monday',
    monthlyIntervalThe: 1,
    // Yearly pattern
    yearlyPattern: 'every' as 'every' | 'the',
    yearlyMonth: 'January',
    yearlyInterval: 1,
    yearlyWeekNumber: 'first' as 'first' | 'second' | 'third' | 'fourth' | 'last',
    yearlyWeekDay: 'Monday',
    yearlyMonthThe: 'January',
    // Date range
    endDateOption: 'noEnd' as 'noEnd' | 'endBy' | 'endAfter',
    recurrenceEndDate: '',
    recurrenceOccurrences: 1
  });

  const isSpecialLeave = React.useMemo(() => {
    const lower = leaveFormData.leaveType.toLowerCase();
    return lower.includes('maternity') || lower.includes('paternity');
  }, [leaveFormData.leaveType]);

  React.useEffect(() => {
    if (isSpecialLeave && leaveFormData.startDate) {
      const start = new Date(leaveFormData.startDate);
      if (!isNaN(start.getTime())) {
        const lowerType = leaveFormData.leaveType.toLowerCase();
        // Dynamic quota from leaveQuotas or fallbacks (182 for maternity, 54 for paternity)
        const quota = leaveQuotas[leaveFormData.leaveType] || (lowerType.includes('maternity') ? 182 : 54);

        const end = new Date(start);
        end.setDate(start.getDate() + quota - 1); // -1 because the start date counts as 1 day

        const endStr = end.toISOString().split('T')[0];
        if (leaveFormData.endDate !== endStr) {
          setLeaveFormData(prev => ({ ...prev, endDate: endStr, isHalfDay: false }));
        }
      }
    }
  }, [isSpecialLeave, leaveFormData.leaveType, leaveFormData.startDate, leaveQuotas]);

  const [workFromHomeFormData, setWorkFromHomeFormData] = useState({
    workFromHomeType: 'Work From Home',
    startDate: todayIST(),
    endDate: todayIST(),
    reason: '',
    isHalfDay: false,
    halfDayType: 'first' as 'first' | 'second',
    isRecurring: false,
    recurringFrequency: 'Daily' as 'Daily' | 'Weekly' | 'Monthly' | 'Yearly',
    // Daily pattern
    dailyInterval: 1,
    dailyWeekdaysOnly: false,
    // Weekly pattern
    weeklyInterval: 1,
    weeklyDays: [] as string[],
    // Monthly pattern
    monthlyPattern: 'day' as 'day' | 'the',
    monthlyDay: 1,
    monthlyInterval: 1,
    monthlyWeekNumber: 'first' as 'first' | 'second' | 'third' | 'fourth' | 'last',
    monthlyWeekDay: 'Monday',
    monthlyIntervalThe: 1,
    // Yearly pattern
    yearlyPattern: 'every' as 'every' | 'the',
    yearlyMonth: 'January',
    yearlyInterval: 1,
    yearlyWeekNumber: 'first' as 'first' | 'second' | 'third' | 'fourth' | 'last',
    yearlyWeekDay: 'Monday',
    yearlyMonthThe: 'January',
    // Date range
    endDateOption: 'noEnd' as 'noEnd' | 'endBy' | 'endAfter',
    recurrenceEndDate: '',
    recurrenceOccurrences: 1
  });

  // Policy Modal State
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [policyFormData, setPolicyFormData] = useState<Partial<Policy>>({ title: '', content: '' });
  const [editingPolicyId, setEditingPolicyId] = useState<number | null>(null);

  // Holiday Modal State
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [holidayFormData, setHolidayFormData] = useState<Partial<Holiday>>({ name: '', date: '', type: 'Public' });
  const [editingHolidayId, setEditingHolidayId] = useState<number | null>(null);

  // Leave Balance Modal State
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
  const [balanceEmployee, setBalanceEmployee] = useState<Employee | null>(null);
  const [isVersionHistoryModalOpen, setIsVersionHistoryModalOpen] = useState(false);
  const [versionHistoryTitle, setVersionHistoryTitle] = useState('Version History');
  const [versionHistoryEntries, setVersionHistoryEntries] = useState<VersionHistoryEntry[]>([]);
  const [isVersionHistoryLoading, setIsVersionHistoryLoading] = useState(false);
  const [versionHistoryError, setVersionHistoryError] = useState<string | undefined>(undefined);

  // Current User State
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserTitle, setCurrentUserTitle] = useState<string | null>(null);
  const [currentUserUpn, setCurrentUserUpn] = useState<string | null>(null);
  const [currentUserLoginName, setCurrentUserLoginName] = useState<string | null>(null);
  const [currentUserSpId, setCurrentUserSpId] = useState<number | null>(null);
  const [isCurrentUserResolved, setIsCurrentUserResolved] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // HR Management group membership (3rd fallback for HR access)
  const [isInHrGroup, setIsInHrGroup] = React.useState(false);

  React.useEffect(() => {
    if (!sp || !isCurrentUserResolved) return;
    sp.web.siteGroups.getByName("HR Management").users().then(users => {
      console.log("HR Management Group Users:", users);
      const normalizeStr = (v: unknown): string => String(v || '').trim().toLowerCase();
      const currentEmailNorm = normalizeStr(currentUserEmail);
      const currentUpnNorm = normalizeStr(currentUserUpn);
      const currentLoginNorm = normalizeStr(currentUserLoginName);

      const isMember = (users as Array<{ Email?: string; UserPrincipalName?: string; LoginName?: string }>).some(u => {
        const uEmail = normalizeStr(u.Email);
        const uUpn = normalizeStr(u.UserPrincipalName);
        const uLogin = normalizeStr(u.LoginName);
        return (
          (currentEmailNorm && (uEmail === currentEmailNorm || uUpn === currentEmailNorm)) ||
          (currentUpnNorm && (uEmail === currentUpnNorm || uUpn === currentUpnNorm)) ||
          (currentLoginNorm && (uLogin === currentLoginNorm || uLogin.endsWith('|' + currentLoginNorm)))
        );
      });
      console.log(isMember);
      setIsInHrGroup(isMember);
    }).catch(err => {
      console.error("Error fetching HR Management group users:", err);
      setIsInHrGroup(false);
    });
  }, [sp, isCurrentUserResolved, currentUserEmail, currentUserUpn, currentUserLoginName]);

  const editingPolicy = React.useMemo(
    () => policies.find((policy) => policy.id === editingPolicyId) || null,
    [policies, editingPolicyId]
  );

  const editingHoliday = React.useMemo(
    () => holidays.find((holiday) => holiday.id === editingHolidayId) || null,
    [holidays, editingHolidayId]
  );

  const handleOpenVersionHistory = React.useCallback(async (
    label: string,
    listTitle: string,
    itemId?: number
  ) => {
    if (!itemId) return;
    setVersionHistoryTitle(`${label} Version History`);
    setIsVersionHistoryModalOpen(true);
    setIsVersionHistoryLoading(true);
    setVersionHistoryError(undefined);
    setVersionHistoryEntries([]);
    try {
      const entries = await getItemVersionHistory(sp, listTitle, itemId);
      setVersionHistoryEntries(entries);
    } catch (error) {
      console.error('Failed to load version history', error);
      setVersionHistoryError('Unable to load version history for this item.');
    } finally {
      setIsVersionHistoryLoading(false);
    }
  }, [sp]);

  React.useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const user = await sp.web.currentUser();
        console.log("Current User:", user);
        // Fallback to UserPrincipalName or LoginName if Email is empty (common in some SPO setups)
        const email = user.Email || user.UserPrincipalName || (user.LoginName ? user.LoginName.split('|').pop() : null) || null;
        const title = String((user as { Title?: string }).Title || '').trim();
        const upn = String((user as { UserPrincipalName?: string }).UserPrincipalName || '').trim();
        const loginName = String((user as { LoginName?: string }).LoginName || '').trim();
        setCurrentUserEmail(email);
        setCurrentUserTitle(title || null);
        setCurrentUserUpn(upn || null);
        setCurrentUserLoginName(loginName || null);

        if (email) {
          try {
            const spUserId = await getUserId(email, sp);
            console.log('Current User SharePoint ID:', spUserId);
            setCurrentUserSpId(spUserId);
          } catch (idError) {
            console.error('Error resolving current user ID:', idError);
          }
        }
      } catch (error) {
        console.error("Error fetching current user:", error);
      } finally {
        setIsCurrentUserResolved(true);
      }
    };
    void fetchCurrentUser();
  }, [sp]);

  const matchedCurrentUser = React.useMemo(() => {
    if (directoryEmployees.length === 0) return undefined;
    const normalizeName = (value: unknown): string => String(value || '').trim().toLowerCase();
    const normalizeEmail = (value: unknown): string => {
      const raw = String(value || '').trim().toLowerCase();
      if (!raw) return '';
      if (raw.indexOf('|') !== -1) {
        const parts = raw.split('|');
        return parts[parts.length - 1].trim();
      }
      return raw;
    };

    const byTitle = normalizeName(currentUserTitle);
    if (byTitle) {
      const matchByTitle = directoryEmployees.find((emp) => normalizeName(emp.name) === byTitle);
      if (matchByTitle) return matchByTitle;
    }

    const byUpn = normalizeEmail(currentUserUpn || currentUserEmail);
    if (byUpn) {
      const matchByUpn = directoryEmployees.find((emp) => normalizeEmail(emp.email) === byUpn);
      if (matchByUpn) return matchByUpn;
    }

    const byLogin = normalizeEmail(currentUserLoginName);
    if (byLogin) {
      const matchByLogin = directoryEmployees.find((emp) => normalizeEmail(emp.email) === byLogin);
      if (matchByLogin) return matchByLogin;
    }

    return undefined;
  }, [currentUserTitle, currentUserUpn, currentUserEmail, currentUserLoginName, directoryEmployees]);

  const inferredCurrentUser = React.useMemo(() => {
    return matchedCurrentUser || directoryEmployees[0];
  }, [matchedCurrentUser, directoryEmployees]);

  const isAuthenticatedDirectoryUser = React.useMemo(() => {
    if (!isCurrentUserResolved) return true;
    if (!directoryEmployees.length) return false;
    return !!matchedCurrentUser;
  }, [isCurrentUserResolved, directoryEmployees.length, matchedCurrentUser]);

  React.useEffect(() => {
    if (!directoryEmployees.length) return;
    if (!matchedCurrentUser) {
      setSelectedUserId(null);
      return;
    }
    if (!selectedUserId) {
      setSelectedUserId(matchedCurrentUser.id);
      return;
    }
    const stillExists = directoryEmployees.some(emp => emp.id === selectedUserId);
    if (!stillExists) {
      setSelectedUserId(matchedCurrentUser.id);
    }
  }, [directoryEmployees, matchedCurrentUser, selectedUserId]);

  const currentUser = React.useMemo(() => {
    if (!directoryEmployees.length) return inferredCurrentUser;
    const selected = selectedUserId ? directoryEmployees.find(emp => emp.id === selectedUserId) : undefined;
    return selected || inferredCurrentUser || directoryEmployees[0];
  }, [directoryEmployees, inferredCurrentUser, selectedUserId]);

  const canAccessHr = React.useMemo(() => {
    const normalize = (value: unknown): string => String(value || '').trim().toLowerCase();

    // 1st check: static name list
    const allowedNames = HR_ALLOWED_NAMES.map(normalize);
    const currentName = normalize(currentUserTitle || inferredCurrentUser?.name);
    const isNameAllowed = !!currentName && allowedNames.indexOf(currentName) !== -1;
    if (isNameAllowed) return true;

    // 2nd check: static email list
    const allowedEmails = HR_ALLOWED_EMAILS.map(normalize);
    const currentEmail = normalize(currentUserEmail);
    const isEmailAllowed = !!currentEmail && allowedEmails.indexOf(currentEmail) !== -1;
    if (isEmailAllowed) return true;

    // 3rd check: "HR Management" SharePoint group membership
    return isInHrGroup;
  }, [currentUserTitle, currentUserEmail, inferredCurrentUser, isInHrGroup]);

  React.useEffect(() => {
    if (canAccessHr) return;
    if (role === UserRole.HR) {
      setRole(UserRole.Employee);
      setActiveTab('dashboard');
    }
  }, [canAccessHr, role]);

  const handleUpdateRequestStatus = async (id: number, status: LeaveStatus, comment: string) => {
    try {
      const approverName = (currentUserTitle && String(currentUserTitle).trim()) || inferredCurrentUser?.name || "HR Manager";
      const approver = status === LeaveStatus.Pending ? "" : (canAccessHr ? approverName : "HR Manager");
      const finalComment = status === LeaveStatus.Pending ? "" : comment;

      await updateLeaveRequestStatus(sp, id, status, approver, finalComment);
      await loadLeaveRequests(); // Reload data
    } catch (error) {
      console.error("Error updating leave request status:", error);
      showAlert("Failed to update leave request status. Please try again.");
    }
  };

  // Load Attendance Records
  const loadAttendance = React.useCallback(async () => {
    if (!sp) return;
    try {
      const records = await getAllAttendanceRecords(sp);
      setAttendanceRecords(records);
    } catch (err) {
      console.error("Failed to load attendance", err);
    }
  }, [sp]);

  React.useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  const handleImportAttendance = async (records: AttendanceRecord[]) => {
    if (!sp) return;
    setIsImportingAttendance(true);
    try {
      const { created, updated, unchanged } = await saveAttendanceRecords(sp, records);
      await loadAttendance();
      showAlert(`Created: ${created}, updated: ${updated}, unchanged: ${unchanged}`);
    } catch (err) {
      showAlert("Failed to import attendance data.");
      console.error(err);
    } finally {
      setIsImportingAttendance(false);
    }
  };

  const handleUpdateAttendanceRecord = async (record: AttendanceRecord) => {
    if (!sp) return;
    try {
      await updateAttendanceRecord(sp, record);
      await loadAttendance();
    } catch (error) {
      console.error("Error updating attendance record:", error);
      throw error;
    }
  };

  const handleDeleteAttendanceByDate = async (date: string, employeeId?: string): Promise<number> => {
    if (!sp) return 0;
    try {
      const deletedCount = await deleteAttendanceRecordsByDate(sp, date, employeeId);
      await loadAttendance();
      return deletedCount;
    } catch (error) {
      console.error("Error deleting attendance records by date:", error);
      throw error;
    }
  };

  const handleDeleteRequest = async (id: number) => {
    if (!confirm("Are you sure you want to delete this leave request?")) return;
    try {
      await deleteLeaveRequest(sp, id);
      await loadLeaveRequests(); // Reload data
    } catch (error) {
      console.error("Error deleting leave request:", error);
      showAlert("Failed to delete leave request. Please try again.");
    }
  };

  const handleDeleteAttendanceRecord = async (record: AttendanceRecord): Promise<void> => {
    if (!record.id || !sp) return;
    if (!confirm("Are you sure you want to delete this attendance record?")) return;
    try {
      await deleteAttendanceRecordById(sp, record.id);
      await loadAttendance();
    } catch (error) {
      console.error("Error deleting attendance record:", error);
      showAlert("Failed to delete attendance record. Please try again.");
    }
  };

  const handleOpenLeaveModal = (empOrReq?: Employee | LeaveRequest, preferredTab?: 'leave' | 'workFromHome', initialDate?: string) => {
    let emp: Employee;
    let req: LeaveRequest | undefined;
    if (empOrReq && 'leaveType' in empOrReq) {
      req = empOrReq as LeaveRequest;
      emp = req.employee;
    } else {
      emp = (empOrReq as Employee) || currentUser;
    }

    if ((emp?.department === 'Trainee' || emp?.department === 'Intern') && !req) {
      showAlert("Trainees / Interns are not eligible to submit new leave or WFH requests.");
      return;
    }

    setSelectedEmployeeForLeave(emp);
    setLeaveEmployeeSearch(emp ? `${emp.name} (${emp.id}) - ${emp.department}` : '');
    setIsLeaveEmployeeDropdownOpen(false);
    if (req) {
      const isWorkFromHomeRequest = req.requestCategory === 'Work From Home';
      setLeaveModalTab(isWorkFromHomeRequest ? 'workFromHome' : 'leave');
      setEditingRequest(req);
      setLeaveFormData({
        leaveType: req.leaveType,
        startDate: req.startDate,
        endDate: req.endDate,
        reason: req.reason,
        isHalfDay: req.isHalfDay || false,
        halfDayType: req.halfDayType || 'first',
        isRecurring: req.isRecurring || false,
        recurringFrequency: (req.recurringFrequency as 'Daily' | 'Weekly' | 'Monthly' | 'Yearly') || 'Daily',
        dailyInterval: 1,
        dailyWeekdaysOnly: false,
        weeklyInterval: 1,
        weeklyDays: [],
        monthlyPattern: 'day' as 'day' | 'the',
        monthlyDay: 1,
        monthlyInterval: 1,
        monthlyWeekNumber: 'first' as 'first' | 'second' | 'third' | 'fourth' | 'last',
        monthlyWeekDay: 'Monday',
        monthlyIntervalThe: 1,
        yearlyPattern: 'every' as 'every' | 'the',
        yearlyMonth: 'January',
        yearlyInterval: 1,
        yearlyWeekNumber: 'first' as 'first' | 'second' | 'third' | 'fourth' | 'last',
        yearlyWeekDay: 'Monday',
        yearlyMonthThe: 'January',
        endDateOption: 'noEnd' as 'noEnd' | 'endBy' | 'endAfter',
        recurrenceEndDate: '',
        recurrenceOccurrences: 1
      });
      setWorkFromHomeFormData({
        workFromHomeType: req.leaveType || (workFromHomeTypes[0] || 'Work From Home'),
        startDate: req.startDate || todayIST(),
        endDate: req.endDate || req.startDate || todayIST(),
        reason: req.reason || '',
        isHalfDay: req.isHalfDay || false,
        halfDayType: req.halfDayType || 'first',
        isRecurring: req.isRecurring || false,
        recurringFrequency: (req.recurringFrequency as 'Daily' | 'Weekly' | 'Monthly' | 'Yearly') || 'Daily',
        dailyInterval: 1,
        dailyWeekdaysOnly: false,
        weeklyInterval: 1,
        weeklyDays: [],
        monthlyPattern: 'day' as 'day' | 'the',
        monthlyDay: 1,
        monthlyInterval: 1,
        monthlyWeekNumber: 'first' as 'first' | 'second' | 'third' | 'fourth' | 'last',
        monthlyWeekDay: 'Monday',
        monthlyIntervalThe: 1,
        yearlyPattern: 'every' as 'every' | 'the',
        yearlyMonth: 'January',
        yearlyInterval: 1,
        yearlyWeekNumber: 'first' as 'first' | 'second' | 'third' | 'fourth' | 'last',
        yearlyWeekDay: 'Monday',
        yearlyMonthThe: 'January',
        endDateOption: 'noEnd' as 'noEnd' | 'endBy' | 'endAfter',
        recurrenceEndDate: '',
        recurrenceOccurrences: 1
      });
    } else {
      setLeaveModalTab(preferredTab || 'leave');
      setEditingRequest(null);
      const todayStr = initialDate || todayIST();
      const defaultType = Object.keys(leaveQuotas)[0] || 'Sick';
      setLeaveFormData({
        leaveType: defaultType,
        startDate: todayStr,
        endDate: todayStr,
        reason: '',
        isHalfDay: false,
        halfDayType: 'first' as 'first' | 'second',
        isRecurring: false,
        recurringFrequency: 'Daily' as 'Daily' | 'Weekly' | 'Monthly' | 'Yearly',
        dailyInterval: 1,
        dailyWeekdaysOnly: false,
        weeklyInterval: 1,
        weeklyDays: [],
        monthlyPattern: 'day' as 'day' | 'the',
        monthlyDay: 1,
        monthlyInterval: 1,
        monthlyWeekNumber: 'first' as 'first' | 'second' | 'third' | 'fourth' | 'last',
        monthlyWeekDay: 'Monday',
        monthlyIntervalThe: 1,
        yearlyPattern: 'every' as 'every' | 'the',
        yearlyMonth: 'January',
        yearlyInterval: 1,
        yearlyWeekNumber: 'first' as 'first' | 'second' | 'third' | 'fourth' | 'last',
        yearlyWeekDay: 'Monday',
        yearlyMonthThe: 'January',
        endDateOption: 'noEnd' as 'noEnd' | 'endBy' | 'endAfter',
        recurrenceEndDate: '',
        recurrenceOccurrences: 1
      });
      setWorkFromHomeFormData({
        workFromHomeType: workFromHomeTypes[0] || 'Work From Home',
        startDate: todayStr,
        endDate: todayStr,
        reason: '',
        isHalfDay: false,
        halfDayType: 'first' as 'first' | 'second',
        isRecurring: false,
        recurringFrequency: 'Daily' as 'Daily' | 'Weekly' | 'Monthly' | 'Yearly',
        dailyInterval: 1,
        dailyWeekdaysOnly: false,
        weeklyInterval: 1,
        weeklyDays: [],
        monthlyPattern: 'day' as 'day' | 'the',
        monthlyDay: 1,
        monthlyInterval: 1,
        monthlyWeekNumber: 'first' as 'first' | 'second' | 'third' | 'fourth' | 'last',
        monthlyWeekDay: 'Monday',
        monthlyIntervalThe: 1,
        yearlyPattern: 'every' as 'every' | 'the',
        yearlyMonth: 'January',
        yearlyInterval: 1,
        yearlyWeekNumber: 'first' as 'first' | 'second' | 'third' | 'fourth' | 'last',
        yearlyWeekDay: 'Monday',
        yearlyMonthThe: 'January',
        endDateOption: 'noEnd' as 'noEnd' | 'endBy' | 'endAfter',
        recurrenceEndDate: '',
        recurrenceOccurrences: 1
      });
    }
    setIsLeaveModalOpen(true);
  };

  // Add the missing saveLeaveRequest function
  // Save Leave Request
  const saveLeaveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeForLeave) {
      showAlert('Please select an employee.');
      return;
    }

    setIsSavingLeave(true);
    try {
      if (editingRequest) {
        if (leaveModalTab === 'workFromHome') {
          const start = new Date(workFromHomeFormData.startDate);
          const end = workFromHomeFormData.isHalfDay ? start : new Date(workFromHomeFormData.endDate || workFromHomeFormData.startDate);
          let days = 1;
          if (workFromHomeFormData.isHalfDay) {
            days = 0.5;
          } else {
            const diffTime = Math.abs(end.getTime() - start.getTime());
            days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          }

          await updateLeaveRequest(sp, editingRequest.id, {
            ...workFromHomeFormData,
            leaveType: workFromHomeFormData.workFromHomeType || 'Work From Home',
            endDate: workFromHomeFormData.isHalfDay ? workFromHomeFormData.startDate : (workFromHomeFormData.endDate || workFromHomeFormData.startDate),
            requestCategory: 'Work From Home'
          }, days, selectedEmployeeForLeave || undefined);
        } else {
          const start = new Date(leaveFormData.startDate);
          const end = leaveFormData.isHalfDay ? start : new Date(leaveFormData.endDate);
          let days = 1;
          if (leaveFormData.isHalfDay) {
            days = 0.5;
          } else {
            const diffTime = Math.abs(end.getTime() - start.getTime());
            days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          }
          await updateLeaveRequest(sp, editingRequest.id, { ...leaveFormData, requestCategory: 'Leave' }, days, selectedEmployeeForLeave || undefined);
        }
      } else {
        if (leaveModalTab === 'workFromHome') {
          const start = new Date(workFromHomeFormData.startDate);
          const end = workFromHomeFormData.isHalfDay ? start : new Date(workFromHomeFormData.endDate || workFromHomeFormData.startDate);
          if (Number.isNaN(start.getTime()) || (!workFromHomeFormData.isHalfDay && Number.isNaN(end.getTime()))) {
            showAlert('Please select valid start and end dates for work from home request.');
            return;
          }
          if (!workFromHomeFormData.isHalfDay && end < start) {
            showAlert('End date cannot be earlier than start date.');
            return;
          }

          let days = 1;
          if (workFromHomeFormData.isHalfDay) {
            days = 0.5;
          } else {
            const diffTime = Math.abs(end.getTime() - start.getTime());
            days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          }

          await createLeaveRequest(sp, selectedEmployeeForLeave, {
            ...workFromHomeFormData,
            leaveType: workFromHomeFormData.workFromHomeType || 'Work From Home',
            endDate: workFromHomeFormData.isHalfDay ? workFromHomeFormData.startDate : (workFromHomeFormData.endDate || workFromHomeFormData.startDate),
            requestCategory: 'Work From Home'
          }, days);
        } else {
          const start = new Date(leaveFormData.startDate);
          const end = leaveFormData.isHalfDay ? start : new Date(leaveFormData.endDate);
          let days = 1;
          if (leaveFormData.isHalfDay) {
            days = 0.5;
          } else {
            const diffTime = Math.abs(end.getTime() - start.getTime());
            days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          }

          // Validate Leave Balance
          const quota = leaveQuotas[leaveFormData.leaveType] || 0;

          // Calculate currently used leaves (Approved + Pending) for this user and type
          const used = leaveRequests
            .filter(r => r.employee.id === currentUser.id && r.leaveType === leaveFormData.leaveType && (r.status === LeaveStatus.Approved || r.status === LeaveStatus.Pending))
            .reduce((sum, r) => sum + r.days, 0);

          if (used + days > quota) {
            showAlert(`Insufficient leave balance! You have used ${used} of ${quota} days for ${leaveFormData.leaveType}. This request of ${days} days would exceed your limit.`);
            return;
          }

          await createLeaveRequest(sp, selectedEmployeeForLeave, { ...leaveFormData, requestCategory: 'Leave' }, days);
        }
      }

      await loadLeaveRequests(); // Reload data
      setIsLeaveModalOpen(false);
    } catch (error) {
      console.error('Failed to save leave request:', error);
      showAlert('Failed to save leave request. Please try again.');
    } finally {
      setIsSavingLeave(false);
    }
  };

  const handleViewBalance = (emp: Employee) => {
    setBalanceEmployee(emp);
    setIsBalanceModalOpen(true);
  };

  const getQuotaForLeaveType = React.useCallback((type: string): number => {
    const direct = leaveQuotas[type];
    if (typeof direct === 'number') return direct;
    const matchedKey = Object.keys(leaveQuotas).find((key) => key.toLowerCase() === type.toLowerCase());
    return matchedKey ? leaveQuotas[matchedKey] : 0;
  }, [leaveQuotas]);

  const getUsedLeavesForEmployee = React.useCallback((employeeId: string, type: string): number => {
    return leaveRequests
      .filter((request) =>
        request.employee.id === employeeId &&
        request.leaveType.toLowerCase() === type.toLowerCase() &&
        request.status === LeaveStatus.Approved
      )
      .reduce((sum, request) => sum + request.days, 0);
  }, [leaveRequests]);

  const balanceSummary = React.useMemo(() => {
    if (!balanceEmployee) return [];
    const leaveTypes = Object.keys(leaveQuotas);

    interface SummaryItem {
      type: string;
      quota: number;
      used: number;
      left: number;
      isSpecial: boolean;
    }

    const allItems: SummaryItem[] = leaveTypes.map((type) => {
      const quota = getQuotaForLeaveType(type);
      const used = getUsedLeavesForEmployee(balanceEmployee.id, type);
      const left = Math.max(quota - used, 0);
      const isSpecial = type.toLowerCase().includes('maternity') || type.toLowerCase().includes('paternity');
      return { type, quota, used, left, isSpecial };
    });

    const regulars = allItems.filter(i => !i.isSpecial);
    const specials = allItems.filter(i => i.isSpecial);

    const otherLeaves: SummaryItem = {
      type: 'Other Leaves',
      quota: regulars.reduce((sum, i) => sum + i.quota, 0),
      used: regulars.reduce((sum, i) => sum + i.used, 0),
      left: regulars.reduce((sum, i) => sum + i.left, 0),
      isSpecial: false
    };

    const anySpecialUsed = specials.some(i => i.used > 0);
    const finalSummary = [otherLeaves];
    // If any special leave used, show ALL special leaves (so user can see remaining balance for both)
    if (anySpecialUsed) {
      specials.forEach(i => finalSummary.push(i));
    }

    return finalSummary;
  }, [balanceEmployee, leaveQuotas, getQuotaForLeaveType, getUsedLeavesForEmployee]);

  const totalLeavesTaken = React.useMemo(() => {
    // balanceSummary now only has 'Other Leaves' (regular) and optionally 'Special Leaves'
    // We only want regular leaves in the total
    const other = balanceSummary.find(s => s.type === 'Other Leaves');
    return other ? other.used : 0;
  }, [balanceSummary]);

  const totalLeavesLeft = React.useMemo(() => {
    const other = balanceSummary.find(s => s.type === 'Other Leaves');
    return other ? other.left : 0;
  }, [balanceSummary]);

  const handleRaiseConcern = async (type: ConcernType, referenceId: string | number, description: string) => {
    try {
      let employeeSpUserId = currentUserSpId;
      const candidateEmail = currentUserEmail || currentUserUpn || currentUserLoginName;
      if (!employeeSpUserId && candidateEmail) {
        try {
          employeeSpUserId = await getUserId(candidateEmail, sp);
          setCurrentUserSpId(employeeSpUserId);
        } catch (error) {
          console.error('Failed to resolve SharePoint user ID for concern', error);
        }
      }
      await createConcern(sp, { type, referenceId, description, status: ConcernStatus.Open }, employeeSpUserId ?? undefined);
      await loadConcerns();
    } catch (error) {
      console.error("Error raising concern:", error);
      showAlert("Failed to submit concern to SharePoint.");
    }
  };

  const handleOpenConcernReply = (concern: Concern) => {
    const stripHtml = (value: string): string => value.replace(/<[^>]*>/g, '').trim();
    setSelectedConcern(concern);
    setConcernReplyText(concern.reply ? stripHtml(concern.reply) : '');
    setIsConcernReplyModalOpen(true);
  };

  const handleSaveConcernReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConcern) return;
    try {
      await updateConcernReply(sp, selectedConcern.id, concernReplyText);
      await loadConcerns();
      setIsConcernReplyModalOpen(false);
    } catch (error) {
      console.error("Error saving concern reply:", error);
      showAlert("Failed to save resolution to SharePoint.");
    }
  };

  const handleReopenConcern = async (concern: Concern) => {
    try {
      await updateConcernStatus(sp, concern.id, ConcernStatus.Open);
      await loadConcerns();
    } catch (error) {
      console.error('Error reopening concern:', error);
      showAlert('Failed to reopen concern.');
    }
  };

  const applySalaryFromYearlyCtc = (
    yearlyCtcValue: string,
    paidDaysValue?: number,
    yearValue?: string,
    insuranceTakenValue?: 'Yes' | 'No',
    workingDaysValue?: number
  ): void => {
    const yearly = Number(yearlyCtcValue);
    if (!yearlyCtcValue || Number.isNaN(yearly) || yearly <= 0) {
      setSalaryFormData((prev) => ({
        ...prev,
        basic: 0,
        hra: 0,
        allowances: 0,
        deductions: 0,
        monthlyCtc: 0,
        gross: 0,
        employerPF: 0,
        employeePF: 0,
        bonus: 0,
        insurance: 0,
        esi: 0,
        employerEsi: 0,
        inhand: 0
      }));
      return;
    }

    const selectedYear = Number(yearValue || salaryFormData.year) || getNowIST().getFullYear();
    const effectivePaidDays = Math.max(0, paidDaysValue ?? salaryFormData.paidDays);
    const workingDays = Math.max(
      0,
      workingDaysValue ?? (salaryFormData.workingDays || getDaysInMonth(salaryFormData.month, selectedYear))
    );
    const cappedPaidDays = Math.min(effectivePaidDays, workingDays);
    const fullMonthlyCtc = yearly / 12;
    const paidRatio = workingDays > 0 ? cappedPaidDays / workingDays : 0;
    const monthly = Number((fullMonthlyCtc * paidRatio).toFixed(2));
    const isInsuranceOptIn = (insuranceTakenValue ?? salaryFormData.insuranceTaken ?? 'Yes') === 'Yes';
    const salary = calculateSalary(monthly, isInsuranceOptIn);
    const deductions = salary.employeePF + salary.esi;
    const computedInhand = Math.max(0, salary.gross - deductions - (isInsuranceOptIn ? salary.insurance : 0));

    setSalaryFormData((prev) => ({
      ...prev,
      basic: salary.basic,
      hra: salary.hra,
      allowances: salary.other,
      deductions,
      monthlyCtc: Number(monthly.toFixed(2)),
      gross: salary.gross,
      employerPF: salary.employerPF,
      employeePF: salary.employeePF,
      bonus: salary.bonus,
      insurance: salary.insurance,
      esi: salary.esi,
      employerEsi: salary.employerEsi,
      inhand: computedInhand,
      paidDays: cappedPaidDays,
      insuranceTaken: insuranceTakenValue ?? prev.insuranceTaken
    }));
  };

  // Keep salary breakup synced with driver inputs (yearly CTC, month/year, working/paid days, insurance).
  // This guarantees net pay and components update whenever paid days changes.
  React.useEffect(() => {
    if (!isSalaryModalOpen) return;

    setSalaryFormData((prev) => {
      const yearly = Number(salaryYearlyCtc);
      const selectedYear = Number(prev.year) || getNowIST().getFullYear();
      const resolvedWorkingDays = Math.max(0, Number(prev.workingDays) || getDaysInMonth(prev.month, selectedYear));
      const resolvedPaidDays = Math.min(Math.max(0, Number(prev.paidDays) || 0), resolvedWorkingDays);

      if (!salaryYearlyCtc || Number.isNaN(yearly) || yearly <= 0) {
        const zeroed = {
          basic: 0,
          hra: 0,
          allowances: 0,
          deductions: 0,
          monthlyCtc: 0,
          gross: 0,
          employerPF: 0,
          employeePF: 0,
          bonus: 0,
          insurance: 0,
          esi: 0,
          employerEsi: 0,
          inhand: 0,
          paidDays: resolvedPaidDays
        };

        const noChange =
          prev.basic === zeroed.basic &&
          prev.hra === zeroed.hra &&
          prev.allowances === zeroed.allowances &&
          prev.deductions === zeroed.deductions &&
          prev.monthlyCtc === zeroed.monthlyCtc &&
          prev.gross === zeroed.gross &&
          prev.employerPF === zeroed.employerPF &&
          prev.employeePF === zeroed.employeePF &&
          prev.bonus === zeroed.bonus &&
          prev.insurance === zeroed.insurance &&
          prev.esi === zeroed.esi &&
          prev.employerEsi === zeroed.employerEsi &&
          prev.inhand === zeroed.inhand &&
          prev.paidDays === zeroed.paidDays;

        return noChange ? prev : { ...prev, ...zeroed };
      }

      const fullMonthlyCtc = yearly / 12;
      const paidRatio = resolvedWorkingDays > 0 ? resolvedPaidDays / resolvedWorkingDays : 0;
      const monthly = Number((fullMonthlyCtc * paidRatio).toFixed(2));
      const isInsuranceOptIn = normalizeInsuranceTakenValue(prev.insuranceTaken) === 'Yes';
      const salary = calculateSalary(monthly, isInsuranceOptIn);
      const deductions = salary.employeePF + salary.esi;
      const computedInhand = Math.max(0, salary.gross - deductions - (isInsuranceOptIn ? salary.insurance : 0));

      const next = {
        basic: salary.basic,
        hra: salary.hra,
        allowances: salary.other,
        deductions,
        monthlyCtc: Number(monthly.toFixed(2)),
        gross: salary.gross,
        employerPF: salary.employerPF,
        employeePF: salary.employeePF,
        bonus: salary.bonus,
        insurance: salary.insurance,
        esi: salary.esi,
        employerEsi: salary.employerEsi,
        inhand: computedInhand,
        paidDays: resolvedPaidDays
      };

      const noChange =
        prev.basic === next.basic &&
        prev.hra === next.hra &&
        prev.allowances === next.allowances &&
        prev.deductions === next.deductions &&
        prev.monthlyCtc === next.monthlyCtc &&
        prev.gross === next.gross &&
        prev.employerPF === next.employerPF &&
        prev.employeePF === next.employeePF &&
        prev.bonus === next.bonus &&
        prev.insurance === next.insurance &&
        prev.esi === next.esi &&
        prev.employerEsi === next.employerEsi &&
        prev.inhand === next.inhand &&
        prev.paidDays === next.paidDays;

      return noChange ? prev : { ...prev, ...next };
    });
  }, [
    isSalaryModalOpen,
    salaryYearlyCtc,
    salaryFormData.month,
    salaryFormData.year,
    salaryFormData.workingDays,
    salaryFormData.paidDays,
    salaryFormData.insuranceTaken
  ]);

  const handleUploadSalarySlip = (employee?: Employee) => {
    if (!employee) return;
    const currentYear = getNowIST().getFullYear();
    const currentMonth = monthNameIST();
    const workingDays = getDaysInMonth(currentMonth, currentYear);
    const initialYearlyCtc = employee.yearlyCTC
      ? String(employee.yearlyCTC)
      : (employee.total ? String(employee.total) : '');
    const insuranceTaken = normalizeInsuranceTakenValue(employee.insuranceTaken);
    setTargetEmployee(employee);
    setSalaryFormData({
      month: currentMonth,
      year: String(currentYear),
      basic: 0,
      hra: 0,
      allowances: 0,
      deductions: 0,
      bankName: employee.bankName || '',
      accountNumber: employee.accountNumber || '',
      ifscCode: employee.ifscCode || '',
      pan: employee.pan || '',
      uan: employee.uan || '',
      workingDays,
      paidDays: workingDays,
      monthlyCtc: 0,
      gross: 0,
      employerPF: 0,
      employeePF: 0,
      bonus: 0,
      insurance: 0,
      esi: 0,
      employerEsi: 0,
      inhand: 0,
      insuranceTaken
    });
    setSalaryYearlyCtc(initialYearlyCtc);
    applySalaryFromYearlyCtc(initialYearlyCtc, workingDays, String(currentYear), insuranceTaken, workingDays);
    setIsSalaryManualMode(false);
    setIsSalaryModalOpen(true);
  };

  const saveSalarySlip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmployee) return;
    const employeeForSlip: Employee = {
      ...targetEmployee,
      name: String(targetEmployee.name || '').trim(),
      id: String(targetEmployee.id || '').trim(),
      department: String(targetEmployee.department || '').trim(),
      position: String(targetEmployee.position || '').trim()
    };
    const insuranceDeduction = normalizeInsuranceTakenValue(salaryFormData.insuranceTaken) === 'Yes'
      ? (Number(salaryFormData.insurance) || 0)
      : 0;
    const netPay = Math.max(0, (Number(salaryFormData.gross) || 0) - (Number(salaryFormData.deductions) || 0) - insuranceDeduction);
    const newSlip: SalarySlip = {
      id: `S${Date.now()}`,
      employeeId: employeeForSlip.id,
      yearlyCtc: Number(salaryYearlyCtc) || 0,
      ...salaryFormData,
      payrollKey: `${employeeForSlip.name}-${employeeForSlip.id}-${salaryFormData.month}-${salaryFormData.year}`,
      netPay,
      generatedDate: todayIST()
    };
    try {
      await createSalarySlip(sp, newSlip, employeeForSlip);

      // Update employee bank details if changed
      if (employeeForSlip.itemId) {
        await updateEmployee(sp, employeeForSlip.itemId, {
          name: employeeForSlip.name,
          id: employeeForSlip.id,
          department: employeeForSlip.department,
          position: employeeForSlip.position,
          bankName: salaryFormData.bankName,
          accountNumber: salaryFormData.accountNumber,
          ifscCode: salaryFormData.ifscCode,
          pan: salaryFormData.pan,
          uan: salaryFormData.uan
        });

        // Update local state
        setDirectoryEmployees(prev => prev.map(emp =>
          emp.itemId === employeeForSlip.itemId
            ? {
              ...emp,
              name: employeeForSlip.name,
              id: employeeForSlip.id,
              department: employeeForSlip.department,
              position: employeeForSlip.position,
              bankName: salaryFormData.bankName,
              accountNumber: salaryFormData.accountNumber,
              ifscCode: salaryFormData.ifscCode,
              pan: salaryFormData.pan,
              uan: salaryFormData.uan
            }
            : emp
        ));
      }
      setTargetEmployee(employeeForSlip);

      const all = await getAllSalarySlips(sp);
      setSalarySlips(all);
      setIsSalaryModalOpen(false);
      showAlert('Salary slip saved and employee bank details updated.');
    } catch (error) {
      console.error('Failed to save salary slip', error);
      const e = error as any;
      const errorMessage = String(
        e?.data?.responseBody?.['odata.error']?.message?.value ||
        e?.data?.responseBody?.error?.message?.value ||
        e?.message ||
        'Failed to save salary slip.'
      );
      showAlert(`Failed to save salary slip. ${errorMessage}`);
    }
  };

  const salaryInsuranceDeduction = normalizeInsuranceTakenValue(salaryFormData.insuranceTaken) === 'Yes'
    ? (Number(salaryFormData.insurance) || 0)
    : 0;
  const salaryNetPay = Math.max(0, (Number(salaryFormData.gross) || 0) - (Number(salaryFormData.deductions) || 0) - salaryInsuranceDeduction);

  const loadSalarySlips = React.useCallback(async () => {
    if (!sp) return;
    try {
      const slips = await getAllSalarySlips(sp);
      setSalarySlips(slips);
    } catch (error) {
      console.error('Failed to load salary slips', error);
    }
  }, [sp]);



  const handleOpenEmployeeModal = (emp?: Employee) => {
    if (emp) {
      const normalizedInsuranceTaken = normalizeInsuranceTakenValue(emp.insuranceTaken);
      setEditingEmployee(emp);
      setEmployeeFormData({
        ...emp,
        yearlyCTC: emp.yearlyCTC ?? emp.total ?? 0,
        total: emp.total ?? emp.yearlyCTC ?? 0,
        employeeESI: emp.employeeESI ?? 0,
        employerESI: emp.employerESI ?? 0,
        salaryInsurance: emp.salaryInsurance ?? 0,
        salaryBonus: emp.salaryBonus ?? 0,
        insuranceTaken: normalizedInsuranceTaken,
        employeeStatus: emp.employeeStatus || 'Active Employee'
      });
    } else {
      setEditingEmployee(null);
      setEmployeeFormData({
        name: '',
        id: '',
        email: '',
        department: '',
        position: '',
        joiningDate: todayIST(),
        pan: '',
        uan: '',
        accountNumber: '',
        bankName: '',
        ifscCode: '',
        basicSalary: 0,
        hra: 0,
        others: 0,
        pf: 0,
        total: 0,
        yearlyCTC: 0,
        employeeESI: 0,
        employerESI: 0,
        salaryInsurance: 0,
        salaryBonus: 0,
        insuranceTaken: 'Yes',
        employeeStatus: 'Active Employee'
      });
    }
    setEmployeeModalTab('professional');
    setProfileUploadFile(null);
    setSelectedGalleryImageUrl('');
    setRemoveProfileImage(false);
    setIsEmployeeModalOpen(true);
  };

  const loadImagesForFolder = React.useCallback(async (folder: SPFolder) => {
    if (!sp) return;
    setIsLoadingFolderImages(true);
    setSelectedProfileFolder(folder);
    try {
      const webInfo = await sp.web.select('Url')();
      const siteUrl = String((webInfo as { Url?: string })?.Url || window.location.href);
      const images = await getImagesByFolder(sp, siteUrl, folder.ServerRelativeUrl);
      const mapped: ProfileGalleryImage[] = images.map((image) => ({
        folder: folder.Name,
        name: image.fileName,
        url: image.serverRelativeUrl
      }));
      setProfileFolderImages(mapped);
    } catch (error) {
      console.error(`Failed to load images for folder ${folder.Name}`, error);
      setProfileFolderImages([]);
    } finally {
      setIsLoadingFolderImages(false);
    }
  }, [sp]);

  const loadProfileImageFolders = React.useCallback(async () => {
    if (!sp) return;
    setIsLoadingProfileFolders(true);
    try {
      const webInfo = await sp.web.select('Url')();
      const siteUrl = String((webInfo as { Url?: string })?.Url || window.location.href);
      const folders = await getImageLibraryFolders(sp, siteUrl);
      setProfileImageFolders(folders);

      if (!folders.length) {
        setSelectedProfileFolder(null);
        setProfileFolderImages([]);
        return;
      }

      const selected = selectedProfileFolderRef.current
        ? folders.find((folder) => folder.ServerRelativeUrl === selectedProfileFolderRef.current?.ServerRelativeUrl) || folders[0]
        : folders[0];

      await loadImagesForFolder(selected);
    } catch (error) {
      console.error('Failed to load image library folders', error);
      setProfileImageFolders([]);
      setSelectedProfileFolder(null);
      setProfileFolderImages([]);
    } finally {
      setIsLoadingProfileFolders(false);
    }
  }, [sp, loadImagesForFolder]);

  React.useEffect(() => {
    if (!isEmployeeModalOpen) return;
    void loadProfileImageFolders();
  }, [isEmployeeModalOpen, loadProfileImageFolders]);

  React.useEffect(() => {
    selectedProfileFolderRef.current = selectedProfileFolder;
  }, [selectedProfileFolder]);

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !employeeFormData.name ||
      !employeeFormData.id ||
      !employeeFormData.email ||
      !employeeFormData.department ||
      !employeeFormData.position ||
      !employeeFormData.joiningDate
    ) {
      setEmployeeModalTab('professional');
      showAlert('Please fill all required professional details.');
      return;
    }
    try {
      let savedItemId: number | undefined = editingEmployee?.itemId;
      if (editingEmployee && editingEmployee.itemId) {
        await updateEmployee(sp, editingEmployee.itemId, employeeFormData);
        savedItemId = editingEmployee.itemId;
      } else {
        savedItemId = await createEmployee(sp, employeeFormData);
      }

      if (savedItemId) {
        if (removeProfileImage) {
          await clearEmployeeProfileImage(sp, savedItemId);
        }

        if (profileUploadFile) {
          await replaceEmployeeProfileImage(sp, savedItemId, profileUploadFile, profileUploadFile.name);
        } else if (selectedGalleryImageUrl) {
          const response = await fetch(selectedGalleryImageUrl);
          const galleryBlob = await response.blob();
          const extension = selectedGalleryImageUrl.split('.').pop()?.split('?')[0] || 'jpg';
          const imageName = `profile-${savedItemId}.${extension}`;
          await replaceEmployeeProfileImage(sp, savedItemId, galleryBlob, imageName);
        }
      }
      setIsEmployeeModalOpen(false);
      await loadDirectoryEmployees();
    } catch (error) {
      console.error("Error saving employee:", error);
      showAlert("Failed to save employee to SharePoint.");
    }
  };

  const handleDeleteEmployee = async (itemId?: number) => {
    if (!itemId) return;
    if (!window.confirm("Are you sure you want to delete this employee?")) return;
    try {
      await deleteEmployee(sp, itemId);
      await loadDirectoryEmployees();
    } catch (error) {
      console.error("Error deleting employee:", error);
      showAlert("Failed to delete employee.");
    }
  };

  // Load leave quotas from SharePoint
  const loadLeaveQuotas = React.useCallback(async () => {
    if (!sp) return;
    setIsLoadingQuotas(true);
    setQuotasError(null);
    try {
      const items = await sp.web.lists
        .getByTitle(OFFICIAL_LEAVES_LIST_ID)
        .items.select('Id', 'Title', 'Leaves')
        .filter("TaxType eq 'Unofficial Leaves'")
        .top(5000)();

      console.log('Leave Quotas loaded:', items);

      const quotasMap: Record<string, number> = {};
      items.forEach((item: any) => {
        const leaveType = item.Title || '';
        const quota = parseInt(item.Leaves || '0', 10);
        if (leaveType) {
          quotasMap[leaveType] = quota;
        }
      });

      // Set default quotas if none exist in SharePoint
      if (Object.keys(quotasMap).length === 0) {
        quotasMap['Sick'] = 5;
        quotasMap['Vacation'] = 12;
        quotasMap['Personal'] = 3;
      }

      setLeaveQuotas(quotasMap);
    } catch (err: any) {
      setQuotasError('Failed to load leave quotas.');
      console.error('Leave quotas load failed', err);
      // Set default quotas on error
      setLeaveQuotas({
        'Sick': 5,
        'Vacation': 12,
        'Personal': 3
      });
    } finally {
      setIsLoadingQuotas(false);
    }
  }, [sp]);

  // Save leave quotas to SharePoint
  const handleSaveQuotas = async () => {
    if (!sp) return;

    try {
      setIsLoadingQuotas(true);
      setQuotasError(null);

      // First, get all existing quota items
      const existingItems = await sp.web.lists
        .getByTitle(OFFICIAL_LEAVES_LIST_ID)
        .items.select('Id')
        .filter("TaxType eq 'Unofficial Leaves'")
        .top(5000)();

      // Delete all existing quota items
      for (const item of existingItems) {
        await sp.web.lists
          .getByTitle(OFFICIAL_LEAVES_LIST_ID)
          .items.getById(item.Id)
          .delete();
      }

      // Add new quota items
      for (const [leaveType, quota] of Object.entries(leaveQuotas)) {
        await sp.web.lists
          .getByTitle(OFFICIAL_LEAVES_LIST_ID)
          .items.add({
            Title: leaveType,
            Leaves: quota,
            TaxType: 'Unofficial Leaves'
          });
      }

      // Reload quotas to confirm
      await loadLeaveQuotas();
      setIsAddLeaveModalOpen(false);

    } catch (err: any) {
      setQuotasError('Failed to save leave quotas. Please try again.');
      console.error('Failed to save quotas', err);
      showAlert('Failed to save leave quotas. Please try again.');
    } finally {
      setIsLoadingQuotas(false);
    }
  };

  // Load policies from SharePoint
  const loadPolicies = React.useCallback(async () => {
    if (!sp) return;
    setIsLoadingPolicies(true);
    setPoliciesError(null);
    try {
      const items = await sp.web.lists
        .getByTitle(OFFICIAL_LEAVES_LIST_ID)
        .items.select('Id', 'Title', 'Configurations', 'Created', 'Modified', 'Author/Title', 'Editor/Title')
        .expand('Author', 'Editor')
        .filter("TaxType eq 'LeavePolicy'")
        .top(5000)();
      console.log('Policies loaded:', items);
      const mapped: Policy[] = items.map((item: any) => ({
        id: item.Id,
        title: item.Title || 'Untitled Policy',
        content: item.Configurations || '',
        lastUpdated: formatDateIST(item.Modified) || todayIST(),
        createdAt: formatDateIST(item.Created),
        modifiedAt: formatDateIST(item.Modified),
        createdByName: item.Author?.Title || '',
        modifiedByName: item.Editor?.Title || ''
      }));

      setPolicies(mapped);
    } catch (err: any) {
      setPoliciesError('Failed to load policies.');
      console.error('Policies load failed', err);
    } finally {
      setIsLoadingPolicies(false);
    }
  }, [sp]);

  const handleOpenPolicyModal = (policy?: Policy) => {
    if (policy) {
      setEditingPolicyId(policy.id);
      setPolicyFormData({ title: policy.title, content: policy.content });
    } else {
      setEditingPolicyId(null);
      setPolicyFormData({ title: '', content: '' });
    }
    setIsPolicyModalOpen(true);
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sp) return;

    try {
      setIsLoadingPolicies(true);

      if (editingPolicyId !== null && editingPolicyId !== undefined) {
        // Update existing policy
        await sp.web.lists
          .getByTitle(OFFICIAL_LEAVES_LIST_ID)
          .items.getById(editingPolicyId)
          .update({
            Title: policyFormData.title || 'Untitled Policy',
            Configurations: policyFormData.content || '',
            TaxType: 'LeavePolicy'
          });
      } else {
        // Create new policy
        await sp.web.lists
          .getByTitle(OFFICIAL_LEAVES_LIST_ID)
          .items.add({
            Title: policyFormData.title || 'Untitled Policy',
            Configurations: policyFormData.content || '',
            TaxType: 'LeavePolicy'
          });
      }

      await loadPolicies();
      setIsPolicyModalOpen(false);
      setPolicyFormData({ title: '', content: '' });
      setEditingPolicyId(null);
    } catch (err: any) {
      console.error('Failed to save policy', err);
      showAlert('Failed to save policy. Please try again.');
    } finally {
      setIsLoadingPolicies(false);
    }
  };

  const handleDeletePolicy = async (id: number) => {
    if (!sp) return;
    if (!window.confirm('Are you sure you want to delete this policy?')) return;

    try {
      setIsLoadingPolicies(true);
      await sp.web.lists
        .getByTitle(OFFICIAL_LEAVES_LIST_ID)
        .items.getById(id)
        .delete();

      await loadPolicies();
    } catch (err: any) {
      console.error('Failed to delete policy', err);
      showAlert('Failed to delete policy. Please try again.');
    } finally {
      setIsLoadingPolicies(false);
    }
  };


  const employeeColumns = React.useMemo<ColumnDef<Employee>[]>(() => ([
    {
      key: 'name',
      header: 'Name',
      accessor: (emp) => emp.name,
      render: (emp) => (
        <div className="d-flex align-items-center gap-3">
          <img src={emp.avatar} width="32" height="32" className="rounded-circle border" />
          <div className="">{emp.name}</div>
        </div>
      )
    },
    { key: 'id', header: 'Emp ID', accessor: (emp) => emp.id },
    { key: 'email', header: 'Email Address', accessor: (emp) => emp.email || '', render: (emp) => emp.email || '-' },
    { key: 'department', header: 'Department', accessor: (emp) => emp.department, render: (emp) => emp.department },
    { key: 'position', header: 'Designation', accessor: (emp) => emp.position || '', render: (emp) => emp.position || '-' },
    { key: 'joiningDate', header: 'DOJ', accessor: (emp) => emp.joiningDate },
    {
      key: 'employeeStatus',
      header: 'Status',
      accessor: (emp) => emp.employeeStatus || 'Active Employee',
      render: (emp) => {
        const status = emp.employeeStatus || 'Active Employee';
        const textColor = status === 'Active Employee' ? '#198754' : '#555555';
        return <span style={{ color: textColor, fontWeight: '600' }}>{status}</span>;
      }
    },
    {
      key: 'actions',
      header: 'Actions',
      searchable: false,
      filterable: false,
      align: 'end',
      render: (emp) => (
        <div className="d-flex gap-3 justify-content-end align-items-center">
          <button
            type="button"
            className="p-0 border-0 bg-transparent flex-shrink-0"
            style={{ color: '#2f5596', display: 'flex' }}
            onClick={() => handleOpenEmployeeModal(emp)}
            title="Edit"
          >
            <Edit3 size={16} />
          </button>
          <button
            type="button"
            className="p-0 border-0 bg-transparent flex-shrink-0"
            style={{ color: '#d14b64', display: 'flex' }}
            onClick={() => handleDeleteEmployee(emp.itemId)}
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )
    }
  ]), [handleOpenEmployeeModal, handleDeleteEmployee]);

  const uploadSalaryColumns = React.useMemo<ColumnDef<Employee>[]>(() => ([
    {
      key: 'name',
      header: 'Name',
      accessor: (emp) => emp.name,
      render: (emp) => (
        <div className="d-flex align-items-center gap-3">
          <img src={emp.avatar} width="32" height="32" className="rounded-circle border" />
          <div>
            <div className="">{emp.name}</div>
            <div className="text-muted">ID: {emp.id}</div>
          </div>
        </div>
      )
    },
    { key: 'id', header: 'Employee ID', accessor: (emp) => emp.id },
    { key: 'department', header: 'Department', accessor: (emp) => emp.department, render: (emp) => emp.department || '-' },
    { key: 'position', header: 'Designation', accessor: (emp) => emp.position || '', render: (emp) => emp.position || '-' },
    {
      key: 'actions',
      header: 'Actions',
      searchable: false,
      filterable: false,
      align: 'end',
      render: (emp) => (
        <button
          className="btn btn-sm btn-primary"
          onClick={() => handleUploadSalarySlip(emp)}
        >
          Salary Slip
        </button>
      )
    }
  ]), [handleUploadSalarySlip]);

  const policyColumns = React.useMemo<ColumnDef<Policy>[]>(() => ([
    { key: 'title', header: 'Title' },
    {
      key: 'description',
      header: 'Description',
      accessor: (p) => p.content || '',
      render: (p) => <div className="text-truncate" style={{ maxWidth: '420px' }}>{p.content || '-'}</div>
    },
    { key: 'lastUpdated', header: 'Last Updated' },
    {
      key: 'actions',
      header: 'Actions',
      searchable: false,
      filterable: false,
      align: 'end',
      render: (p) => (
        <div className="d-flex gap-3 justify-content-end align-items-center">
          <button
            type="button"
            className="p-0 border-0 bg-transparent flex-shrink-0"
            style={{ color: '#2f5596', display: 'flex' }}
            onClick={() => handleOpenPolicyModal(p)}
            title="Edit"
          >
            <Edit3 size={16} />
          </button>
          <button
            type="button"
            className="p-0 border-0 bg-transparent flex-shrink-0"
            style={{ color: '#d14b64', display: 'flex' }}
            onClick={() => handleDeletePolicy(p.id)}
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )
    }
  ]), [handleOpenPolicyModal, handleDeletePolicy]);

  const holidayColumns = React.useMemo<ColumnDef<Holiday>[]>(() => ([
    { key: 'name', header: 'Holiday' },
    { key: 'date', header: 'Date' },
    { key: 'type', header: 'Type', render: (h) => <span className={`${h.type === 'Public' ? 'text-primary' : 'text-primary'}`}>{h.type}</span> },
    {
      key: 'actions',
      header: 'Actions',
      searchable: false,
      filterable: false,
      align: 'end',
      render: (h) => (
        <div className="d-flex gap-3 justify-content-end align-items-center">
          <button
            type="button"
            className="p-0 border-0 bg-transparent flex-shrink-0"
            style={{ color: '#2f5596', display: 'flex' }}
            onClick={() => handleOpenHolidayModal(h)}
            title="Edit"
          >
            <Edit3 size={16} />
          </button>
          <button
            type="button"
            className="p-0 border-0 bg-transparent flex-shrink-0"
            style={{ color: '#d14b64', display: 'flex' }}
            onClick={() => handleDeleteHoliday(h.id)}
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )
    }
  ]), []);

  const resolveConcernEmployee = React.useCallback((c: Concern) => {
    const normalizeText = (value: unknown): string => String(value ?? '').trim().toLowerCase();
    const normalizeEmail = (value: unknown): string => {
      const raw = normalizeText(value);
      if (!raw) return '';
      if (raw.indexOf('|') !== -1) {
        const parts = raw.split('|');
        return parts[parts.length - 1].trim();
      }
      return raw;
    };

    const byEmail = c.employeeEmail
      ? directoryEmployees.find((e) => normalizeEmail(e.email) === normalizeEmail(c.employeeEmail))
      : undefined;
    const byName = !byEmail && c.employeeName
      ? directoryEmployees.find((e) => normalizeText(e.name) === normalizeText(c.employeeName))
      : undefined;
    const emp = byEmail || byName;

    if (emp) {
      return { name: emp.name, avatar: emp.avatar, employee: emp };
    }

    const fallbackName = c.employeeName || c.createdByName || 'Unknown';
    const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&background=2f5596&color=ffffff&bold=true&size=128`;
    return { name: fallbackName, avatar: fallbackAvatar };
  }, [directoryEmployees]);

  const concernColumns = React.useMemo<ColumnDef<Concern>[]>(() => ([
    {
      key: 'employee',
      header: 'Employee',
      accessor: (c) => resolveConcernEmployee(c).name || '',
      render: (c) => {
        const resolved = resolveConcernEmployee(c);
        return (
          <div className="d-flex align-items-center gap-2">
            <img src={resolved.avatar} alt={resolved.name} width="32" height="32" className="rounded-circle border" />
            <div>
              <div className="">{resolved.name}</div>
              <div className="text-muted small">{c.submittedAt}</div>
            </div>
          </div>
        );
      }
    },
    { key: 'type', header: 'Type', render: (c) => <span className="status-chip status-chip--neutral">{c.type}</span> },
    { key: 'description', header: 'Summary', render: (c) => <div className="text-truncate" style={{ maxWidth: '300px' }}>{c.description}</div> },
    {
      key: 'status',
      header: 'Status',
      render: (c) => (
        <Badge status={c.status === ConcernStatus.Open ? 'Unresolved' : c.status} />
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      searchable: false,
      filterable: false,
      align: 'end',
      render: (c) => {
        const isAlreadyReplied = c.status !== ConcernStatus.Open;
        return (
          <div className="d-flex align-items-center gap-2 justify-content-end">
            <button
              className="btn btn-sm concern-reply-btn"
              onClick={() => handleOpenConcernReply(c)}
              disabled={isAlreadyReplied}
              title={isAlreadyReplied ? 'HR already replied to this concern' : 'Reply to concern'}
            >
              Reply
            </button>
            {c.status !== ConcernStatus.Open && (
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => handleReopenConcern(c)}
                title="Reopen concern to edit resolution"
              >
                Reopen
              </button>
            )}
          </div>
        );
      }
    }
  ]), [handleOpenConcernReply, handleReopenConcern, resolveConcernEmployee]);

  // Load leave category choices from SharePoint field
  const loadLeaveCategories = React.useCallback(async () => {
    if (!sp) return;
    try {
      const field = await sp.web.lists
        .getByTitle(OFFICIAL_LEAVES_LIST_ID)
        .fields.getByInternalNameOrTitle('LeaveCategory')();

      if (field && field.Choices) {
        setLeaveCategories(field.Choices);
      }
    } catch (err: any) {
      console.error('Failed to load leave categories', err);
      // Fallback to default values if field fetch fails
      setLeaveCategories(['Public', 'National']);
    }
  }, [sp]);

  // Load work from home request types from SmartMetadata list
  const loadWorkFromHomeTypes = React.useCallback(async () => {
    if (!sp) return;
    try {
      const items = await sp.web.lists
        .getByTitle(OFFICIAL_LEAVES_LIST_ID)
        .items.select('Title')
        .filter("TaxType eq 'Work From Home'")
        .top(5000)();

      const mappedTypes = items
        .map((item: { Title?: string }) => String(item.Title || '').trim())
        .filter((type: string, index: number, arr: string[]) => type && arr.indexOf(type) === index);

      setWorkFromHomeTypes(mappedTypes.length > 0 ? mappedTypes : ['Work From Home']);
    } catch (err: any) {
      console.error('Failed to load work from home types', err);
      setWorkFromHomeTypes(['Work From Home']);
    }
  }, [sp]);

  // Load holidays from SharePoint
  const loadHolidays = React.useCallback(async () => {
    if (!sp) return;
    setIsLoadingHolidays(true);
    setHolidaysError(null);
    try {
      const items = await sp.web.lists
        .getByTitle(OFFICIAL_LEAVES_LIST_ID)
        .items.select('Id', 'Title', 'Date', 'TaxType', 'LeaveCategory', 'Created', 'Modified', 'Author/Title', 'Editor/Title')
        .expand('Author', 'Editor')
        .filter("TaxType eq 'Official Leave'")
        .top(5000)();

      const mapped: Holiday[] = items.map((item: any) => ({
        id: item.Id,
        name: item.Title || 'Untitled Holiday',
        date: formatDateIST(item.Date) || todayIST(),
        type: (item.LeaveCategory || 'Public') as 'Public' | 'Restricted',
        createdAt: formatDateIST(item.Created),
        modifiedAt: formatDateIST(item.Modified),
        createdByName: item.Author?.Title || '',
        modifiedByName: item.Editor?.Title || ''
      }));

      setHolidays(mapped);
    } catch (err: any) {
      setHolidaysError('Failed to load holidays.');
      console.error('Holidays load failed', err);
    } finally {
      setIsLoadingHolidays(false);
    }
  }, [sp]);

  // Create new holiday in SharePoint
  const handleCreateHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sp) return;

    try {
      setIsLoadingHolidays(true);
      await sp.web.lists
        .getByTitle(OFFICIAL_LEAVES_LIST_ID)
        .items.add({
          Title: holidayFormData.name || 'Untitled Holiday',
          Date: holidayFormData.date || todayIST(),
          TaxType: 'Official Leave',
          LeaveCategory: holidayFormData.type || 'Public'
        });

      await loadHolidays();
      setIsHolidayModalOpen(false);
      setHolidayFormData({ name: '', date: '', type: 'Public' });
    } catch (err: any) {
      console.error('Failed to create holiday', err);
      showAlert('Failed to create holiday. Please try again.');
    } finally {
      setIsLoadingHolidays(false);
    }
  };

  // Update existing holiday in SharePoint
  const handleUpdateHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sp || !editingHolidayId) return;

    try {
      setIsLoadingHolidays(true);
      await sp.web.lists
        .getByTitle(OFFICIAL_LEAVES_LIST_ID)
        .items.getById(editingHolidayId)
        .update({
          Title: holidayFormData.name || 'Untitled Holiday',
          Date: holidayFormData.date || todayIST(),
          TaxType: 'Official Leave',
          LeaveCategory: holidayFormData.type || 'Public'
        });

      await loadHolidays();
      setIsHolidayModalOpen(false);
      setHolidayFormData({ name: '', date: '', type: 'Public' });
      setEditingHolidayId(null);
    } catch (err: any) {
      console.error('Failed to update holiday', err);
      showAlert('Failed to update holiday. Please try again.');
    } finally {
      setIsLoadingHolidays(false);
    }
  };

  // Delete holiday from SharePoint
  const handleDeleteHoliday = async (id: number) => {
    if (!sp) return;
    if (!window.confirm('Are you sure you want to delete this holiday?')) return;

    try {
      setIsLoadingHolidays(true);
      await sp.web.lists
        .getByTitle(OFFICIAL_LEAVES_LIST_ID)
        .items.getById(id)
        .delete();

      await loadHolidays();
    } catch (err: any) {
      console.error('Failed to delete holiday', err);
      showAlert('Failed to delete holiday. Please try again.');
    } finally {
      setIsLoadingHolidays(false);
    }
  };

  // Open holiday modal for create or edit
  const handleOpenHolidayModal = (holiday?: Holiday) => {
    if (holiday) {
      setEditingHolidayId(holiday.id);
      setHolidayFormData({
        name: holiday.name,
        date: holiday.date,
        type: holiday.type
      });
    } else {
      setEditingHolidayId(null);
      setHolidayFormData({ name: '', date: '', type: 'Public' });
    }
    setIsHolidayModalOpen(true);
  };

  // Handle holiday form submission (create or update)
  const handleSaveHoliday = (e: React.FormEvent) => {
    if (editingHolidayId) {
      handleUpdateHoliday(e);
    } else {
      handleCreateHoliday(e);
    }
  };

  const handleRoleToggle = (newRole: UserRole) => {
    if (newRole === UserRole.HR && !canAccessHr) return;
    setRole(newRole);
    setActiveTab(newRole === UserRole.Employee ? 'dashboard' : 'overview');
  };

  // Load holidays on component mount
  React.useEffect(() => {
    void loadHolidays();
  }, [loadHolidays]);

  // Load leave categories on component mount
  React.useEffect(() => {
    void loadLeaveCategories();
  }, [loadLeaveCategories]);

  // Load work from home request types on component mount
  React.useEffect(() => {
    void loadWorkFromHomeTypes();
  }, [loadWorkFromHomeTypes]);

  React.useEffect(() => {
    if (workFromHomeTypes.length === 0) return;
    if (workFromHomeTypes.indexOf(workFromHomeFormData.workFromHomeType) !== -1) return;
    setWorkFromHomeFormData(prev => ({ ...prev, workFromHomeType: workFromHomeTypes[0] }));
  }, [workFromHomeTypes, workFromHomeFormData.workFromHomeType]);

  // Load policies on component mount
  React.useEffect(() => {
    void loadPolicies();
  }, [loadPolicies]);

  // Load leave quotas on component mount
  React.useEffect(() => {
    void loadLeaveQuotas();
  }, [loadLeaveQuotas]);

  // Load salary slips from SalarySlip document library
  React.useEffect(() => {
    void loadSalarySlips();
  }, [loadSalarySlips]);

  const openConcernsCount = useMemo(() => concerns.filter(c => c.status === ConcernStatus.Open).length, [concerns]);
  const leaveOnlyRequests = useMemo(
    () => leaveRequests.filter((request) => !(request.requestCategory === 'Work From Home' || /work\s*from\s*home|wfh/i.test(String(request.leaveType || '')))),
    [leaveRequests]
  );
  const workFromHomeRequests = useMemo(
    () => leaveRequests.filter((request) => request.requestCategory === 'Work From Home' || /work\s*from\s*home|wfh/i.test(String(request.leaveType || ''))),
    [leaveRequests]
  );

  const toDateKey = React.useCallback((value: string): string => {
    const raw = String(value || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return '';
    return formatDateIST(parsed);
  }, []);

  const handleGenerateSendReportData = React.useCallback(() => {
    const now = getNowIST();
    let startBound: Date | null = null;
    let endBound: Date | null = null;

    if (sendReportPreset === 'Custom') {
      startBound = sendReportStartDate ? startOfDay(new Date(sendReportStartDate)) : null;
      endBound = sendReportEndDate ? endOfDay(new Date(sendReportEndDate)) : null;
    } else {
      const range = resolveSendReportRange(sendReportPreset, now);
      startBound = range.start;
      endBound = range.end;
    }

    const filtered = leaveRequests.filter((request) => {
      if (request.status === LeaveStatus.Rejected) return false;
      if (request.employee.employeeStatus === 'Ex-Staff') return false; // Exclude Ex-Staff
      const requestStartKey = toDateKey(request.startDate);
      if (!requestStartKey) return false;
      const requestStart = new Date(requestStartKey);
      if (Number.isNaN(requestStart.getTime())) return false;
      const requestStartTime = requestStart.getTime();

      const leaveType = String(request.leaveType || '').toLowerCase();
      const isLongLeave = leaveType.includes('maternity') || leaveType.includes('paternity');

      if (isLongLeave) {
        // For maternity/paternity: use overlap check (include if leave is active during the period)
        const requestEndKey = toDateKey(request.endDate) || requestStartKey;
        const requestEnd = new Date(requestEndKey);
        const requestEndTime = Number.isNaN(requestEnd.getTime()) ? requestStartTime : requestEnd.getTime();
        if (startBound && requestEndTime < startBound.getTime()) return false;
        if (endBound && requestStartTime > endBound.getTime()) return false;
      } else {
        // For regular leaves: check if start date falls within the range (original behavior)
        if (startBound && requestStartTime < startBound.getTime()) return false;
        if (endBound && requestStartTime > endBound.getTime()) return false;
      }
      return true;
    });

    const statusSummaryMap: Record<string, { count: number; totalDays: number }> = {};
    const typeStatusSummaryMap: Record<string, { type: string; status: string; count: number; totalDays: number }> = {};

    filtered.forEach((request) => {
      const statusKey = String(request.status || 'Unknown');
      const days = Number(request.days || 0);
      if (!statusSummaryMap[statusKey]) statusSummaryMap[statusKey] = { count: 0, totalDays: 0 };
      statusSummaryMap[statusKey].count += 1;
      statusSummaryMap[statusKey].totalDays += days;

      const typeKey = request.requestCategory === 'Work From Home' ? 'Work From Home' : (request.leaveType || 'Leave');
      const compositeKey = `${typeKey}__${statusKey}`;
      if (!typeStatusSummaryMap[compositeKey]) {
        typeStatusSummaryMap[compositeKey] = { type: typeKey, status: statusKey, count: 0, totalDays: 0 };
      }
      typeStatusSummaryMap[compositeKey].count += 1;
      typeStatusSummaryMap[compositeKey].totalDays += days;
    });

    const uniqueEmployees: Record<string, true> = {};
    filtered.forEach((r) => { uniqueEmployees[r.employee.id] = true; });

    const payload = {
      reportMeta: {
        generatedAt: new Date().toISOString(),
        sourceTab: 'On Leave / WFH Today',
        reportPreset: sendReportPreset,
        rangeStartDate: startBound ? formatDateIST(startBound) : '',
        rangeEndDate: endBound ? formatDateIST(endBound) : '',
        totalRequests: filtered.length,
        totalEmployees: Object.keys(uniqueEmployees).length
      },
      summaryByStatus: Object.keys(statusSummaryMap).map((key) => ({
        status: key,
        count: statusSummaryMap[key].count,
        totalDays: Number(statusSummaryMap[key].totalDays.toFixed(2))
      })),
      summaryByTypeAndStatus: Object.keys(typeStatusSummaryMap).map((key) => ({
        type: typeStatusSummaryMap[key].type,
        status: typeStatusSummaryMap[key].status,
        count: typeStatusSummaryMap[key].count,
        totalDays: Number(typeStatusSummaryMap[key].totalDays.toFixed(2))
      })),
      records: filtered
        .slice()
        .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || '') || a.employee.name.localeCompare(b.employee.name))
        .map((request) => ({
          requestId: request.id,
          employeeId: request.employee.id,
          employeeName: request.employee.name,
          department: request.employee.department,
          requestCategory: request.requestCategory || 'Leave',
          leaveType: request.leaveType,
          status: request.status,
          startDate: request.startDate,
          endDate: request.endDate,
          days: request.days,
          reason: request.reason,
          submittedAt: request.submittedAt,
          approverName: request.approverName || '',
          approverComment: request.approverComment || ''
        }))
    };

    setSendReportPayload(JSON.stringify(payload, null, 2));

    const toEmployeeType = (department: string): 'Staff' | 'Trainee' => {
      const lower = String(department || '').trim().toLowerCase();
      return (lower === 'trainee' || lower === 'project management trainee' || lower === 'intern') ? 'Trainee' : 'Staff';
    };

    const onLeaveEmployeeIds: Record<string, true> = {};
    filtered.forEach((request) => { onLeaveEmployeeIds[request.employee.id] = true; });

    // Filter directory for active employees only for report counts
    const activeDirectory = directoryEmployees.filter(emp => emp.employeeStatus !== 'Ex-Staff');

    const totalTeamCount = activeDirectory.length;
    const onLeaveCount = Object.keys(onLeaveEmployeeIds).length;
    const availableCount = Math.max(0, totalTeamCount - onLeaveCount);

    const typeSummary: SendReportTypeSummary[] = ['Staff', 'Trainee'].map((type) => {
      const teamMembers = activeDirectory.filter((employee) => toEmployeeType(employee.department) === type);
      const onLeaveMembers = teamMembers.filter((employee) => Boolean(onLeaveEmployeeIds[employee.id]));
      return {
        type: type as 'Staff' | 'Trainee',
        total: teamMembers.length,
        available: Math.max(0, teamMembers.length - onLeaveMembers.length),
        onLeave: onLeaveMembers.length
      };
    });

    const teamNames = activeDirectory
      .map((employee) => String(employee.department || '').trim())
      .filter((team, index, arr) => Boolean(team) && arr.indexOf(team) === index)
      .sort((a, b) => a.localeCompare(b));

    const teamMatrix: Array<{ type: 'Staff' | 'Trainee'; cells: SendReportTeamMatrixCell[] }> = ['Staff', 'Trainee'].map((type) => {
      const cells = teamNames.map((team) => {
        const teamMembers = activeDirectory.filter((employee) => String(employee.department || '').trim() === team);
        const teamTypeMembers = teamMembers.filter((employee) => toEmployeeType(employee.department) === type);
        const teamOnLeave = teamTypeMembers.filter((employee) => Boolean(onLeaveEmployeeIds[employee.id])).length;
        return {
          team,
          total: teamTypeMembers.length,
          available: Math.max(0, teamTypeMembers.length - teamOnLeave),
          onLeave: teamOnLeave
        };
      });
      return { type: type as 'Staff' | 'Trainee', cells };
    });


    const details: SendReportDetailRow[] = filtered
      .slice()
      .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || '') || a.employee.name.localeCompare(b.employee.name))
      .map((request, index) => {
        const leaveTypeText = request.isHalfDay
          ? `${request.leaveType} (${request.halfDayType === 'second' ? 'Second Half Day' : 'First Half Day'})`
          : request.leaveType;

        // Calculate total leave within the report date range (not just current year)
        const reportEndMs = endBound?.getTime() || now.getTime();
        const reportStartMs = startBound?.getTime() || 0;
        const totalLeaveInRange = leaveRequests
          .filter((r) => {
            if (r.employee.id !== request.employee.id) return false;
            if (r.status === LeaveStatus.Rejected) return false;
            const rStart = toDateValue(r.startDate);
            const rEnd = toDateValue(r.endDate);
            if (!rStart) return false;
            const rStartMs = rStart.getTime();
            const rEndMs = rEnd ? rEnd.getTime() : rStartMs;
            // Overlap check: leave overlaps with report range
            if (reportStartMs && rEndMs < reportStartMs) return false;
            if (reportEndMs && rStartMs > reportEndMs) return false;
            return true;
          })
          .reduce((sum, r) => {
            const lt = String(r.leaveType || '').toLowerCase();
            // For maternity/paternity, don't double-count here — they'll be shown separately
            if (lt.includes('maternity') || lt.includes('paternity')) return sum;
            return sum + Number(r.days || 0);
          }, 0);

        // Cumulative Maternity/Paternity Usage up to report end
        const cumulativeRequests = leaveRequests.filter(r =>
          r.employee.id === request.employee.id &&
          r.status === LeaveStatus.Approved
        );

        const calcCumulative = (search: string) => cumulativeRequests
          .filter(r => {
            const rDate = toDateValue(r.startDate);
            return rDate && rDate.getTime() <= reportEndMs &&
              String(r.leaveType || '').toLowerCase().includes(search);
          })
          .reduce((sum, r) => {
            const start = toDateValue(r.startDate);
            const end = toDateValue(r.endDate);
            if (!start) return sum + Number(r.days || 0);
            // Calculate actual elapsed days: from leave start to min(leaveEnd, reportEnd)
            const effectiveEnd = end ? Math.min(end.getTime(), reportEndMs) : reportEndMs;
            const elapsedMs = effectiveEnd - start.getTime();
            const elapsedDays = Math.max(0, Math.floor(elapsedMs / (1000 * 60 * 60 * 24)) + 1);
            // Cap at total requested days (r.days) to avoid overcounting
            const totalDays = Number(r.days || 0);
            return sum + Math.min(elapsedDays, totalDays);
          }, 0);

        const getDynamicQuota = (search: string) => {
          // Only assign a quota if this employee has ever requested this leave type
          const hasEverRequested = leaveRequests.some(r =>
            r.employee.id === request.employee.id &&
            String(r.leaveType || '').toLowerCase().includes(search.toLowerCase())
          );
          if (!hasEverRequested) return 0;

          const qKey = Object.keys(leaveQuotas).find(k => k.toLowerCase().includes(search.toLowerCase()));
          const listQuota = qKey ? leaveQuotas[qKey] : 0;
          if (listQuota > 0) return listQuota;
          // Fallback to total days approved for this person if not in global list
          const totalDaysApproved = cumulativeRequests
            .filter(r => String(r.leaveType || '').toLowerCase().includes(search.toLowerCase()))
            .reduce((sum, r) => sum + Number(r.days || 0), 0);
          return totalDaysApproved > 0 ? totalDaysApproved : (search === 'maternity' ? 182 : 5);
        };

        const matUsed = calcCumulative('maternity');
        const patUsed = calcCumulative('paternity');
        const matQuota = getDynamicQuota('maternity');
        const patQuota = getDynamicQuota('paternity');

        // Total = regular leaves + elapsed maternity/paternity days
        const grandTotal = totalLeaveInRange + matUsed + patUsed;

        return {
          no: index + 1,
          name: request.employee.name,
          employeeId: request.employee.id,
          employeeType: toEmployeeType(request.employee.department),
          attendance: leaveTypeText,
          reason: request.reason || '',
          expectedLeaveEnd: request.endDate,
          team: request.employee.department || '',
          status: String(request.status || ''),
          totalLeaveThisYear: Number(grandTotal.toFixed(2)),
          maternityUsage: (matUsed > 0 || matQuota > 0) ? `${matUsed} / ${matQuota}` : undefined,
          paternityUsage: (patUsed > 0 || patQuota > 0) ? `${patUsed} / ${patQuota}` : undefined
        };
      });

    setSendReportSnapshot({
      generatedAt: new Date().toISOString(),
      reportPreset: sendReportPreset,
      rangeStartDate: startBound ? formatDateIST(startBound) : '',
      rangeEndDate: endBound ? formatDateIST(endBound) : '',
      totalTeamCount,
      availableCount,
      onLeaveCount,
      typeSummary,
      teamMatrix,
      details
    });

  }, [directoryEmployees, leaveRequests, sendReportEndDate, sendReportPreset, sendReportStartDate, toDateKey]);

  const hrLeavesCalendarEvents = useMemo<CalendarViewEvent[]>(() => {
    const leaveEvents = leaveOnlyRequests.map((request) => ({
      id: request.id,
      title: `${request.employee.name} - ${request.leaveType} (${request.status})`,
      color: getLeaveEventColor(request.leaveType || request.requestCategory || 'Leave'),
      subtitle: request.reason || request.status,
      status: request.status,
      startDate: toDateKey(request.startDate),
      endDate: toDateKey(request.endDate || request.startDate),
      referenceId: request.id,
      raw: request
    }));
    const holidayEvents = holidays.map((holiday) => ({
      id: `holiday-${holiday.id}`,
      title: `Holiday - ${holiday.name}`,
      color: HOLIDAY_EVENT_COLOR,
      subtitle: holiday.type,
      startDate: toDateKey(holiday.date),
      endDate: toDateKey(holiday.date),
      referenceId: holiday.id,
      raw: holiday
    }));
    return [...leaveEvents, ...holidayEvents];
  }, [holidays, leaveOnlyRequests, toDateKey]);

  const handleGenerateSendReportPdf = React.useCallback(() => {
    if (!sendReportSnapshot) {
      showAlert('Please click Generate Data first.');
      return;
    }

    const escapeHtml = (value: unknown): string => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    const popup = window.open('', '_blank', 'width=1200,height=900');
    if (!popup) {
      showAlert('Please allow popups to generate PDF.');
      return;
    }

    const firstMatrixRow = sendReportSnapshot.teamMatrix[0];
    const matrixHeaderCells = firstMatrixRow
      ? firstMatrixRow.cells.map((cell) => `<th colspan="2">${escapeHtml(cell.team)} (${cell.total})</th>`).join('')
      : '';
    const matrixBodyRows = sendReportSnapshot.teamMatrix.map((row) => {
      const cells = row.cells.map((cell) => (
        `<td class="num available">${cell.available}</td><td class="num onleave">${cell.onLeave}</td>`
      )).join('');
      return `<tr><td class="rowHead">${escapeHtml(row.type)}</td>${cells}</tr>`;
    }).join('');

    const detailRows = sendReportSnapshot.details.map((item) => `
      <tr>
        <td>${item.no}</td>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.employeeType)}</td>
        <td>${escapeHtml(item.attendance)}</td>
        <td>${escapeHtml(item.reason)}</td>
        <td>${escapeHtml(item.expectedLeaveEnd)}</td>
        <td>${escapeHtml(item.team)}</td>
        <td>${escapeHtml(item.status)}</td>
        <td>
          ${item.totalLeaveThisYear}
          ${item.maternityUsage ? `<br/><span style="font-size:10px;color:#11803f;font-weight:bold">Mat: ${escapeHtml(item.maternityUsage)}</span>` : ''}
          ${item.paternityUsage ? `<br/><span style="font-size:10px;color:#11803f;font-weight:bold">Pat: ${escapeHtml(item.paternityUsage)}</span>` : ''}
        </td>
      </tr>
    `).join('');

    const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>Send Report</title>
        <style>
          body{font-family:Segoe UI,Arial,sans-serif;margin:18px;color:#1f2937;}
          .title{font-size:20px;font-weight:700;color:#2f5596;margin-bottom:14px;}
          table{border-collapse:collapse;width:100%;margin-bottom:14px;}
          th,td{border:1px solid #d7deea;padding:7px 8px;font-size:12px;vertical-align:middle;}
          .box th{color:#fff;text-align:center;}
          .box .team{background:#2f5596;}
          .box .avail{background:#11803f;}
          .box .leave{background:#b4232c;}
          .num{text-align:center;font-weight:700;}
          .available{color:#11803f;}
          .onleave{color:#b4232c;}
          .matrix thead th,.matrix .rowHead{background:#2f5596;color:#fff;font-weight:700;text-align:center;}
          .details thead th{background:#eef3fb;font-weight:700;}
          .details td:nth-child(4){background:#f5efe3;}
          .meta{font-size:11px;color:#6b7280;margin-bottom:8px;}
        </style>
      </head>
      <body>
        <div class="title">On Leave / WFH Report</div>
        <div class="meta">Generated: ${escapeHtml(formatDateForDisplayIST(sendReportSnapshot.generatedAt, 'en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }))}</div>
        <div class="meta">Time Frame: ${escapeHtml(sendReportSnapshot.reportPreset)}${sendReportSnapshot.rangeStartDate || sendReportSnapshot.rangeEndDate ? ` (${escapeHtml(sendReportSnapshot.rangeStartDate || '-')} to ${escapeHtml(sendReportSnapshot.rangeEndDate || '-')})` : ''}</div>

        <table class="box" style="max-width:420px">
          <tr>
            <th class="team">Team (${sendReportSnapshot.totalTeamCount})</th>
            <th class="avail">Available (${sendReportSnapshot.availableCount})</th>
            <th class="leave">On Leave (${sendReportSnapshot.onLeaveCount})</th>
          </tr>
          ${sendReportSnapshot.typeSummary.map((item) => `<tr><td class="rowHead" style="background:#2f5596;color:#fff;text-align:center">${escapeHtml(item.type)}</td><td class="num available">${item.available}</td><td class="num onleave">${item.onLeave}</td></tr>`).join('')}
        </table>

        <table class="matrix">
          <thead>
            <tr>
              <th>Team</th>
              ${matrixHeaderCells}
            </tr>
          </thead>
          <tbody>
            ${matrixBodyRows}
          </tbody>
        </table>

        <table class="details">
          <thead>
            <tr>
              <th>No.</th>
              <th>Name</th>
              <th>Employee Type</th>
              <th>Attendance</th>
              <th>Reason</th>
              <th>Expected leave end</th>
              <th>Team</th>
              <th>Status</th>
              <th>Total leave this year</th>
            </tr>
          </thead>
          <tbody>${detailRows || '<tr><td colspan="9" style="text-align:center;color:#6b7280">No data found</td></tr>'}</tbody>
        </table>

        <script>window.onload=function(){window.print();}</script>
      </body>
      </html>
    `;
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  }, [sendReportSnapshot]);

  const hrWfhCalendarEvents = useMemo<CalendarViewEvent[]>(() => {
    const wfhEvents = workFromHomeRequests.map((request) => ({
      id: request.id,
      title: `${request.employee.name} - Work From Home (${request.status})`,
      subtitle: request.reason || request.status,
      status: request.status,
      startDate: toDateKey(request.startDate),
      endDate: toDateKey(request.endDate || request.startDate),
      referenceId: request.id,
      raw: request
    }));
    const holidayEvents = holidays.map((holiday) => ({
      id: `holiday-${holiday.id}`,
      title: `Holiday - ${holiday.name}`,
      color: HOLIDAY_EVENT_COLOR,
      subtitle: holiday.type,
      startDate: toDateKey(holiday.date),
      endDate: toDateKey(holiday.date),
      referenceId: holiday.id,
      raw: holiday
    }));
    return [...wfhEvents, ...holidayEvents];
  }, [holidays, toDateKey, workFromHomeRequests]);

  const hrAttendanceCalendarEvents = useMemo<CalendarViewEvent[]>(() => {
    const attendanceEvents = attendanceRecords.map((record, index) => ({
      id: record.id || `${record.employeeId}-${record.date}-${index}`,
      title: `${record.employeeName || record.employeeId} - ${record.status}`,
      subtitle: `${record.clockIn || '--:--'} - ${record.clockOut || '--:--'}`,
      startDate: toDateKey(record.date),
      referenceId: record.id || record.date,
      raw: record
    }));
    const holidayEvents = holidays.map((holiday) => ({
      id: `holiday-${holiday.id}`,
      title: `Holiday - ${holiday.name}`,
      color: HOLIDAY_EVENT_COLOR,
      subtitle: holiday.type,
      startDate: toDateKey(holiday.date),
      endDate: toDateKey(holiday.date),
      referenceId: holiday.id,
      raw: holiday
    }));
    return [...attendanceEvents, ...holidayEvents];
  }, [attendanceRecords, holidays, toDateKey]);

  const handleExportHolidays = React.useCallback(async () => {
    if (holidays.length === 0) return;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Official Holidays');

    // Title
    const titleRow = worksheet.addRow(['Official Holidays List']);
    worksheet.mergeCells('A1:C1');
    titleRow.eachCell(cell => {
      cell.font = { bold: true, size: 14, color: { argb: 'FF2F5596' } };
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
    });
    worksheet.addRow([]); // Gap

    // Headers
    const headers = ['Holiday Name', 'Date', 'Type'];
    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5596' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
    });

    // Column widths
    worksheet.columns = [
      { key: 'name', width: 35 },
      { key: 'date', width: 20 },
      { key: 'type', width: 20 }
    ];

    // Data
    sortedHolidays.forEach(holiday => {
      const row = worksheet.addRow([
        holiday.name,
        holiday.date,
        holiday.type
      ]);
      row.eachCell(cell => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `official_holidays_${todayIST()}.xlsx`);
  }, [sortedHolidays]);

  const handleExportGlobalDirectory = React.useCallback(async () => {
    if (directoryEmployees.length === 0) return;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Employee Directory');

    // Title
    const titleRow = worksheet.addRow(['Employee Global Directory']);
    worksheet.mergeCells('A1:F1');
    titleRow.eachCell(cell => {
      cell.font = { bold: true, size: 14, color: { argb: 'FF2F5596' } };
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
    });
    worksheet.addRow([]); // Gap

    // Headers
    const headers = ['Name', 'Employee ID', 'Department', 'Position', 'Email', 'Active Status'];
    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5596' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
    });

    // Column widths
    worksheet.columns = [
      { key: 'name', width: 25 },
      { key: 'id', width: 15 },
      { key: 'dept', width: 20 },
      { key: 'pos', width: 20 },
      { key: 'email', width: 30 },
      { key: 'status', width: 15 }
    ];

    // Data
    directoryEmployees.forEach(emp => {
      const row = worksheet.addRow([
        emp.name,
        emp.id,
        emp.department,
        emp.position,
        emp.email,
        'Active'
      ]);
      row.eachCell(cell => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `employee_directory_${todayIST()}.xlsx`);
  }, [directoryEmployees]);

  const handleGenerateSendReportExcel = React.useCallback(async () => {
    if (!sendReportSnapshot) {
      showAlert('Please click Generate Data first.');
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('On Leave Report');

    // Title
    const titleRow = worksheet.addRow(['On Leave / WFH Report']);
    worksheet.mergeCells('A1:G1');
    titleRow.eachCell(cell => {
      cell.font = { bold: true, size: 14, color: { argb: 'FF2F5596' } };
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
    });

    worksheet.addRow([`Generated: ${formatDateForDisplayIST(sendReportSnapshot.generatedAt, 'en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`]);
    worksheet.addRow([`Time Frame: ${sendReportSnapshot.reportPreset}${sendReportSnapshot.rangeStartDate || sendReportSnapshot.rangeEndDate ? ` (${sendReportSnapshot.rangeStartDate || '-'} to ${sendReportSnapshot.rangeEndDate || '-'})` : ''}`]);
    worksheet.addRow([]); // Gap

    // Summary Box
    const summaryHeader = worksheet.addRow([`Team (${sendReportSnapshot.totalTeamCount})`, `Available (${sendReportSnapshot.availableCount})`, `On Leave (${sendReportSnapshot.onLeaveCount})`]);
    summaryHeader.eachCell((cell, colNum) => {
      const colors = ['FF2F5596', 'FF11803F', 'FFB4232C'];
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors[colNum - 1] } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      cell.alignment = { horizontal: 'center' };
    });

    sendReportSnapshot.typeSummary.forEach(item => {
      const row = worksheet.addRow([item.type, item.available, item.onLeave]);
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5596' } };
      row.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      row.eachCell(cell => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.alignment = { horizontal: 'center' };
      });
    });
    worksheet.addRow([]); // Gap

    // Matrix Table
    const firstMatrixRow = sendReportSnapshot.teamMatrix[0];
    if (firstMatrixRow) {
      const matrixHeaders = ['Team', ...firstMatrixRow.cells.reduce((acc: string[], cell: SendReportTeamMatrixCell) => acc.concat([`${cell.team} (Avail)`, `${cell.team} (Leave)`]), [])];
      const matrixHeaderRow = worksheet.addRow(matrixHeaders);
      matrixHeaderRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5596' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      });

      sendReportSnapshot.teamMatrix.forEach(row => {
        const dataRow = worksheet.addRow([row.type, ...row.cells.reduce((acc: number[], c: SendReportTeamMatrixCell) => acc.concat([c.available, c.onLeave]), [])]);
        dataRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5596' } };
        dataRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        dataRow.eachCell(cell => {
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          cell.alignment = { horizontal: 'center' };
        });
      });
      worksheet.addRow([]); // Gap
    }

    // Details Table
    const detailHeaders = ['No', 'Name', 'Employee Type', 'Attendance', 'Reason', 'Expected End', 'Team', 'Status', 'Total Leaves (YTD)'];
    const detailHeaderRow = worksheet.addRow(detailHeaders);
    detailHeaderRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
      cell.font = { bold: true };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    sendReportSnapshot.details.forEach(item => {
      const row = worksheet.addRow([
        item.no,
        item.name,
        item.employeeType,
        item.attendance,
        item.reason,
        item.expectedLeaveEnd,
        item.team,
        item.status,
        item.totalLeaveThisYear
      ]);
      row.eachCell((cell, colNum) => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        if (colNum === 4) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5EFE3' } };
      });
    });

    // Column Widths
    worksheet.columns = [
      { width: 5 }, { width: 25 }, { width: 12 }, { width: 25 }, { width: 30 }, { width: 15 }, { width: 20 }, { width: 12 }, { width: 15 }
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `on_leave_wfh_report_${todayIST()}.xlsx`);
  }, [sendReportSnapshot]);

  const hrOnLeaveTodayCalendarEvents = useMemo<CalendarViewEvent[]>(() => {
    const onLeaveEvents = leaveRequests.map((request) => ({
      id: request.id,
      title: `${request.employee.name} - ${request.requestCategory === 'Work From Home' ? 'WFH' : request.leaveType} (${request.status})`,
      color: getLeaveEventColor(request.requestCategory === 'Work From Home' ? 'Work From Home' : (request.leaveType || 'Leave')),
      subtitle: request.reason || request.status,
      status: request.status,
      startDate: toDateKey(request.startDate),
      endDate: toDateKey(request.endDate || request.startDate),
      referenceId: request.id,
      raw: request
    }));
    const holidayEvents = holidays.map((holiday) => ({
      id: `holiday-${holiday.id}`,
      title: `Holiday - ${holiday.name}`,
      color: HOLIDAY_EVENT_COLOR,
      subtitle: holiday.type,
      startDate: toDateKey(holiday.date),
      endDate: toDateKey(holiday.date),
      referenceId: holiday.id,
      raw: holiday
    }));
    return [...onLeaveEvents, ...holidayEvents];
  }, [holidays, leaveRequests, toDateKey]);

  const isBootLoading = !isCurrentUserResolved || !isDirectoryResolved;

  if (isBootLoading) {
    return (
      <div className="bg-light min-vh-100 d-flex align-items-center justify-content-center">
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <div className="text-muted">Loading your dashboard...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticatedDirectoryUser) {
    return (
      <div className="bg-light min-vh-100 d-flex align-items-center justify-content-center p-3">
        <div className="alert alert-danger mb-0">
          You are not an authenticated user to access this page.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-light min-vh-100">
      <CustomAlertProvider />
      <Header
        role={role}
        onRoleToggle={handleRoleToggle}
        canAccessHr={canAccessHr}
        currentUser={currentUser}
        onTabChange={setActiveTab}
      />

      <main className="container-fluid hr-shell-container hr-main-content py-4">
        {activeTab === 'profile' ? (
          <Profile
            user={currentUser || inferredCurrentUser || directoryEmployees[0]}
            role={role}
            sp={sp}
            onBack={() => setActiveTab(role === UserRole.HR ? 'overview' : 'dashboard')}
            onUpdate={loadDirectoryEmployees}
            onOpenVersionHistory={(itemId) => { void handleOpenVersionHistory('Employee', 'EmployeeMaster', itemId); }}
          />
        ) : (
          <>
            <ul className="nav nav-pills mb-4 bg-white p-2 rounded shadow-sm d-inline-flex flex-wrap gap-2 w-100" role="tablist">
              {role === UserRole.HR ? (
                <>
                  <li className="nav-item">
                    <button className={`nav-link btn-sm px-4 py-2 fw-medium ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Dashboard</button>
                  </li>
                  <li className="nav-item">
                    <button className={`nav-link btn-sm px-4 py-2 fw-medium ${activeTab === 'leaves-request' ? 'active' : ''}`} onClick={() => setActiveTab('leaves-request')}>Leaves request</button>
                  </li>
                  <li className="nav-item">
                    <button className={`nav-link btn-sm px-4 py-2 fw-medium ${activeTab === 'wfh-request' ? 'active' : ''}`} onClick={() => setActiveTab('wfh-request')}>WFH Request</button>
                  </li>
                  <li className="nav-item">
                    <button className={`nav-link btn-sm px-4 py-2 fw-medium ${activeTab === 'global-directory' ? 'active' : ''}`} onClick={() => setActiveTab('global-directory')}>Global Directory</button>
                  </li>
                  <li className="nav-item">
                    <button className={`nav-link btn-sm px-4 py-2 fw-medium ${activeTab === 'attendance' ? 'active' : ''}`} onClick={() => setActiveTab('attendance')}>Global Attendance</button>
                  </li>
                  <li className="nav-item">
                    <button className={`nav-link btn-sm px-4 py-2 fw-medium ${activeTab === 'upload-salary-slip' ? 'active' : ''}`} onClick={() => setActiveTab('upload-salary-slip')}>Upload Salary Slip</button>
                  </li>
                  <li className="nav-item">
                    <button className={`nav-link btn-sm px-4 py-2 fw-medium ${activeTab === 'onLeaveToday' ? 'active' : ''}`} onClick={() => setActiveTab('onLeaveToday')}>On Leave / WFH Today</button>
                  </li>
                  <li className="nav-item">
                    <button className={`nav-link btn-sm px-4 py-2 fw-medium ${activeTab === 'policy-admin' ? 'active' : ''}`} onClick={() => setActiveTab('policy-admin')}>Leave Policy</button>
                  </li>
                  <li className="nav-item">
                    <button className={`nav-link btn-sm px-4 py-2 fw-medium ${activeTab === 'holiday-admin' ? 'active' : ''}`} onClick={() => setActiveTab('holiday-admin')}>Official Leaves</button>
                  </li>
                  <li className="nav-item">
                    <button className={`nav-link btn-sm px-4 py-2 fw-medium ${activeTab === 'carry-forward-leaves' ? 'active' : ''}`} onClick={() => setActiveTab('carry-forward-leaves')}>Carry Forward Leaves</button>
                  </li>
                  <li className="nav-item">
                    <button className={`nav-link btn-sm px-4 py-2 fw-medium ${activeTab === 'concerns-admin' ? 'active' : ''}`} onClick={() => setActiveTab('concerns-admin')}>
                      Concerns {openConcernsCount > 0 && <span className="badge text-bg-danger ms-1">{openConcernsCount}</span>}
                    </button>
                  </li>
                </>
              ) : (
                <>
                  <li className="nav-item">
                    <button className={`nav-link btn-sm px-4 py-2 fw-medium ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
                  </li>
                  <li className="nav-item">
                    <button className={`nav-link btn-sm px-4 py-2 fw-medium ${activeTab === 'attendance' ? 'active' : ''}`} onClick={() => setActiveTab('attendance')}>Attendance</button>
                  </li>
                  <li className="nav-item">
                    <button className={`nav-link btn-sm px-4 py-2 fw-medium ${activeTab === 'leave' ? 'active' : ''}`} onClick={() => setActiveTab('leave')}>Leave Applications</button>
                  </li>
                  <li className="nav-item">
                    <button className={`nav-link btn-sm px-4 py-2 fw-medium ${activeTab === 'work-from-home' ? 'active' : ''}`} onClick={() => setActiveTab('work-from-home')}>Work From Home</button>
                  </li>
                  <li className="nav-item">
                    <button className={`nav-link btn-sm px-4 py-2 fw-medium ${activeTab === 'salary' ? 'active' : ''}`} onClick={() => setActiveTab('salary')}>Salary Slip</button>
                  </li>
                </>
              )}
            </ul>

            <div className="tab-content">
              {role === UserRole.Employee ? (
                <EmployeePortal user={currentUser} requests={leaveRequests} attendance={attendanceRecords} salarySlips={salarySlips} policies={policies} holidays={holidays} concerns={concerns} leaveQuotas={leaveQuotas} teamEvents={teamEvents} onRaiseConcern={handleRaiseConcern} onSubmitLeave={(preferredTab, initialDate) => handleOpenLeaveModal(undefined, preferredTab, initialDate)} onTabChange={setActiveTab} activeTab={activeTab} />
              ) : (
                <>
                  {activeTab === 'overview' && <Dashboard requests={leaveRequests} attendanceRecords={attendanceRecords} concernsCount={openConcernsCount} holidays={holidays} teamEvents={teamEvents} onAddTeamEvent={handleAddTeamEvent} onUpdateTeamEvent={handleUpdateTeamEvent} onDeleteTeamEvent={handleDeleteTeamEvent} onPendingClick={() => setActiveTab('leaves-request')} onOnLeaveTodayClick={() => setActiveTab('onLeaveToday')} onConcernsClick={() => setActiveTab('concerns-admin')} onOpenTeamEventForm={(eventId) => { openOutOfBoxListItemForm(sp, 'TeamCelebrations', eventId).catch(() => undefined); }} onOpenTeamEventVersionHistory={(eventId) => { void handleOpenVersionHistory('Team Event', 'TeamCelebrations', eventId); }} />}
                  {activeTab === 'leaves-request' && (
                    isLoadingLeaveRequests ? (
                      <div className="d-flex justify-content-center p-5">
                        <div className="spinner-border text-primary" role="status">
                          <span className="visually-hidden">Loading...</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="d-flex justify-content-end align-items-center gap-2 mb-3">
                          {!hrCalendarViewByTab['leaves-request'] && (
                            <button
                              type="button"
                              className="btn btn-sm btn-default"
                              onClick={() => setOpenLeaveReportKey((prev) => prev + 1)}
                            >
                              Generate Report
                            </button>
                          )}
                          <div className="d-flex align-items-center bg-light rounded-pill p-1 border shadow-xs" style={{ width: 'fit-content' }}>
                            <button
                              type="button"
                              className={`btn btn-sm rounded-pill border-0 d-flex align-items-center gap-2 px-3 ${!hrCalendarViewByTab['leaves-request'] ? 'bg-white shadow-sm fw-bold text-primary' : 'text-muted'}`}
                              onClick={() => setHrCalendarViewByTab(prev => ({ ...prev, 'leaves-request': false }))}
                              style={{ transition: 'all 0.2s' }}
                            >
                              <FileText size={14} /> Table
                            </button>
                            <button
                              type="button"
                              className={`btn btn-sm rounded-pill border-0 d-flex align-items-center gap-2 px-3 ${hrCalendarViewByTab['leaves-request'] ? 'bg-white shadow-sm fw-bold text-primary' : 'text-muted'}`}
                              onClick={() => setHrCalendarViewByTab(prev => ({ ...prev, 'leaves-request': true }))}
                              style={{ transition: 'all 0.2s' }}
                            >
                              <CalendarIcon size={14} /> Calendar
                            </button>
                          </div>
                        </div>
                        {hrCalendarViewByTab['leaves-request'] ? (
                          <CalendarView
                            heading="Leaves Request Calendar"
                            events={hrLeavesCalendarEvents}
                            showCreate
                            showEdit
                            showDelete
                            onCreate={(date) => handleOpenLeaveModal(undefined, 'leave', date)}
                            onEdit={(event) => {
                              if (String(event.id).indexOf('holiday-') === 0) {
                                handleOpenHolidayModal(event.raw as Holiday);
                                return;
                              }
                              handleOpenLeaveModal(event.raw as LeaveRequest);
                            }}
                            onDelete={(event) => { void handleDeleteRequest(Number(event.referenceId)); }}
                          />
                        ) : (
                          <LeaveRequestsTable requests={leaveOnlyRequests} employees={directoryEmployees} leaveQuotas={leaveQuotas} filter={leaveFilter} onFilterChange={setLeaveFilter} onUpdateStatus={handleUpdateRequestStatus} onDelete={handleDeleteRequest} onViewBalance={handleViewBalance} teams={distinctTimeCategories} showGenerateReportButton={false} externalOpenReportKey={openLeaveReportKey} reportMode="leave" onOpenRequestForm={(requestId) => { openOutOfBoxListItemForm(sp, 'Leave Request', requestId).catch(() => undefined); }} onOpenRequestVersionHistory={(requestId) => { void handleOpenVersionHistory('Leave Request', 'Leave Request', requestId); }} />
                        )}
                      </>
                    )
                  )}
                  {activeTab === 'wfh-request' && (
                    isLoadingLeaveRequests ? (
                      <div className="d-flex justify-content-center p-5">
                        <div className="spinner-border text-primary" role="status">
                          <span className="visually-hidden">Loading...</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="d-flex justify-content-end align-items-center gap-2 mb-3">
                          {!hrCalendarViewByTab['wfh-request'] && (
                            <button
                              type="button"
                              className="btn btn-sm btn-default"
                              onClick={() => setOpenWfhReportKey((prev) => prev + 1)}
                            >
                              Generate Report
                            </button>
                          )}
                          <div className="d-flex align-items-center bg-light rounded-pill p-1 border shadow-xs" style={{ width: 'fit-content' }}>
                            <button
                              type="button"
                              className={`btn btn-sm rounded-pill border-0 d-flex align-items-center gap-2 px-3 ${!hrCalendarViewByTab['wfh-request'] ? 'bg-white shadow-sm fw-bold text-primary' : 'text-muted'}`}
                              onClick={() => setHrCalendarViewByTab(prev => ({ ...prev, 'wfh-request': false }))}
                              style={{ transition: 'all 0.2s' }}
                            >
                              <FileText size={14} /> Table
                            </button>
                            <button
                              type="button"
                              className={`btn btn-sm rounded-pill border-0 d-flex align-items-center gap-2 px-3 ${hrCalendarViewByTab['wfh-request'] ? 'bg-white shadow-sm fw-bold text-primary' : 'text-muted'}`}
                              onClick={() => setHrCalendarViewByTab(prev => ({ ...prev, 'wfh-request': true }))}
                              style={{ transition: 'all 0.2s' }}
                            >
                              <CalendarIcon size={14} /> Calendar
                            </button>
                          </div>
                        </div>
                        {hrCalendarViewByTab['wfh-request'] ? (
                          <CalendarView
                            heading="WFH Request Calendar"
                            events={hrWfhCalendarEvents}
                            showCreate
                            showEdit
                            showDelete
                            onCreate={(date) => handleOpenLeaveModal(undefined, 'workFromHome', date)}
                            onEdit={(event) => {
                              if (String(event.id).indexOf('holiday-') === 0) {
                                handleOpenHolidayModal(event.raw as Holiday);
                                return;
                              }
                              handleOpenLeaveModal(event.raw as LeaveRequest);
                            }}
                            onDelete={(event) => { void handleDeleteRequest(Number(event.referenceId)); }}
                          />
                        ) : (
                          <LeaveRequestsTable requests={workFromHomeRequests} employees={directoryEmployees} leaveQuotas={leaveQuotas} filter={leaveFilter} onFilterChange={setLeaveFilter} onUpdateStatus={handleUpdateRequestStatus} onDelete={handleDeleteRequest} onViewBalance={handleViewBalance} teams={distinctTimeCategories} title="Detailed Work From Home Applications" showLeaveBalance={false} showGenerateReportButton={false} externalOpenReportKey={openWfhReportKey} reportMode="wfh" onOpenRequestForm={(requestId) => { openOutOfBoxListItemForm(sp, 'Leave Request', requestId).catch(() => undefined); }} onOpenRequestVersionHistory={(requestId) => { void handleOpenVersionHistory('Work From Home Request', 'Leave Request', requestId); }} />
                        )}
                      </>
                    )
                  )}
                  {activeTab === 'global-directory' && (
                    <div className="card border-0 shadow-sm px-4">
                      <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                        <h5 className="mb-0 fw-bold color-primary">Employee Global Directory</h5>
                        <div className="d-flex gap-2">
                          <button
                            className="btn btn-default btn-sm d-flex align-items-center gap-2"
                            onClick={handleExportGlobalDirectory}
                            disabled={directoryEmployees.length === 0}
                          >
                            <Download size={16} /> Export Excel
                          </button>
                          <button className="btn btn-primary btn-sm d-flex align-items-center gap-2" onClick={() => handleOpenEmployeeModal()}>
                            <Plus size={16} /> Add User
                          </button>
                        </div>
                      </div>
                      {directoryError && (
                        <div className="alert alert-warning m-3 mb-0">{directoryError}</div>
                      )}
                      <CommonTable
                        data={directoryEmployees}
                        columns={employeeColumns}
                        getRowId={(row) => row.id}
                        globalSearchPlaceholder="Search employees"
                        enableRowSelection
                      />
                    </div>
                  )}
                  {activeTab === 'attendance' && (
                    <>
                      <div className="d-flex justify-content-end mb-3">
                        <div className="d-flex align-items-center bg-light rounded-pill p-1 border shadow-xs" style={{ width: 'fit-content' }}>
                          <button
                            type="button"
                            className={`btn btn-sm rounded-pill border-0 d-flex align-items-center gap-2 px-3 ${!hrCalendarViewByTab.attendance ? 'bg-white shadow-sm fw-bold text-primary' : 'text-muted'}`}
                            onClick={() => setHrCalendarViewByTab(prev => ({ ...prev, attendance: false }))}
                            style={{ transition: 'all 0.2s' }}
                          >
                            <FileText size={14} /> Table
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm rounded-pill border-0 d-flex align-items-center gap-2 px-3 ${hrCalendarViewByTab.attendance ? 'bg-white shadow-sm fw-bold text-primary' : 'text-muted'}`}
                            onClick={() => setHrCalendarViewByTab(prev => ({ ...prev, attendance: true }))}
                            style={{ transition: 'all 0.2s' }}
                          >
                            <CalendarIcon size={14} /> Calendar
                          </button>
                        </div>
                      </div>
                      {hrCalendarViewByTab.attendance ? (
                        <CalendarView
                          heading="Global Attendance Calendar"
                          events={hrAttendanceCalendarEvents}
                          showEdit
                          showDelete
                          onEdit={(event) => {
                            if (String(event.id).indexOf('holiday-') === 0) {
                              handleOpenHolidayModal(event.raw as Holiday);
                              return;
                            }
                            setPendingAttendanceEditRecord(event.raw as AttendanceRecord);
                            setHrCalendarViewByTab((prev) => ({ ...prev, attendance: false }));
                          }}
                          onDelete={(event) => { void handleDeleteAttendanceRecord(event.raw as AttendanceRecord); }}
                        />
                      ) : (
                        <AttendanceTracker employees={directoryEmployees} leaveRequests={leaveRequests} attendanceRecords={attendanceRecords} onImport={handleImportAttendance} isImporting={isImportingAttendance} onViewBalance={handleViewBalance} leaveQuotas={leaveQuotas} onUpdateAttendanceRecord={handleUpdateAttendanceRecord} onDeleteAttendanceByDate={handleDeleteAttendanceByDate} onDeleteAttendanceRecord={handleDeleteAttendanceRecord} onOpenAttendanceForm={(recordId) => { openOutOfBoxListItemForm(sp, 'AttendanceList', recordId).catch(() => undefined); }} onOpenAttendanceVersionHistory={(recordId) => { void handleOpenVersionHistory('Attendance', 'AttendanceList', recordId); }} initialEditRecord={pendingAttendanceEditRecord} onInitialEditConsumed={() => setPendingAttendanceEditRecord(null)} />
                      )}
                    </>
                  )}
                  {activeTab === 'upload-salary-slip' && (
                    <div className="card border-0 shadow-sm px-4">
                      <div className="card-header bg-white py-3">
                        <h5 className="mb-0 fw-bold color-primary">Upload Salary Slip</h5>
                      </div>
                      <CommonTable
                        data={directoryEmployees}
                        columns={uploadSalaryColumns}
                        getRowId={(row) => row.id}
                        globalSearchPlaceholder="Search employees"
                      />
                    </div>
                  )}
                  {activeTab === 'onLeaveToday' && (
                    <>
                      <div className="d-flex justify-content-end align-items-center gap-2 mb-3">
                        <button
                          type="button"
                          className="btn btn-sm btn-default d-inline-flex align-items-center gap-1"
                          onClick={() => {
                            setSendReportPreset('Today');
                            setSendReportStartDate(todayIST());
                            setSendReportEndDate(todayIST());
                            setSendReportPayload('');
                            setSendReportSnapshot(null);
                            setIsSendReportModalOpen(true);
                          }}
                        >
                          <Send size={14} /> Send Report
                        </button>
                        <div className="d-flex align-items-center bg-light rounded-pill p-1 border shadow-xs" style={{ width: 'fit-content' }}>
                          <button
                            type="button"
                            className={`btn btn-sm rounded-pill border-0 d-flex align-items-center gap-2 px-3 ${!hrCalendarViewByTab.onLeaveToday ? 'bg-white shadow-sm fw-bold text-primary' : 'text-muted'}`}
                            onClick={() => setHrCalendarViewByTab(prev => ({ ...prev, onLeaveToday: false }))}
                            style={{ transition: 'all 0.2s' }}
                          >
                            <FileText size={14} /> Table
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm rounded-pill border-0 d-flex align-items-center gap-2 px-3 ${hrCalendarViewByTab.onLeaveToday ? 'bg-white shadow-sm fw-bold text-primary' : 'text-muted'}`}
                            onClick={() => setHrCalendarViewByTab(prev => ({ ...prev, onLeaveToday: true }))}
                            style={{ transition: 'all 0.2s' }}
                          >
                            <CalendarIcon size={14} /> Calendar
                          </button>
                        </div>
                      </div>
                      {hrCalendarViewByTab.onLeaveToday ? (
                        <CalendarView
                          heading="On Leave / WFH Calendar"
                          events={hrOnLeaveTodayCalendarEvents}
                          showCreate
                          showEdit
                          showDelete
                          onCreate={(date) => handleOpenLeaveModal(undefined, 'leave', date)}
                          onEdit={(event) => {
                            if (String(event.id).indexOf('holiday-') === 0) {
                              handleOpenHolidayModal(event.raw as Holiday);
                              return;
                            }
                            handleOpenLeaveModal(event.raw as LeaveRequest);
                          }}
                          onDelete={(event) => { void handleDeleteRequest(Number(event.referenceId)); }}
                        />
                      ) : (
                        <OnLeaveTodayTable
                          requests={leaveRequests}
                          onEdit={handleOpenLeaveModal}
                          leaveQuotas={leaveQuotas}
                          sp={sp}
                          employees={directoryEmployees}
                          onRefresh={loadLeaveRequests}
                        />
                      )}
                    </>
                  )}
                  {activeTab === 'policy-admin' && (
                    <div className="card border-0 shadow-sm px-4">
                      <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                        <h5 className="mb-0 fw-bold color-primary">Leave Policies</h5>
                        <button className="btn btn-primary btn-sm" onClick={() => handleOpenPolicyModal()} disabled={isLoadingPolicies}><Plus size={16} /> Add Policy</button>
                      </div>
                      {isLoadingPolicies && (
                        <div className="text-center py-4">
                          <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Loading...</span>
                          </div>
                        </div>
                      )}
                      {policiesError && (
                        <div className="alert alert-danger m-3" role="alert">
                          {policiesError}
                        </div>
                      )}
                      {!isLoadingPolicies && !policiesError && (
                        <CommonTable
                          data={policies}
                          columns={policyColumns}
                          getRowId={(row) => row.id}
                          globalSearchPlaceholder="Search policies"
                        />
                      )}
                    </div>
                  )}
                  {activeTab === 'holiday-admin' && (
                    <div className="row g-3">
                      <div className="col-lg-6">
                        <div className="card border-0 shadow-sm h-100 px-4">
                          <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                            <h5 className="mb-0 fw-bold color-primary">Official Holidays</h5>
                            <div className="d-flex gap-2">
                              <button
                                className="btn btn-default btn-sm d-inline-flex align-items-center gap-1"
                                onClick={handleExportHolidays}
                                disabled={isLoadingHolidays || sortedHolidays.length === 0}
                              >
                                <Download size={14} /> Export Excel
                              </button>
                              <button className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1" onClick={() => handleOpenHolidayModal()} disabled={isLoadingHolidays}>
                                <Plus size={14} /> Add Holiday
                              </button>
                            </div>
                          </div>
                          {isLoadingHolidays && (
                            <div className="text-center py-4">
                              <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Loading...</span>
                              </div>
                            </div>
                          )}
                          {holidaysError && (
                            <div className="alert alert-danger m-3" role="alert">
                              {holidaysError}
                            </div>
                          )}
                          {!isLoadingHolidays && !holidaysError && (
                            <CommonTable
                              data={sortedHolidays}
                              columns={holidayColumns}
                              getRowId={(row) => row.id}
                              globalSearchPlaceholder="Search holidays"
                            />
                          )}
                        </div>
                      </div>
                      <div className="col-lg-6">
                        <div className="card border-0 shadow-sm h-100 px-4">
                          <div className="card-header color-primary bg-white py-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                            <h5 className="mb-0 fw-bold"> Leave Quotas</h5>
                            <button
                              className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1"
                              onClick={() => setIsAddLeaveModalOpen(true)}
                            >
                              <Plus size={14} /> Add Unofficial Leave
                            </button>
                          </div>
                          {isLoadingQuotas && (
                            <div className="text-center py-4">
                              <div className="spinner-border spinner-border-sm text-primary" role="status">
                                <span className="visually-hidden">Loading...</span>
                              </div>
                            </div>
                          )}
                          {quotasError && (
                            <div className="alert alert-warning m-3 mb-0 small" role="alert">
                              {quotasError}
                            </div>
                          )}
                          {!isLoadingQuotas && !quotasError && (
                            <div className="card-body p-0">
                              {Object.keys(leaveQuotas).length > 0 ? (
                                <>
                                  <ul className="list-group list-group-flush">
                                    {Object.entries(leaveQuotas).map(([type, quota]) => (
                                      <li key={type} className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                                        <div>{type}</div>
                                        <span className="">{quota}</span>
                                      </li>
                                    ))}
                                  </ul>
                                  <div className="p-3 bg-light text-center border-top">
                                    <button
                                      className="btn btn-sm btn-primary"
                                      onClick={() => setIsAddLeaveModalOpen(true)}
                                      disabled={isLoadingQuotas}
                                    >
                                      Manage Unofficial Leaves
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <div className="p-4 text-center text-muted">
                                  <p className="mb-2">No leave quotas configured</p>
                                  <button className="btn btn-sm btn-primary" onClick={() => setIsAddLeaveModalOpen(true)}>Add Unofficial Leave</button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  {activeTab === 'carry-forward-leaves' && (
                    <CarryForwardLeavesAdmin
                      sp={sp}
                      employees={directoryEmployees}
                      leaveRequests={leaveRequests}
                      listId={LEAVE_MONTHLY_BALANCE_LIST_REF}
                    />
                  )}
                  {activeTab === 'concerns-admin' && (
                    <div className="card border-0 shadow-sm px-4">
                      <div className="card-header bg-white py-3"><h5 className="mb-0 fw-bold color-primary">Employee Concerns</h5></div>
                      <CommonTable
                        data={concerns}
                        columns={concernColumns}
                        getRowId={(row) => row.id}
                        globalSearchPlaceholder="Search concerns"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </main>

      <Modal
        isOpen={isPolicyModalOpen}
        onClose={() => setIsPolicyModalOpen(false)}
        title={editingPolicyId ? "Edit Policy" : "New Policy"}
        createdInfo={formatAuditInfo(editingPolicy?.createdAt, editingPolicy?.createdByName)}
        modifiedInfo={formatAuditInfo(editingPolicy?.modifiedAt, editingPolicy?.modifiedByName)}
        onVersionHistoryClick={() => { void handleOpenVersionHistory('Policy', OFFICIAL_LEAVES_LIST_ID, editingPolicyId || undefined); }}
        onOpenFormClick={() => { openOutOfBoxListItemForm(sp, OFFICIAL_LEAVES_LIST_ID, editingPolicyId ?? undefined).catch(() => undefined); }}
        footer={<div className="d-flex justify-content-end gap-2 w-100"><button className="btn btn-default" onClick={() => setIsPolicyModalOpen(false)}>Cancel</button><button type="submit" form="policy-form" className="btn btn-primary">{editingPolicyId ? "Update" : "Save"}</button></div>}
      >
        <form id="policy-form" onSubmit={handleSavePolicy}><div className="mb-3"><label className="form-label">Title</label><input type="text" className="form-control" value={policyFormData.title} onChange={e => setPolicyFormData({ ...policyFormData, title: e.target.value })} required /></div><div className="mb-3"><label className="form-label">Description</label><textarea className="form-control" rows={8} value={policyFormData.content} onChange={e => setPolicyFormData({ ...policyFormData, content: e.target.value })} required></textarea></div></form>
      </Modal>

      <Modal isOpen={isAddLeaveModalOpen} onClose={() => setIsAddLeaveModalOpen(false)} title="Manage Quotas" footer={<button className="btn btn-primary px-4" onClick={handleSaveQuotas} disabled={isLoadingQuotas}>{isLoadingQuotas ? 'Saving...' : 'Save'}</button>}>
        <div className="mb-4"><label className="">Add New Type</label><div className="input-group input-group-sm gap-2"><input type="text" className="form-control" value={newLeaveTypeName} onChange={(e) => setNewLeaveTypeName(e.target.value)} placeholder="Enter leave type name" /><button className="btn btn-primary" onClick={handleAddNewLeaveType} disabled={isLoadingQuotas}>Add</button></div></div>
        {Object.keys(leaveQuotas).length > 0 ? (
          <div className="list-group list-group-flush overflow-auto" style={{ maxHeight: '400px' }}>
            {Object.entries(leaveQuotas).map(([type, count]) => (
              <div key={type} className="list-group-item d-flex justify-content-between align-items-center py-3">
                {editingLeaveType === type ? (
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    style={{ maxWidth: '200px' }}
                    value={editingLeaveTypeName}
                    onChange={(e) => setEditingLeaveTypeName(e.target.value)}
                    onBlur={() => handleRenameLeaveType(type, editingLeaveTypeName)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleRenameLeaveType(type, editingLeaveTypeName);
                      } else if (e.key === 'Escape') {
                        setEditingLeaveType(null);
                      }
                    }}
                    autoFocus
                    disabled={isLoadingQuotas}
                  />
                ) : (
                  <div
                    className=""
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setEditingLeaveType(type);
                      setEditingLeaveTypeName(type);
                    }}
                    title="Click to edit"
                  >
                    {type}
                  </div>
                )}
                <div className="d-flex align-items-center gap-3">
                  <button className="btn-default rounded-circle px-2" onClick={() => handleUpdateQuota(type, -1)} disabled={isLoadingQuotas}><Minus size={14} /></button>
                  <div className="" style={{ width: '20px', textAlign: 'center' }}>{count}</div>
                  <button className="btn-primary rounded-circle" onClick={() => handleUpdateQuota(type, 1)} disabled={isLoadingQuotas}><Plus size={14} /></button>
                  <button className="btn btn-link text-primary p-0 ms-2" onClick={() => handleDeleteQuotaType(type)} disabled={isLoadingQuotas}><X size={18} color="#2F5596" /></button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-muted py-4">
            <p>No leave types configured. Add your first leave type above.</p>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isHolidayModalOpen}
        onClose={() => setIsHolidayModalOpen(false)}
        title={editingHolidayId ? "Edit Holiday" : "New Holiday"}
        createdInfo={formatAuditInfo(editingHoliday?.createdAt, editingHoliday?.createdByName)}
        modifiedInfo={formatAuditInfo(editingHoliday?.modifiedAt, editingHoliday?.modifiedByName)}
        onVersionHistoryClick={() => { void handleOpenVersionHistory('Holiday', OFFICIAL_LEAVES_LIST_ID, editingHolidayId || undefined); }}
        onOpenFormClick={() => { openOutOfBoxListItemForm(sp, OFFICIAL_LEAVES_LIST_ID, editingHolidayId ?? undefined).catch(() => undefined); }}
        footer={<><button className="btn btn-default text-decoration-none" onClick={() => setIsHolidayModalOpen(false)}>Cancel</button><button type="submit" form="holiday-form" className="btn btn-primary">{editingHolidayId ? "Update" : "Save"}</button></>}
      >
        <form id="holiday-form" onSubmit={handleSaveHoliday}><div className="mb-3"><label className="form-label">Name</label><input type="text" className="form-control" value={holidayFormData.name} onChange={e => setHolidayFormData({ ...holidayFormData, name: e.target.value })} required /></div><div className="mb-3"><label className="form-label">Date</label><input type="date" className="form-control" value={holidayFormData.date} onChange={e => setHolidayFormData({ ...holidayFormData, date: e.target.value })} required /></div><div className="mb-3"><label className="form-label">Type</label><select className="form-select" value={holidayFormData.type} onChange={e => setHolidayFormData({ ...holidayFormData, type: e.target.value as any })}>{leaveCategories.length > 0 ? leaveCategories.map(cat => <option key={cat} value={cat}>{cat}</option>) : <><option value="Public">Public</option><option value="Restricted">Restricted</option></>}</select></div></form>
      </Modal>

      <Modal
        isOpen={isConcernReplyModalOpen}
        onClose={() => setIsConcernReplyModalOpen(false)}
        title="Resolve Concern"
        maxWidth={672}
        createdInfo={formatAuditInfo(selectedConcern?.createdAt, selectedConcern?.createdByName)}
        modifiedInfo={formatAuditInfo(selectedConcern?.modifiedAt, selectedConcern?.modifiedByName)}
        onVersionHistoryClick={() => { void handleOpenVersionHistory('Concern', 'EmployeeConcerns', selectedConcern?.id); }}
        onOpenFormClick={() => { openOutOfBoxListItemForm(sp, 'EmployeeConcerns', selectedConcern?.id).catch(() => undefined); }}
        footer={<><button className="btn btn-link text-decoration-none" onClick={() => setIsConcernReplyModalOpen(false)}>Cancel</button><button type="submit" form="concern-reply-form" className="btn btn-primary px-4">Submit</button></>}
      >
        {selectedConcern && (
          <form id="concern-reply-form" onSubmit={handleSaveConcernReply}>
            <div className="mb-3 p-3 bg-light rounded border">
              <div className="fw-bold text-muted text-uppercase">{selectedConcern.type}</div>
              <div className="text-dark mt-1">{selectedConcern.description}</div>
            </div>
            {selectedConcern.modifiedByName && selectedConcern.status === ConcernStatus.Resolved && (
              <div className="mb-3 small text-muted">
                Resolved by <span className="fw-semibold">{selectedConcern.modifiedByName}</span>
              </div>
            )}
            <div className="mb-3">
              <label className="form-label">Resolution</label>
              <textarea className="form-control" rows={5} value={concernReplyText} onChange={e => setConcernReplyText(e.target.value)} required placeholder="Resolution message..."></textarea>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        title={editingRequest ? (leaveModalTab === 'workFromHome' ? "Edit Work From Home" : "Edit Leave") : (leaveModalTab === 'workFromHome' ? "New Work From Home Request" : "New Leave")}
        createdInfo={formatAuditInfo(editingRequest?.createdAt, editingRequest?.createdByName)}
        modifiedInfo={formatAuditInfo(editingRequest?.modifiedAt, editingRequest?.modifiedByName)}
        onVersionHistoryClick={() => { void handleOpenVersionHistory('Leave Request', 'Leave Request', editingRequest?.id); }}
        onOpenFormClick={() => { openOutOfBoxListItemForm(sp, 'Leave Request', editingRequest?.id).catch(() => undefined); }}
        footer={
          <>
            <button className="btn btn-default text-decoration-none" onClick={() => setIsLeaveModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="leave-application-form" className="btn btn-primary px-4" disabled={isSavingLeave}>
              {isSavingLeave ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Submitting...
                </>
              ) : 'Submit'}
            </button>
          </>
        }
      >
        <form id="leave-application-form" onSubmit={saveLeaveRequest}>
          {leaveModalTab === 'leave' ? (
            <div className="row g-3">
              {role === UserRole.HR && (
                <div className="col-12">
                  <label className="form-label">Employee</label>
                  <div className="position-relative">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Search by name, ID, email or department..."
                      value={leaveEmployeeSearch}
                      onChange={(e) => {
                        setLeaveEmployeeSearch(e.target.value);
                        setIsLeaveEmployeeDropdownOpen(true);
                        if (selectedEmployeeForLeave) setSelectedEmployeeForLeave(null);
                      }}
                      onFocus={() => setIsLeaveEmployeeDropdownOpen(true)}
                      required={!selectedEmployeeForLeave}
                    />
                    {isLeaveEmployeeDropdownOpen && filteredLeaveEmployees.length > 0 && (
                      <div
                        className="position-absolute w-100 bg-white border rounded shadow-lg overflow-auto"
                        style={{ zIndex: 1050, maxHeight: '220px', top: '100%', marginTop: '2px' }}
                      >
                        {filteredLeaveEmployees.map((emp) => (
                          <button
                            key={`leave-${emp.id}`}
                            type="button"
                            className={`btn btn-light w-100 text-start d-flex align-items-center gap-2 px-3 py-2 border-0 border-bottom ${selectedEmployeeForLeave?.id === emp.id ? 'bg-primary bg-opacity-10' : ''}`}
                            onClick={() => {
                              setSelectedEmployeeForLeave(emp);
                              setLeaveEmployeeSearch(`${emp.name} (${emp.id}) - ${emp.department}`);
                              setIsLeaveEmployeeDropdownOpen(false);
                            }}
                          >
                            <img src={emp.avatar} alt={emp.name} width="30" height="30" className="rounded-circle border" style={{ objectFit: 'cover' }} />
                            <div style={{ lineHeight: '1.2' }}>
                              <div className="fw-medium text-dark" style={{ fontSize: '13px' }}>{emp.name}</div>
                              <div className="text-muted" style={{ fontSize: '11px' }}>ID: {emp.id} • {emp.department}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="col-12"><label className="form-label">Leave Type</label><select className="form-select" value={leaveFormData.leaveType} onChange={e => setLeaveFormData({ ...leaveFormData, leaveType: e.target.value })}>{Object.keys(leaveQuotas).map(t => (<option key={t} value={t}>{t}</option>))}</select></div>
              <div className="col-md-6"><label className="form-label">Start</label><input type="date" className="form-control" value={leaveFormData.startDate} onChange={e => setLeaveFormData({ ...leaveFormData, startDate: e.target.value })} required /></div>
              <div className="col-md-6">
                <label className="form-label">End {isSpecialLeave && <span className="small text-primary">(Auto-calculated)</span>}</label>
                <input
                  type="date"
                  className={`form-control ${isSpecialLeave ? 'bg-light border-primary border-dashed fw-bold text-primary' : ''}`}
                  value={leaveFormData.endDate}
                  onChange={e => setLeaveFormData({ ...leaveFormData, endDate: e.target.value })}
                  required
                  disabled={leaveFormData.isHalfDay || isSpecialLeave}
                />
              </div>
              <div className="col-12">
                <button
                  type="button"
                  className={`btn popup-option-toggle ${leaveFormData.isHalfDay ? 'popup-option-toggle--active' : ' btn-default'}`}
                  onClick={() => setLeaveFormData({ ...leaveFormData, isHalfDay: !leaveFormData.isHalfDay })}
                  aria-pressed={leaveFormData.isHalfDay}
                >
                  Request Half Day
                </button>
              </div>
              {leaveFormData.isHalfDay && (
                <div className="col-12">
                  <label className="form-label">Half Day Type</label>
                  <div className="d-flex gap-3">
                    <div className="SpfxCheckRadio">
                      <input
                        className="radio"
                        type="radio"
                        name="halfDayType"
                        id="firstHalf"
                        value="first"
                        checked={leaveFormData.halfDayType === 'first'}
                        onChange={e => setLeaveFormData({ ...leaveFormData, halfDayType: e.target.value as 'first' | 'second' })}
                      />
                      <label className="" htmlFor="firstHalf">First Half</label>
                    </div>
                    <div className="SpfxCheckRadio">
                      <input
                        className="radio"
                        type="radio"
                        name="halfDayType"
                        id="secondHalf"
                        value="second"
                        checked={leaveFormData.halfDayType === 'second'}
                        onChange={e => setLeaveFormData({ ...leaveFormData, halfDayType: e.target.value as 'first' | 'second' })}
                      />
                      <label className="" htmlFor="secondHalf">Second Half</label>
                    </div>
                  </div>
                </div>
              )}
              <div className="col-12">
                <button
                  type="button"
                  className={`btn popup-option-toggle ${leaveFormData.isRecurring ? 'popup-option-toggle--active' : ' btn-default'}`}
                  onClick={() => setLeaveFormData({ ...leaveFormData, isRecurring: !leaveFormData.isRecurring })}
                  aria-pressed={leaveFormData.isRecurring}
                >
                  Recurrence
                </button>
              </div>
              {leaveFormData.isRecurring && (
                <>
                  {/* Recurrence Pattern Selection */}
                  <div className="col-12">
                    <label className="form-label">Recurrence Pattern</label>
                    <div className="d-flex gap-2">
                      {(['Daily', 'Weekly', 'Monthly', 'Yearly'] as const).map(freq => (
                        <div key={freq} className="SpfxCheckRadio">
                          <input
                            className="radio"
                            type="radio"
                            name="recurringFrequency"
                            id={`freq${freq}`}
                            value={freq}
                            checked={leaveFormData.recurringFrequency === freq}
                            onChange={e => setLeaveFormData({ ...leaveFormData, recurringFrequency: e.target.value as typeof freq })}
                          />
                          <label className="" htmlFor={`freq${freq}`}>{freq}</label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pattern-specific options */}
                  <div className="col-12">
                    <label className="form-label text-primary">Pattern</label>

                    {/* Daily Pattern */}
                    {leaveFormData.recurringFrequency === 'Daily' && (
                      <div className="border rounded p-2">
                        <div className="SpfxCheckRadio mb-2">
                          <input className="radio" type="radio" name="dailyPattern" id="dailyEvery" checked={!leaveFormData.dailyWeekdaysOnly} onChange={() => setLeaveFormData({ ...leaveFormData, dailyWeekdaysOnly: false })} />
                          <label className="" htmlFor="dailyEvery">
                            every <input type="number" className="form-control form-control-sm d-inline-block mx-1" style={{ width: '60px' }} min="1" value={leaveFormData.dailyInterval} onChange={e => setLeaveFormData({ ...leaveFormData, dailyInterval: parseInt(e.target.value) || 1 })} /> days
                          </label>
                        </div>
                        <div className="SpfxCheckRadio">
                          <input className="radio" type="radio" name="dailyPattern" id="dailyWeekdays" checked={leaveFormData.dailyWeekdaysOnly} onChange={() => setLeaveFormData({ ...leaveFormData, dailyWeekdaysOnly: true })} />
                          <label className="" htmlFor="dailyWeekdays">every weekdays</label>
                        </div>
                      </div>
                    )}

                    {/* Weekly Pattern */}
                    {leaveFormData.recurringFrequency === 'Weekly' && (
                      <div className="border rounded p-2">
                        <div className="mb-2">
                          every <input type="number" className="form-control form-control-sm d-inline-block mx-1" style={{ width: '60px' }} min="1" value={leaveFormData.weeklyInterval} onChange={e => setLeaveFormData({ ...leaveFormData, weeklyInterval: parseInt(e.target.value) || 1 })} /> week(s) on
                        </div>
                        <div className="d-flex flex-wrap gap-1">
                          {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                            <div key={day} className="form-check form-check-inline">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id={`day${day}`}
                                checked={leaveFormData.weeklyDays.indexOf(day) !== -1}
                                onChange={e => {
                                  const days = e.target.checked
                                    ? [...leaveFormData.weeklyDays, day]
                                    : leaveFormData.weeklyDays.filter(d => d !== day);
                                  setLeaveFormData({ ...leaveFormData, weeklyDays: days });
                                }}
                              />
                              <label className="form-check-label" htmlFor={`day${day}`}>{day.slice(0, 3)}</label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Monthly Pattern */}
                    {leaveFormData.recurringFrequency === 'Monthly' && (
                      <div className="border rounded p-2">
                        <div className="SpfxCheckRadio mb-2">
                          <input className="radio" type="radio" name="monthlyPattern" id="monthlyDay" checked={leaveFormData.monthlyPattern === 'day'} onChange={() => setLeaveFormData({ ...leaveFormData, monthlyPattern: 'day' })} />
                          <label className="" htmlFor="monthlyDay">
                            Day <input type="number" className="form-control form-control-sm d-inline-block mx-1" style={{ width: '60px' }} min="1" max="31" value={leaveFormData.monthlyDay} onChange={e => setLeaveFormData({ ...leaveFormData, monthlyDay: parseInt(e.target.value) || 1 })} /> of every <input type="number" className="form-control form-control-sm d-inline-block mx-1" style={{ width: '60px' }} min="1" value={leaveFormData.monthlyInterval} onChange={e => setLeaveFormData({ ...leaveFormData, monthlyInterval: parseInt(e.target.value) || 1 })} /> month(s)
                          </label>
                        </div>
                        <div className="SpfxCheckRadio">
                          <input className="form-check-input" type="radio" name="monthlyPattern" id="monthlyThe" checked={leaveFormData.monthlyPattern === 'the'} onChange={() => setLeaveFormData({ ...leaveFormData, monthlyPattern: 'the' })} />
                          <label className="form-check-label" htmlFor="monthlyThe">
                            the <select className="form-select form-select-sm d-inline-block mx-1" style={{ width: 'auto' }} value={leaveFormData.monthlyWeekNumber} onChange={e => setLeaveFormData({ ...leaveFormData, monthlyWeekNumber: e.target.value as any })}>
                              <option value="first">first</option>
                              <option value="second">second</option>
                              <option value="third">third</option>
                              <option value="fourth">fourth</option>
                              <option value="last">last</option>
                            </select> <select className="form-select form-select-sm d-inline-block mx-1" style={{ width: 'auto' }} value={leaveFormData.monthlyWeekDay} onChange={e => setLeaveFormData({ ...leaveFormData, monthlyWeekDay: e.target.value })}>
                              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => <option key={d} value={d}>{d}</option>)}
                            </select> of every <input type="number" className="form-control form-control-sm d-inline-block mx-1" style={{ width: '60px' }} min="1" value={leaveFormData.monthlyIntervalThe} onChange={e => setLeaveFormData({ ...leaveFormData, monthlyIntervalThe: parseInt(e.target.value) || 1 })} /> month(s)
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Yearly Pattern */}
                    {leaveFormData.recurringFrequency === 'Yearly' && (
                      <div className="border rounded p-2">
                        <div className="SpfxCheckRadio mb-2">
                          <input className="radio" type="radio" name="yearlyPattern" id="yearlyEvery" checked={leaveFormData.yearlyPattern === 'every'} onChange={() => setLeaveFormData({ ...leaveFormData, yearlyPattern: 'every' })} />
                          <label className="" htmlFor="yearlyEvery">
                            every <select className="form-select form-select-sm d-inline-block mx-1" style={{ width: 'auto' }} value={leaveFormData.yearlyMonth} onChange={e => setLeaveFormData({ ...leaveFormData, yearlyMonth: e.target.value })}>
                              {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => <option key={m} value={m}>{m}</option>)}
                            </select> <input type="number" className="form-control form-control-sm d-inline-block mx-1" style={{ width: '60px' }} min="1" value={leaveFormData.yearlyInterval} onChange={e => setLeaveFormData({ ...leaveFormData, yearlyInterval: parseInt(e.target.value) || 1 })} />
                          </label>
                        </div>
                        <div className="SpfxCheckRadio">
                          <input className="radio" type="radio" name="yearlyPattern" id="yearlyThe" checked={leaveFormData.yearlyPattern === 'the'} onChange={() => setLeaveFormData({ ...leaveFormData, yearlyPattern: 'the' })} />
                          <label className="" htmlFor="yearlyThe">
                            the <select className="form-select form-select-sm d-inline-block mx-1" style={{ width: 'auto' }} value={leaveFormData.yearlyWeekNumber} onChange={e => setLeaveFormData({ ...leaveFormData, yearlyWeekNumber: e.target.value as any })}>
                              <option value="first">first</option>
                              <option value="second">second</option>
                              <option value="third">third</option>
                              <option value="fourth">fourth</option>
                              <option value="last">last</option>
                            </select> <select className="form-select form-select-sm d-inline-block mx-1" style={{ width: 'auto' }} value={leaveFormData.yearlyWeekDay} onChange={e => setLeaveFormData({ ...leaveFormData, yearlyWeekDay: e.target.value })}>
                              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => <option key={d} value={d}>{d}</option>)}
                            </select> of <select className="form-select form-select-sm d-inline-block mx-1" style={{ width: 'auto' }} value={leaveFormData.yearlyMonthThe} onChange={e => setLeaveFormData({ ...leaveFormData, yearlyMonthThe: e.target.value })}>
                              {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Date Range */}
                  <div className="col-12">
                    <label className="form-label">Date Range</label>
                    <div className="border rounded p-2">
                      <div className="mb-2">
                        <label className="form-label mb-1">Start Date</label>
                        <input type="date" className="form-control form-control-sm" value={leaveFormData.startDate} onChange={e => setLeaveFormData({ ...leaveFormData, startDate: e.target.value })} required />
                      </div>
                      <div className="SpfxCheckRadio mb-2">
                        <input className="radio" type="radio" name="endDateOption" id="noEnd" checked={leaveFormData.endDateOption === 'noEnd'} onChange={() => setLeaveFormData({ ...leaveFormData, endDateOption: 'noEnd' })} />
                        <label className="" htmlFor="noEnd">no end date</label>
                      </div>
                      <div className="SpfxCheckRadio mb-2">
                        <input className="radio" type="radio" name="endDateOption" id="endBy" checked={leaveFormData.endDateOption === 'endBy'} onChange={() => setLeaveFormData({ ...leaveFormData, endDateOption: 'endBy' })} />
                        <label className="" htmlFor="endBy">
                          end by <input type="date" className="form-control form-control-sm d-inline-block mx-1" style={{ width: '150px' }} value={leaveFormData.recurrenceEndDate} onChange={e => setLeaveFormData({ ...leaveFormData, recurrenceEndDate: e.target.value })} disabled={leaveFormData.endDateOption !== 'endBy'} />
                        </label>
                      </div>
                      <div className="SpfxCheckRadio">
                        <input className="radio" type="radio" name="endDateOption" id="endAfter" checked={leaveFormData.endDateOption === 'endAfter'} onChange={() => setLeaveFormData({ ...leaveFormData, endDateOption: 'endAfter' })} />
                        <label className="" htmlFor="endAfter">
                          end after <input type="number" className="form-control form-control-sm d-inline-block mx-1" style={{ width: '60px' }} min="1" value={leaveFormData.recurrenceOccurrences} onChange={e => setLeaveFormData({ ...leaveFormData, recurrenceOccurrences: parseInt(e.target.value) || 1 })} disabled={leaveFormData.endDateOption !== 'endAfter'} /> occurrences
                        </label>
                      </div>
                    </div>
                  </div>
                </>
              )}
              <div className="col-12"><label className="form-label">Reason</label><textarea className="form-control" rows={4} value={leaveFormData.reason} onChange={e => setLeaveFormData({ ...leaveFormData, reason: e.target.value })} required></textarea></div>
            </div>
          ) : (
            <div className="row g-3">
              {role === UserRole.HR && (
                <div className="col-12">
                  <label className="form-label">Employee</label>
                  <div className="position-relative">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Search by name, ID, email or department..."
                      value={leaveEmployeeSearch}
                      onChange={(e) => {
                        setLeaveEmployeeSearch(e.target.value);
                        setIsLeaveEmployeeDropdownOpen(true);
                        if (selectedEmployeeForLeave) setSelectedEmployeeForLeave(null);
                      }}
                      onFocus={() => setIsLeaveEmployeeDropdownOpen(true)}
                      required={!selectedEmployeeForLeave}
                    />
                    {isLeaveEmployeeDropdownOpen && filteredLeaveEmployees.length > 0 && (
                      <div
                        className="position-absolute w-100 bg-white border rounded shadow-lg overflow-auto"
                        style={{ zIndex: 1050, maxHeight: '220px', top: '100%', marginTop: '2px' }}
                      >
                        {filteredLeaveEmployees.map((emp) => (
                          <button
                            key={`wfh-${emp.id}`}
                            type="button"
                            className={`btn btn-light w-100 text-start d-flex align-items-center gap-2 px-3 py-2 border-0 border-bottom ${selectedEmployeeForLeave?.id === emp.id ? 'bg-primary bg-opacity-10' : ''}`}
                            onClick={() => {
                              setSelectedEmployeeForLeave(emp);
                              setLeaveEmployeeSearch(`${emp.name} (${emp.id}) - ${emp.department}`);
                              setIsLeaveEmployeeDropdownOpen(false);
                            }}
                          >
                            <img src={emp.avatar} alt={emp.name} width="30" height="30" className="rounded-circle border" style={{ objectFit: 'cover' }} />
                            <div style={{ lineHeight: '1.2' }}>
                              <div className="fw-medium text-dark" style={{ fontSize: '13px' }}>{emp.name}</div>
                              <div className="text-muted" style={{ fontSize: '11px' }}>ID: {emp.id} • {emp.department}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="col-12">
                <label className="form-label">Work From Home Type</label>
                <select
                  className="form-select"
                  value={workFromHomeFormData.workFromHomeType}
                  onChange={e => setWorkFromHomeFormData({ ...workFromHomeFormData, workFromHomeType: e.target.value })}
                  required
                >
                  {workFromHomeTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Start Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={workFromHomeFormData.startDate}
                  onChange={e => setWorkFromHomeFormData({ ...workFromHomeFormData, startDate: e.target.value })}
                  required
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">End Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={workFromHomeFormData.endDate}
                  onChange={e => setWorkFromHomeFormData({ ...workFromHomeFormData, endDate: e.target.value })}
                  required
                  disabled={workFromHomeFormData.isHalfDay}
                />
              </div>
              <div className="col-12">
                <button
                  type="button"
                  className={`btn popup-option-toggle ${workFromHomeFormData.isHalfDay ? 'popup-option-toggle--active' : ' btn-default'}`}
                  onClick={() => setWorkFromHomeFormData({ ...workFromHomeFormData, isHalfDay: !workFromHomeFormData.isHalfDay })}
                  aria-pressed={workFromHomeFormData.isHalfDay}
                >
                  Request Half Day
                </button>
              </div>
              {workFromHomeFormData.isHalfDay && (
                <div className="col-12">
                  <label className="form-label">Half Day Type</label>
                  <div className="d-flex gap-3">
                    <div className="SpfxCheckRadio">
                      <input
                        className="radio"
                        type="radio"
                        name="wfhHalfDayType"
                        id="wfhFirstHalf"
                        value="first"
                        checked={workFromHomeFormData.halfDayType === 'first'}
                        onChange={e => setWorkFromHomeFormData({ ...workFromHomeFormData, halfDayType: e.target.value as 'first' | 'second' })}
                      />
                      <label className="" htmlFor="wfhFirstHalf">First Half</label>
                    </div>
                    <div className="SpfxCheckRadio">
                      <input
                        className="radio"
                        type="radio"
                        name="wfhHalfDayType"
                        id="wfhSecondHalf"
                        value="second"
                        checked={workFromHomeFormData.halfDayType === 'second'}
                        onChange={e => setWorkFromHomeFormData({ ...workFromHomeFormData, halfDayType: e.target.value as 'first' | 'second' })}
                      />
                      <label className="" htmlFor="wfhSecondHalf">Second Half</label>
                    </div>
                  </div>
                </div>
              )}
              <div className="col-12">
                <button
                  type="button"
                  className={`btn popup-option-toggle ${workFromHomeFormData.isRecurring ? 'popup-option-toggle--active' : ' btn-default'}`}
                  onClick={() => setWorkFromHomeFormData({ ...workFromHomeFormData, isRecurring: !workFromHomeFormData.isRecurring })}
                  aria-pressed={workFromHomeFormData.isRecurring}
                >
                  Recurrence
                </button>
              </div>
              {workFromHomeFormData.isRecurring && (
                <>
                  <div className="col-12">
                    <label className="form-label">Recurrence Pattern</label>
                    <div className="d-flex gap-2">
                      {(['Daily', 'Weekly', 'Monthly', 'Yearly'] as const).map(freq => (
                        <div key={freq} className="SpfxCheckRadio">
                          <input
                            className="radio"
                            type="radio"
                            name="wfhRecurringFrequency"
                            id={`wfhFreq${freq}`}
                            value={freq}
                            checked={workFromHomeFormData.recurringFrequency === freq}
                            onChange={e => setWorkFromHomeFormData({ ...workFromHomeFormData, recurringFrequency: e.target.value as typeof freq })}
                          />
                          <label className="" htmlFor={`wfhFreq${freq}`}>{freq}</label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="col-12">
                    <label className="form-label text-primary">Pattern</label>
                    {workFromHomeFormData.recurringFrequency === 'Daily' && (
                      <div className="border rounded p-2">
                        <div className="SpfxCheckRadio mb-2">
                          <input className="radio" type="radio" name="wfhDailyPattern" id="wfhDailyEvery" checked={!workFromHomeFormData.dailyWeekdaysOnly} onChange={() => setWorkFromHomeFormData({ ...workFromHomeFormData, dailyWeekdaysOnly: false })} />
                          <label className="" htmlFor="wfhDailyEvery">
                            every <input type="number" className="form-control form-control-sm d-inline-block mx-1" style={{ width: '60px' }} min="1" value={workFromHomeFormData.dailyInterval} onChange={e => setWorkFromHomeFormData({ ...workFromHomeFormData, dailyInterval: parseInt(e.target.value) || 1 })} /> days
                          </label>
                        </div>
                        <div className="SpfxCheckRadio">
                          <input className="radio" type="radio" name="wfhDailyPattern" id="wfhDailyWeekdays" checked={workFromHomeFormData.dailyWeekdaysOnly} onChange={() => setWorkFromHomeFormData({ ...workFromHomeFormData, dailyWeekdaysOnly: true })} />
                          <label className="" htmlFor="wfhDailyWeekdays">every weekdays</label>
                        </div>
                      </div>
                    )}
                    {workFromHomeFormData.recurringFrequency === 'Weekly' && (
                      <div className="border rounded p-2">
                        <div className="mb-2">
                          every <input type="number" className="form-control form-control-sm d-inline-block mx-1" style={{ width: '60px' }} min="1" value={workFromHomeFormData.weeklyInterval} onChange={e => setWorkFromHomeFormData({ ...workFromHomeFormData, weeklyInterval: parseInt(e.target.value) || 1 })} /> week(s) on
                        </div>
                        <div className="d-flex flex-wrap gap-1">
                          {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                            <div key={day} className="form-check form-check-inline">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id={`wfhDay${day}`}
                                checked={workFromHomeFormData.weeklyDays.indexOf(day) !== -1}
                                onChange={e => {
                                  const days = e.target.checked
                                    ? [...workFromHomeFormData.weeklyDays, day]
                                    : workFromHomeFormData.weeklyDays.filter(d => d !== day);
                                  setWorkFromHomeFormData({ ...workFromHomeFormData, weeklyDays: days });
                                }}
                              />
                              <label className="form-check-label" htmlFor={`wfhDay${day}`}>{day.slice(0, 3)}</label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {workFromHomeFormData.recurringFrequency === 'Monthly' && (
                      <div className="border rounded p-2">
                        <div className="SpfxCheckRadio mb-2">
                          <input className="radio" type="radio" name="wfhMonthlyPattern" id="wfhMonthlyDay" checked={workFromHomeFormData.monthlyPattern === 'day'} onChange={() => setWorkFromHomeFormData({ ...workFromHomeFormData, monthlyPattern: 'day' })} />
                          <label className="" htmlFor="wfhMonthlyDay">
                            Day <input type="number" className="form-control form-control-sm d-inline-block mx-1" style={{ width: '60px' }} min="1" max="31" value={workFromHomeFormData.monthlyDay} onChange={e => setWorkFromHomeFormData({ ...workFromHomeFormData, monthlyDay: parseInt(e.target.value) || 1 })} /> of every <input type="number" className="form-control form-control-sm d-inline-block mx-1" style={{ width: '60px' }} min="1" value={workFromHomeFormData.monthlyInterval} onChange={e => setWorkFromHomeFormData({ ...workFromHomeFormData, monthlyInterval: parseInt(e.target.value) || 1 })} /> month(s)
                          </label>
                        </div>
                        <div className="SpfxCheckRadio">
                          <input className="radio" type="radio" name="wfhMonthlyPattern" id="wfhMonthlyThe" checked={workFromHomeFormData.monthlyPattern === 'the'} onChange={() => setWorkFromHomeFormData({ ...workFromHomeFormData, monthlyPattern: 'the' })} />
                          <label className="" htmlFor="wfhMonthlyThe">
                            the <select className="form-select form-select-sm d-inline-block mx-1" style={{ width: 'auto' }} value={workFromHomeFormData.monthlyWeekNumber} onChange={e => setWorkFromHomeFormData({ ...workFromHomeFormData, monthlyWeekNumber: e.target.value as any })}>
                              <option value="first">first</option>
                              <option value="second">second</option>
                              <option value="third">third</option>
                              <option value="fourth">fourth</option>
                              <option value="last">last</option>
                            </select> <select className="form-select form-select-sm d-inline-block mx-1" style={{ width: 'auto' }} value={workFromHomeFormData.monthlyWeekDay} onChange={e => setWorkFromHomeFormData({ ...workFromHomeFormData, monthlyWeekDay: e.target.value })}>
                              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => <option key={d} value={d}>{d}</option>)}
                            </select> of every <input type="number" className="form-control form-control-sm d-inline-block mx-1" style={{ width: '60px' }} min="1" value={workFromHomeFormData.monthlyIntervalThe} onChange={e => setWorkFromHomeFormData({ ...workFromHomeFormData, monthlyIntervalThe: parseInt(e.target.value) || 1 })} /> month(s)
                          </label>
                        </div>
                      </div>
                    )}
                    {workFromHomeFormData.recurringFrequency === 'Yearly' && (
                      <div className="border rounded p-2">
                        <div className="SpfxCheckRadio mb-2">
                          <input className="radio" type="radio" name="wfhYearlyPattern" id="wfhYearlyEvery" checked={workFromHomeFormData.yearlyPattern === 'every'} onChange={() => setWorkFromHomeFormData({ ...workFromHomeFormData, yearlyPattern: 'every' })} />
                          <label className="" htmlFor="wfhYearlyEvery">
                            every <select className="form-select form-select-sm d-inline-block mx-1" style={{ width: 'auto' }} value={workFromHomeFormData.yearlyMonth} onChange={e => setWorkFromHomeFormData({ ...workFromHomeFormData, yearlyMonth: e.target.value })}>
                              {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => <option key={m} value={m}>{m}</option>)}
                            </select> <input type="number" className="form-control form-control-sm d-inline-block mx-1" style={{ width: '60px' }} min="1" value={workFromHomeFormData.yearlyInterval} onChange={e => setWorkFromHomeFormData({ ...workFromHomeFormData, yearlyInterval: parseInt(e.target.value) || 1 })} />
                          </label>
                        </div>
                        <div className="SpfxCheckRadio">
                          <input className="radio" type="radio" name="wfhYearlyPattern" id="wfhYearlyThe" checked={workFromHomeFormData.yearlyPattern === 'the'} onChange={() => setWorkFromHomeFormData({ ...workFromHomeFormData, yearlyPattern: 'the' })} />
                          <label className="" htmlFor="wfhYearlyThe">
                            the <select className="form-select form-select-sm d-inline-block mx-1" style={{ width: 'auto' }} value={workFromHomeFormData.yearlyWeekNumber} onChange={e => setWorkFromHomeFormData({ ...workFromHomeFormData, yearlyWeekNumber: e.target.value as any })}>
                              <option value="first">first</option>
                              <option value="second">second</option>
                              <option value="third">third</option>
                              <option value="fourth">fourth</option>
                              <option value="last">last</option>
                            </select> <select className="form-select form-select-sm d-inline-block mx-1" style={{ width: 'auto' }} value={workFromHomeFormData.yearlyWeekDay} onChange={e => setWorkFromHomeFormData({ ...workFromHomeFormData, yearlyWeekDay: e.target.value })}>
                              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => <option key={d} value={d}>{d}</option>)}
                            </select> of <select className="form-select form-select-sm d-inline-block mx-1" style={{ width: 'auto' }} value={workFromHomeFormData.yearlyMonthThe} onChange={e => setWorkFromHomeFormData({ ...workFromHomeFormData, yearlyMonthThe: e.target.value })}>
                              {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="col-12">
                    <label className="form-label text-primary">Range of recurrence</label>
                    <div className="border rounded p-2">
                      <div className="SpfxCheckRadio mb-2">
                        <input className="radio" type="radio" name="wfhEndDateOption" id="wfhNoEnd" checked={workFromHomeFormData.endDateOption === 'noEnd'} onChange={() => setWorkFromHomeFormData({ ...workFromHomeFormData, endDateOption: 'noEnd' })} />
                        <label className="" htmlFor="wfhNoEnd">no end date</label>
                      </div>
                      <div className="SpfxCheckRadio mb-2">
                        <input className="radio" type="radio" name="wfhEndDateOption" id="wfhEndBy" checked={workFromHomeFormData.endDateOption === 'endBy'} onChange={() => setWorkFromHomeFormData({ ...workFromHomeFormData, endDateOption: 'endBy' })} />
                        <label className="" htmlFor="wfhEndBy">
                          end by <input type="date" className="form-control form-control-sm d-inline-block mx-1" style={{ width: '130px' }} value={workFromHomeFormData.recurrenceEndDate} onChange={e => setWorkFromHomeFormData({ ...workFromHomeFormData, recurrenceEndDate: e.target.value })} disabled={workFromHomeFormData.endDateOption !== 'endBy'} />
                        </label>
                      </div>
                      <div className="SpfxCheckRadio">
                        <input className="radio" type="radio" name="wfhEndDateOption" id="wfhEndAfter" checked={workFromHomeFormData.endDateOption === 'endAfter'} onChange={() => setWorkFromHomeFormData({ ...workFromHomeFormData, endDateOption: 'endAfter' })} />
                        <label className="" htmlFor="wfhEndAfter">
                          end after <input type="number" className="form-control form-control-sm d-inline-block mx-1" style={{ width: '60px' }} min="1" value={workFromHomeFormData.recurrenceOccurrences} onChange={e => setWorkFromHomeFormData({ ...workFromHomeFormData, recurrenceOccurrences: parseInt(e.target.value) || 1 })} disabled={workFromHomeFormData.endDateOption !== 'endAfter'} /> occurrences
                        </label>
                      </div>
                    </div>
                  </div>
                </>
              )}
              <div className="col-12">
                <label className="form-label">Reason</label>
                <textarea
                  className="form-control"
                  rows={4}
                  value={workFromHomeFormData.reason}
                  onChange={e => setWorkFromHomeFormData({ ...workFromHomeFormData, reason: e.target.value })}
                  required
                />
              </div>
            </div>
          )}
        </form>
      </Modal>

      <Modal
        isOpen={isSalaryModalOpen}
        onClose={() => setIsSalaryModalOpen(false)}
        title="Upload Salary Slip"
        size="lg"
        scrollable={false}
        footer={
          <>
            {/* <button className="btn btn-outline-secondary d-flex align-items-center gap-2 shadow-sm" onClick={() => window.print()}>
              <Plus size={16} /> Print Salary Slip
            </button> */}
            <div className="flex-grow-1"></div>
            <button className="btn btn-link link-secondary text-decoration-none" onClick={() => setIsSalaryModalOpen(false)}>Cancel</button>
            <button type="submit" form="salary-upload-form" className="btn btn-primary px-4 shadow-sm">Upload Slip</button>
          </>
        }
      >
        <form id="salary-upload-form" onSubmit={saveSalarySlip}>
          <div className="row g-3">
            {/* Employee Information Section - Dense box */}
            <div className="col-12">
              <div className="p-3 rounded border bg-light shadow-xs mb-1">
                <div className="fw-bold color-primary d-flex align-items-center gap-2 mb-2 small text-uppercase">
                  Employee Information
                </div>
                <div className="row g-2">
                  <div className="col-md-3">
                    <div className="small text-muted">Employee Name</div>
                    {isSalaryManualMode ? (
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={targetEmployee?.name || ''}
                        onChange={(e) => setTargetEmployee((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                        placeholder="Employee name"
                      />
                    ) : (
                      <div className="fw-semibold text-dark">{targetEmployee?.name || 'N/A'}</div>
                    )}
                  </div>
                  <div className="col-md-3">
                    <div className="small text-muted">Employee ID</div>
                    {isSalaryManualMode ? (
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={targetEmployee?.id || ''}
                        onChange={(e) => setTargetEmployee((prev) => (prev ? { ...prev, id: e.target.value } : prev))}
                        placeholder="Employee ID"
                      />
                    ) : (
                      <div className="fw-semibold text-dark">{targetEmployee?.id || 'N/A'}</div>
                    )}
                  </div>
                  <div className="col-md-3">
                    <div className="small text-muted">Department</div>
                    {isSalaryManualMode ? (
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={targetEmployee?.department || ''}
                        onChange={(e) => setTargetEmployee((prev) => (prev ? { ...prev, department: e.target.value } : prev))}
                        placeholder="Department"
                      />
                    ) : (
                      <div className="fw-semibold text-dark">{targetEmployee?.department || 'N/A'}</div>
                    )}
                  </div>
                  <div className="col-md-3">
                    <div className="small text-muted">Designation</div>
                    {isSalaryManualMode ? (
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={targetEmployee?.position || ''}
                        onChange={(e) => setTargetEmployee((prev) => (prev ? { ...prev, position: e.target.value } : prev))}
                        placeholder="Designation"
                      />
                    ) : (
                      <div className="fw-semibold text-dark">{targetEmployee?.position || 'N/A'}</div>
                    )}
                  </div>
                  <div className="col-md-3">
                    <div className="small text-muted">UAN</div>
                    <div className="fw-semibold text-dark">{salaryFormData.uan || targetEmployee?.uan || 'N/A'}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Hidden Print Template */}
            <div className="d-none">
              {targetEmployee && (
                <SalarySlipView
                  employee={targetEmployee}
                  formData={salaryFormData}
                />
              )}
            </div>

            {/* Date & Period Section */}
            <div className="col-md-3">
              <label className="form-label small text-muted text-uppercase mb-1">Month</label>
              <select
                className="form-select"
                value={salaryFormData.month}
                disabled={!isSalaryManualMode}
                onChange={e => {
                  const nextMonth = e.target.value;
                  const selectedYear = Number(salaryFormData.year) || getNowIST().getFullYear();
                  const nextWorkingDays = getDaysInMonth(nextMonth, selectedYear);
                  const nextPaidDays = Math.min(Math.max(0, salaryFormData.paidDays || nextWorkingDays), nextWorkingDays);
                  setSalaryFormData({
                    ...salaryFormData,
                    month: nextMonth,
                    workingDays: nextWorkingDays,
                    paidDays: nextPaidDays
                  });
                  applySalaryFromYearlyCtc(
                    salaryYearlyCtc,
                    nextPaidDays,
                    salaryFormData.year,
                    undefined,
                    nextWorkingDays
                  );
                }}
              >
                {MONTH_NAMES.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label small text-muted text-uppercase mb-1">Year</label>
              <select
                className="form-select"
                value={salaryFormData.year}
                disabled={!isSalaryManualMode}
                onChange={e => {
                  const nextYear = e.target.value;
                  const parsedYear = Number(nextYear) || getNowIST().getFullYear();
                  const nextWorkingDays = getDaysInMonth(salaryFormData.month, parsedYear);
                  const nextPaidDays = Math.min(Math.max(0, salaryFormData.paidDays || nextWorkingDays), nextWorkingDays);
                  setSalaryFormData({
                    ...salaryFormData,
                    year: nextYear,
                    workingDays: nextWorkingDays,
                    paidDays: nextPaidDays
                  });
                  applySalaryFromYearlyCtc(
                    salaryYearlyCtc,
                    nextPaidDays,
                    nextYear,
                    undefined,
                    nextWorkingDays
                  );
                }}
              >
                {[getNowIST().getFullYear() - 1, getNowIST().getFullYear(), getNowIST().getFullYear() + 1].map((year) => (
                  <option key={year} value={String(year)}>{year}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label small text-muted text-uppercase mb-1">Working Days</label>
              <input
                type="number"
                className="form-control"
                value={salaryFormData.workingDays}
                readOnly={!isSalaryManualMode}
                onChange={e => {
                  const nextWorkingDays = Math.max(0, Number(e.target.value) || 0);
                  const nextPaidDays = Math.min(salaryFormData.paidDays, nextWorkingDays);
                  setSalaryFormData({ ...salaryFormData, workingDays: nextWorkingDays, paidDays: nextPaidDays });
                  applySalaryFromYearlyCtc(
                    salaryYearlyCtc,
                    nextPaidDays,
                    salaryFormData.year,
                    undefined,
                    nextWorkingDays
                  );
                }}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label small text-muted text-uppercase mb-1">Paid Days</label>
              <input
                type="number"
                className="form-control"
                value={salaryFormData.paidDays}
                readOnly={!isSalaryManualMode}
                onChange={e => {
                  const enteredPaidDays = Math.max(0, Number(e.target.value) || 0);
                  const nextPaidDays = Math.min(enteredPaidDays, salaryFormData.workingDays);
                  setSalaryFormData({ ...salaryFormData, paidDays: nextPaidDays });
                  applySalaryFromYearlyCtc(
                    salaryYearlyCtc,
                    nextPaidDays,
                    salaryFormData.year,
                    undefined,
                    salaryFormData.workingDays
                  );
                }}
              />
            </div>

            {/* CTC & Manual Toggle Row */}
            <div className="col-md-8">
              <label className="form-label small text-muted text-uppercase mb-1">Yearly CTC (₹)</label>
              <input
                type="number"
                min="0"
                className="form-control"
                value={salaryYearlyCtc}
                readOnly={!isSalaryManualMode}
                onChange={(e) => {
                  const value = e.target.value;
                  setSalaryYearlyCtc(value);
                  applySalaryFromYearlyCtc(
                    value,
                    salaryFormData.paidDays,
                    salaryFormData.year,
                    undefined,
                    salaryFormData.workingDays
                  );
                }}
                required
              />
            </div>
            <div className="col-md-4 d-flex align-items-end pb-2">
              <button
                type="button"
                className={`btn popup-option-toggle ${isSalaryManualMode ? 'popup-option-toggle--active' : ' btn-default'}`}
                onClick={() => setIsSalaryManualMode(!isSalaryManualMode)}
                aria-pressed={isSalaryManualMode}
              >
                {isSalaryManualMode ? 'Manual Edit: ON' : 'Manual Edit: OFF'}
              </button>
            </div>

            <div className="col-12 mt-2">
              <div className="row row-cols-1 row-cols-md-2 g-3">
                {/* Monthly CTC */}
                <div className="col">
                  <label className="form-label small fw-bold text-muted mb-1">Monthly CTC (₹)</label>
                  <input
                    type="number"
                    className={`form-control ${!isSalaryManualMode ? 'bg-light border-light-subtle' : ''}`}
                    value={salaryFormData.monthlyCtc}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setSalaryFormData(prev => ({
                        ...prev,
                        monthlyCtc: val
                      }));
                    }}
                    readOnly={!isSalaryManualMode}
                  />
                </div>
                {/* Basic Pay */}
                <div className="col">
                  <label className="form-label small fw-bold text-muted mb-1">Basic Pay (₹)</label>
                  <input
                    type="number"
                    className={`form-control ${!isSalaryManualMode ? 'bg-light border-light-subtle' : ''}`}
                    value={salaryFormData.basic}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setSalaryFormData(prev => ({
                        ...prev,
                        basic: val,
                        gross: val + prev.hra + prev.allowances,
                        inhand: (val + prev.hra + prev.allowances) - prev.deductions
                      }));
                    }}
                    readOnly={!isSalaryManualMode}
                  />
                </div>
                {/* HRA */}
                <div className="col">
                  <label className="form-label small text-muted mb-1">HRA (₹)</label>
                  <input
                    type="number"
                    className={`form-control ${!isSalaryManualMode ? 'bg-light border-light-subtle' : ''}`}
                    value={salaryFormData.hra}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setSalaryFormData(prev => ({
                        ...prev,
                        hra: val,
                        gross: prev.basic + val + prev.allowances,
                        inhand: (prev.basic + val + prev.allowances) - prev.deductions
                      }));
                    }}
                    readOnly={!isSalaryManualMode}
                  />
                </div>
                {/* Allowances */}
                <div className="col">
                  <label className="form-label small text-muted mb-1">Allowances (₹)</label>
                  <input
                    type="number"
                    className={`form-control ${!isSalaryManualMode ? 'bg-light border-light-subtle' : ''}`}
                    value={salaryFormData.allowances}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setSalaryFormData(prev => ({
                        ...prev,
                        allowances: val,
                        gross: prev.basic + prev.hra + val,
                        inhand: (prev.basic + prev.hra + val) - prev.deductions
                      }));
                    }}
                    readOnly={!isSalaryManualMode}
                  />
                </div>
                {/* Deductions */}
                <div className="col">
                  <label className="form-label small text-muted mb-1">Deductions (₹)</label>
                  <input
                    type="number"
                    className={`form-control ${!isSalaryManualMode ? 'bg-light border-light-subtle' : ''}`}
                    value={salaryFormData.deductions}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setSalaryFormData(prev => ({
                        ...prev,
                        deductions: val,
                        inhand: prev.gross - val
                      }));
                    }}
                    readOnly={!isSalaryManualMode}
                  />
                </div>
                {/* Gross */}
                <div className="col">
                  <label className="form-label small text-muted mb-1">Gross (₹)</label>
                  <input
                    type="number"
                    className={`form-control ${!isSalaryManualMode ? 'bg-light border-light-subtle' : ''}`}
                    value={salaryFormData.gross}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setSalaryFormData(prev => ({
                        ...prev,
                        gross: val,
                        inhand: Math.max(0, val - (prev.deductions || 0))
                      }));
                    }}
                    readOnly={!isSalaryManualMode}
                  />
                </div>
                {/* Employer PF */}
                <div className="col">
                  <label className="form-label small text-muted mb-1">Employer PF (₹)</label>
                  <input
                    type="number"
                    className={`form-control ${!isSalaryManualMode ? 'bg-light border-light-subtle' : ''}`}
                    value={salaryFormData.employerPF}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setSalaryFormData(prev => {
                        const gross = Math.max(0, prev.monthlyCtc - val - prev.bonus - prev.insurance);
                        const allowances = gross - prev.basic - prev.hra;
                        const deductions = prev.employeePF + prev.esi;
                        return {
                          ...prev,
                          employerPF: val,
                          gross,
                          allowances,
                          deductions,
                          inhand: gross - deductions
                        };
                      });
                    }}
                    readOnly={!isSalaryManualMode}
                  />
                </div>
                {/* Employee PF */}
                <div className="col">
                  <label className="form-label small text-muted mb-1">Employee PF (₹)</label>
                  <input
                    type="number"
                    className={`form-control ${!isSalaryManualMode ? 'bg-light border-light-subtle' : ''}`}
                    value={salaryFormData.employeePF}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setSalaryFormData(prev => {
                        const deductions = val + prev.esi;
                        return {
                          ...prev,
                          employeePF: val,
                          deductions,
                          inhand: prev.gross - deductions
                        };
                      });
                    }}
                    readOnly={!isSalaryManualMode}
                  />
                </div>
                {/* Bonus */}
                <div className="col">
                  <label className="form-label small text-muted mb-1">Bonus (₹)</label>
                  <input
                    type="number"
                    className={`form-control ${!isSalaryManualMode ? 'bg-light border-light-subtle' : ''}`}
                    value={salaryFormData.bonus}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setSalaryFormData(prev => {
                        const gross = Math.max(0, prev.monthlyCtc - prev.employerPF - val - prev.insurance);
                        const allowances = gross - prev.basic - prev.hra;
                        const deductions = prev.employeePF + prev.esi;
                        return {
                          ...prev,
                          bonus: val,
                          gross,
                          allowances,
                          deductions,
                          inhand: gross - deductions
                        };
                      });
                    }}
                    readOnly={!isSalaryManualMode}
                  />
                </div>
                {/* ESI */}
                <div className="col">
                  <label className="form-label small text-muted mb-1">ESI (₹)</label>
                  <input
                    type="number"
                    className={`form-control ${!isSalaryManualMode ? 'bg-light border-light-subtle' : ''}`}
                    value={salaryFormData.esi}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setSalaryFormData(prev => {
                        const deductions = prev.employeePF + val;
                        return {
                          ...prev,
                          esi: val,
                          deductions,
                          inhand: prev.gross - deductions
                        };
                      });
                    }}
                    readOnly={!isSalaryManualMode}
                  />
                </div>
                {/* Employer ESI */}
                <div className="col">
                  <label className="form-label small text-muted mb-1">Employer ESI (₹)</label>
                  <input
                    type="number"
                    className={`form-control ${!isSalaryManualMode ? 'bg-light border-light-subtle' : ''}`}
                    value={salaryFormData.employerEsi}
                    onChange={(e) => setSalaryFormData({ ...salaryFormData, employerEsi: Number(e.target.value) || 0 })}
                    readOnly={!isSalaryManualMode}
                  />
                </div>
                {/* Insurance */}
                <div className="col">
                  <label className="form-label small text-muted mb-1">Insurance (₹)</label>
                  <input
                    type="number"
                    className={`form-control ${!isSalaryManualMode ? 'bg-light border-light-subtle' : ''}`}
                    value={salaryFormData.insurance}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setSalaryFormData(prev => {
                        const gross = Math.max(0, prev.monthlyCtc - prev.employerPF - prev.bonus - val);
                        const allowances = gross - prev.basic - prev.hra;
                        const deductions = prev.employeePF + prev.esi;
                        return {
                          ...prev,
                          insurance: val,
                          gross,
                          allowances,
                          deductions,
                          inhand: gross - deductions
                        };
                      });
                    }}
                    readOnly={!isSalaryManualMode}
                  />
                </div>
              </div>
            </div>

            <div className="col-12 mt-4 pt-3 border-top">
              <div className="d-flex justify-content-between align-items-center">
                <div className="fw-bold fs-4 text-dark">Total Net Pay</div>
                <div className="text-primary fw-bold fs-3">
                  ₹{salaryNetPay.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
          </div>
        </form>
      </Modal >

      <Modal isOpen={isBalanceModalOpen} onClose={() => setIsBalanceModalOpen(false)} title="Balance Summary" size="sm" scrollable={true}>
        {balanceEmployee && (
          <div>
            <div className="text-center mb-3">
              <div className="fw-bold text-primary">{balanceEmployee.name}</div>
              <div className="text-muted">Employee ID: {balanceEmployee.id}</div>
            </div>

            <div className="row g-2 mb-3">
              <div className="col-6">
                <div className="p-2 border rounded bg-light text-center h-100">
                  <div className="text-muted fw-semibold">Total Leaves Left</div>
                  <div className="h5 mb-0 text-primary fw-bold">{totalLeavesLeft}</div>
                </div>
              </div>
              <div className="col-6">
                <div className="p-2 border rounded bg-light text-center h-100">
                  <div className="text-muted fw-semibold">Total Leaves Taken</div>
                  <div className="h5 mb-0 text-primary fw-bold">{totalLeavesTaken}</div>
                </div>
              </div>
            </div>

            {balanceSummary.length === 0 && (
              <div className="text-muted small text-center">No unofficial leave quota configured.</div>
            )}

            <div className="d-flex flex-column gap-2">
              {(() => {
                const otherItem = balanceSummary.find(i => i.type === 'Other Leaves');
                const specialItems = balanceSummary.filter(i => i.isSpecial);
                const allLeaveTypes = Object.keys(leaveQuotas)
                  .filter(t => !t.toLowerCase().includes('maternity') && !t.toLowerCase().includes('paternity'));

                return (
                  <>
                    {/* Grouped Other Leaves with per-type breakdown */}
                    {otherItem && (
                      <div className="border rounded p-3">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="fw-bold text-dark" style={{ fontSize: '14px' }}>Other Leaves</span>
                          <span className="text-muted">{otherItem.used}/{otherItem.quota} used</span>
                        </div>
                        <div className="d-flex flex-column gap-1 ps-2 border-start border-2 mb-2">
                          {allLeaveTypes.map((type, idx) => {
                            const quota = getQuotaForLeaveType(type);
                            const used = balanceEmployee ? getUsedLeavesForEmployee(balanceEmployee.id, type) : 0;
                            return (
                              <div key={idx} className="d-flex justify-content-between align-items-center py-1">
                                <span className="text-muted" style={{ fontSize: '12px' }}>↳ {type}</span>
                                <span className="fw-medium text-dark" style={{ fontSize: '12px' }}>{used}/{quota} Days</span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="d-flex justify-content-between align-items-center border-top pt-2">
                          <span className="text-muted small fw-semibold">Leaves Left</span>
                          <span className="fw-bold text-primary" style={{ fontSize: '16px' }}>{otherItem.left}</span>
                        </div>
                      </div>
                    )}

                    {/* Special Leaves — only if taken */}
                    {specialItems.length > 0 && (
                      <>
                        <div className="small text-muted fw-bold text-uppercase px-1 mt-1" style={{ fontSize: '10px' }}>Special Leaves</div>
                        {specialItems.map((item, idx) => (
                          <div key={`special-${idx}`} className="border rounded p-3 bg-light">
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <span className="fw-bold text-dark" style={{ fontSize: '14px' }}>{item.type}</span>
                              <span className="text-muted small">{item.used}/{item.quota} used</span>
                            </div>
                            <div className="progress mb-2" style={{ height: '3px' }}>
                              <div className="progress-bar bg-primary" role="progressbar" style={{ width: `${(item.used / (item.quota || 1)) * 100}%` }} />
                            </div>
                            <div className="d-flex justify-content-between align-items-center">
                              <span className="text-muted small fw-semibold">Leaves Left</span>
                              <span className="fw-bold text-primary" style={{ fontSize: '16px' }}>{item.left}</span>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isEmployeeModalOpen}
        onClose={() => setIsEmployeeModalOpen(false)}
        title={editingEmployee ? "Edit Employee Details" : "Add New Employee"}
        size="lg"
        createdInfo={formatAuditInfo(editingEmployee?.createdAt, editingEmployee?.createdByName)}
        modifiedInfo={formatAuditInfo(editingEmployee?.modifiedAt, editingEmployee?.modifiedByName)}
        onVersionHistoryClick={() => { void handleOpenVersionHistory('Employee', 'EmployeeMaster', editingEmployee?.itemId); }}
        onOpenFormClick={() => { openOutOfBoxListItemForm(sp, 'EmployeeMaster', editingEmployee?.itemId).catch(() => undefined); }}
        footer={<><button className="btn btn-default" onClick={() => setIsEmployeeModalOpen(false)}>Cancel</button><button type="submit" form="employee-form" className="btn btn-primary">Save Employee</button></>}
      >
        <form id="employee-form" onSubmit={handleSaveEmployee}>
          <ul className="nav nav-tabs mb-3">
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${employeeModalTab === 'professional' ? 'active' : ''}`}
                onClick={() => setEmployeeModalTab('professional')}
              >
                Professional Details
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${employeeModalTab === 'banking' ? 'active' : ''}`}
                onClick={() => setEmployeeModalTab('banking')}
              >
                Banking Details
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${employeeModalTab === 'image' ? 'active' : ''}`}
                onClick={() => setEmployeeModalTab('image')}
              >
                Profile Image
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${employeeModalTab === 'salary' ? 'active' : ''}`}
                onClick={() => setEmployeeModalTab('salary')}
              >
                Salary Details
              </button>
            </li>
          </ul>
          <div className="row g-3">
            {employeeModalTab === 'professional' && (
              <>
                <h6 className="fw-bold color-primary border-bottom pb-2">Professional Details</h6>
                <div className="col-md-6">
                  <label className="form-label">Full Name</label>
                  <input type="text" className="form-control" value={employeeFormData.name} onChange={e => setEmployeeFormData({ ...employeeFormData, name: e.target.value })} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Employee ID</label>
                  <input type="text" className="form-control" value={employeeFormData.id} onChange={e => setEmployeeFormData({ ...employeeFormData, id: e.target.value })} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-control" value={employeeFormData.email} onChange={e => setEmployeeFormData({ ...employeeFormData, email: e.target.value })} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Department</label>
                  <select className="form-select" value={employeeFormData.department} onChange={e => setEmployeeFormData({ ...employeeFormData, department: e.target.value })} required>
                    <option value="">Select Department</option>
                    <option value="SPFx">SPFx</option>
                    <option value="Design">Design</option>
                    <option value="QA">QA</option>
                    <option value="HR">HR</option>
                    <option value="Finance">Finance</option>
                    <option value="Smalsus Lead">Smalsus Lead</option>
                    <option value="Portfolio Lead">Portfolio Lead</option>
                    <option value="Management">Management</option>
                    <option value="Trainee">Trainee</option>
                    <option value="Project Management Trainee">Project Management Trainee</option>
                    <option value="Intern">Intern</option>
                    <option value="User Experience">User Experience</option>
                    <option value="HHHH">HHHH</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Designation</label>
                  <input type="text" className="form-control" value={employeeFormData.position} onChange={e => setEmployeeFormData({ ...employeeFormData, position: e.target.value })} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Joining Date (DOJ)</label>
                  <input type="date" className="form-control" value={employeeFormData.joiningDate} onChange={e => setEmployeeFormData({ ...employeeFormData, joiningDate: e.target.value })} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Employee Status</label>
                  <select
                    className="form-select"
                    value={employeeFormData.employeeStatus || 'Active Employee'}
                    onChange={e => setEmployeeFormData({ ...employeeFormData, employeeStatus: e.target.value as any })}
                    required
                  >
                    <option value="Active Employee">Active Employee</option>
                    <option value="Ex-Staff">Ex-Staff</option>
                  </select>
                </div>
              </>
            )}

            {employeeModalTab === 'banking' && (
              <>
                <h6 className="fw-bold color-primary border-bottom pb-2">Banking Details</h6>
                <div className="col-md-6">
                  <label className="form-label">PAN Number</label>
                  <input type="text" className="form-control" value={employeeFormData.pan || ''} onChange={e => setEmployeeFormData({ ...employeeFormData, pan: e.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">UAN Number</label>
                  <input type="text" className="form-control" value={employeeFormData.uan || ''} onChange={e => setEmployeeFormData({ ...employeeFormData, uan: e.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Bank Name</label>
                  <input type="text" className="form-control" value={employeeFormData.bankName || ''} onChange={e => setEmployeeFormData({ ...employeeFormData, bankName: e.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Account Number</label>
                  <input type="text" className="form-control" value={employeeFormData.accountNumber || ''} onChange={e => setEmployeeFormData({ ...employeeFormData, accountNumber: e.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">IFSC Code</label>
                  <input type="text" className="form-control" value={employeeFormData.ifscCode || ''} onChange={e => setEmployeeFormData({ ...employeeFormData, ifscCode: e.target.value })} />
                </div>
              </>
            )}

            {employeeModalTab === 'salary' && (
              <>
                <h6 className="fw-bold color-primary border-bottom pb-2">Salary Details</h6>
                <div className="col-md-6">
                  <label className="form-label">Yearly CTC (₹)</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={employeeFormData.yearlyCTC || 0}
                    onChange={e => {
                      const yearly = Math.max(0, Number(e.target.value) || 0);
                      const monthly = yearly / 12;
                      const salary = calculateSalary(monthly, (employeeFormData.insuranceTaken ?? 'Yes') === 'Yes');
                      setEmployeeFormData({
                        ...employeeFormData,
                        yearlyCTC: yearly,
                        total: yearly,
                        salaryBonus: Number(salary.bonus.toFixed(2)),
                        salaryInsurance: Number(salary.insurance.toFixed(2)),
                        employeeESI: Number(salary.esi.toFixed(2)),
                        employerESI: Number(salary.employerEsi.toFixed(2))
                      });
                    }}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Insurance Opt</label>
                  <select
                    className="form-select"
                    value={employeeFormData.insuranceTaken ?? 'Yes'}
                    onChange={e => {
                      const insuranceTaken = e.target.value === 'No' ? 'No' : 'Yes';
                      const yearly = Math.max(0, Number(employeeFormData.yearlyCTC) || 0);
                      const monthly = yearly / 12;
                      const salary = calculateSalary(monthly, insuranceTaken === 'Yes');
                      setEmployeeFormData({
                        ...employeeFormData,
                        insuranceTaken,
                        salaryBonus: Number(salary.bonus.toFixed(2)),
                        salaryInsurance: Number(salary.insurance.toFixed(2)),
                        employeeESI: Number(salary.esi.toFixed(2)),
                        employerESI: Number(salary.employerEsi.toFixed(2))
                      });
                    }}
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Salary Bonus (₹)</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={employeeFormData.salaryBonus || 0}
                    onChange={e => setEmployeeFormData({ ...employeeFormData, salaryBonus: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Salary Insurance (₹)</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={employeeFormData.salaryInsurance || 0}
                    onChange={e => setEmployeeFormData({ ...employeeFormData, salaryInsurance: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Employee ESI (₹)</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={employeeFormData.employeeESI || 0}
                    onChange={e => setEmployeeFormData({ ...employeeFormData, employeeESI: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Employer ESI (₹)</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={employeeFormData.employerESI || 0}
                    onChange={e => setEmployeeFormData({ ...employeeFormData, employerESI: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </div>
              </>
            )}

            {employeeModalTab === 'image' && (
              <>
                <h6 className="fw-bold color-primary border-bottom pb-2">Profile Image</h6>
                <div className="col-12 d-flex align-items-center gap-3">
                  <img
                    src={employeeFormData.avatar || editingEmployee?.avatar || 'https://i.pravatar.cc/150?u=employee'}
                    width="64"
                    height="64"
                    className="rounded-circle border"
                    style={{ objectFit: 'cover' }}
                  />
                  <div>
                    <div className="text-muted">Current profile image</div>
                    <button
                      type="button"
                      className="btn text-primary mt-1"
                      onClick={() => {
                        setRemoveProfileImage(true);
                        setProfileUploadFile(null);
                        setSelectedGalleryImageUrl('');
                        setEmployeeFormData({ ...employeeFormData, avatar: '' });
                      }}
                    >
                      Remove Image
                    </button>
                  </div>
                </div>
                <div className="col-12">
                  <label className="form-label">Upload New Image</label>
                  <input
                    type="file"
                    className="form-control"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setProfileUploadFile(file);
                      setSelectedGalleryImageUrl('');
                      setRemoveProfileImage(false);
                      if (file) {
                        setEmployeeFormData({ ...employeeFormData, avatar: URL.createObjectURL(file) });
                      }
                    }}
                  />
                </div>
                <div className="col-12">
                  <div className="d-flex justify-content-between align-items-center">
                    <label className="form-label">Choose from Gallery Folders</label>
                    <button type="button" className="btn btn-sm color-primary" onClick={() => void loadProfileImageFolders()}>Refresh</button>
                  </div>
                </div>
                {isLoadingProfileFolders && <div className="col-12 text-muted">Loading image folders...</div>}
                {!isLoadingProfileFolders && (
                  <div className="col-12">
                    <div className="row g-3">
                      <div className="col-md-4">
                        <div className="border rounded p-2" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                          {profileImageFolders.length === 0 && (
                            <div className="text-muted">No folders found in Images library.</div>
                          )}
                          {profileImageFolders.map((folder) => {
                            const isActive = selectedProfileFolder?.ServerRelativeUrl === folder.ServerRelativeUrl;
                            return (
                              <button
                                type="button"
                                key={folder.ServerRelativeUrl}
                                className={`btn btn-sm w-100 text-start mb-1 ${isActive ? 'btn-primary' : 'btn-light'}`}
                                onClick={() => { loadImagesForFolder(folder).catch(() => undefined); }}
                              >
                                <span>{folder.Name}</span>
                                <span className="float-end">{folder.ItemCount}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="col-md-8">
                        <div className="border rounded p-2" style={{ minHeight: '300px' }}>
                          {selectedProfileFolder && (
                            <div className="fw-semibold mb-2">Images in "{selectedProfileFolder.Name}"</div>
                          )}
                          {!selectedProfileFolder && (
                            <div className="text-muted">Select a folder to view images.</div>
                          )}
                          {isLoadingFolderImages && <div className="text-muted">Loading folder images...</div>}
                          {!isLoadingFolderImages && selectedProfileFolder && profileFolderImages.length === 0 && (
                            <div className="text-muted">No images found in this folder.</div>
                          )}
                          {!isLoadingFolderImages && profileFolderImages.length > 0 && (
                            <div className="d-flex flex-wrap gap-2">
                              {profileFolderImages.map((image) => {
                                const isSelected = selectedGalleryImageUrl === image.url;
                                return (
                                  <button
                                    type="button"
                                    key={`${image.folder}-${image.url}`}
                                    className={`btn p-1 border ${isSelected ? 'border-primary' : 'border-light'}`}
                                    onClick={() => {
                                      setSelectedGalleryImageUrl(image.url);
                                      setProfileUploadFile(null);
                                      setRemoveProfileImage(false);
                                      setEmployeeFormData({ ...employeeFormData, avatar: image.url });
                                    }}
                                    title={image.name}
                                  >
                                    <img
                                      src={image.url}
                                      alt={image.name}
                                      width="72"
                                      height="72"
                                      style={{ objectFit: 'cover', borderRadius: 6 }}
                                    />
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isSendReportModalOpen}
        onClose={() => setIsSendReportModalOpen(false)}
        title="Send Report Data"
        size="lg"
        footer={
          <>
            <button className="btn btn-default" onClick={() => setIsSendReportModalOpen(false)}>Close</button>
            <button
              className="btn btn-default"
              onClick={() => {
                if (!sendReportPayload) return;
                void navigator.clipboard?.writeText(sendReportPayload);
              }}
            >
              Copy JSON
            </button>
            <button
              className="btn btn-default"
              onClick={handleGenerateSendReportPdf}
              disabled={!sendReportSnapshot}
            >
              Generate PDF
            </button>
            <button
              className="btn btn-default"
              onClick={handleGenerateSendReportExcel}
              disabled={!sendReportSnapshot}
            >
              Generate Excel
            </button>
            <button className="btn btn-primary" onClick={handleGenerateSendReportData}>Generate Data</button>
          </>
        }
      >
        <div className="row g-3">
          <div className="col-12">
            <label className="form-label">Date</label>
            <div className="d-flex flex-wrap gap-3">
              {(['Custom', 'Today', 'Yesterday', 'This Week', 'Last Week', 'This Month', 'Last Month', 'Last 3 Months', 'This Year', 'Last Year', 'All Time'] as SendReportDatePreset[]).map((preset) => (
                <div key={`send-report-${preset}`} className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    id={`send-report-preset-${preset}`}
                    checked={sendReportPreset === preset}
                    onChange={() => setSendReportPreset(preset)}
                  />
                  <label className="form-check-label" htmlFor={`send-report-preset-${preset}`}>{preset}</label>
                </div>
              ))}
            </div>
          </div>
          <div className="col-md-6">
            <label className="form-label">Start Date</label>
            <input
              type="date"
              className="form-control"
              value={sendReportStartDate}
              onChange={(e) => {
                setSendReportStartDate(e.target.value);
                setSendReportPreset('Custom');
              }}
            />
          </div>
          <div className="col-md-6">
            <label className="form-label">End Date</label>
            <input
              type="date"
              className="form-control"
              value={sendReportEndDate}
              onChange={(e) => {
                setSendReportEndDate(e.target.value);
                setSendReportPreset('Custom');
              }}
            />
          </div>
          <div className="col-12">
            <label className="form-label">Power Automate Payload (JSON)</label>
            <textarea
              className="form-control"
              rows={14}
              readOnly
              value={sendReportPayload}
              placeholder="Click 'Generate Data' to prepare report payload."
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace' }}
            />
          </div>
        </div>
      </Modal>

      <VersionHistoryModal
        isOpen={isVersionHistoryModalOpen}
        onClose={() => setIsVersionHistoryModalOpen(false)}
        title={versionHistoryTitle}
        entries={versionHistoryEntries}
        isLoading={isVersionHistoryLoading}
        error={versionHistoryError}
      />
    </div >
  );
};

export default App;
