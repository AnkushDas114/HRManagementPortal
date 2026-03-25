
import * as React from 'react';
import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { LeaveStatus } from '../types';
import type { Employee, LeaveRequest, AttendanceRecord, AttendanceStatus } from '../types';
import Badge from '../ui/Badge';
import CommonTable, { ColumnDef } from '../ui/CommonTable';
import Modal from '../ui/Modal';
import { Clock, Info, ChevronDown, ChevronRight, ChevronLeft, Upload, Calendar, Download, Edit3, Trash2 } from 'lucide-react';
import { formatAuditInfo, formatDateIST, getNowIST, todayIST, formatDateForDisplayIST } from '../utils/dateTime';
import { showAlert } from '../ui/CustomAlert';

interface AttendanceTrackerProps {
  employees: Employee[];
  leaveRequests: LeaveRequest[];
  attendanceRecords: AttendanceRecord[];
  onImport: (records: AttendanceRecord[]) => Promise<void> | void;
  onUpdateAttendanceRecord?: (record: AttendanceRecord) => Promise<void> | void;
  onDeleteAttendanceByDate?: (date: string, employeeId?: string) => Promise<number> | number;
  onDeleteAttendanceRecord?: (record: AttendanceRecord) => Promise<void> | void;
  onOpenAttendanceForm?: (recordId: number) => void;
  onOpenAttendanceVersionHistory?: (recordId: number) => void;
  onViewBalance?: (employee: Employee) => void;
  isImporting?: boolean;
  selectedUserId?: string | null;
  leaveQuotas?: Record<string, number>;
  initialEditRecord?: AttendanceRecord | null;
  onInitialEditConsumed?: () => void;
}

