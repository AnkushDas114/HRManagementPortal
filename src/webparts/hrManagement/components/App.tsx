
import * as React from 'react';
import { useState, useMemo } from 'react';
import type { SPFI } from '@pnp/sp';
import '@pnp/sp/lists';
import '@pnp/sp/fields';
import '@pnp/sp/site-users/web';
import './App.bootstrap.css';
import Header from './Header';
import Dashboard from './Dashboard';
import LeaveRequestsTable from './LeaveRequestsTable';
import AttendanceTracker from './AttendanceTracker';
import OnLeaveTodayTable from './OnLeaveTodayTable';
import EmployeePortal from './EmployeePortal';
import Profile from './Profile';
import Modal from '../ui/Modal';
import CommonTable, { ColumnDef } from '../ui/CommonTable';
import type { LeaveRequest, AttendanceRecord, Employee, SalarySlip, Policy, Concern, Holiday, TeamEvent } from '../types';
import { LeaveStatus, UserRole, ConcernStatus, ConcernType } from '../types';
import { getAllLeaveRequests, createLeaveRequest, updateLeaveRequestStatus, deleteLeaveRequest } from '../services/LeaveRequestsService';
import { getAllEvents, createEvent } from '../services/EventsService';
import { getAllConcerns, createConcern, updateConcernReply } from '../services/ConcernsService';
import {
  getAllEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  clearEmployeeProfileImage,
  replaceEmployeeProfileImage,
  getProfileGalleryImages,
  type ProfileGalleryImage
} from '../services/EmployeeService';
import { getAllAttendanceRecords, saveAttendanceRecords } from '../services/AttendanceService';
import { getAllSalarySlips, createSalarySlip } from '../services/SalarySlipService';
import { MOCK_LEAVE_REQUESTS, MOCK_ATTENDANCE_RECORDS, MOCK_EMPLOYEES } from '../constants';
import { Plus, Trash2, Edit, Minus, X } from 'lucide-react';
import { formatDateIST, getNowIST, monthNameIST, todayIST } from '../utils/dateTime';
import { SalarySlipView } from './SalarySlipView';

interface AppProps {
  sp: SPFI;
}

const OFFICIAL_LEAVES_LIST_ID = '0af5c538-1190-4fe5-8644-d01252e79d4b';

const calculateSalary = (monthlyCTC: number): {
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
  const useEsi = monthlyCTC > 21000;
  const insurance = useEsi ? 0 : 800;
  const esi = useEsi ? Number((monthlyCTC * 0.0075).toFixed(2)) : 0;
  const employerEsi = useEsi ? Number((monthlyCTC * 0.0325).toFixed(2)) : 0;
  const employeePF = 1800;
  const basic = monthlyCTC * 0.5;
  const hra = basic * 0.5;
  const employerPF = Math.floor((basic * 0.1) / 50) * 50;
  const bonus = Math.round(monthlyCTC / 24);
  const gross = Math.max(0, monthlyCTC - employerPF - insurance - bonus);
  const other = Math.max(0, gross - basic - hra);
  const inhand = Math.max(0, gross - employeePF - esi);

  return {
    basic,
    hra,
    other,
    gross,
    employerPF,
    employeePF,
    bonus,
    insurance,
    esi,
    employerEsi,
    inhand,
    yearlyCTC: monthlyCTC * 12
  };
};

