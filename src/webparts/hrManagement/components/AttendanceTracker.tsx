
import * as React from 'react';
import * as XLSX from 'xlsx';
import { LeaveStatus } from '../types';
import type { Employee, LeaveRequest, AttendanceRecord, AttendanceStatus } from '../types';
import CommonTable, { ColumnDef } from '../ui/CommonTable';
import { Edit3, Clock, Info, ChevronDown, ChevronRight, Download, Search, Upload } from 'lucide-react';
import { formatDateIST, getNowIST, todayIST } from '../utils/dateTime';

interface AttendanceTrackerProps {
  employees: Employee[];
  leaveRequests: LeaveRequest[];
  attendanceRecords: AttendanceRecord[];
  onImport: (records: AttendanceRecord[]) => void;
  onEditEmployeeLeave?: (employee: Employee) => void;
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
  onEditEmployeeLeave,
  onViewBalance,
  selectedUserId,
  leaveQuotas
}) => {
  const [isDateAccordionOpen, setIsDateAccordionOpen] = React.useState(true);
  const [isSmartSearchOpen, setIsSmartSearchOpen] = React.useState(false);
  const [selectedDateFilter, setSelectedDateFilter] = React.useState('All Time');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [selectedMemberId, setSelectedMemberId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');

  const today = getNowIST();
  const todayStr = todayIST();

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
        if (request.status !== LeaveStatus.Approved && request.status !== LeaveStatus.Pending) return false;
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
      const matchesSearch = !searchQuery ||
        recordName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(record.employeeId ?? '').toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesMember || !matchesSearch) return false;

      // 2. Date presets filtering
      const recDate = new Date(record.date);
      const recTime = recDate.getTime();

      const startOfDay = (d: Date) => {
        const res = new Date(d.getTime());
        res.setHours(0, 0, 0, 0);
        return res;
      };

      if (selectedDateFilter === 'Today') {
        return record.date === todayStr;
      }

      if (selectedDateFilter === 'Yesterday') {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return record.date === formatDateIST(yesterday);
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
        return record.date >= startDate && record.date <= endDate;
      }

      if (selectedDateFilter === 'All Time') {
        return true;
      }

      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [attendanceRecords, employees, selectedMemberId, searchQuery, selectedDateFilter, startDate, endDate, todayStr, today, employeeIdsMatch, normalizeText]);

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

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      const objectRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

      const parsedRecords: AttendanceRecord[] = [];

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
            onImport(uiParsedRecords);
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
        onImport(parsedRecords);
      } else {
        alert("No attendance records found in the file. Please check the format.");
      }
    };
    reader.readAsBinaryString(file);
    // Reset input
    e.target.value = '';
  };

  const exportToCSV = () => {
    const headers = ['Employee', 'ID', 'Department', 'Date', 'Clock In', 'Clock Out', 'Total Time', 'Status'];

    const csvCell = (value: unknown): string => {
      const raw = String(value ?? '');
      if (/[",\n]/.test(raw)) {
        return `"${raw.replace(/"/g, '""')}"`;
      }
      return raw;
    };

    const rows = filteredRecords.map(record => {
      const emp = employees.find(e => employeeIdsMatch(e.id, record.employeeId));
      const name = emp?.name || record.employeeName || 'Unknown';
      return [
        name,
        String(record.employeeId || ''),
        emp?.department || record.department || 'N/A',
        record.date,
        record.clockIn || '--:--',
        record.clockOut || '--:--',
        record.workDuration || '00:00',
        record.status
      ];
    });

    const csvContent = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `attendance_export_${selectedDateFilter.replace(/\s+/g, '_')}_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
        <span className={`badge ${record.status === 'Present' ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} border-0`} style={{ fontSize: '10px' }}>
          {record.status}
        </span>
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
      key: 'actions',
      header: 'Actions',
      searchable: false,
      filterable: false,
      align: 'end',
      render: ({ employee }) => (
        <button
          className="btn btn-sm btn-light border d-inline-flex align-items-center gap-1 fw-bold px-3 shadow-xs"
          style={{ fontSize: '11px', borderRadius: '4px' }}
          onClick={() => onEditEmployeeLeave?.(employee)}
        >
          <Edit3 size={14} /> Edit
        </button>
      )
    }
  ]), [formatLeaveNumber, getLeaveSummary, onViewBalance, onEditEmployeeLeave]);

  return (
    <div className="card shadow-sm border-0 bg-white">
      <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center border-bottom-0">
        <h5 className="mb-0 fw-bold" style={{ color: '#2F5596', fontSize: '18px' }}>Global Attendance & Payroll Directory</h5>
        <div className="d-flex gap-2">
          <label className="btn btn-primary btn-sm d-flex align-items-center gap-2 fw-medium px-3 shadow-xs mb-0 cursor-pointer" style={{ borderRadius: '4px' }}>
            <Upload size={14} /> Import Data
            <input type="file" accept=".xlsx, .xls, .csv" className="d-none" onChange={handleFileChange} />
          </label>
          <button
            className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2 fw-medium px-3 shadow-xs"
            onClick={exportToCSV}
            style={{ borderRadius: '4px' }}
          >
            <Download size={14} /> Export CSV
          </button>
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
              <div className="row g-3 mb-3">
                {/* Added explicit type assertion to nested array to fix TS 'unknown' type inference on .map call */}
                {([
                  ['Custom', 'Today', 'Yesterday', 'This Week', 'Last Week', 'This Month'],
                  ['Last Month', 'Last 3 Months', 'This Year', 'Last Year', 'All Time', 'Pre-set']
                ] as string[][]).map((row, rIdx) => (
                  <div key={rIdx} className="col-12 d-flex flex-wrap gap-4">
                    {row.map(filter => (
                      <div key={filter} className="d-flex align-items-center gap-2">
                        <input
                          type="radio"
                          id={`radio-date-${filter}`}
                          name="dateRangeFilter"
                          className="form-check-input shadow-xs"
                          checked={selectedDateFilter === filter}
                          onChange={() => setSelectedDateFilter(filter)}
                        />
                        <label htmlFor={`radio-date-${filter}`} className="small text-muted mb-0 cursor-pointer">{filter}</label>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="d-flex align-items-center gap-3">
                <div className="d-flex align-items-center gap-2">
                  <label className="small text-muted fw-bold">Start Date</label>
                  <input
                    type="date"
                    className="form-control form-control-sm shadow-xs"
                    style={{ width: '135px' }}
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
              <div className="input-group input-group-sm shadow-xs" style={{ maxWidth: '400px' }}>
                <span className="input-group-text bg-white border-end-0 text-muted"><Search size={14} /></span>
                <input
                  type="text"
                  className="form-control border-start-0 ps-0"
                  placeholder="Search by name, ID or role..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <CommonTable
        data={tableRows}
        columns={columns}
        getRowId={(row) => `${row.record.employeeId}-${row.record.date}`}
        globalSearchPlaceholder="Search attendance"
      />

      <style>{`
        .avatar-selection:hover img { transform: scale(1.1); }
        .avatar-selection.active img { border-color: #2F5596 !important; transform: scale(1.1); box-shadow: 0 0 0 2px rgba(47, 85, 150, 0.1); }
        .accordion-filter:hover { background-color: #fafafa; }
        .shadow-xs { box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .animate-in { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        .form-check-input:checked { background-color: #2F5596; border-color: #2F5596; }
      `}</style>
    </div>
  );
};

export default AttendanceTracker;
