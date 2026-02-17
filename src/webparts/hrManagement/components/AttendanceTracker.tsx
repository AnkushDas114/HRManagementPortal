
import * as React from 'react';
import * as XLSX from 'xlsx';
import { LeaveStatus } from '../types';
import type { Employee, LeaveRequest, AttendanceRecord, AttendanceStatus } from '../types';
import Badge from '../ui/Badge';
import CommonTable, { ColumnDef } from '../ui/CommonTable';
import Modal from '../ui/Modal';
import { Edit3, Clock, Info, ChevronDown, ChevronRight, ChevronLeft, Search, Upload, Calendar, Download } from 'lucide-react';
import { formatDateIST, getNowIST, todayIST, formatDateForDisplayIST } from '../utils/dateTime';

interface AttendanceTrackerProps {
  employees: Employee[];
  leaveRequests: LeaveRequest[];
  attendanceRecords: AttendanceRecord[];
  onImport: (records: AttendanceRecord[]) => Promise<void> | void;
  onUpdateAttendanceRecord?: (record: AttendanceRecord) => Promise<void> | void;
  onViewBalance?: (employee: Employee) => void;
  isImporting?: boolean;
  selectedUserId?: string | null;
  leaveQuotas?: Record<string, number>;
}

const AttendanceTracker: React.FC<AttendanceTrackerProps> = ({
  employees,
  leaveRequests,
  attendanceRecords,
  onImport,
  onUpdateAttendanceRecord,
  onViewBalance,
  isImporting: isImportingProp,
  selectedUserId,
  leaveQuotas
}) => {
  const [isImportingLocal, setIsImportingLocal] = React.useState(false);
  const [isDateAccordionOpen, setIsDateAccordionOpen] = React.useState(true);
  const [isSmartSearchOpen, setIsSmartSearchOpen] = React.useState(false);
  const [selectedDateFilter, setSelectedDateFilter] = React.useState('All Time');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [selectedMemberId, setSelectedMemberId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [isSavingEdit, setIsSavingEdit] = React.useState(false);
  const [editingAttendance, setEditingAttendance] = React.useState<AttendanceRecord | null>(null);

  const today = getNowIST();
  const todayStr = todayIST();

  const [viewMode, setViewMode] = React.useState<'Daily' | 'Weekly' | 'Monthly'>('Weekly');
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
    return Object.values(leaveQuotas || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
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
        const isWorkFromHomeRequest = request.requestCategory === 'Work From Home' || /work\s*from\s*home|wfh/i.test(String(request.leaveType || ''));
        if (isWorkFromHomeRequest) return false;
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
      const isWorkFromHomeRequest = request.requestCategory === 'Work From Home' || /work\s*from\s*home|wfh/i.test(String(request.leaveType || ''));
      if (isWorkFromHomeRequest) return;
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
    employees.forEach(emp => {
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

      // 1. Member selection and search query filtering
      const recordName = employee?.name || record.employeeName || 'Unknown';
      const matchesMemberById = selectedMemberId ? employeeIdsMatch(record.employeeId, selectedMemberId) : true;
      const matchesMemberByName = !!selectedEmployee && normalizeText(recordName) === normalizeText(selectedEmployee.name);
      const matchesMember = !selectedMemberId || matchesMemberById || matchesMemberByName;
      const query = searchQuery.toLowerCase().trim();
      const departmentText = (employee?.department || record.department || '').toLowerCase();
      const roleText = (employee?.position || '').toLowerCase();
      const matchesSearch = !query ||
        recordName.toLowerCase().includes(query) ||
        String(record.employeeId ?? '').toLowerCase().includes(query) ||
        departmentText.includes(query) ||
        roleText.includes(query);

      if (!matchesMember || !matchesSearch) return false;

      // 2. Date presets filtering
      const recDate = parseRecordDate(record.date);
      if (!recDate) return false;
      const recTime = recDate.getTime();
      const recDateKey = formatDateIST(recDate);

      const startOfDay = (d: Date) => {
        const res = new Date(d.getTime());
        res.setHours(0, 0, 0, 0);
        return res;
      };

      if (selectedDateFilter === 'Today') {
        return recDateKey === todayStr;
      }

      if (selectedDateFilter === 'Yesterday') {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return recDateKey === formatDateIST(yesterday);
      }

      if (selectedDateFilter === 'This Week') {
        const firstDayOfWeek = new Date();
        firstDayOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
        return recTime >= startOfDay(firstDayOfWeek).getTime();
      }

      if (selectedDateFilter === 'Last Week') {
        const lastWeekStart = new Date();
        lastWeekStart.setDate(today.getDate() - today.getDay() - 7);
        const lastWeekEnd = new Date();
        lastWeekEnd.setDate(today.getDate() - today.getDay() - 1);
        return recTime >= startOfDay(lastWeekStart).getTime() && recTime <= startOfDay(lastWeekEnd).getTime();
      }

      if (selectedDateFilter === 'This Month') {
        return recDate.getMonth() === today.getMonth() && recDate.getFullYear() === today.getFullYear();
      }

      if (selectedDateFilter === 'Last Month') {
        const lastMonth = new Date();
        lastMonth.setMonth(today.getMonth() - 1);
        return recDate.getMonth() === lastMonth.getMonth() && recDate.getFullYear() === lastMonth.getFullYear();
      }

      if (selectedDateFilter === 'Last 3 Months') {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(today.getMonth() - 3);
        return recTime >= startOfDay(threeMonthsAgo).getTime();
      }

      if (selectedDateFilter === 'This Year') {
        return recDate.getFullYear() === today.getFullYear();
      }

      if (selectedDateFilter === 'Last Year') {
        return recDate.getFullYear() === today.getFullYear() - 1;
      }

      if (selectedDateFilter === 'Custom' && startDate && endDate) {
        const start = parseRecordDate(startDate);
        const end = parseRecordDate(endDate);
        if (!start || !end) return false;
        return recTime >= startOfDay(start).getTime() && recTime <= startOfDay(end).getTime();
      }

      // 3. View mode filtering (Daily, Weekly, Monthly)
      const refDateStr = formatDateIST(referenceDate);

      if (viewMode === 'Daily') {
        return recDateKey === refDateStr;
      }

      if (viewMode === 'Weekly') {
        const startOfWeek = new Date(referenceDate);
        startOfWeek.setDate(referenceDate.getDate() - referenceDate.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const recStart = new Date(recDate.getTime());
        recStart.setHours(0, 0, 0, 0);

        return recStart >= startOfWeek && recStart <= endOfWeek;
      }

      if (viewMode === 'Monthly') {
        return recDate.getMonth() === referenceDate.getMonth() && recDate.getFullYear() === referenceDate.getFullYear();
      }

      if (selectedDateFilter === 'All Time') {
        return true;
      }

      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [attendanceRecords, employees, selectedMemberId, searchQuery, selectedDateFilter, startDate, endDate, todayStr, today, employeeIdsMatch, normalizeText, viewMode, referenceDate, parseRecordDate]);

  const handlePrev = () => {
    const nextDate = new Date(referenceDate);
    if (viewMode === 'Daily') nextDate.setDate(referenceDate.getDate() - 1);
    else if (viewMode === 'Weekly') nextDate.setDate(referenceDate.getDate() - 7);
    else if (viewMode === 'Monthly') nextDate.setMonth(referenceDate.getMonth() - 1);
    setReferenceDate(nextDate);
  };

  const handleNext = () => {
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
      return `${formatDateForDisplayIST(new Date(startDate), 'en-US', { day: 'numeric', month: 'short' })} - ${formatDateForDisplayIST(new Date(endDate), 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }

    if (viewMode === 'Daily') {
      return formatDateForDisplayIST(referenceDate, 'en-US', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
    }
    if (viewMode === 'Weekly') {
      const start = new Date(referenceDate);
      start.setDate(referenceDate.getDate() - referenceDate.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${formatDateForDisplayIST(start, 'en-US', { day: 'numeric', month: 'short' })} - ${formatDateForDisplayIST(end, 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    if (viewMode === 'Monthly') {
      return formatDateForDisplayIST(referenceDate, 'en-US', { month: 'long', year: 'numeric' });
    }
    return '';
  };

  const handleDateFilterChange = (filter: string) => {
    const now = getNowIST();

    // Map Presets to View Modes
    if (filter === 'Today') {
      setReferenceDate(now);
      setViewMode('Daily');
      setSelectedDateFilter('All Time'); // Treat as shortcut
      return;
    }
    if (filter === 'Yesterday') {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      setReferenceDate(d);
      setViewMode('Daily');
      setSelectedDateFilter('All Time');
      return;
    }
    if (filter === 'This Week') {
      setReferenceDate(now);
      setViewMode('Weekly');
      setSelectedDateFilter('All Time');
      return;
    }
    if (filter === 'Last Week') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      setReferenceDate(d);
      setViewMode('Weekly');
      setSelectedDateFilter('All Time');
      return;
    }
    if (filter === 'This Month') {
      setReferenceDate(now);
      setViewMode('Monthly');
      setSelectedDateFilter('All Time');
      return;
    }
    if (filter === 'Last Month') {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 1);
      setReferenceDate(d);
      setViewMode('Monthly');
      setSelectedDateFilter('All Time');
      return;
    }

    // For other filters (Custom, Ranges), apply strict filtering
    setSelectedDateFilter(filter);
  };

  const handleClearFilters = () => {
    setSelectedDateFilter('All Time');
    setStartDate('');
    setEndDate('');
    setSelectedMemberId(null);
    setSearchQuery('');
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
        if (normalized === 'upcoming') return 'Upcoming' as AttendanceStatus;
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
          alert("No attendance records found in the file. Please check the format.");
        }
      } catch (error) {
        console.error('Failed to parse/import attendance file', error);
        alert('Failed to import attendance data. Please verify the file and try again.');
      } finally {
        setIsImportingLocal(false);
      }
    };
    reader.onerror = () => {
      setIsImportingLocal(false);
      alert('Failed to read the selected file.');
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
      alert('Failed to update attendance record.');
    } finally {
      setIsSavingEdit(false);
    }
  }, [editingAttendance, onUpdateAttendanceRecord]);

  const handleExportFilteredAttendance = (): void => {
    if (tableRows.length === 0) {
      alert('No attendance data available to export for current filters.');
      return;
    }

    const exportRows = tableRows.map(({ record, employee }) => {
      const summary = getLeaveSummary(employee, record);
      const leaveUsedTotal = summary.total ? `${formatLeaveNumber(summary.used)}/${formatLeaveNumber(summary.total)} (${formatLeaveNumber(summary.left)} left)` : '--';
      const monthlyUsage = getMonthlyLeaveUsage(employee, record);
      const monthlyLeaveTaken = `${formatLeaveNumber(monthlyUsage.taken)}/${monthlyUsage.totalDaysInMonth}`;

      return {
        Employee: employee?.name || record.employeeName || 'Unknown',
        'Employee ID': record.employeeId,
        Department: employee?.department || record.department || 'N/A',
        Date: record.date,
        'Clock In': record.clockIn || '--:--',
        'Clock Out': record.clockOut || '--:--',
        'Total Time': record.workDuration || '--:--',
        Status: record.status,
        'Total Leave Left': leaveUsedTotal,
        'Leaves This Month': monthlyLeaveTaken
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    worksheet['!cols'] = [
      { wch: 24 }, // Employee
      { wch: 14 }, // Employee ID
      { wch: 16 }, // Department
      { wch: 12 }, // Date
      { wch: 10 }, // Clock In
      { wch: 10 }, // Clock Out
      { wch: 12 }, // Total Time
      { wch: 12 }, // Status
      { wch: 20 }, // Total Leave Left
      { wch: 18 }  // Leaves This Month
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');
    XLSX.writeFile(workbook, `attendance_export_${todayIST()}.xlsx`);
  };

  const columns = React.useMemo<ColumnDef<{ record: AttendanceRecord; employee: Employee }>[]>(() => ([
    {
      key: 'employee',
      header: 'Employee',
      accessor: ({ record, employee }) => employee?.name || record.employeeName || 'Unknown',
      render: ({ record, employee }) => (
        <div className="d-flex align-items-center">
          {employee?.avatar ? (
            <img className="rounded-circle border" src={employee.avatar} alt={employee.name} width="36" height="36" style={{ objectFit: 'cover' }} />
          ) : (
            <div className="rounded-circle border bg-light d-flex align-items-center justify-content-center" style={{ width: '36px', height: '36px' }}>
              <Clock size={20} className="text-muted" />
            </div>
          )}
          <div className="ms-3">
            <div className="fw-bold text-dark small">{employee?.name || record.employeeName || 'Unknown'}</div>
            <div className="text-muted" style={{ fontSize: '11px' }}>ID: {record.employeeId}</div>
          </div>
        </div>
      )
    },
    {
      key: 'department',
      header: 'Department',
      accessor: ({ record, employee }) => employee?.department || record.department || 'N/A',
      render: ({ record, employee }) => <span className="small text-muted">{employee?.department || record.department || 'N/A'}</span>
    },
    { key: 'date', header: 'Date', accessor: ({ record }) => record.date, render: ({ record }) => <span className="small fw-bold text-primary-emphasis">{record.date}</span> },
    {
      key: 'clockIn',
      header: 'Clock In',
      accessor: ({ record }) => record.clockIn || '',
      render: ({ record }) => (
        <div className="d-flex align-items-center gap-1 small text-dark">
          <Clock size={12} className="text-success" />
          {record.clockIn || '--:--'}
        </div>
      )
    },
    {
      key: 'clockOut',
      header: 'Clock Out',
      accessor: ({ record }) => record.clockOut || '',
      render: ({ record }) => (
        <div className="d-flex align-items-center gap-1 small text-dark">
          <Clock size={12} className="text-danger" />
          {record.clockOut || '--:--'}
        </div>
      )
    },
    {
      key: 'workDuration',
      header: 'Total Time',
      accessor: ({ record }) => record.workDuration || '',
      render: ({ record }) => <span className="small fw-medium">{record.workDuration || '--:--'}</span>
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
            <span className="fw-bold" style={{ color: '#2F5596' }}>
              {formatLeaveNumber(summary.used)}/{formatLeaveNumber(summary.total)}
              <span className="ms-1 text-muted">({formatLeaveNumber(summary.left)} left)</span>
            </span>
            {employee && <Info size={14} className="text-muted cursor-pointer" onClick={() => onViewBalance?.(employee)} />}
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
          <span className="fw-bold" style={{ color: '#2F5596' }}>
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
        <button
          className="btn btn-sm btn-light border d-inline-flex align-items-center gap-1 fw-bold px-3 shadow-xs"
          style={{ fontSize: '11px', borderRadius: '4px' }}
          onClick={() => handleOpenEditAttendance(row)}
        >
          <Edit3 size={14} /> Edit
        </button>
      )
    }
  ]), [formatLeaveNumber, getLeaveSummary, getMonthlyLeaveUsage, onViewBalance, handleOpenEditAttendance]);

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
              className="btn btn-outline-primary btn-sm d-flex align-items-center gap-2 fw-medium px-3 shadow-xs"
              onClick={handleExportFilteredAttendance}
              disabled={tableRows.length === 0 || isImporting}
            >
              <Download size={14} /> Export Attendance
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 pb-2">
        {/* Teams Avatar Selection */}
        <div className="d-flex flex-wrap gap-5 mb-4 border-top pt-3">
          {Object.entries(teams).map(([dept, members]) => (
            <div key={dept} className="team-filter-group">
              <div className="small text-muted border-bottom mb-2 pb-1 fw-bold text-uppercase" style={{ fontSize: '10px', letterSpacing: '0.5px' }}>{dept} Team</div>
              <div className="d-flex align-items-center gap-2">
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
                      <div className="position-absolute bottom-0 end-0 bg-primary rounded-circle border border-white" style={{ width: '8px', height: '8px' }} />
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
            {isDateAccordionOpen ? <ChevronDown size={18} className="text-dark" /> : <ChevronRight size={18} className="text-dark" />}
            <span className="fw-bold small text-dark">Date</span>
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
                    <label htmlFor={`radio-date-${filter}`} className="small text-muted mb-0 cursor-pointer">{filter}</label>
                  </div>
                ))}
              </div>
              <div className="d-flex flex-wrap align-items-end gap-3">
                <div className="d-flex align-items-center gap-2">
                  <label className="small text-muted fw-bold">Start Date</label>
                  <input
                    type="date"
                    className="form-control form-control-sm shadow-xs"
                    style={{ width: '140px' }}
                    value={startDate}
                    onChange={e => { setStartDate(e.target.value); setSelectedDateFilter('Custom'); }}
                  />
                </div>
                <div className="d-flex align-items-center gap-2">
                  <label className="small text-muted fw-bold">End Date</label>
                  <input
                    type="date"
                    className="form-control form-control-sm shadow-xs"
                    style={{ width: '135px' }}
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

        {/* SmartSearch Filter */}
        <div className="accordion-filter border-top">
          <div
            className="d-flex align-items-center gap-2 py-2 cursor-pointer"
            onClick={() => setIsSmartSearchOpen(!isSmartSearchOpen)}
          >
            {isSmartSearchOpen ? <ChevronDown size={18} className="text-dark" /> : <ChevronRight size={18} className="text-dark" />}
            <span className="fw-bold small text-dark">SmartSearch – Filters</span>
          </div>
          {isSmartSearchOpen && (
            <div className="ps-4 pb-3 animate-in fade-in">
              <div className="smartsearch-box">
                <Search size={14} className="smartsearch-icon" />
                <input
                  type="text"
                  className="form-control form-control-sm shadow-xs"
                  placeholder="Search by name, ID or role..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
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
              onClick={() => setViewMode('Daily')}
            >
              <Clock size={16} className={viewMode === 'Daily' ? 'text-white' : 'text-primary'} /> Daily
            </button>
            <button
              className={`btn btn-sm d-flex align-items-center gap-2 px-3 fw-medium border-0 ${viewMode === 'Weekly' ? 'btn-primary' : 'bg-white text-dark'}`}
              onClick={() => setViewMode('Weekly')}
            >
              <Calendar size={16} className={viewMode === 'Weekly' ? 'text-white' : 'text-primary'} /> Weekly
            </button>
            <button
              className={`btn btn-sm d-flex align-items-center gap-2 px-3 fw-medium border-0 ${viewMode === 'Monthly' ? 'btn-primary' : 'bg-white text-dark'}`}
              onClick={() => setViewMode('Monthly')}
            >
              <Calendar size={16} className={viewMode === 'Monthly' ? 'text-white' : 'text-primary'} /> Monthly
            </button>
          </div>

          {/* Date Navigator */}
          <div className="d-flex align-items-center gap-2 bg-light rounded-pill px-2 py-1 shadow-xs border">
            <button className="btn btn-sm btn-link text-dark p-1 hover-bg-gray rounded-circle" onClick={handlePrev}>
              <ChevronLeft size={20} />
            </button>
            <div className="fw-bold px-3 text-center" style={{ minWidth: '180px', color: '#2F5596', fontSize: '13px' }}>
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
        isOpen={isEditModalOpen}
        onClose={() => {
          if (isSavingEdit) return;
          setIsEditModalOpen(false);
          setEditingAttendance(null);
        }}
        title="Edit Attendance"
        footer={
          <>
            <button
              className="btn btn-link text-decoration-none"
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
                  <option value="Upcoming">Upcoming</option>
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