const App: React.FC<AppProps> = ({ sp }) => {
  React.useEffect(() => {
    const bootstrapLinkId = 'hr-bootstrap-css';
    const existing = document.getElementById(bootstrapLinkId);
    if (existing) return;

    const link = document.createElement('link');
    link.id = bootstrapLinkId;
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css';
    document.head.appendChild(link);
  }, []);

  const [role, setRole] = useState<UserRole>(UserRole.Employee);
  const [employees] = useState<Employee[]>(MOCK_EMPLOYEES);
  const [directoryEmployees, setDirectoryEmployees] = useState<Employee[]>([]);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(MOCK_LEAVE_REQUESTS);
  const [isLoadingLeaveRequests, setIsLoadingLeaveRequests] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(MOCK_ATTENDANCE_RECORDS);
  const [isImportingAttendance, setIsImportingAttendance] = useState(false);
  const [salarySlips, setSalarySlips] = useState<SalarySlip[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoadingPolicies, setIsLoadingPolicies] = useState(false);
  const [policiesError, setPoliciesError] = useState<string | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoadingHolidays, setIsLoadingHolidays] = useState(false);
  const [holidaysError, setHolidaysError] = useState<string | null>(null);
  const [leaveCategories, setLeaveCategories] = useState<string[]>([]);
  const [concerns, setConcerns] = useState<Concern[]>([]);
  const [isLoadingQuotas, setIsLoadingQuotas] = useState(false);
  const [quotasError, setQuotasError] = useState<string | null>(null);
  const [teamEvents, setTeamEvents] = useState<TeamEvent[]>([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [leaveFilter, setLeaveFilter] = useState<LeaveStatus | 'All'>('All');

  //userGroup call-->




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
      alert("This leave type already exists.");
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
      alert("A leave type with this name already exists.");
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
      alert("Failed to add event.");
    }
  };



  const loadDirectoryEmployees = React.useCallback(async () => {
    if (!sp) return;
    setDirectoryError(null);
    try {
      const mapped = await getAllEmployees(sp);
      setDirectoryEmployees(mapped);
    } catch (err: any) {
      setDirectoryError('Failed to load Employee Master directory.');
      setDirectoryEmployees([]);
      console.error('Employee Master load failed', err);
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
    inhand: 0
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
  const [employeeModalTab, setEmployeeModalTab] = useState<'professional' | 'banking' | 'image'>('professional');
  const [profileUploadFile, setProfileUploadFile] = useState<File | null>(null);
  const [selectedGalleryImageUrl, setSelectedGalleryImageUrl] = useState<string>('');
  const [removeProfileImage, setRemoveProfileImage] = useState(false);
  const [profileGalleryImages, setProfileGalleryImages] = useState<ProfileGalleryImage[]>([]);
  const [isLoadingProfileGallery, setIsLoadingProfileGallery] = useState(false);
  const [employeeFormData, setEmployeeFormData] = useState<Partial<Employee>>({
    name: '',
    id: '',
    email: '',
    department: '',
    position: '',
    joiningDate: todayIST(),
    pan: '',
    accountNumber: '',
    bankName: '',
    ifscCode: '',
    basicSalary: 0,
    hra: 0,
    others: 0,
    pf: 0,
    total: 0
  });

  // Leave Form Modal State
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [selectedEmployeeForLeave, setSelectedEmployeeForLeave] = useState<Employee | null>(null);
  const [editingRequest, setEditingRequest] = useState<LeaveRequest | null>(null);
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

  // Current User State
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  React.useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const user = await sp.web.currentUser();
        console.log("Current User:", user);
        // Fallback to UserPrincipalName or LoginName if Email is empty (common in some SPO setups)
        const email = user.Email || user.UserPrincipalName || (user.LoginName ? user.LoginName.split('|').pop() : null) || null;
        setCurrentUserEmail(email);
      } catch (error) {
        console.error("Error fetching current user:", error);
      }
    };
    void fetchCurrentUser();
  }, [sp]);

  const inferredCurrentUser = React.useMemo(() => {
    if (!currentUserEmail || directoryEmployees.length === 0) {
      return directoryEmployees[0] || employees[0];
    }
    const found = directoryEmployees.find(emp => emp.email && emp.email.toLowerCase() === currentUserEmail.toLowerCase());
    return found || directoryEmployees[0] || employees[0];
  }, [currentUserEmail, directoryEmployees, employees]);

  React.useEffect(() => {
    if (!directoryEmployees.length) return;
    if (!selectedUserId) {
      setSelectedUserId(inferredCurrentUser?.id || directoryEmployees[0].id);
      return;
    }
    const stillExists = directoryEmployees.some(emp => emp.id === selectedUserId);
    if (!stillExists) {
      setSelectedUserId(inferredCurrentUser?.id || directoryEmployees[0].id);
    }
  }, [directoryEmployees, inferredCurrentUser, selectedUserId]);

  const currentUser = React.useMemo(() => {
    if (!directoryEmployees.length) return inferredCurrentUser;
    const selected = selectedUserId ? directoryEmployees.find(emp => emp.id === selectedUserId) : undefined;
    return selected || inferredCurrentUser || directoryEmployees[0];
  }, [directoryEmployees, inferredCurrentUser, selectedUserId]);
  const hrUser: Employee = {
    id: 'HR001',
    name: 'Alex Morgan',
    department: 'Engineering',
    avatar: 'https://i.pravatar.cc/150?u=hr-manager',
    joiningDate: '2020-01-01'
  };

  const handleUpdateRequestStatus = async (id: number, status: LeaveStatus, comment: string) => {
    try {
      const approver = status === LeaveStatus.Pending ? "" : "HR Manager";
      const finalComment = status === LeaveStatus.Pending ? "" : comment;

      await updateLeaveRequestStatus(sp, id, status, approver, finalComment);
      await loadLeaveRequests(); // Reload data
    } catch (error) {
      console.error("Error updating leave request status:", error);
      alert("Failed to update leave request status. Please try again.");
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
      await saveAttendanceRecords(sp, records);
      await loadAttendance();
      alert(`Successfully imported ${records.length} records to SharePoint.`);
    } catch (err) {
      alert("Failed to import attendance data.");
      console.error(err);
    } finally {
      setIsImportingAttendance(false);
    }
  };

  const handleDeleteRequest = async (id: number) => {
    if (!confirm("Are you sure you want to delete this leave request?")) return;
    try {
      await deleteLeaveRequest(sp, id);
      await loadLeaveRequests(); // Reload data
    } catch (error) {
      console.error("Error deleting leave request:", error);
      alert("Failed to delete leave request. Please try again.");
    }
  };

  const handleOpenLeaveModal = (empOrReq?: Employee | LeaveRequest) => {
    let emp: Employee;
    let req: LeaveRequest | undefined;
    if (empOrReq && 'leaveType' in empOrReq) {
      req = empOrReq as LeaveRequest;
      emp = req.employee;
    } else {
      emp = (empOrReq as Employee) || currentUser;
    }
    setSelectedEmployeeForLeave(emp);
    if (req) {
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
    } else {
      setEditingRequest(null);
      const todayStr = todayIST();
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
    }
    setIsLeaveModalOpen(true);
  };

  // Add the missing saveLeaveRequest function
  // Save Leave Request
  const saveLeaveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeForLeave) return;

    const start = new Date(leaveFormData.startDate);
    const end = leaveFormData.isHalfDay ? start : new Date(leaveFormData.endDate);
    let days = 1;
    if (leaveFormData.isHalfDay) {
      days = 0.5;
    } else {
      const diffTime = Math.abs(end.getTime() - start.getTime());
      days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    try {
      if (editingRequest) {
        // Edit logic not yet implemented in service, for now just update local state
        // TODO: Implement updateLeaveRequest in service if needed
        console.warn('Edit functionality not fully implemented on backend');
        alert('Edit functionality is currently limited.');
      } else {
        // Validate Leave Balance
        const quota = leaveQuotas[leaveFormData.leaveType] || 0;

        // Calculate currently used leaves (Approved) for this user and type
        // NOTE: We could also include 'Pending' to preventing double-booking if desired.
        // For now, matching the table logic which counts 'Approved'.
        // To be safer, we should probably count Pending as well to avoid overdrafts via multiple requests.
        const used = leaveRequests
          .filter(r => r.employee.id === currentUser.id && r.leaveType === leaveFormData.leaveType && (r.status === LeaveStatus.Approved || r.status === LeaveStatus.Pending))
          .reduce((sum, r) => sum + r.days, 0);

        if (used + days > quota) {
          alert(`Insufficient leave balance! You have used ${used} of ${quota} days for ${leaveFormData.leaveType}. This request of ${days} days would exceed your limit.`);
          return;
        }

        await createLeaveRequest(sp, selectedEmployeeForLeave, leaveFormData, days);
        await loadLeaveRequests(); // Reload data
        setIsLeaveModalOpen(false);
      }
    } catch (error) {
      console.error('Failed to save leave request:', error);
      alert('Failed to save leave request. Please try again.');
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
    return leaveTypes.map((type) => {
      const quota = getQuotaForLeaveType(type);
      const used = getUsedLeavesForEmployee(balanceEmployee.id, type);
      const left = Math.max(quota - used, 0);
      return { type, quota, used, left };
    });
  }, [balanceEmployee, leaveQuotas, getQuotaForLeaveType, getUsedLeavesForEmployee]);

  const handleRaiseConcern = async (type: ConcernType, referenceId: string | number, description: string) => {
    try {
      await createConcern(sp, { type, referenceId, description, status: ConcernStatus.Open }, currentUser.id);
      await loadConcerns();
    } catch (error) {
      console.error("Error raising concern:", error);
      alert("Failed to submit concern to SharePoint.");
    }
  };

  const handleOpenConcernReply = (concern: Concern) => {
    setSelectedConcern(concern);
    setConcernReplyText('');
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
      alert("Failed to save resolution to SharePoint.");
    }
  };

  const applySalaryFromYearlyCtc = (yearlyCtcValue: string): void => {
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

    const monthly = yearly / 12;
    const salary = calculateSalary(monthly);
    setSalaryFormData((prev) => ({
      ...prev,
      basic: Number(salary.basic.toFixed(2)),
      hra: Number(salary.hra.toFixed(2)),
      allowances: Number(salary.other.toFixed(2)),
      deductions: Number((salary.employeePF + salary.esi).toFixed(2)),
      monthlyCtc: Number(monthly.toFixed(2)),
      gross: Number(salary.gross.toFixed(2)),
      employerPF: Number(salary.employerPF.toFixed(2)),
      employeePF: Number(salary.employeePF.toFixed(2)),
      bonus: Number(salary.bonus.toFixed(2)),
      insurance: Number(salary.insurance.toFixed(2)),
      esi: Number(salary.esi.toFixed(2)),
      employerEsi: Number(salary.employerEsi.toFixed(2)),
      inhand: Number(salary.inhand.toFixed(2))
    }));
  };

  const handleUploadSalarySlip = (employee?: Employee) => {
    if (!employee) return;
    const initialYearlyCtc = employee.total ? String(employee.total) : '';
    setTargetEmployee(employee);
    setSalaryFormData({
      month: monthNameIST(),
      year: String(getNowIST().getFullYear()),
      basic: 0,
      hra: 0,
      allowances: 0,
      deductions: 0,
      bankName: employee.bankName || '',
      accountNumber: employee.accountNumber || '',
      ifscCode: employee.ifscCode || '',
      pan: employee.pan || '',
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
      inhand: 0
    });
    setSalaryYearlyCtc(initialYearlyCtc);
    applySalaryFromYearlyCtc(initialYearlyCtc);
    setIsSalaryManualMode(false);
    setIsSalaryModalOpen(true);
  };

  const saveSalarySlip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmployee) return;
    const netPay = (salaryFormData.basic + salaryFormData.hra + salaryFormData.allowances) - salaryFormData.deductions;
    const newSlip: SalarySlip = {
      id: `S${Date.now()}`,
      employeeId: targetEmployee.id,
      yearlyCtc: Number(salaryYearlyCtc) || 0,
      ...salaryFormData,
      payrollKey: `${targetEmployee.name}-${targetEmployee.id}-${salaryFormData.month}-${salaryFormData.year}`,
      netPay,
      generatedDate: todayIST()
    };
    try {
      await createSalarySlip(sp, newSlip, targetEmployee);

      // Update employee bank details if changed
      if (targetEmployee.itemId) {
        await updateEmployee(sp, targetEmployee.itemId, {
          bankName: salaryFormData.bankName,
          accountNumber: salaryFormData.accountNumber,
          ifscCode: salaryFormData.ifscCode,
          pan: salaryFormData.pan
        });

        // Update local state
        setDirectoryEmployees(prev => prev.map(emp =>
          emp.id === targetEmployee.id
            ? {
              ...emp,
              bankName: salaryFormData.bankName,
              accountNumber: salaryFormData.accountNumber,
              ifscCode: salaryFormData.ifscCode,
              pan: salaryFormData.pan
            }
            : emp
        ));
      }

      const all = await getAllSalarySlips(sp);
      setSalarySlips(all);
      setIsSalaryModalOpen(false);
      alert('Salary slip saved and employee bank details updated.');
    } catch (error) {
      console.error('Failed to save salary slip', error);
      alert('Failed to save salary slip.');
    }
  };

  const salaryNetPay = (salaryFormData.basic + salaryFormData.hra + salaryFormData.allowances) - salaryFormData.deductions;

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
      setEditingEmployee(emp);
      setEmployeeFormData({ ...emp });
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
        accountNumber: '',
        bankName: '',
        ifscCode: '',
        basicSalary: 0,
        hra: 0,
        others: 0,
        pf: 0,
        total: 0
      });
    }
    setEmployeeModalTab('professional');
    setProfileUploadFile(null);
    setSelectedGalleryImageUrl('');
    setRemoveProfileImage(false);
    setIsEmployeeModalOpen(true);
  };

  const loadProfileImageGallery = React.useCallback(async () => {
    if (!sp) return;
    setIsLoadingProfileGallery(true);
    try {
      const images = await getProfileGalleryImages(sp);
      setProfileGalleryImages(images);
    } catch (error) {
      console.error('Failed to load profile image gallery', error);
      setProfileGalleryImages([]);
    } finally {
      setIsLoadingProfileGallery(false);
    }
  }, [sp]);

  React.useEffect(() => {
    if (!isEmployeeModalOpen) return;
    void loadProfileImageGallery();
  }, [isEmployeeModalOpen, loadProfileImageGallery]);

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
      alert('Please fill all required professional details.');
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
      alert("Failed to save employee to SharePoint.");
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
      alert("Failed to delete employee.");
    }
  };

  // Load leave quotas from SharePoint
  const loadLeaveQuotas = React.useCallback(async () => {
    if (!sp) return;
    setIsLoadingQuotas(true);
    setQuotasError(null);
    try {
      const items = await sp.web.lists
        .getById(OFFICIAL_LEAVES_LIST_ID)
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
        .getById(OFFICIAL_LEAVES_LIST_ID)
        .items.select('Id')
        .filter("TaxType eq 'Unofficial Leaves'")
        .top(5000)();

      // Delete all existing quota items
      for (const item of existingItems) {
        await sp.web.lists
          .getById(OFFICIAL_LEAVES_LIST_ID)
          .items.getById(item.Id)
          .delete();
      }

      // Add new quota items
      for (const [leaveType, quota] of Object.entries(leaveQuotas)) {
        await sp.web.lists
          .getById(OFFICIAL_LEAVES_LIST_ID)
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
      alert('Failed to save leave quotas. Please try again.');
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
        .getById(OFFICIAL_LEAVES_LIST_ID)
        .items.select('Id', 'Title', 'Configurations', 'Created', 'Modified')
        .filter("TaxType eq 'LeavePolicy'")
        .top(5000)();
      console.log('Policies loaded:', items);
      const mapped: Policy[] = items.map((item: any) => ({
        id: item.Id,
        title: item.Title || 'Untitled Policy',
        content: item.Configurations || '',
        lastUpdated: formatDateIST(item.Modified) || todayIST()
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
          .getById(OFFICIAL_LEAVES_LIST_ID)
          .items.getById(editingPolicyId)
          .update({
            Title: policyFormData.title || 'Untitled Policy',
            Configurations: policyFormData.content || '',
            TaxType: 'LeavePolicy'
          });
      } else {
        // Create new policy
        await sp.web.lists
          .getById(OFFICIAL_LEAVES_LIST_ID)
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
      alert('Failed to save policy. Please try again.');
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
        .getById(OFFICIAL_LEAVES_LIST_ID)
        .items.getById(id)
        .delete();

      await loadPolicies();
    } catch (err: any) {
      console.error('Failed to delete policy', err);
      alert('Failed to delete policy. Please try again.');
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
          <div className="fw-bold text-primary small">{emp.name}</div>
        </div>
      )
    },
    { key: 'id', header: 'Emp ID', accessor: (emp) => emp.id },
    { key: 'email', header: 'Email Address', accessor: (emp) => emp.email || '', render: (emp) => emp.email || '-' },
    { key: 'department', header: 'Department', accessor: (emp) => emp.department, render: (emp) => emp.department },
    { key: 'position', header: 'Designation', accessor: (emp) => emp.position || '', render: (emp) => emp.position || '-' },
    { key: 'joiningDate', header: 'DOJ', accessor: (emp) => emp.joiningDate },
    {
      key: 'actions',
      header: 'Actions',
      searchable: false,
      filterable: false,
      align: 'end',
      render: (emp) => (
        <div className="d-flex gap-2">
          <button className="btn btn-sm btn-link p-0" style={{ color: '#2F5596' }} onClick={() => handleOpenEmployeeModal(emp)} title="Edit"><Edit size={18} /></button>
          <button className="btn btn-sm btn-link p-0 text-danger" onClick={() => handleDeleteEmployee(emp.itemId)} title="Delete"><Trash2 size={18} /></button>
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
            <div className="fw-bold small">{emp.name}</div>
            <div className="text-muted small">ID: {emp.id}</div>
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
          Add Salary
        </button>
      )
    }
  ]), [handleUploadSalarySlip]);

  const policyColumns = React.useMemo<ColumnDef<Policy>[]>(() => ([
    { key: 'title', header: 'Title' },
    { key: 'lastUpdated', header: 'Last Updated' },
    {
      key: 'actions',
      header: 'Actions',
      searchable: false,
      filterable: false,
      align: 'end',
      render: (p) => (
        <>
          <button className="btn btn-sm btn-link" onClick={() => handleOpenPolicyModal(p)}><Edit size={14} /></button>
          <button className="btn btn-sm btn-link text-danger" onClick={() => handleDeletePolicy(p.id)}><Trash2 size={14} /></button>
        </>
      )
    }
  ]), [handleOpenPolicyModal, handleDeletePolicy]);

  const holidayColumns = React.useMemo<ColumnDef<Holiday>[]>(() => ([
    { key: 'name', header: 'Holiday' },
    { key: 'date', header: 'Date' },
    { key: 'type', header: 'Type', render: (h) => <span className={`badge ${h.type === 'Public' ? 'text-bg-primary' : 'text-bg-secondary'}`}>{h.type}</span> },
    {
      key: 'actions',
      header: 'Actions',
      searchable: false,
      filterable: false,
      align: 'end',
      render: (h) => (
        <>
          <button className="btn btn-sm btn-link" onClick={() => handleOpenHolidayModal(h)}><Edit size={14} /></button>
          <button className="btn btn-sm btn-link text-danger" onClick={() => handleDeleteHoliday(h.id)}><Trash2 size={14} /></button>
        </>
      )
    }
  ]), []);

  const concernColumns = React.useMemo<ColumnDef<Concern>[]>(() => ([
    {
      key: 'employee',
      header: 'Employee',
      accessor: (c) => directoryEmployees.find(e => e.id === c.employeeId)?.name || '',
      render: (c) => {
        const emp = directoryEmployees.find(e => e.id === c.employeeId);
        return (
          <div className="d-flex align-items-center gap-2">
            <img src={emp?.avatar} width="32" height="32" className="rounded-circle border" />
            <div>
              <div className="fw-bold small">{emp?.name}</div>
              <div className="text-muted small">{c.submittedAt}</div>
            </div>
          </div>
        );
      }
    },
    { key: 'type', header: 'Type', render: (c) => <span className="badge text-bg-light border">{c.type}</span> },
    { key: 'description', header: 'Summary', render: (c) => <div className="small text-truncate" style={{ maxWidth: '300px' }}>{c.description}</div> },
    { key: 'status', header: 'Status', render: (c) => <span className={`badge ${c.status === ConcernStatus.Open ? 'text-bg-warning' : 'text-bg-success'}`}>{c.status}</span> },
    {
      key: 'actions',
      header: 'Actions',
      searchable: false,
      filterable: false,
      align: 'end',
      render: (c) => (
        <button className="btn btn-sm btn-outline-primary" onClick={() => handleOpenConcernReply(c)}>Reply</button>
      )
    }
  ]), [directoryEmployees, handleOpenConcernReply]);

  // Load leave category choices from SharePoint field
  const loadLeaveCategories = React.useCallback(async () => {
    if (!sp) return;
    try {
      const field = await sp.web.lists
        .getById(OFFICIAL_LEAVES_LIST_ID)
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

  // Load holidays from SharePoint
  const loadHolidays = React.useCallback(async () => {
    if (!sp) return;
    setIsLoadingHolidays(true);
    setHolidaysError(null);
    try {
      const items = await sp.web.lists
        .getById(OFFICIAL_LEAVES_LIST_ID)
        .items.select('Id', 'Title', 'Date', 'TaxType', 'LeaveCategory')
        .filter("TaxType eq 'Official Leave'")
        .top(5000)();

      const mapped: Holiday[] = items.map((item: any) => ({
        id: item.Id,
        name: item.Title || 'Untitled Holiday',
        date: formatDateIST(item.Date) || todayIST(),
        type: (item.LeaveCategory || 'Public') as 'Public' | 'Restricted'
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
        .getById(OFFICIAL_LEAVES_LIST_ID)
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
      alert('Failed to create holiday. Please try again.');
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
        .getById(OFFICIAL_LEAVES_LIST_ID)
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
      alert('Failed to update holiday. Please try again.');
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
        .getById(OFFICIAL_LEAVES_LIST_ID)
        .items.getById(id)
        .delete();

      await loadHolidays();
    } catch (err: any) {
      console.error('Failed to delete holiday', err);
      alert('Failed to delete holiday. Please try again.');
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

  return (
    <div className="bg-light min-vh-100">
      <Header
        role={role}
        onRoleToggle={handleRoleToggle}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        users={directoryEmployees}
        selectedUserId={currentUser?.id}
        onUserChange={setSelectedUserId}
      />

      <main className="container-fluid hr-shell-container hr-main-content py-4">
        {activeTab === 'profile' ? (
          <Profile
            user={currentUser || hrUser}
            role={role}
            sp={sp}
            onBack={() => setActiveTab(role === UserRole.HR ? 'overview' : 'dashboard')}
            onUpdate={loadDirectoryEmployees}
          />
        ) : (
          <>
            <ul className="nav nav-pills mb-4 bg-white p-2 rounded shadow-sm d-inline-flex flex-wrap gap-2" role="tablist">
              {role === UserRole.HR ? (
                <>
                  <li className="nav-item">
                    <button className={`nav-link btn-sm px-4 py-2 fw-medium ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Leave Overview</button>
                  </li>
                  <li className="nav-item">
                    <button className={`nav-link btn-sm px-4 py-2 fw-medium ${activeTab === 'leaves-request' ? 'active' : ''}`} onClick={() => setActiveTab('leaves-request')}>Leaves request</button>
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
                    <button className={`nav-link btn-sm px-4 py-2 fw-medium ${activeTab === 'onLeaveToday' ? 'active' : ''}`} onClick={() => setActiveTab('onLeaveToday')}>ON Leave Today</button>
                  </li>
                  <li className="nav-item">
                    <button className={`nav-link btn-sm px-4 py-2 fw-medium ${activeTab === 'policy-admin' ? 'active' : ''}`} onClick={() => setActiveTab('policy-admin')}>Leave Policy</button>
                  </li>
                  <li className="nav-item">
                    <button className={`nav-link btn-sm px-4 py-2 fw-medium ${activeTab === 'holiday-admin' ? 'active' : ''}`} onClick={() => setActiveTab('holiday-admin')}>Official Leaves</button>
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
                    <button className={`nav-link btn-sm px-4 py-2 fw-medium ${activeTab === 'salary' ? 'active' : ''}`} onClick={() => setActiveTab('salary')}>Salary Slip</button>
                  </li>
                </>
              )}
            </ul>

            <div className="tab-content">
              {role === UserRole.Employee ? (
                <EmployeePortal user={currentUser} requests={leaveRequests} attendance={attendanceRecords} salarySlips={salarySlips} policies={policies} holidays={holidays} concerns={concerns} leaveQuotas={leaveQuotas} teamEvents={teamEvents} onRaiseConcern={handleRaiseConcern} onSubmitLeave={() => handleOpenLeaveModal()} onTabChange={setActiveTab} activeTab={activeTab} />
              ) : (
                <>
                  {activeTab === 'overview' && <Dashboard requests={leaveRequests} attendanceRecords={attendanceRecords} concernsCount={openConcernsCount} holidays={holidays} teamEvents={teamEvents} employees={directoryEmployees} onAddTeamEvent={handleAddTeamEvent} onPendingClick={() => setActiveTab('leaves-request')} onOnLeaveTodayClick={() => setActiveTab('onLeaveToday')} onConcernsClick={() => setActiveTab('concerns-admin')} />}
                  {activeTab === 'leaves-request' && (
                    isLoadingLeaveRequests ? (
                      <div className="d-flex justify-content-center p-5">
                        <div className="spinner-border text-primary" role="status">
                          <span className="visually-hidden">Loading...</span>
                        </div>
                      </div>
                    ) : (
                      <LeaveRequestsTable requests={leaveRequests} employees={directoryEmployees} leaveQuotas={leaveQuotas} filter={leaveFilter} onFilterChange={setLeaveFilter} onUpdateStatus={handleUpdateRequestStatus} onDelete={handleDeleteRequest} onViewBalance={handleViewBalance} teams={distinctTimeCategories} />
                    )
                  )}
                  {activeTab === 'global-directory' && (
                    <div className="card border-0 shadow-sm">
                      <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                        <h5 className="mb-0 fw-bold text-primary">Employee Global Directory</h5>
                        <button className="btn btn-primary btn-sm d-flex align-items-center gap-2" onClick={() => handleOpenEmployeeModal()}>
                          <Plus size={16} /> Add User
                        </button>
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
                  {activeTab === 'attendance' && <AttendanceTracker employees={directoryEmployees} leaveRequests={leaveRequests} attendanceRecords={attendanceRecords} onImport={handleImportAttendance} isImporting={isImportingAttendance} onEditEmployeeLeave={handleOpenLeaveModal} onViewBalance={handleViewBalance} leaveQuotas={leaveQuotas} />}
                  {activeTab === 'upload-salary-slip' && (
                    <div className="card border-0 shadow-sm">
                      <div className="card-header bg-white py-3">
                        <h5 className="mb-0 fw-bold text-primary">Upload Salary Slip</h5>
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
                    <OnLeaveTodayTable
                      requests={leaveRequests}
                      onEdit={handleOpenLeaveModal}
                      leaveQuotas={leaveQuotas}
                      sp={sp}
                      employees={directoryEmployees}
                      onRefresh={loadLeaveRequests}
                    />
                  )}
                  {activeTab === 'policy-admin' && (
                    <div className="card border-0 shadow-sm">
                      <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                        <h5 className="mb-0 fw-bold text-primary">Leave Policies</h5>
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
                    <div className="row g-4">
                      <div className="col-md-8">
                        <div className="card border-0 shadow-sm">
                          <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                            <h5 className="mb-0 fw-bold text-primary">Official Holidays</h5>
                            <button className="btn btn-primary btn-sm" onClick={() => handleOpenHolidayModal()} disabled={isLoadingHolidays}><Plus size={16} /> Add Holiday</button>
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
                      <div className="col-md-4">
                        <div className="card border-0 shadow-sm">
                          <div className="card-header text-primary bg-white py-3"><h5 className="mb-0 fw-bold">Leave Quotas</h5></div>
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
                                      <li key={type} className="list-group-item d-flex justify-content-between align-items-center py-2">
                                        <div className="small">{type}</div>
                                        <span className="badge text-bg-light border fw-bold">{quota}</span>
                                      </li>
                                    ))}
                                  </ul>
                                  <div className="p-3 bg-light text-center"><button className="btn btn-sm btn-outline-primary w-100" onClick={() => setIsAddLeaveModalOpen(true)} disabled={isLoadingQuotas}>Manage Quotas</button></div>
                                </>
                              ) : (
                                <div className="p-4 text-center text-muted">
                                  <p className="mb-2">No leave quotas configured</p>
                                  <button className="btn btn-sm btn-primary" onClick={() => setIsAddLeaveModalOpen(true)}>Add Quotas</button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  {activeTab === 'concerns-admin' && (
                    <div className="card border-0 shadow-sm">
                      <div className="card-header bg-white py-3"><h5 className="mb-0 fw-bold text-primary">Employee Concerns</h5></div>
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

      <Modal isOpen={isPolicyModalOpen} onClose={() => setIsPolicyModalOpen(false)} title={editingPolicyId ? "Edit Policy" : "New Policy"} footer={<div className="d-flex justify-content-end gap-2 w-100"><button className="btn btn-outline-secondary" onClick={() => setIsPolicyModalOpen(false)}>Cancel</button><button type="submit" form="policy-form" className="btn btn-primary">{editingPolicyId ? "Update" : "Save"}</button></div>}>
        <form id="policy-form" onSubmit={handleSavePolicy}><div className="mb-3"><label className="form-label fw-bold">Title</label><input type="text" className="form-control" value={policyFormData.title} onChange={e => setPolicyFormData({ ...policyFormData, title: e.target.value })} required /></div><div className="mb-3"><label className="form-label fw-bold">Configurations</label><textarea className="form-control" rows={8} value={policyFormData.content} onChange={e => setPolicyFormData({ ...policyFormData, content: e.target.value })} required></textarea></div></form>
      </Modal>

      <Modal isOpen={isAddLeaveModalOpen} onClose={() => setIsAddLeaveModalOpen(false)} title="Manage Quotas" footer={<button className="btn btn-primary px-4" onClick={handleSaveQuotas} disabled={isLoadingQuotas}>{isLoadingQuotas ? 'Saving...' : 'Save'}</button>}>
        <div className="mb-4"><label className="form-label small fw-bold text-muted">ADD NEW TYPE</label><div className="input-group input-group-sm"><input type="text" className="form-control" value={newLeaveTypeName} onChange={(e) => setNewLeaveTypeName(e.target.value)} placeholder="Enter leave type name" /><button className="btn btn-primary" onClick={handleAddNewLeaveType} disabled={isLoadingQuotas}>Add</button></div></div>
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
                    className="fw-bold"
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
                  <button className="btn btn-sm btn-outline-secondary rounded-circle px-2" onClick={() => handleUpdateQuota(type, -1)} disabled={isLoadingQuotas}><Minus size={14} /></button>
                  <div className="fw-bold" style={{ width: '20px', textAlign: 'center' }}>{count}</div>
                  <button className="btn btn-sm btn-outline-primary rounded-circle px-2" onClick={() => handleUpdateQuota(type, 1)} disabled={isLoadingQuotas}><Plus size={14} /></button>
                  <button className="btn btn-link text-danger p-0 ms-2" onClick={() => handleDeleteQuotaType(type)} disabled={isLoadingQuotas}><X size={18} /></button>
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

      <Modal isOpen={isHolidayModalOpen} onClose={() => setIsHolidayModalOpen(false)} title={editingHolidayId ? "Edit Holiday" : "New Holiday"} footer={<><button className="btn btn-link text-decoration-none" onClick={() => setIsHolidayModalOpen(false)}>Cancel</button><button type="submit" form="holiday-form" className="btn btn-primary">{editingHolidayId ? "Update" : "Save"}</button></>}>
        <form id="holiday-form" onSubmit={handleSaveHoliday}><div className="mb-3"><label className="form-label fw-bold">Name</label><input type="text" className="form-control" value={holidayFormData.name} onChange={e => setHolidayFormData({ ...holidayFormData, name: e.target.value })} required /></div><div className="mb-3"><label className="form-label fw-bold">Date</label><input type="date" className="form-control" value={holidayFormData.date} onChange={e => setHolidayFormData({ ...holidayFormData, date: e.target.value })} required /></div><div className="mb-3"><label className="form-label fw-bold">Type</label><select className="form-select" value={holidayFormData.type} onChange={e => setHolidayFormData({ ...holidayFormData, type: e.target.value as any })}>{leaveCategories.length > 0 ? leaveCategories.map(cat => <option key={cat} value={cat}>{cat}</option>) : <><option value="Public">Public</option><option value="Restricted">Restricted</option></>}</select></div></form>
      </Modal>

      <Modal isOpen={isConcernReplyModalOpen} onClose={() => setIsConcernReplyModalOpen(false)} title="Resolve Concern" footer={<><button className="btn btn-link text-decoration-none" onClick={() => setIsConcernReplyModalOpen(false)}>Cancel</button><button type="submit" form="concern-reply-form" className="btn btn-primary px-4">Submit</button></>}>
        {selectedConcern && (
          <form id="concern-reply-form" onSubmit={handleSaveConcernReply}><div className="mb-3 p-3 bg-light rounded border"><div className="small fw-bold text-muted text-uppercase">{selectedConcern.type}</div><div className="text-dark small mt-1">{selectedConcern.description}</div></div><div className="mb-3"><label className="form-label fw-bold">Resolution</label><textarea className="form-control" rows={5} value={concernReplyText} onChange={e => setConcernReplyText(e.target.value)} required placeholder="Resolution message..."></textarea></div></form>
        )}
      </Modal>

      <Modal isOpen={isLeaveModalOpen} onClose={() => setIsLeaveModalOpen(false)} title={editingRequest ? "Edit Leave" : "New Leave"} footer={<><button className="btn btn-link text-decoration-none" onClick={() => setIsLeaveModalOpen(false)}>Cancel</button><button type="submit" form="leave-application-form" className="btn btn-primary px-4">Submit</button></>}>
        <form id="leave-application-form" onSubmit={saveLeaveRequest}>
          <div className="row g-3">
            <div className="col-12"><label className="form-label fw-bold">Leave Type</label><select className="form-select" value={leaveFormData.leaveType} onChange={e => setLeaveFormData({ ...leaveFormData, leaveType: e.target.value })}>{Object.keys(leaveQuotas).map(t => (<option key={t} value={t}>{t}</option>))}</select></div>
            <div className="col-md-6"><label className="form-label fw-bold">Start</label><input type="date" className="form-control" value={leaveFormData.startDate} onChange={e => setLeaveFormData({ ...leaveFormData, startDate: e.target.value })} required /></div>
            <div className="col-md-6"><label className="form-label fw-bold">End</label><input type="date" className="form-control" value={leaveFormData.endDate} onChange={e => setLeaveFormData({ ...leaveFormData, endDate: e.target.value })} required disabled={leaveFormData.isHalfDay} /></div>
            <div className="col-12">
              <button
                type="button"
                className={`btn popup-option-toggle ${leaveFormData.isHalfDay ? 'popup-option-toggle--active' : ''}`}
                onClick={() => setLeaveFormData({ ...leaveFormData, isHalfDay: !leaveFormData.isHalfDay })}
                aria-pressed={leaveFormData.isHalfDay}
              >
                Request Half Day
              </button>
            </div>
            {leaveFormData.isHalfDay && (
              <div className="col-12">
                <label className="form-label fw-bold">Half Day Type</label>
                <div className="d-flex gap-3">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="halfDayType"
                      id="firstHalf"
                      value="first"
                      checked={leaveFormData.halfDayType === 'first'}
                      onChange={e => setLeaveFormData({ ...leaveFormData, halfDayType: e.target.value as 'first' | 'second' })}
                    />
                    <label className="form-check-label" htmlFor="firstHalf">First Half</label>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="halfDayType"
                      id="secondHalf"
                      value="second"
                      checked={leaveFormData.halfDayType === 'second'}
                      onChange={e => setLeaveFormData({ ...leaveFormData, halfDayType: e.target.value as 'first' | 'second' })}
                    />
                    <label className="form-check-label" htmlFor="secondHalf">Second Half</label>
                  </div>
                </div>
              </div>
            )}
            <div className="col-12">
              <button
                type="button"
                className={`btn popup-option-toggle ${leaveFormData.isRecurring ? 'popup-option-toggle--active' : ''}`}
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
                  <label className="form-label fw-bold small text-primary">RECURRENCE PATTERN</label>
                  <div className="d-flex gap-2">
                    {(['Daily', 'Weekly', 'Monthly', 'Yearly'] as const).map(freq => (
                      <div key={freq} className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="recurringFrequency"
                          id={`freq${freq}`}
                          value={freq}
                          checked={leaveFormData.recurringFrequency === freq}
                          onChange={e => setLeaveFormData({ ...leaveFormData, recurringFrequency: e.target.value as typeof freq })}
                        />
                        <label className="form-check-label small" htmlFor={`freq${freq}`}>{freq}</label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pattern-specific options */}
                <div className="col-12">
                  <label className="form-label fw-bold small text-primary">PATTERN</label>

                  {/* Daily Pattern */}
                  {leaveFormData.recurringFrequency === 'Daily' && (
                    <div className="border rounded p-2">
                      <div className="form-check mb-2">
                        <input className="form-check-input" type="radio" name="dailyPattern" id="dailyEvery" checked={!leaveFormData.dailyWeekdaysOnly} onChange={() => setLeaveFormData({ ...leaveFormData, dailyWeekdaysOnly: false })} />
                        <label className="form-check-label small" htmlFor="dailyEvery">
                          every <input type="number" className="form-control form-control-sm d-inline-block mx-1" style={{ width: '60px' }} min="1" value={leaveFormData.dailyInterval} onChange={e => setLeaveFormData({ ...leaveFormData, dailyInterval: parseInt(e.target.value) || 1 })} /> days
                        </label>
                      </div>
                      <div className="form-check">
                        <input className="form-check-input" type="radio" name="dailyPattern" id="dailyWeekdays" checked={leaveFormData.dailyWeekdaysOnly} onChange={() => setLeaveFormData({ ...leaveFormData, dailyWeekdaysOnly: true })} />
                        <label className="form-check-label small" htmlFor="dailyWeekdays">every weekdays</label>
                      </div>
                    </div>
                  )}

                  {/* Weekly Pattern */}
                  {leaveFormData.recurringFrequency === 'Weekly' && (
                    <div className="border rounded p-2">
                      <div className="mb-2 small">
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
                            <label className="form-check-label small" htmlFor={`day${day}`}>{day.slice(0, 3)}</label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Monthly Pattern */}
                  {leaveFormData.recurringFrequency === 'Monthly' && (
                    <div className="border rounded p-2">
                      <div className="form-check mb-2">
                        <input className="form-check-input" type="radio" name="monthlyPattern" id="monthlyDay" checked={leaveFormData.monthlyPattern === 'day'} onChange={() => setLeaveFormData({ ...leaveFormData, monthlyPattern: 'day' })} />
                        <label className="form-check-label small" htmlFor="monthlyDay">
                          Day <input type="number" className="form-control form-control-sm d-inline-block mx-1" style={{ width: '60px' }} min="1" max="31" value={leaveFormData.monthlyDay} onChange={e => setLeaveFormData({ ...leaveFormData, monthlyDay: parseInt(e.target.value) || 1 })} /> of every <input type="number" className="form-control form-control-sm d-inline-block mx-1" style={{ width: '60px' }} min="1" value={leaveFormData.monthlyInterval} onChange={e => setLeaveFormData({ ...leaveFormData, monthlyInterval: parseInt(e.target.value) || 1 })} /> month(s)
                        </label>
                      </div>
                      <div className="form-check">
                        <input className="form-check-input" type="radio" name="monthlyPattern" id="monthlyThe" checked={leaveFormData.monthlyPattern === 'the'} onChange={() => setLeaveFormData({ ...leaveFormData, monthlyPattern: 'the' })} />
                        <label className="form-check-label small" htmlFor="monthlyThe">
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
                      <div className="form-check mb-2">
                        <input className="form-check-input" type="radio" name="yearlyPattern" id="yearlyEvery" checked={leaveFormData.yearlyPattern === 'every'} onChange={() => setLeaveFormData({ ...leaveFormData, yearlyPattern: 'every' })} />
                        <label className="form-check-label small" htmlFor="yearlyEvery">
                          every <select className="form-select form-select-sm d-inline-block mx-1" style={{ width: 'auto' }} value={leaveFormData.yearlyMonth} onChange={e => setLeaveFormData({ ...leaveFormData, yearlyMonth: e.target.value })}>
                            {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => <option key={m} value={m}>{m}</option>)}
                          </select> <input type="number" className="form-control form-control-sm d-inline-block mx-1" style={{ width: '60px' }} min="1" value={leaveFormData.yearlyInterval} onChange={e => setLeaveFormData({ ...leaveFormData, yearlyInterval: parseInt(e.target.value) || 1 })} />
                        </label>
                      </div>
                      <div className="form-check">
                        <input className="form-check-input" type="radio" name="yearlyPattern" id="yearlyThe" checked={leaveFormData.yearlyPattern === 'the'} onChange={() => setLeaveFormData({ ...leaveFormData, yearlyPattern: 'the' })} />
                        <label className="form-check-label small" htmlFor="yearlyThe">
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
                  <label className="form-label fw-bold small text-primary">DATE RANGE</label>
                  <div className="border rounded p-2">
                    <div className="mb-2">
                      <label className="form-label small mb-1">Start Date</label>
                      <input type="date" className="form-control form-control-sm" value={leaveFormData.startDate} onChange={e => setLeaveFormData({ ...leaveFormData, startDate: e.target.value })} required />
                    </div>
                    <div className="form-check mb-2">
                      <input className="form-check-input" type="radio" name="endDateOption" id="noEnd" checked={leaveFormData.endDateOption === 'noEnd'} onChange={() => setLeaveFormData({ ...leaveFormData, endDateOption: 'noEnd' })} />
                      <label className="form-check-label small" htmlFor="noEnd">no end date</label>
                    </div>
                    <div className="form-check mb-2">
                      <input className="form-check-input" type="radio" name="endDateOption" id="endBy" checked={leaveFormData.endDateOption === 'endBy'} onChange={() => setLeaveFormData({ ...leaveFormData, endDateOption: 'endBy' })} />
                      <label className="form-check-label small" htmlFor="endBy">
                        end by <input type="date" className="form-control form-control-sm d-inline-block mx-1" style={{ width: '150px' }} value={leaveFormData.recurrenceEndDate} onChange={e => setLeaveFormData({ ...leaveFormData, recurrenceEndDate: e.target.value })} disabled={leaveFormData.endDateOption !== 'endBy'} />
                      </label>
                    </div>
                    <div className="form-check">
                      <input className="form-check-input" type="radio" name="endDateOption" id="endAfter" checked={leaveFormData.endDateOption === 'endAfter'} onChange={() => setLeaveFormData({ ...leaveFormData, endDateOption: 'endAfter' })} />
                      <label className="form-check-label small" htmlFor="endAfter">
                        end after <input type="number" className="form-control form-control-sm d-inline-block mx-1" style={{ width: '60px' }} min="1" value={leaveFormData.recurrenceOccurrences} onChange={e => setLeaveFormData({ ...leaveFormData, recurrenceOccurrences: parseInt(e.target.value) || 1 })} disabled={leaveFormData.endDateOption !== 'endAfter'} /> occurrences
                      </label>
                    </div>
                  </div>
                </div>
              </>
            )}
            <div className="col-12"><label className="form-label fw-bold">Reason</label><textarea className="form-control" rows={4} value={leaveFormData.reason} onChange={e => setLeaveFormData({ ...leaveFormData, reason: e.target.value })} required></textarea></div>
          </div>
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
                <div className="fw-bold text-primary d-flex align-items-center gap-2 mb-2 small text-uppercase">
                  Employee Information
                </div>
                <div className="row g-2">
                  <div className="col-md-4">
                    <div className="small text-muted">Employee Name</div>
                    <div className="fw-semibold text-dark">{targetEmployee?.name || 'N/A'}</div>
                  </div>
                  <div className="col-md-4">
                    <div className="small text-muted">Employee ID</div>
                    <div className="fw-semibold text-dark">{targetEmployee?.id || 'N/A'}</div>
                  </div>
                  <div className="col-md-4">
                    <div className="small text-muted">Department</div>
                    <div className="fw-semibold text-dark">{targetEmployee?.department || 'N/A'}</div>
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
              <label className="form-label fw-bold small text-muted text-uppercase mb-1">Month</label>
              <select className="form-select" value={salaryFormData.month} onChange={e => setSalaryFormData({ ...salaryFormData, month: e.target.value })}>
                {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-bold small text-muted text-uppercase mb-1">Year</label>
              <select className="form-select" value={salaryFormData.year} onChange={e => setSalaryFormData({ ...salaryFormData, year: e.target.value })}>
                {[getNowIST().getFullYear() - 1, getNowIST().getFullYear(), getNowIST().getFullYear() + 1].map((year) => (
                  <option key={year} value={String(year)}>{year}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-bold small text-muted text-uppercase mb-1">Working Days</label>
              <input
                type="number"
                className="form-control"
                value={salaryFormData.workingDays}
                onChange={e => setSalaryFormData({ ...salaryFormData, workingDays: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-bold small text-muted text-uppercase mb-1">Paid Days</label>
              <input
                type="number"
                className="form-control"
                value={salaryFormData.paidDays}
                onChange={e => setSalaryFormData({ ...salaryFormData, paidDays: Number(e.target.value) || 0 })}
              />
            </div>

            {/* CTC & Manual Toggle Row */}
            <div className="col-md-8">
              <label className="form-label fw-bold small text-muted text-uppercase mb-1">Yearly CTC (₹)</label>
              <input
                type="number"
                min="0"
                className="form-control"
                value={salaryYearlyCtc}
                onChange={(e) => {
                  const value = e.target.value;
                  setSalaryYearlyCtc(value);
                  applySalaryFromYearlyCtc(value);
                }}
                required
              />
            </div>
            <div className="col-md-4 d-flex align-items-end pb-2">
              <button
                type="button"
                className={`btn popup-option-toggle ${isSalaryManualMode ? 'popup-option-toggle--active' : ''}`}
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
                    className={`form-control bg-light`}
                    value={salaryFormData.monthlyCtc}
                    readOnly
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
                        inhand: Math.max(0, (val + prev.hra + prev.allowances + prev.bonus) - prev.deductions)
                      }));
                    }}
                    readOnly={!isSalaryManualMode}
                  />
                </div>
                {/* HRA */}
                <div className="col">
                  <label className="form-label small fw-bold text-muted mb-1">HRA (₹)</label>
                  <input
                    type="number"
                    className={`form-control ${!isSalaryManualMode ? 'bg-light border-light-subtle' : ''}`}
                    value={salaryFormData.hra}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setSalaryFormData(prev => ({
                        ...prev,
                        hra: val,
                        inhand: Math.max(0, (prev.basic + val + prev.allowances + prev.bonus) - prev.deductions)
                      }));
                    }}
                    readOnly={!isSalaryManualMode}
                  />
                </div>
                {/* Allowances */}
                <div className="col">
                  <label className="form-label small fw-bold text-muted mb-1">Allowances (₹)</label>
                  <input
                    type="number"
                    className={`form-control ${!isSalaryManualMode ? 'bg-light border-light-subtle' : ''}`}
                    value={salaryFormData.allowances}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setSalaryFormData(prev => ({
                        ...prev,
                        allowances: val,
                        inhand: Math.max(0, (prev.basic + prev.hra + val + prev.bonus) - prev.deductions)
                      }));
                    }}
                    readOnly={!isSalaryManualMode}
                  />
                </div>
                {/* Deductions */}
                <div className="col">
                  <label className="form-label small fw-bold text-muted mb-1">Deductions (₹)</label>
                  <input
                    type="number"
                    className={`form-control ${!isSalaryManualMode ? 'bg-light border-light-subtle' : ''}`}
                    value={salaryFormData.deductions}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setSalaryFormData(prev => ({
                        ...prev,
                        deductions: val,
                        inhand: Math.max(0, (prev.basic + prev.hra + prev.allowances + prev.bonus) - val)
                      }));
                    }}
                    readOnly={!isSalaryManualMode}
                  />
                </div>
                {/* Gross */}
                <div className="col">
                  <label className="form-label small fw-bold text-muted mb-1">Gross (₹)</label>
                  <input
                    type="number"
                    className="form-control bg-light"
                    value={salaryFormData.gross}
                    readOnly
                  />
                </div>
                {/* Employer PF */}
                <div className="col">
                  <label className="form-label small fw-bold text-muted mb-1">Employer PF (₹)</label>
                  <input
                    type="number"
                    className={`form-control ${!isSalaryManualMode ? 'bg-light border-light-subtle' : ''}`}
                    value={salaryFormData.employerPF}
                    onChange={(e) => setSalaryFormData({ ...salaryFormData, employerPF: Number(e.target.value) || 0 })}
                    readOnly={!isSalaryManualMode}
                  />
                </div>
                {/* Employee PF */}
                <div className="col">
                  <label className="form-label small fw-bold text-muted mb-1">Employee PF (₹)</label>
                  <input
                    type="number"
                    className={`form-control ${!isSalaryManualMode ? 'bg-light border-light-subtle' : ''}`}
                    value={salaryFormData.employeePF}
                    onChange={(e) => setSalaryFormData({ ...salaryFormData, employeePF: Number(e.target.value) || 0 })}
                    readOnly={!isSalaryManualMode}
                  />
                </div>
                {/* Bonus */}
                <div className="col">
                  <label className="form-label small fw-bold text-muted mb-1">Bonus (₹)</label>
                  <input
                    type="number"
                    className={`form-control ${!isSalaryManualMode ? 'bg-light border-light-subtle' : ''}`}
                    value={salaryFormData.bonus}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setSalaryFormData(prev => ({
                        ...prev,
                        bonus: val,
                        inhand: Math.max(0, (prev.basic + prev.hra + prev.allowances + val) - prev.deductions)
                      }));
                    }}
                    readOnly={!isSalaryManualMode}
                  />
                </div>
                {/* ESI */}
                <div className="col">
                  <label className="form-label small fw-bold text-muted mb-1">ESI (₹)</label>
                  <input
                    type="number"
                    className={`form-control ${!isSalaryManualMode ? 'bg-light border-light-subtle' : ''}`}
                    value={salaryFormData.esi}
                    onChange={(e) => setSalaryFormData({ ...salaryFormData, esi: Number(e.target.value) || 0 })}
                    readOnly={!isSalaryManualMode}
                  />
                </div>
                {/* Employer ESI */}
                <div className="col">
                  <label className="form-label small fw-bold text-muted mb-1">Employer ESI (₹)</label>
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
                  <label className="form-label small fw-bold text-muted mb-1">Insurance (₹)</label>
                  <input
                    type="number"
                    className={`form-control ${!isSalaryManualMode ? 'bg-light border-light-subtle' : ''}`}
                    value={salaryFormData.insurance}
                    onChange={(e) => setSalaryFormData({ ...salaryFormData, insurance: Number(e.target.value) || 0 })}
                    readOnly={!isSalaryManualMode}
                  />
                </div>
              </div>
            </div>

            <div className="col-12 mt-4 pt-3 border-top">
              <div className="d-flex justify-content-between align-items-center">
                <div className="fw-bold fs-4 text-dark">Total Net Pay</div>
                <div className="text-success fw-bold fs-3">
                  ₹{salaryNetPay.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isBalanceModalOpen} onClose={() => setIsBalanceModalOpen(false)} title="Balance Summary">
        {balanceEmployee && (
          <div>
            <div className="small text-muted mb-3">
              {balanceEmployee.name} (ID: {balanceEmployee.id})
            </div>
            <div className="row g-3">
              {balanceSummary.length === 0 && (
                <div className="col-12">
                  <div className="text-muted small">No unofficial leave quota configured.</div>
                </div>
              )}
              {balanceSummary.map((item) => (
                <div key={item.type} className="col-12 col-md-4 col-lg-3">
                  <div className="p-3 bg-white border rounded text-center shadow-sm h-100">
                    <div className="h4 fw-bold mb-1 text-primary">{item.left}</div>
                    <div className="small text-muted text-truncate" title={item.type}>{item.type}</div>
                    <div className="small text-muted mt-1">Used {item.used} / {item.quota}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isEmployeeModalOpen}
        onClose={() => setIsEmployeeModalOpen(false)}
        title={editingEmployee ? "Edit Employee Details" : "Add New Employee"}
        size="lg"
        footer={<><button className="btn btn-link" onClick={() => setIsEmployeeModalOpen(false)}>Cancel</button><button type="submit" form="employee-form" className="btn btn-primary">Save Employee</button></>}
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
          </ul>
          <div className="row g-3">
            {employeeModalTab === 'professional' && (
              <>
                <h6 className="fw-bold text-primary border-bottom pb-2">Professional Details</h6>
                <div className="col-md-6">
                  <label className="form-label fw-bold">Full Name</label>
                  <input type="text" className="form-control" value={employeeFormData.name} onChange={e => setEmployeeFormData({ ...employeeFormData, name: e.target.value })} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-bold">Employee ID</label>
                  <input type="text" className="form-control" value={employeeFormData.id} onChange={e => setEmployeeFormData({ ...employeeFormData, id: e.target.value })} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-bold">Email</label>
                  <input type="email" className="form-control" value={employeeFormData.email} onChange={e => setEmployeeFormData({ ...employeeFormData, email: e.target.value })} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-bold">Department</label>
                  <select className="form-select" value={employeeFormData.department} onChange={e => setEmployeeFormData({ ...employeeFormData, department: e.target.value })} required>
                    <option value="">Select Department</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Product">Product</option>
                    <option value="Design">Design</option>
                    <option value="QA">QA</option>
                    <option value="Marketing">Marketing</option>
                    <option value="HR">HR</option>
                    <option value="Finance">Finance</option>
                    <option value="Management">Management</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-bold">Designation</label>
                  <input type="text" className="form-control" value={employeeFormData.position} onChange={e => setEmployeeFormData({ ...employeeFormData, position: e.target.value })} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-bold">Joining Date (DOJ)</label>
                  <input type="date" className="form-control" value={employeeFormData.joiningDate} onChange={e => setEmployeeFormData({ ...employeeFormData, joiningDate: e.target.value })} required />
                </div>
              </>
            )}

            {employeeModalTab === 'banking' && (
              <>
                <h6 className="fw-bold text-primary border-bottom pb-2">Banking Details</h6>
                <div className="col-md-6">
                  <label className="form-label fw-bold">PAN Number</label>
                  <input type="text" className="form-control" value={employeeFormData.pan || ''} onChange={e => setEmployeeFormData({ ...employeeFormData, pan: e.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-bold">Bank Name</label>
                  <input type="text" className="form-control" value={employeeFormData.bankName || ''} onChange={e => setEmployeeFormData({ ...employeeFormData, bankName: e.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-bold">Account Number</label>
                  <input type="text" className="form-control" value={employeeFormData.accountNumber || ''} onChange={e => setEmployeeFormData({ ...employeeFormData, accountNumber: e.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-bold">IFSC Code</label>
                  <input type="text" className="form-control" value={employeeFormData.ifscCode || ''} onChange={e => setEmployeeFormData({ ...employeeFormData, ifscCode: e.target.value })} />
                </div>
              </>
            )}

            {employeeModalTab === 'image' && (
              <>
                <h6 className="fw-bold text-primary border-bottom pb-2">Profile Image</h6>
                <div className="col-12 d-flex align-items-center gap-3">
                  <img
                    src={employeeFormData.avatar || editingEmployee?.avatar || 'https://i.pravatar.cc/150?u=employee'}
                    width="64"
                    height="64"
                    className="rounded-circle border"
                    style={{ objectFit: 'cover' }}
                  />
                  <div>
                    <div className="small text-muted">Current profile image</div>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger mt-1"
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
                  <label className="form-label fw-bold">Upload New Image</label>
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
                    <label className="form-label fw-bold mb-0">Choose from Gallery Folders</label>
                    <button type="button" className="btn btn-sm btn-link" onClick={() => void loadProfileImageGallery()}>Refresh</button>
                  </div>
                </div>
                {isLoadingProfileGallery && <div className="col-12 text-muted small">Loading gallery images...</div>}
                {!isLoadingProfileGallery && profileGalleryImages.length === 0 && (
                  <div className="col-12 text-muted small">No gallery images found in configured folders.</div>
                )}
                {!isLoadingProfileGallery && profileGalleryImages.length > 0 && (
                  <div className="col-12">
                    {Object.entries(profileGalleryImages.reduce<Record<string, ProfileGalleryImage[]>>((acc, image) => {
                      if (!acc[image.folder]) acc[image.folder] = [];
                      acc[image.folder].push(image);
                      return acc;
                    }, {})).map(([folder, images]) => (
                      <div key={folder} className="mb-3">
                        <div className="fw-semibold mb-2">{folder}</div>
                        <div className="d-flex flex-wrap gap-2">
                          {images.map((image) => {
                            const isSelected = selectedGalleryImageUrl === image.url;
                            return (
                              <button
                                type="button"
                                key={`${folder}-${image.url}`}
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
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </form>
      </Modal>
    </div >
  );
};

export default App;