const AttendanceTracker: React.FC<AttendanceTrackerProps> = ({
  employees,
  leaveRequests,
  attendanceRecords,
  onImport,
  onUpdateAttendanceRecord,
  onDeleteAttendanceByDate,
  onDeleteAttendanceRecord,
  onOpenAttendanceForm,
  onOpenAttendanceVersionHistory,
  onViewBalance,
  isImporting: isImportingProp,
  selectedUserId,
  leaveQuotas,
  initialEditRecord,
  onInitialEditConsumed
}) => {
  const today = getNowIST();
  const todayStr = todayIST();

  const [isImportingLocal, setIsImportingLocal] = React.useState(false);
  const [isDateAccordionOpen, setIsDateAccordionOpen] = React.useState(false);
  const [selectedDateFilter, setSelectedDateFilter] = React.useState('Pre-set');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [selectedMemberId, setSelectedMemberId] = React.useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [isSavingEdit, setIsSavingEdit] = React.useState(false);
  const [editingAttendance, setEditingAttendance] = React.useState<AttendanceRecord | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
  const [deleteDate, setDeleteDate] = React.useState(todayStr);
  const [deleteEmployeeId, setDeleteEmployeeId] = React.useState('');
  const [isDeletingRecords, setIsDeletingRecords] = React.useState(false);

  const [viewMode, setViewMode] = React.useState<'Daily' | 'Weekly' | 'Monthly'>('Daily');
  const [referenceDate, setReferenceDate] = React.useState<Date>(today);

  const normalizeText = React.useCallback((value: unknown): string => {
    return String(value ?? '').trim().toLowerCase();
  }, []);

  const normalizeCompactId = React.useCallback((value: unknown): string => {
    return normalizeText(value).replace(/\s+/g, '');
  }, [normalizeText]);

  const normalizeNumericId = React.useCallback((value: unknown): string => {
    const digits = normalizeCompactId(value).replace(/\D/g, '');
    if (!digits) return '';
    const trimmed = digits.replace(/^0+/, '');
    return trimmed || '0';
  }, [normalizeCompactId]);

  const employeeIdsMatch = React.useCallback((a: unknown, b: unknown): boolean => {
    const idA = normalizeCompactId(a);
    const idB = normalizeCompactId(b);
    if (!idA || !idB) return false;
    if (idA === idB) return true;

    const numA = normalizeNumericId(a);
    const numB = normalizeNumericId(b);
    return !!numA && !!numB && numA === numB;
  }, [normalizeCompactId, normalizeNumericId]);

  const parseRecordDate = React.useCallback((value: string): Date | null => {
    const raw = String(value || '').trim();
    if (!raw) return null;

    // Parse YYYY-MM-DD as local noon to avoid timezone shifts.
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [year, month, day] = raw.split('-').map(Number);
      const parsed = new Date(year, month - 1, day, 12, 0, 0);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, []);

  const configuredTotalLeaves = React.useMemo(() => {
    return Object.entries(leaveQuotas || {})
      .filter(([type]) => !type.toLowerCase().includes('maternity') && !type.toLowerCase().includes('paternity'))
      .reduce((sum, [, value]) => sum + (Number(value) || 0), 0);
  }, [leaveQuotas]);

  const formatLeaveNumber = React.useCallback((value: number): string => {
    if (!Number.isFinite(value)) return '0';
    if (Math.floor(value) === value) return String(value);
    return value.toFixed(1).replace(/\.0$/, '');
  }, []);

  const getLeaveSummary = React.useCallback((employee: Employee | undefined, record: AttendanceRecord): { used: number; total: number; left: number } => {
    const recordName = normalizeText(employee?.name || record.employeeName);
    const recordEmail = normalizeText(employee?.email);

    const used = leaveRequests
      .filter((request) => {
        if (request.status !== LeaveStatus.Approved) return false;
        const lowerType = String(request.leaveType || '').toLowerCase();
        const isWorkFromHomeRequest = request.requestCategory === 'Work From Home' || /work\s*from\s*home|wfh/i.test(lowerType);
        if (isWorkFromHomeRequest) return false;

        // Also exclude special leaves from the general leave summary tally
        const isSpecialLeave = lowerType.includes('maternity') || lowerType.includes('paternity');
        if (isSpecialLeave) return false;

        const requestEmployee = request.employee;
        if (!requestEmployee) return false;

        if (employeeIdsMatch(requestEmployee.id, record.employeeId)) return true;
        if (employee && employeeIdsMatch(requestEmployee.id, employee.id)) return true;

        const requestName = normalizeText(requestEmployee.name);
        const requestEmail = normalizeText(requestEmployee.email);
        if (recordEmail && requestEmail && recordEmail === requestEmail) return true;
        if (recordName && requestName && recordName === requestName) return true;
        return false;
      })
      .reduce((sum, request) => sum + (request.days || 0), 0);

    const fallbackTotal =
      employee?.balance?.totalEntitled ||
      ((employee?.balance?.vacation || 0) + (employee?.balance?.sick || 0) + (employee?.balance?.personal || 0));

    const total = configuredTotalLeaves > 0 ? configuredTotalLeaves : fallbackTotal;
    const left = Math.max(total - used, 0);
    return { used, total, left };
  }, [configuredTotalLeaves, employeeIdsMatch, leaveRequests, normalizeText]);

  const getMonthlyLeaveUsage = React.useCallback((employee: Employee | undefined, record: AttendanceRecord): { taken: number; totalDaysInMonth: number } => {
    const targetYear = referenceDate.getFullYear();
    const targetMonth = referenceDate.getMonth();
    const totalDaysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const monthStart = new Date(targetYear, targetMonth, 1, 12, 0, 0);
    const monthEnd = new Date(targetYear, targetMonth, totalDaysInMonth, 12, 0, 0);
    const oneDayMs = 1000 * 60 * 60 * 24;

    const recordName = normalizeText(employee?.name || record.employeeName);
    const recordEmail = normalizeText(employee?.email);

    let taken = 0;

    leaveRequests.forEach((request) => {
      if (request.status !== LeaveStatus.Approved) return;
      const lowerType = String(request.leaveType || '').toLowerCase();
      const isWorkFromHomeRequest = request.requestCategory === 'Work From Home' || /work\s*from\s*home|wfh/i.test(lowerType);
      if (isWorkFromHomeRequest) return;

      const isSpecialLeave = lowerType.includes('maternity') || lowerType.includes('paternity');
      if (isSpecialLeave) return;
      const requestEmployee = request.employee;
      if (!requestEmployee) return;

      let isSameEmployee = false;
      if (employeeIdsMatch(requestEmployee.id, record.employeeId)) isSameEmployee = true;
      if (!isSameEmployee && employee && employeeIdsMatch(requestEmployee.id, employee.id)) isSameEmployee = true;
      if (!isSameEmployee) {
        const requestName = normalizeText(requestEmployee.name);
        const requestEmail = normalizeText(requestEmployee.email);
        if (recordEmail && requestEmail && recordEmail === requestEmail) isSameEmployee = true;
        if (recordName && requestName && recordName === requestName) isSameEmployee = true;
      }
      if (!isSameEmployee) return;

      const reqStart = parseRecordDate(request.startDate);
      const reqEnd = parseRecordDate(request.endDate || request.startDate);
      if (!reqStart || !reqEnd) return;

      // Half-day requests should only contribute 0.5 for the matched day in the target month.
      if (request.isHalfDay) {
        if (reqStart.getFullYear() === targetYear && reqStart.getMonth() === targetMonth) {
          taken += 0.5;
        }
        return;
      }

      const overlapStart = reqStart > monthStart ? reqStart : monthStart;
      const overlapEnd = reqEnd < monthEnd ? reqEnd : monthEnd;
      if (overlapEnd < overlapStart) return;

      const overlapDays = Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / oneDayMs) + 1;
      if (overlapDays > 0) taken += overlapDays;
    });

    return { taken, totalDaysInMonth };
  }, [employeeIdsMatch, leaveRequests, normalizeText, parseRecordDate, referenceDate]);

  React.useEffect(() => {
    if (selectedUserId) {
      setSelectedMemberId(selectedUserId);
    }
  }, [selectedUserId]);

  const teams = React.useMemo(() => {
    const groups: Record<string, Employee[]> = {};
    employees.filter(emp => emp.employeeStatus !== 'Ex-Staff').forEach(emp => {
      if (!groups[emp.department]) groups[emp.department] = [];
      groups[emp.department].push(emp);
    });
    return groups;
  }, [employees]);

  // Comprehensive Date Filtering Logic
  const filteredRecords = React.useMemo(() => {
    return attendanceRecords.filter(record => {
      const employee = employees.find(e => employeeIdsMatch(e.id, record.employeeId));
      const selectedEmployee = selectedMemberId ? employees.find(e => employeeIdsMatch(e.id, selectedMemberId)) : undefined;

      // 1. Member selection filtering
      const recordName = employee?.name || record.employeeName || 'Unknown';
      const matchesMemberById = selectedMemberId ? employeeIdsMatch(record.employeeId, selectedMemberId) : true;
      const matchesMemberByName = !!selectedEmployee && normalizeText(recordName) === normalizeText(selectedEmployee.name);
      const matchesMember = !selectedMemberId || matchesMemberById || matchesMemberByName;
      if (!matchesMember) return false;

      // 2. Date Filtering
      const recDate = parseRecordDate(record.date);
      if (!recDate) return false;
      const recTime = recDate.getTime();
      const recDateKey = formatDateIST(recDate);

      const startOfDay = (d: Date) => {
        const res = new Date(d.getTime());
        res.setHours(0, 0, 0, 0);
        return res;
      };

      // Priority 1: Accordion Presets (if not All Time/Pre-set)
      if (selectedDateFilter === 'All Time') {
        return true;
      }

      const endOfDay = (d: Date) => {
        const res = new Date(d.getTime());
        res.setHours(23, 59, 59, 999);
        return res;
      };

      if (selectedDateFilter !== 'Pre-set') {
        if (selectedDateFilter === 'Today') {
          return recDateKey === todayStr;
        }

        if (selectedDateFilter === 'Yesterday') {
          const yesterday = new Date();
          yesterday.setDate(today.getDate() - 1);
          return recDateKey === formatDateIST(yesterday);
        }

        if (selectedDateFilter === 'This Week') {
          const firstDayOfWeek = new Date();
          firstDayOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
          const lastDayOfWeek = new Date(firstDayOfWeek);
          lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);
          return recTime >= startOfDay(firstDayOfWeek).getTime() && recTime <= endOfDay(lastDayOfWeek).getTime();
        }

        if (selectedDateFilter === 'Last Week') {
          const lastWeekStart = new Date();
          lastWeekStart.setDate(today.getDate() - today.getDay() - 7);
          const lastWeekEnd = new Date();
          lastWeekEnd.setDate(today.getDate() - today.getDay() - 1);
          return recTime >= startOfDay(lastWeekStart).getTime() && recTime <= endOfDay(lastWeekEnd).getTime();
        }

        if (selectedDateFilter === 'This Month') {
          const first = new Date(today.getFullYear(), today.getMonth(), 1);
          const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          return recTime >= startOfDay(first).getTime() && recTime <= endOfDay(last).getTime();
        }

        if (selectedDateFilter === 'Last Month') {
          const lastMonth = new Date();
          lastMonth.setMonth(today.getMonth() - 1);
          const first = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
          const last = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
          return recTime >= startOfDay(first).getTime() && recTime <= endOfDay(last).getTime();
        }

        if (selectedDateFilter === 'Last 3 Months') {
          const threeMonthsAgo = new Date();
          threeMonthsAgo.setMonth(today.getMonth() - 3);
          return recTime >= startOfDay(threeMonthsAgo).getTime() && recTime <= endOfDay(today).getTime();
        }

        if (selectedDateFilter === 'This Year') {
          const first = new Date(today.getFullYear(), 0, 1);
          const last = new Date(today.getFullYear(), 11, 31);
          return recTime >= startOfDay(first).getTime() && recTime <= endOfDay(last).getTime();
        }

        if (selectedDateFilter === 'Last Year') {
          const first = new Date(today.getFullYear() - 1, 0, 1);
          const last = new Date(today.getFullYear() - 1, 11, 31);
          return recTime >= startOfDay(first).getTime() && recTime <= endOfDay(last).getTime();
        }

        if (selectedDateFilter === 'Custom') {
          if (!startDate || !endDate) return false;
          const startParsed = parseRecordDate(startDate);
          const endParsed = parseRecordDate(endDate);
          if (!startParsed || !endParsed) return false;

          const startKey = formatDateIST(startParsed);
          const endKey = formatDateIST(endParsed);
          const from = startKey <= endKey ? startKey : endKey;
          const to = startKey <= endKey ? endKey : startKey;

          return recDateKey >= from && recDateKey <= to;
        }
      }

      // Priority 2: Navigator / View Mode logic (used when "All Time" or "Pre-set" is selected)
      const refDateStr = formatDateIST(referenceDate);

      if (viewMode === 'Daily') {
        return recDateKey === refDateStr;
      }

      if (viewMode === 'Weekly') {
        const startOfWeek = startOfDay(new Date(referenceDate));
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const recStart = startOfDay(new Date(recDate.getTime()));

        return recStart >= startOfWeek && recStart <= endOfWeek;
      }

      if (viewMode === 'Monthly') {
        return recDate.getMonth() === referenceDate.getMonth() && recDate.getFullYear() === referenceDate.getFullYear();
      }

      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [attendanceRecords, employees, selectedMemberId, selectedDateFilter, startDate, endDate, todayStr, today, employeeIdsMatch, normalizeText, viewMode, referenceDate, parseRecordDate]);

  const handlePrev = () => {
    setSelectedDateFilter('Pre-set');
    const nextDate = new Date(referenceDate);
    if (viewMode === 'Daily') nextDate.setDate(referenceDate.getDate() - 1);
    else if (viewMode === 'Weekly') nextDate.setDate(referenceDate.getDate() - 7);
    else if (viewMode === 'Monthly') nextDate.setMonth(referenceDate.getMonth() - 1);
    setReferenceDate(nextDate);
  };

  const handleNext = () => {
    setSelectedDateFilter('Pre-set');
    const nextDate = new Date(referenceDate);
    if (viewMode === 'Daily') nextDate.setDate(referenceDate.getDate() + 1);
    else if (viewMode === 'Weekly') nextDate.setDate(referenceDate.getDate() + 7);
    else if (viewMode === 'Monthly') nextDate.setMonth(referenceDate.getMonth() + 1);
    setReferenceDate(nextDate);
  };

  const getDateDisplay = () => {
    if (selectedDateFilter !== 'All Time' && selectedDateFilter !== 'Custom' && selectedDateFilter !== 'Pre-set') {
      return selectedDateFilter;
    }
    if (selectedDateFilter === 'Custom' && startDate && endDate) {
      return `${formatDateForDisplayIST(new Date(startDate), 'en-GB', { day: '2-digit', month: 'short' })} - ${formatDateForDisplayIST(new Date(endDate), 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    }

    if (viewMode === 'Daily') {
      return formatDateForDisplayIST(referenceDate, 'en-GB', { day: '2-digit', month: 'long', year: 'numeric', weekday: 'long' });
    }
    if (viewMode === 'Weekly') {
      const start = new Date(referenceDate);
      start.setDate(referenceDate.getDate() - referenceDate.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${formatDateForDisplayIST(start, 'en-GB', { day: '2-digit', month: 'short' })} - ${formatDateForDisplayIST(end, 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    }
    if (viewMode === 'Monthly') {
      return formatDateForDisplayIST(referenceDate, 'en-GB', { month: 'long', year: 'numeric' });
    }
    return '';
  };

  const handleDateFilterChange = (filter: string) => {
    const now = getNowIST();

    // Map Presets
    setSelectedDateFilter(filter);

    const toDateString = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    let sDate = '';
    let eDate = '';

    if (filter === 'Today') {
      sDate = toDateString(now);
      eDate = toDateString(now);
      setReferenceDate(now);
      setViewMode('Daily');
    } else if (filter === 'Yesterday') {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      sDate = toDateString(d);
      eDate = toDateString(d);
      setReferenceDate(d);
      setViewMode('Daily');
    } else if (filter === 'This Week') {
      const first = new Date(now);
      first.setDate(first.getDate() - first.getDay());
      const last = new Date(first);
      last.setDate(first.getDate() + 6);
      sDate = toDateString(first);
      eDate = toDateString(last);
      setReferenceDate(now);
      setViewMode('Weekly');
    } else if (filter === 'Last Week') {
      const first = new Date(now);
      first.setDate(first.getDate() - first.getDay() - 7);
      const last = new Date(now);
      last.setDate(now.getDate() - now.getDay() - 1);
      sDate = toDateString(first);
      eDate = toDateString(last);
      setReferenceDate(first);
      setViewMode('Weekly');
    } else if (filter === 'This Month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      sDate = toDateString(first);
      eDate = toDateString(last);
      setReferenceDate(now);
      setViewMode('Monthly');
    } else if (filter === 'Last Month') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      sDate = toDateString(first);
      eDate = toDateString(last);
      setReferenceDate(first);
      setViewMode('Monthly');
    } else if (filter === 'Last 3 Months') {
      const first = new Date(now);
      first.setMonth(now.getMonth() - 3);
      sDate = toDateString(first);
      eDate = toDateString(now);
    } else if (filter === 'This Year') {
      const first = new Date(now.getFullYear(), 0, 1);
      const last = new Date(now.getFullYear(), 11, 31);
      sDate = toDateString(first);
      eDate = toDateString(last);
    } else if (filter === 'Last Year') {
      const first = new Date(now.getFullYear() - 1, 0, 1);
      const last = new Date(now.getFullYear() - 1, 11, 31);
      sDate = toDateString(first);
      eDate = toDateString(last);
    } else if (filter === 'All Time') {
      sDate = '';
      eDate = '';
    } else if (filter === 'Custom' || filter === 'Pre-set') {
      return;
    }

    if (filter !== 'Custom' && filter !== 'Pre-set') {
      setStartDate(sDate);
      setEndDate(eDate);
    }
  };

  const handleClearFilters = () => {
    setSelectedDateFilter('Pre-set');
    setViewMode('Daily');
    setReferenceDate(today);
    setStartDate('');
    setEndDate('');
    setSelectedMemberId(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImportingLocal(true);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      const objectRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

      const parsedRecords: AttendanceRecord[] = [];

      try {
        const normalizeHeader = (value: unknown): string =>
          String(value ?? '')
            .toLowerCase()
            .replace(/[\s._-]+/g, '');

        const resolveHeader = (keys: string[], aliases: string[]): string | undefined => {
          return keys.find((key) => aliases.indexOf(normalizeHeader(key)) !== -1);
        };

        const normalizeDateCell = (value: unknown): string => {
          if (value === null || value === undefined || value === '') return '';
          if (typeof value === 'number') {
            const parsed = XLSX.SSF.parse_date_code(value);
            if (parsed) {
              return formatDateIST(new Date(parsed.y, parsed.m - 1, parsed.d, 12, 0, 0));
            }
          }

          const raw = String(value).trim();
          if (!raw) return '';
          if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

          const slashOrDash = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
          if (slashOrDash) {
            const day = Number(slashOrDash[1]);
            const month = Number(slashOrDash[2]);
            const yy = Number(slashOrDash[3]);
            const year = yy < 100 ? 2000 + yy : yy;
            if (!Number.isNaN(day) && !Number.isNaN(month) && !Number.isNaN(year)) {
              return formatDateIST(new Date(year, month - 1, day, 12, 0, 0));
            }
          }

          const parsedDate = new Date(raw);
          if (!Number.isNaN(parsedDate.getTime())) {
            return formatDateIST(parsedDate);
          }

          return raw;
        };

        const normalizeTimeCell = (value: unknown): string => {
          if (value === null || value === undefined || value === '') return '';
          if (typeof value === 'number') {
            const excelTime = value >= 1 ? value % 1 : value;
            return XLSX.SSF.format('hh:mm', excelTime || value);
          }
          const raw = String(value).trim();
          if (!raw || raw === '--:--' || raw === '-:--' || raw === '-') return '';
          return raw;
        };

        const normalizeDurationCell = (value: unknown): string => {
          if (value === null || value === undefined || value === '') return '';
          if (typeof value === 'number') {
            const excelTime = value >= 1 ? value % 1 : value;
            return XLSX.SSF.format('h:mm', excelTime || value);
          }
          const raw = String(value).trim();
          if (!raw || raw === '--:--' || raw === '-:--' || raw === '-') return '';
          return raw;
        };

        const extractEmployeeId = (rawEmployee: string): string => {
          const idMatch = rawEmployee.match(/id\s*[:#-]?\s*([a-zA-Z0-9]+)/i);
          return idMatch?.[1]?.trim() || '';
        };

        const stripEmployeeId = (rawEmployee: string): string => {
          return rawEmployee
            .replace(/\(\s*id\s*[:#-]?\s*[a-zA-Z0-9]+\s*\)/gi, '')
            .replace(/\bid\s*[:#-]?\s*[a-zA-Z0-9]+\b/gi, '')
            .trim();
        };

        const normalizeStatus = (value: string): AttendanceStatus => {
          const normalized = value.trim().toLowerCase();
          if (normalized === 'present') return 'Present' as AttendanceStatus;
          if (normalized === 'absent') return 'Absent' as AttendanceStatus;
          if (normalized === 'onleave' || normalized === 'on leave' || normalized === 'leave') return 'On Leave' as AttendanceStatus;
          if (normalized === 'weekend') return 'Weekend' as AttendanceStatus;
          if (normalized === 'workfromhome' || normalized === 'work from home' || normalized === 'wfh') return 'Work From Home' as AttendanceStatus;
          return value as AttendanceStatus;
        };

        // Import files exported from this UI format.
        if (objectRows.length > 0) {
          const headers = Object.keys(objectRows[0]);
          const employeeHeader = resolveHeader(headers, ['employee', 'employeename', 'name']);
          const idHeader = resolveHeader(headers, ['id', 'employeeid', 'empid', 'ecode', 'employeecode']);
          const departmentHeader = resolveHeader(headers, ['department', 'dept']);
          const dateHeader = resolveHeader(headers, ['date', 'attendancedate']);
          const clockInHeader = resolveHeader(headers, ['clockin', 'intime', 'in']);
          const clockOutHeader = resolveHeader(headers, ['clockout', 'outtime', 'out']);
          const totalTimeHeader = resolveHeader(headers, ['totaltime', 'workduration', 'duration', 'workhours']);
          const statusHeader = resolveHeader(headers, ['status']);

          if ((employeeHeader || idHeader) && dateHeader && statusHeader) {
            const uiParsedRecords: AttendanceRecord[] = objectRows
              .map((row) => {
                const employeeRaw = employeeHeader ? String(row[employeeHeader] ?? '').trim() : '';
                const employeeIdRaw = idHeader ? String(row[idHeader] ?? '').trim() : '';
                const employeeId = employeeIdRaw || extractEmployeeId(employeeRaw);
                const employeeName = stripEmployeeId(employeeRaw);
                const date = normalizeDateCell(row[dateHeader]);
                const status = normalizeStatus(String(row[statusHeader] ?? '').trim() || 'Absent');
                const department = departmentHeader ? String(row[departmentHeader] ?? '').trim() : '';
                const clockIn = clockInHeader ? normalizeTimeCell(row[clockInHeader]) : '';
                const clockOut = clockOutHeader ? normalizeTimeCell(row[clockOutHeader]) : '';
                const workDuration = totalTimeHeader ? normalizeDurationCell(row[totalTimeHeader]) : '';

                if (!employeeId || !date) return null;

                return {
                  employeeId,
                  employeeName,
                  department,
                  date,
                  clockIn,
                  clockOut,
                  workDuration,
                  status
                } as AttendanceRecord;
              })
              .filter((record): record is AttendanceRecord => record !== null);

            if (uiParsedRecords.length > 0) {
              await Promise.resolve(onImport(uiParsedRecords));
              e.target.value = '';
              return;
            }
          }
        }

        let currentDept = '';
        let attendanceDate = '';
        let headerMap: {
          sno: number;
          employeeId: number;
          name: number;
          inTime: number;
          outTime: number;
          workDuration: number;
          totalDuration: number;
          status: number;
          remarks: number;
        } | null = null;

        const getCell = (row: any[], index: number): string => {
          if (index < 0) return '';
          const value = row[index];
          if (value === null || value === undefined) return '';
          return String(value).trim();
        };

        const findHeaderIndex = (row: any[], aliases: string[]): number => {
          return row.findIndex((cell) => aliases.indexOf(normalizeHeader(cell)) !== -1);
        };

        data.forEach((row) => {
          const rowStr = row.join(' ');

          // Extract Attendance Date
          if (rowStr.toLowerCase().includes('attendance date')) {
            const match = rowStr.match(/(\d{1,2})-([a-zA-Z]{3})-(\d{4})/);
            if (match) {
              const months: Record<string, number> = {
                jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
                jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
              };
              const day = parseInt(match[1]);
              const month = months[match[2].toLowerCase()];
              const year = parseInt(match[3]);
              if (month !== undefined) {
                const d = new Date(year, month, day, 12, 0, 0);
                attendanceDate = formatDateIST(d);
              }
            }
          }

          // Extract Department
          if (rowStr.toLowerCase().includes('department')) {
            currentDept = rowStr.replace(/department/i, '').trim();
          }

          // Detect header row and map indices by column name to avoid shifted imports.
          if (!headerMap) {
            const snoIdx = findHeaderIndex(row, ['sno']);
            const empIdIdx = findHeaderIndex(row, ['ecode', 'employeecode', 'employeeid', 'empcode', 'empid']);
            const nameIdx = findHeaderIndex(row, ['name', 'employeename']);

            if (snoIdx !== -1 && empIdIdx !== -1 && nameIdx !== -1) {
              headerMap = {
                sno: snoIdx,
                employeeId: empIdIdx,
                name: nameIdx,
                inTime: findHeaderIndex(row, ['intime', 'clockin', 'in']),
                outTime: findHeaderIndex(row, ['outtime', 'clockout', 'out']),
                workDuration: findHeaderIndex(row, ['workdur', 'workduration', 'workhrs', 'workhours']),
                totalDuration: findHeaderIndex(row, ['totdur', 'totaldur', 'duration', 'totalduration']),
                status: findHeaderIndex(row, ['status']),
                remarks: findHeaderIndex(row, ['remarks', 'remark'])
              };
              return;
            }
          }

          // Parse data rows only after header is found.
          if (headerMap && attendanceDate) {
            const snoRaw = getCell(row, headerMap.sno);
            if (!snoRaw || Number.isNaN(Number(snoRaw))) return;

            const empId = getCell(row, headerMap.employeeId);
            const name = getCell(row, headerMap.name);
            const inTime = getCell(row, headerMap.inTime);
            const outTime = getCell(row, headerMap.outTime);
            const workDur = getCell(row, headerMap.workDuration) || getCell(row, headerMap.totalDuration);
            const status = getCell(row, headerMap.status);
            const remarks = getCell(row, headerMap.remarks);

            if (empId) {
              parsedRecords.push({
                employeeId: empId,
                employeeName: name,
                department: currentDept,
                date: attendanceDate,
                clockIn: inTime,
                clockOut: outTime,
                workDuration: workDur,
                status: normalizeStatus(status),
                remarks
              });
            }
          }
        });

        if (parsedRecords.length > 0) {
          await Promise.resolve(onImport(parsedRecords));
        } else {
          showAlert("No attendance records found in the file. Please check the format.");
        }
      } catch (error) {
        console.error('Failed to parse/import attendance file', error);
        showAlert('Failed to import attendance data. Please verify the file and try again.');
      } finally {
        setIsImportingLocal(false);
      }
    };
    reader.onerror = () => {
      setIsImportingLocal(false);
      showAlert('Failed to read the selected file.');
    };
    reader.readAsBinaryString(file);
    // Reset input
    e.target.value = '';
  };

  // Export functionality removed per user request

  const tableRows = React.useMemo(() => {
    return filteredRecords.map(record => ({
      record,
      employee: employees.find(e => employeeIdsMatch(e.id, record.employeeId)) || {
        id: String(record.employeeId || ''),
        name: record.employeeName || 'Unknown',
        department: record.department || 'N/A',
        avatar: '',
        joiningDate: todayStr
      }
    }));
  }, [filteredRecords, employees, employeeIdsMatch, todayStr]);

  const isImporting = Boolean(isImportingLocal || isImportingProp);

  const handleOpenEditAttendance = React.useCallback((row: { record: AttendanceRecord; employee: Employee }) => {
    const { record } = row;
    setEditingAttendance({
      ...record,
      clockIn: record.clockIn || '',
      clockOut: record.clockOut || '',
      workDuration: record.workDuration || '',
      remarks: record.remarks || '',
      department: record.department || ''
    });
    setIsEditModalOpen(true);
  }, []);

  React.useEffect(() => {
    if (!initialEditRecord || !initialEditRecord.id) return;
    setEditingAttendance({
      ...initialEditRecord,
      clockIn: initialEditRecord.clockIn || '',
      clockOut: initialEditRecord.clockOut || '',
      workDuration: initialEditRecord.workDuration || '',
      remarks: initialEditRecord.remarks || '',
      department: initialEditRecord.department || ''
    });
    setIsEditModalOpen(true);
    onInitialEditConsumed?.();
  }, [initialEditRecord, onInitialEditConsumed]);

  const handleSaveEditedAttendance = React.useCallback(async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!editingAttendance || !editingAttendance.id) return;
    if (!onUpdateAttendanceRecord) return;

    setIsSavingEdit(true);
    try {
      await Promise.resolve(onUpdateAttendanceRecord(editingAttendance));
      setIsEditModalOpen(false);
      setEditingAttendance(null);
    } catch (error) {
      console.error('Failed to update attendance record:', error);
      showAlert('Failed to update attendance record.');
    } finally {
      setIsSavingEdit(false);
    }
  }, [editingAttendance, onUpdateAttendanceRecord]);

  const handleOpenDeleteModal = React.useCallback(() => {
    setDeleteDate(todayStr);
    setDeleteEmployeeId('');
    setIsDeleteModalOpen(true);
  }, [todayStr]);

  const handleDeleteAttendanceRecords = React.useCallback(async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!onDeleteAttendanceByDate) return;
    if (!deleteDate) {
      showAlert('Please select a date.');
      return;
    }

    const selectedEmployee = deleteEmployeeId
      ? employees.find((employee) => employeeIdsMatch(employee.id, deleteEmployeeId))
      : undefined;
    const scopeLabel = selectedEmployee ? selectedEmployee.name : 'all users';

    if (!window.confirm(`Delete attendance data for ${scopeLabel} on ${deleteDate}?`)) {
      return;
    }

    setIsDeletingRecords(true);
    try {
      const deletedCount = await Promise.resolve(onDeleteAttendanceByDate(deleteDate, deleteEmployeeId || undefined));
      showAlert(deletedCount > 0
        ? `Deleted ${deletedCount} attendance record(s).`
        : 'No attendance records found for the selected date/user.');
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error('Failed to delete attendance records:', error);
      showAlert('Failed to delete attendance records. Please try again.');
    } finally {
      setIsDeletingRecords(false);
    }
  }, [deleteDate, deleteEmployeeId, employeeIdsMatch, employees, onDeleteAttendanceByDate]);

  const handleExportFilteredAttendance = async (): Promise<void> => {
    if (tableRows.length === 0) {
      showAlert('No attendance data available to export for current filters.');
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Attendance');

    // Define columns
    worksheet.columns = [
      { header: 'Employee', key: 'employee', width: 25 },
      { header: 'Employee ID', key: 'employeeId', width: 15 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Clock In', key: 'clockIn', width: 12 },
      { header: 'Clock Out', key: 'clockOut', width: 12 },
      { header: 'Total Time', key: 'totalTime', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Total Leave Left', key: 'totalLeaveLeft', width: 25 },
      { header: 'Leaves This Month', key: 'leavesThisMonth', width: 20 }
    ];

    // Add data
    tableRows.forEach(({ record, employee }) => {
      const summary = getLeaveSummary(employee, record);
      const leaveUsedTotal = summary.total ? `${formatLeaveNumber(summary.used)}/${formatLeaveNumber(summary.total)} (${formatLeaveNumber(summary.left)} left)` : '--';
      const monthlyUsage = getMonthlyLeaveUsage(employee, record);
      const monthlyLeaveTaken = `${formatLeaveNumber(monthlyUsage.taken)}/${monthlyUsage.totalDaysInMonth}`;

      const rowData = {
        employee: employee?.name || record.employeeName || 'Unknown',
        employeeId: record.employeeId,
        department: employee?.department || record.department || 'N/A',
        date: record.date,
        clockIn: record.clockIn || '--:--',
        clockOut: record.clockOut || '--:--',
        totalTime: record.workDuration || '--:--',
        status: record.status,
        totalLeaveLeft: leaveUsedTotal,
        leavesThisMonth: monthlyLeaveTaken
      };

      const row = worksheet.addRow(rowData);

      // Status coloring (optional but good for UI friendly)
      const statusCell = row.getCell('status');
      if (record.status === 'Present') statusCell.font = { color: { argb: 'FF0D6EFD' }, bold: true };
      else if (record.status === 'Work From Home') statusCell.font = { color: { argb: 'FF0B5ED7' }, bold: true };
      else if (record.status === 'Absent') statusCell.font = { color: { argb: 'FFDC3545' }, bold: true };
      else if (record.status === 'On Leave') statusCell.font = { color: { argb: 'FF198754' }, bold: true };
    });

    // Style the header
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2F5596' }
      };
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Add borders to all data cells
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' }
          };
          cell.alignment = { vertical: 'middle' };
        });
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `attendance_export_${todayIST()}.xlsx`);
  };

  const parseTimeToMinutes = React.useCallback((value: string | undefined): number | null => {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return null;

    const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i);
    if (!match) {
      // Check if it's a decimal number (Excel fraction of a day)
      const asNum = Number(raw);
      if (!Number.isNaN(asNum) && asNum > 0 && asNum < 1 && raw.indexOf('.') !== -1) {
        return Math.round(asNum * 24 * 60);
      }
      return null;
    }

    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const meridiem = (match[3] || '').toLowerCase();
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;

    return (hours * 60) + minutes;
  }, []);

  const parseDurationToMinutes = React.useCallback((value: string | undefined): number | null => {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return null;

    // HH:mm or H:mm
    const hhmm = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (hhmm) {
      const h = Number(hhmm[1]);
      const m = Number(hhmm[2]);
      if (!Number.isNaN(h) && !Number.isNaN(m)) return (h * 60) + m;
    }

    // "8h 30m" style
    const hm = raw.match(/(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?/);
    if (hm && (hm[1] || hm[2])) {
      const h = Number(hm[1] || 0);
      const m = Number(hm[2] || 0);
      if (!Number.isNaN(h) && !Number.isNaN(m)) return (h * 60) + m;
    }

    // Decimal hours, e.g. 8.5
    const asNumber = Number(raw);
    if (!Number.isNaN(asNumber)) return Math.round(asNumber * 60);

    return null;
  }, []);

  const exportDailyFlaggedAttendance = React.useCallback(async (mode: 'short-hours' | 'late-login'): Promise<void> => {
    if (viewMode !== 'Daily') {
      showAlert('This export is available only in Daily view.');
      return;
    }

    if (tableRows.length === 0) {
      showAlert('No attendance data available for selected day.');
      return;
    }

    const scheduledMinutes = 9 * 60;
    const formatMinsExcel = (minutes: number): string => {
      const safeMinutes = Math.max(0, Math.floor(Number(minutes) || 0));
      const hrs = Math.floor(safeMinutes / 60);
      const mins = safeMinutes % 60;
      return `${String(hrs).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`;
    };

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(mode === 'short-hours' ? 'Short Hours' : 'Late Login');

    const title = mode === 'short-hours' ? 'LOGIN HOURS SHORT' : 'LATE LOGIN REPORT';
    const totalCols = mode === 'short-hours' ? 10 : 8;

    // Header Row 1 (Title)
    const titleRow = worksheet.addRow([title]);
    worksheet.mergeCells(`A1:${String.fromCharCode(64 + totalCols)}1`);
    titleRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: mode === 'short-hours' ? 'FF5B9BD5' : 'FFF4B183' }
      };
      cell.font = { bold: true, size: 14, color: { argb: 'FF000000' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    titleRow.height = 30;

    // Header Row 2 (Column Names)
    let headers: string[] = [];
    if (mode === 'short-hours') {
      headers = [
        'Employee Name', 'Department', 'Date', 'Day', 'Scheduled',
        'Clock In', 'Clock Out', 'Total Work', 'Shortage', 'Shortage (minutes)'
      ];
      worksheet.columns = [
        { key: 'name', width: 25 },
        { key: 'dept', width: 20 },
        { key: 'date', width: 14 },
        { key: 'day', width: 14 },
        { key: 'sched', width: 12 },
        { key: 'in', width: 10 },
        { key: 'out', width: 10 },
        { key: 'work', width: 12 },
        { key: 'short', width: 12 },
        { key: 'shortMin', width: 20 }
      ];
    } else {
      headers = [
        'Employee Name', 'Department', 'Date', 'Day',
        'Clock In', 'Clock Out', 'Total Hours', 'Shortage (minutes)'
      ];
      worksheet.columns = [
        { key: 'name', width: 25 },
        { key: 'dept', width: 20 },
        { key: 'date', width: 14 },
        { key: 'day', width: 14 },
        { key: 'in', width: 10 },
        { key: 'out', width: 10 },
        { key: 'total', width: 12 },
        { key: 'shortMin', width: 18 }
      ];
    }

    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2EFDA' }
      };
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    let hasMatch = false;
    tableRows.forEach(({ record, employee }) => {
      const clockInMinutes = parseTimeToMinutes(record.clockIn);
      const clockOutMinutes = parseTimeToMinutes(record.clockOut);
      const durationMinutes = parseDurationToMinutes(record.workDuration);
      const derivedDuration = durationMinutes !== null
        ? durationMinutes
        : (clockInMinutes !== null && clockOutMinutes !== null && clockOutMinutes >= clockInMinutes
          ? (clockOutMinutes - clockInMinutes)
          : null);

      const isShortHours = derivedDuration !== null && derivedDuration < (9 * 60);
      const isLateLogin = clockInMinutes !== null && clockInMinutes > ((10 * 60) + 20);
      const isMatch = mode === 'short-hours' ? isShortHours : isLateLogin;

      if (!isMatch) return;
      hasMatch = true;

      const parsedDate = parseRecordDate(record.date);
      const workedMinutes = Math.max(0, derivedDuration ?? 0);
      const shortageMinutes = Math.max(0, scheduledMinutes - workedMinutes);

      let dataRow: any[];
      if (mode === 'short-hours') {
        dataRow = [
          employee?.name || record.employeeName || 'Unknown',
          employee?.department || record.department || 'N/A',
          parsedDate
            ? formatDateForDisplayIST(parsedDate, 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
            : String(record.date || ''),
          parsedDate
            ? new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'Asia/Kolkata' }).format(parsedDate)
            : '',
          formatMinsExcel(scheduledMinutes),
          record.clockIn || 'N/A',
          record.clockOut || 'N/A',
          formatMinsExcel(workedMinutes),
          formatMinsExcel(shortageMinutes),
          shortageMinutes
        ];
      } else {
        dataRow = [
          employee?.name || record.employeeName || 'Unknown',
          employee?.department || record.department || 'N/A',
          parsedDate
            ? formatDateForDisplayIST(parsedDate, 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
            : String(record.date || ''),
          parsedDate
            ? new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'Asia/Kolkata' }).format(parsedDate)
            : '',
          record.clockIn || 'N/A',
          record.clockOut || 'N/A',
          formatMinsExcel(workedMinutes),
          shortageMinutes
        ];
      }

      const row = worksheet.addRow(dataRow);
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' }
        };
        cell.alignment = { vertical: 'middle' };

        // Highlight clock in for late login (column 5 is 'Clock In' in late-login mode)
        if (mode === 'late-login' && colNumber === 5) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8CBAD' }
          };
        }
      });
    });

    if (!hasMatch) {
      showAlert(mode === 'short-hours'
        ? 'No employees found with working hours less than 9 hours for this day.'
        : 'No employees found with login after 10:20 for this day.');
      return;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const dateToken = formatDateIST(referenceDate);
    saveAs(blob, `${mode.replace('-', '_')}_${dateToken}.xlsx`);
  }, [
    viewMode,
    tableRows,
    parseTimeToMinutes,
    parseDurationToMinutes,
    referenceDate,
    parseRecordDate
  ]);

  const formatMinutesAsHM = React.useCallback((minutes: number): string => {
    const safeMinutes = Math.max(0, Math.floor(Number(minutes) || 0));
    const hrs = Math.floor(safeMinutes / 60);
    const mins = safeMinutes % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }, []);

  // Auto-calculate Work Duration in Edit Modal
  React.useEffect(() => {
    if (!isEditModalOpen || !editingAttendance) return;

    const { clockIn, clockOut } = editingAttendance;
    if (!clockIn || !clockOut) return;

    const inMins = parseTimeToMinutes(clockIn);
    const outMins = parseTimeToMinutes(clockOut);

    if (inMins !== null && outMins !== null && outMins > inMins) {
      const durationStr = formatMinutesAsHM(outMins - inMins);

      if (editingAttendance.workDuration !== durationStr) {
        setEditingAttendance(prev => prev ? ({ ...prev, workDuration: durationStr }) : null);
      }
    }
  }, [editingAttendance?.clockIn, editingAttendance?.clockOut, isEditModalOpen, parseTimeToMinutes, formatMinutesAsHM]);

  const columns = React.useMemo<ColumnDef<{ record: AttendanceRecord; employee: Employee }>[]>(() => ([
    {
      key: 'employee',
      header: 'Employee',
      accessor: ({ record, employee }) => `${employee?.name || record.employeeName || 'Unknown'} ${record.employeeId} ${employee?.department || record.department || ''}`,
      render: ({ record, employee }) => (
        <div className="d-flex align-items-center">
          {employee?.avatar ? (
            <img className="rounded-circle border" src={employee.avatar} alt={employee.name} width="36" height="36" style={{ objectFit: 'cover' }} />
          ) : (
            <div className="rounded-circle border bg-light d-flex align-items-center justify-content-center" style={{ width: '36px', height: '36px' }}>
              <Clock size={20} className="text-primary" />
            </div>
          )}
          <div className="ms-3">
            <div className="text-dark">{employee?.name || record.employeeName || 'Unknown'}</div>
            <div className="text-muted" style={{ fontSize: '11px' }}>ID: {record.employeeId}</div>
          </div>
        </div>
      )
    },
    {
      key: 'department',
      header: 'Department',
      accessor: ({ record, employee }) => employee?.department || record.department || 'N/A',
      render: ({ record, employee }) => <span className="text-muted">{employee?.department || record.department || 'N/A'}</span>
    },
    { key: 'date', header: 'Date', accessor: ({ record }) => formatDateForDisplayIST(record.date), render: ({ record }) => <span className="text-primary-emphasis">{formatDateForDisplayIST(record.date)}</span> },
    {
      key: 'clockIn',
      header: 'Clock In',
      accessor: ({ record }) => record.clockIn || '',
      render: ({ record }) => (
        <div className="d-flex align-items-center gap-1 text-dark">
          <Clock size={12} color="#2F5596" />
          {record.clockIn || '--:--'}
        </div>
      )
    },
    {
      key: 'clockOut',
      header: 'Clock Out',
      accessor: ({ record }) => record.clockOut || '',
      render: ({ record }) => (
        <div className="d-flex align-items-center gap-1 text-dark">
          <Clock size={12} color="#2F5596" />
          {record.clockOut || '--:--'}
        </div>
      )
    },
    {
      key: 'workDuration',
      header: 'Total Time',
      accessor: ({ record }) => record.workDuration || '',
      render: ({ record }) => {
        const mins = parseDurationToMinutes(record.workDuration);
        return <span>{mins !== null ? formatMinutesAsHM(mins) : (record.workDuration || '--:--')}</span>;
      }
    },
    {
      key: 'status',
      header: 'Status',
      accessor: ({ record }) => record.status,
      render: ({ record }) => (
        <Badge status={record.status} />
      )
    },
    {
      key: 'totalLeaveLeft',
      header: 'Total Leave Left',
      render: ({ employee, record }) => {
        const summary = getLeaveSummary(employee, record);
        if (!summary.total) return <span className="text-muted">--</span>;
        return (
          <div className="d-flex align-items-center gap-2">
            <span style={{ color: '#2F5596' }}>
              {formatLeaveNumber(summary.used)}/{formatLeaveNumber(summary.total)}
              <span className="ms-1 text-muted">({formatLeaveNumber(summary.left)} left)</span>
            </span>
            {employee && <Info size={14} className="text-primary cursor-pointer" onClick={() => onViewBalance?.(employee)} />}
          </div>
        );
      }
    },
    {
      key: 'leavesThisMonth',
      header: 'Leaves This Month',
      render: ({ employee, record }) => {
        const monthlyUsage = getMonthlyLeaveUsage(employee, record);
        return (
          <span style={{ color: '#2F5596' }}>
            {formatLeaveNumber(monthlyUsage.taken)}/{monthlyUsage.totalDaysInMonth}
          </span>
        );
      }
    },
    {
      key: 'actions',
      header: 'Actions',
      searchable: false,
      filterable: false,
      align: 'end',
      render: (row) => (
        <div className="d-flex gap-3 justify-content-end align-items-center">
          <button
            type="button"
            className="p-0 border-0 bg-transparent flex-shrink-0"
            style={{ color: '#2f5596', display: 'flex' }}
            onClick={() => handleOpenEditAttendance(row)}
            title="Edit"
          >
            <Edit3 size={16} />
          </button>
          {onDeleteAttendanceRecord && (
            <button
              type="button"
              className="p-0 border-0 bg-transparent flex-shrink-0"
              style={{ color: '#d14b64', display: 'flex' }}
              onClick={() => { void onDeleteAttendanceRecord(row.record); }}
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )
    }
  ]), [formatLeaveNumber, getLeaveSummary, getMonthlyLeaveUsage, onViewBalance, handleOpenEditAttendance, onDeleteAttendanceRecord, parseDurationToMinutes, formatMinutesAsHM]);

  return (
    <div className="card shadow-sm border-0 bg-white">
      <div className="card-header bg-white py-3 border-bottom-0">
        <div className="d-flex flex-wrap justify-content-end align-items-center gap-3">
          {/* Right: Actions */}
          <div className="d-flex flex-wrap gap-2">

            <label
              className={`btn btn-primary btn-sm d-flex align-items-center gap-2 fw-medium px-3 shadow-xs mb-0 ${isImporting ? 'disabled' : 'cursor-pointer'}`}
              style={{ backgroundColor: '#2F5596', borderColor: '#2F5596', opacity: isImporting ? 0.75 : 1, pointerEvents: isImporting ? 'none' : 'auto' }}
            >
              {isImporting ? <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> : <Upload size={14} />}
              {isImporting ? 'Importing...' : 'Import Attendance'}
              <input type="file" accept=".xlsx, .xls, .csv" className="d-none" onChange={handleFileChange} disabled={isImporting} />
            </label>
            <button
              type="button"
              className="btn btn-default btn-sm d-flex align-items-center gap-2 fw-medium px-3 shadow-xs"
              onClick={handleExportFilteredAttendance}
              disabled={tableRows.length === 0 || isImporting}
            >
              <Download size={14} /> Export Attendance
            </button>
            <button
              type="button"
              className="btn btn-default btn-sm d-flex align-items-center gap-2 fw-medium px-3 shadow-xs"
              // style={{ color: '#d14b64', display: 'flex', alignItems: 'center' }}
              onClick={handleOpenDeleteModal}
              disabled={isImporting}
              title="Delete"
            >
              <Trash2 size={16} /> Delete Attendance By Date
            </button>
            {viewMode === 'Daily' && (
              <>
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm d-flex align-items-center gap-2 fw-medium px-3 shadow-xs"
                  onClick={() => exportDailyFlaggedAttendance('short-hours')}
                  disabled={tableRows.length === 0 || isImporting}
                >
                  <Download size={14} /> Get Short Hours
                </button>
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm d-flex align-items-center gap-2 fw-medium px-3 shadow-xs"
                  onClick={() => exportDailyFlaggedAttendance('late-login')}
                  disabled={tableRows.length === 0 || isImporting}
                >
                  <Download size={14} /> Late Login
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pb-2">
        {/* Teams Avatar Selection */}
        <div className="d-flex flex-wrap gap-3 mb-2 border-top pt-2">
          {Object.entries(teams).map(([dept, members]) => (
            <div key={dept} className="team-filter-group">
              <div className="team ng-scope">
                <label className="BdrBtm">{dept} Team</label>
              </div>
              <div className="d-flex align-items-center gap-1">
                {members.map((m) => (
                  <div
                    key={m.id}
                    className={`avatar-selection cursor-pointer position-relative ${selectedMemberId && employeeIdsMatch(selectedMemberId, m.id) ? 'active' : ''}`}
                    onClick={() => setSelectedMemberId(selectedMemberId && employeeIdsMatch(selectedMemberId, m.id) ? null : m.id)}
                    title={m.name}
                  >
                    <img
                      src={m.avatar}
                      className={`rounded-circle border-2 border shadow-xs bg-white ${selectedMemberId && employeeIdsMatch(selectedMemberId, m.id) ? 'border-primary' : 'border-transparent'}`}
                      width="34" height="34"
                      style={{ objectFit: 'cover', transition: 'all 0.2s' }}
                    />
                    {selectedMemberId && employeeIdsMatch(selectedMemberId, m.id) && (
                      <div className="position-absolute bottom-0 end-0 card-bg-primary rounded-circle border border-white" style={{ width: '8px', height: '8px' }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Date Accordion Filter */}
        <div className="accordion-filter border-top">
          <div
            className="d-flex align-items-center gap-2 py-2 cursor-pointer"
            onClick={() => setIsDateAccordionOpen(!isDateAccordionOpen)}
          >
            {isDateAccordionOpen ? <ChevronDown size={18} className="text-primary" /> : <ChevronRight size={18} className="text-primary" />}
            <span className="text-dark">Date</span>
          </div>

          {isDateAccordionOpen && (
            <div className="ps-4 pb-3 animate-in fade-in slide-in-from-top-1">
              <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
                {['Custom', 'Today', 'Yesterday', 'This Week', 'Last Week', 'This Month', 'Last Month', 'Last 3 Months', 'This Year', 'Last Year', 'All Time', 'Pre-set'].map((filter) => (
                  <div key={filter} className="d-flex align-items-center gap-2">
                    <input
                      type="radio"
                      id={`radio-date-${filter}`}
                      name="dateRangeFilter"
                      className="form-check-input shadow-xs"
                      checked={selectedDateFilter === filter}
                      onChange={() => handleDateFilterChange(filter)}
                    />
                    <label htmlFor={`radio-date-${filter}`} className="text-muted mb-0 cursor-pointer">{filter}</label>
                  </div>
                ))}
              </div>
              <div className="d-flex flex-wrap align-items-end gap-3">
                <div className="d-flex align-items-center gap-2">
                  <label className="text-muted">Start Date</label>
                  <input
                    type="date"
                    className="form-control form-control-sm shadow-xs"
                    style={{ width: '140px' }}
                    value={startDate}
                    onChange={e => { setStartDate(e.target.value); setSelectedDateFilter('Custom'); }}
                  />
                </div>
                <div className="d-flex align-items-center gap-2">
                  <label className="text-muted">End Date</label>
                  <input
                    type="date"
                    className="form-control form-control-sm shadow-xs"
                    style={{ width: '140px' }}
                    value={endDate}
                    onChange={e => { setEndDate(e.target.value); setSelectedDateFilter('Custom'); }}
                  />
                </div>
                <button
                  className="btn btn-link btn-sm text-decoration-none fw-bold p-0"
                  style={{ color: '#2F5596' }}
                  onClick={handleClearFilters}
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      <div className="px-4 py-2 border-top">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
          {/* View Mode Toggle */}
          <div className="btn-group shadow-xs" style={{ borderRadius: '8px', overflow: 'hidden' }}>
            <button
              className={`btn btn-sm d-flex align-items-center gap-2 px-3 fw-medium border-0 ${viewMode === 'Daily' ? 'btn-primary' : 'bg-white text-dark'}`}
              onClick={() => { setViewMode('Daily'); setSelectedDateFilter('Pre-set'); }}
            >
              <Clock size={16} className={viewMode === 'Daily' ? 'text-white' : 'text-primary'} /> Daily
            </button>
            <button
              className={`btn btn-sm d-flex align-items-center gap-2 px-3 fw-medium border-0 ${viewMode === 'Weekly' ? 'btn-primary' : 'bg-white text-dark'}`}
              onClick={() => { setViewMode('Weekly'); setSelectedDateFilter('Pre-set'); }}
            >
              <Calendar size={16} className={viewMode === 'Weekly' ? 'text-white' : 'text-primary'} /> Weekly
            </button>
            <button
              className={`btn btn-sm d-flex align-items-center gap-2 px-3 fw-medium border-0 ${viewMode === 'Monthly' ? 'btn-primary' : 'bg-white text-dark'}`}
              onClick={() => { setViewMode('Monthly'); setSelectedDateFilter('Pre-set'); }}
            >
              <Calendar size={16} className={viewMode === 'Monthly' ? 'text-white' : 'text-primary'} /> Monthly
            </button>
          </div>

          {/* Date Navigator */}
          <div className="d-flex align-items-center gap-2 bg-light rounded-pill px-2 py-1 shadow-xs border">
            <button className="btn btn-sm btn-link text-dark p-1 hover-bg-gray rounded-circle" onClick={handlePrev}>
              <ChevronLeft size={20} />
            </button>
            <div className="fw-bold px-3 text-center" style={{ minWidth: '240px', color: '#2F5596', fontSize: '13px' }}>
              {getDateDisplay()}
            </div>
            <button className="btn btn-sm btn-link text-dark p-1 hover-bg-gray rounded-circle" onClick={handleNext}>
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      <CommonTable
        data={tableRows}
        columns={columns}
        getRowId={(row) => `${row.record.employeeId}-${row.record.date}`}
        globalSearchPlaceholder="Search attendance"
      />

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (isDeletingRecords) return;
          setIsDeleteModalOpen(false);
        }}
        title="Delete Attendance Records"
        size="sm"
        scrollable={false}
        footer={
          <>
            <button
              type="button"
              className="btn btn-default text-decoration-none"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isDeletingRecords}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="delete-attendance-form"
              className="btn btn-primary btn-sm d-flex align-items-center gap-2 fw-medium px-3 shadow-xs mb-0"
              disabled={isDeletingRecords || !deleteDate}
            >
              {isDeletingRecords ? 'Deleting...' : 'Delete'}
            </button>
          </>
        }
      >
        <form id="delete-attendance-form" onSubmit={handleDeleteAttendanceRecords}>
          <div className="row g-3">
            <div className="col-12">
              <label className="form-label fw-bold">Date</label>
              <input
                type="date"
                className="form-control"
                value={deleteDate}
                onChange={(event) => setDeleteDate(event.target.value)}
                required
              />
            </div>
            <div className="col-12">
              <label className="form-label fw-bold">User</label>
              <select
                className="form-select"
                value={deleteEmployeeId}
                onChange={(event) => setDeleteEmployeeId(event.target.value)}
              >
                <option value="">All Users</option>
                {employees.filter(emp => emp.employeeStatus !== 'Ex-Staff').map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name} ({employee.id})
                  </option>
                ))}
              </select>
              <span className="text-muted">Default is All Users.</span>
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          if (isSavingEdit) return;
          setIsEditModalOpen(false);
          setEditingAttendance(null);
        }}
        title="Edit Attendance"
        createdInfo={formatAuditInfo(editingAttendance?.createdAt, editingAttendance?.createdByName)}
        modifiedInfo={formatAuditInfo(editingAttendance?.modifiedAt, editingAttendance?.modifiedByName)}
        onVersionHistoryClick={() => {
          if (!editingAttendance?.id) return;
          onOpenAttendanceVersionHistory?.(editingAttendance.id);
        }}
        onOpenFormClick={() => {
          if (!editingAttendance?.id) return;
          onOpenAttendanceForm?.(editingAttendance.id);
        }}
        footer={
          <>
            <button
              className="btn btn-default text-decoration-none"
              onClick={() => {
                if (isSavingEdit) return;
                setIsEditModalOpen(false);
                setEditingAttendance(null);
              }}
              disabled={isSavingEdit}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-attendance-form"
              className="btn btn-primary px-4"
              disabled={isSavingEdit || !editingAttendance?.id}
            >
              {isSavingEdit ? 'Updating...' : 'Update Attendance'}
            </button>
          </>
        }
      >
        {editingAttendance && (
          <form id="edit-attendance-form" onSubmit={handleSaveEditedAttendance}>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label fw-bold">Employee</label>
                <input type="text" className="form-control" value={editingAttendance.employeeName || ''} readOnly />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-bold">Employee ID</label>
                <input type="text" className="form-control" value={editingAttendance.employeeId || ''} readOnly />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-bold">Department</label>
                <input
                  type="text"
                  className="form-control"
                  value={editingAttendance.department || ''}
                  onChange={(event) => setEditingAttendance({ ...editingAttendance, department: event.target.value })}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-bold">Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={editingAttendance.date || ''}
                  onChange={(event) => setEditingAttendance({ ...editingAttendance, date: event.target.value })}
                  required
                />
              </div>
              <div className="col-md-4">
                <label className="form-label fw-bold">Clock In</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="HH:mm"
                  value={editingAttendance.clockIn || ''}
                  onChange={(event) => setEditingAttendance({ ...editingAttendance, clockIn: event.target.value })}
                  onBlur={(event) => {
                    const formatted = parseTimeToMinutes(event.target.value);
                    if (formatted !== null) {
                      const h = Math.floor(formatted / 60);
                      const m = formatted % 60;
                      setEditingAttendance({ ...editingAttendance, clockIn: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` });
                    }
                  }}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label fw-bold">Clock Out</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="HH:mm"
                  value={editingAttendance.clockOut || ''}
                  onChange={(event) => setEditingAttendance({ ...editingAttendance, clockOut: event.target.value })}
                  onBlur={(event) => {
                    const formatted = parseTimeToMinutes(event.target.value);
                    if (formatted !== null) {
                      const h = Math.floor(formatted / 60);
                      const m = formatted % 60;
                      setEditingAttendance({ ...editingAttendance, clockOut: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` });
                    }
                  }}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label fw-bold">Work Duration</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="H:mm"
                  value={editingAttendance.workDuration || ''}
                  onChange={(event) => setEditingAttendance({ ...editingAttendance, workDuration: event.target.value })}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-bold">Status</label>
                <select
                  className="form-select"
                  value={editingAttendance.status}
                  onChange={(event) => setEditingAttendance({ ...editingAttendance, status: event.target.value as AttendanceStatus })}
                >
                  <option value="Present">Present</option>
                  <option value="Absent">Absent</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Weekend">Weekend</option>
                  <option value="Work From Home">Work From Home</option>
                </select>
              </div>
              <div className="col-12">
                <label className="form-label fw-bold">Remarks</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={editingAttendance.remarks || ''}
                  onChange={(event) => setEditingAttendance({ ...editingAttendance, remarks: event.target.value })}
                />
              </div>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default AttendanceTracker;
