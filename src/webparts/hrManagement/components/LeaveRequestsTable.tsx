
import * as React from 'react';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { LeaveRequest, Employee } from '../types';
import { LeaveStatus } from '../types';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';
import CommonTable, { ColumnDef } from '../ui/CommonTable';
import { Check, X, Filter, MessageSquare, Info, RotateCcw, ChevronDown, ChevronRight, Clock, Download, FileText } from 'lucide-react';
import { formatAuditInfo, getNowIST, todayIST, formatDateForDisplayIST } from '../utils/dateTime';

interface LeaveRequestsTableProps {
  requests: LeaveRequest[];
  employees: Employee[];
  leaveQuotas: Record<string, number>;
  filter: LeaveStatus | 'All';
  onFilterChange: (filter: LeaveStatus | 'All') => void;
  onUpdateStatus: (id: number, status: LeaveStatus, comment: string) => void;
  onDelete: (id: number) => void;
  onViewBalance?: (employee: Employee) => void;
  onOpenRequestForm?: (requestId: number) => void;
  onOpenRequestVersionHistory?: (requestId: number) => void;
  teams: string[];
  title?: string;
  showLeaveBalance?: boolean;
  showGenerateReportButton?: boolean;
  externalOpenReportKey?: number;
  reportMode?: 'leave' | 'wfh';
}

type ReportDatePreset =
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

interface ReportTypeGroup {
  type: string;
  entries: Array<{
    requestId: number;
    employeeId: string;
    employeeName: string;
    department: string;
    requestCategory: string;
    startDate: string;
    endDate: string;
    description: string;
    status: LeaveStatus;
    count: number;
    days: number;
    submittedAt: string;
    approverName: string;
    approverComment: string;
    isHalfDay: boolean;
    halfDayType: string;
    isRecurring: boolean;
    recurringFrequency: string;
  }>;
}

interface LeaveReportRow {
  employee: Employee;
  planned: number;
  unplanned: number;
  workFromHome: number;
  maternity: number;
  maternityTotal: number; // Used in period
  maternityQuota: number; // Entitlement
  paternity: number;
  paternityTotal: number; // Used in period
  paternityQuota: number; // Entitlement
  restrictedHoliday: number;
  halfDay: number;
  totalLeave: number;
  details: ReportTypeGroup[];
}

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

const resolvePresetRange = (preset: ReportDatePreset, today: Date): { start: Date | null; end: Date | null } => {
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

const normalizeLeaveType = (value: string): string => value.toLowerCase().replace(/[^a-z]/g, '');

const roundReportValue = (value: number): number => Number(value.toFixed(2));

const isWorkFromHomeRequest = (request: LeaveRequest): boolean => (
  request.requestCategory === 'Work From Home' ||
  /work\s*from\s*home|wfh/i.test(String(request.leaveType || ''))
);

const classifyLeaveBucket = (request: LeaveRequest): 'planned' | 'unplanned' | 'restrictedHoliday' | 'maternity' | 'paternity' => {
  const raw = String(request.leaveType || '').toLowerCase();
  const leaveType = normalizeLeaveType(raw);
  if (
    leaveType.includes('restrictedholiday') ||
    leaveType.includes('restrictedleave') ||
    leaveType.includes('restricted') ||
    leaveType === 'rh'
  ) return 'restrictedHoliday';
  if (leaveType.includes('maternity')) return 'maternity';
  if (leaveType.includes('paternity')) return 'paternity';
  // Check unplanned before planned to avoid matching "unplanned" as planned
  if (leaveType.includes('unplanned')) return 'unplanned';
  if (leaveType.includes('planned')) return 'planned';
  return 'unplanned';
};

const getReportGroupMeta = (
  request: LeaveRequest,
  isWfhReport: boolean
): { key: 'planned' | 'unplanned' | 'restrictedHoliday' | 'maternity' | 'paternity' | 'workFromHome'; label: string } => {
  if (isWfhReport || isWorkFromHomeRequest(request)) {
    return { key: 'workFromHome', label: 'Work From Home' };
  }

  const bucket = classifyLeaveBucket(request);
  if (bucket === 'planned') return { key: bucket, label: 'Planned Leaves' };
  if (bucket === 'unplanned') return { key: bucket, label: 'UnPlanned Leaves' };
  if (bucket === 'restrictedHoliday') return { key: bucket, label: 'Restricted Holiday' };
  if (bucket === 'maternity') return { key: bucket, label: 'Maternity' };
  return { key: bucket, label: 'Paternity' };
};

const daysBetweenInclusive = (start: Date, end: Date): number => {
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.floor((endUtc - startUtc) / (1000 * 60 * 60 * 24)) + 1;
};

const isWeekendDate = (date: Date): boolean => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

const countWeekdaysInRange = (start: Date, end: Date): number => {
  let total = 0;
  const current = startOfDay(start);
  const last = startOfDay(end);

  while (current.getTime() <= last.getTime()) {
    if (!isWeekendDate(current)) total += 1;
    current.setDate(current.getDate() + 1);
  }

  return total;
};

const getReportDaysForRequest = (
  request: LeaveRequest,
  rangeStart: Date | null,
  rangeEnd: Date | null
): number => {
  const requestStart = toDateValue(request.startDate);
  const requestEnd = toDateValue(request.endDate) || requestStart;
  if (!requestStart || !requestEnd) return 0;

  const overlapStart = rangeStart && requestStart < rangeStart ? startOfDay(rangeStart) : startOfDay(requestStart);
  const overlapEnd = rangeEnd && requestEnd > rangeEnd ? startOfDay(rangeEnd) : startOfDay(requestEnd);
  if (overlapStart.getTime() > overlapEnd.getTime()) return 0;

  const groupMeta = getReportGroupMeta(request, false);
  const isSpecialLeave = groupMeta.key === 'maternity' || groupMeta.key === 'paternity';

  if (request.isHalfDay) {
    if (!isSpecialLeave && isWeekendDate(overlapStart)) return 0;
    return 0.5;
  }

  const totalRequested = Math.max(0, Number(request.days || 0));
  if (isSpecialLeave) {
    const overlapDays = daysBetweenInclusive(overlapStart, overlapEnd);
    return roundReportValue(totalRequested > 0 ? Math.min(overlapDays, totalRequested) : overlapDays);
  }

  const weekdayDays = countWeekdaysInRange(overlapStart, overlapEnd);
  return roundReportValue(totalRequested > 0 ? Math.min(weekdayDays, totalRequested) : weekdayDays);
};

const LeaveRequestsTable: React.FC<LeaveRequestsTableProps> = ({ requests, employees, leaveQuotas, filter, onFilterChange, onUpdateStatus, onDelete, onViewBalance, onOpenRequestForm, onOpenRequestVersionHistory, teams, title = 'Detailed Leave Applications', showLeaveBalance = true, showGenerateReportButton = true, externalOpenReportKey, reportMode = 'leave' }) => {
  const [isCommentModalOpen, setIsCommentModalOpen] = React.useState(false);
  const [selectedRequest, setSelectedRequest] = React.useState<LeaveRequest | null>(null);
  const [comment, setComment] = React.useState('');
  const [actionType, setActionType] = React.useState<LeaveStatus.Approved | LeaveStatus.Rejected | null>(null);

  // Advanced Filtering State
  const [isDateAccordionOpen, setIsDateAccordionOpen] = React.useState(false);
  const [selectedDateFilter, setSelectedDateFilter] = React.useState('All Time');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [selectedMemberId, setSelectedMemberId] = React.useState<string | null>(null);
  const [isReportFilterModalOpen, setIsReportFilterModalOpen] = React.useState(false);
  const [reportSelectedMemberIds, setReportSelectedMemberIds] = React.useState<string[]>([]);
  const [reportDatePreset, setReportDatePreset] = React.useState<ReportDatePreset>('Today');
  const [reportStartDate, setReportStartDate] = React.useState(todayIST());
  const [reportEndDate, setReportEndDate] = React.useState(todayIST());
  const [generatedReportRows, setGeneratedReportRows] = React.useState<LeaveReportRow[]>([]);
  const [expandedReportEmployeeIds, setExpandedReportEmployeeIds] = React.useState<Set<string>>(new Set());
  const [isReportGenerated, setIsReportGenerated] = React.useState(false);
  const lastExternalOpenKeyRef = React.useRef<number | null>(null);

  const isWfhReport = reportMode === 'wfh';

  const { hasMaternity, hasPaternity } = React.useMemo(() => {
    if (isWfhReport) return { hasMaternity: false, hasPaternity: false };
    let m = false;
    let p = false;
    generatedReportRows.forEach(row => {
      // Show columns if either there is usage (period or cumulative) OR if a quota is explicitly set > 0
      if (row.maternity > 0 || row.maternityTotal > 0 || row.maternityQuota > 0) m = true;
      if (row.paternity > 0 || row.paternityTotal > 0 || row.paternityQuota > 0) p = true;
    });
    return { hasMaternity: m, hasPaternity: p };
  }, [generatedReportRows, isWfhReport]);

  const reportColSpan = React.useMemo(() => {
    let span = isWfhReport ? 5 : 7; // WFH: expand + name + wfh + halfDay + total
    if (!isWfhReport) {
      if (hasMaternity) span++;
      if (hasPaternity) span++;
    }
    return span;
  }, [hasMaternity, hasPaternity, isWfhReport]);

  React.useEffect(() => {
    if (typeof externalOpenReportKey !== 'number') return;
    if (lastExternalOpenKeyRef.current === null) {
      lastExternalOpenKeyRef.current = externalOpenReportKey;
      return;
    }
    if (externalOpenReportKey === lastExternalOpenKeyRef.current) return;
    lastExternalOpenKeyRef.current = externalOpenReportKey;
    setIsReportGenerated(false);
    setGeneratedReportRows([]);
    setReportSelectedMemberIds([]);
    setIsReportFilterModalOpen(true);
  }, [externalOpenReportKey]);

  const today = getNowIST();
  const todayStr = todayIST();

  // Comprehensive Filtering Logic
  const filteredRequests = React.useMemo(() => {
    return requests.filter(req => {
      // 1. Basic Status Filter
      if (filter !== 'All' && req.status !== filter) return false;

      // 2. Member Selection Filter (Avatar)
      if (selectedMemberId && req.employee.id !== selectedMemberId) return false;

      // 3. Date Presets Filter
      if (selectedDateFilter === 'All Time' || selectedDateFilter === 'Pre-set') return true;

      const reqStartDateObj = toDateValue(req.startDate);
      const reqEndDateObj = toDateValue(req.endDate || req.startDate);
      if (!reqStartDateObj || !reqEndDateObj) return false;

      const startOf = (d: Date) => { const r = new Date(d); r.setHours(0, 0, 0, 0); return r.getTime(); };
      const endOf = (d: Date) => { const r = new Date(d); r.setHours(23, 59, 59, 999); return r.getTime(); };

      const reqStart = startOf(reqStartDateObj);
      const reqEnd = endOf(reqEndDateObj);

      const overlaps = (startTarget: number, endTarget: number) => {
        return startTarget <= reqEnd && endTarget >= reqStart;
      };

      if (selectedDateFilter === 'Today') {
        return overlaps(startOf(today), endOf(today));
      }
      if (selectedDateFilter === 'Yesterday') {
        const yest = new Date(); yest.setDate(today.getDate() - 1);
        return overlaps(startOf(yest), endOf(yest));
      }
      if (selectedDateFilter === 'This Week') {
        const first = new Date(); first.setDate(today.getDate() - today.getDay());
        const last = new Date(first); last.setDate(first.getDate() + 6);
        return overlaps(startOf(first), endOf(last));
      }
      if (selectedDateFilter === 'Last Week') {
        const first = new Date(); first.setDate(today.getDate() - today.getDay() - 7);
        const last = new Date(); last.setDate(today.getDate() - today.getDay() - 1);
        return overlaps(startOf(first), endOf(last));
      }
      if (selectedDateFilter === 'This Month') {
        const first = new Date(today.getFullYear(), today.getMonth(), 1);
        const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return overlaps(startOf(first), endOf(last));
      }
      if (selectedDateFilter === 'Last Month') {
        const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const last = new Date(today.getFullYear(), today.getMonth(), 0);
        return overlaps(startOf(first), endOf(last));
      }
      if (selectedDateFilter === 'Last 3 Months') {
        const three = new Date(); three.setMonth(today.getMonth() - 3);
        return overlaps(startOf(three), endOf(today));
      }
      if (selectedDateFilter === 'This Year') {
        const start = new Date(today.getFullYear(), 0, 1);
        const end = new Date(today.getFullYear(), 11, 31);
        return overlaps(startOf(start), endOf(end));
      }
      if (selectedDateFilter === 'Last Year') {
        const start = new Date(today.getFullYear() - 1, 0, 1);
        const end = new Date(today.getFullYear() - 1, 11, 31);
        return overlaps(startOf(start), endOf(end));
      }
      if (selectedDateFilter === 'Custom' && startDate && endDate) {
        const sDate = toDateValue(startDate);
        const eDate = toDateValue(endDate);
        if (!sDate || !eDate) return false;
        return overlaps(startOf(sDate), endOf(eDate));
      }

      return true;
    }).sort((a, b) => b.id - a.id);
  }, [requests, filter, selectedMemberId, selectedDateFilter, startDate, endDate, todayStr]);

  const handleActionClick = (request: LeaveRequest, status: LeaveStatus.Approved | LeaveStatus.Rejected) => {
    setSelectedRequest(request);
    setActionType(status);
    setComment('');
    setIsCommentModalOpen(true);
  };

  const handleRevertClick = (request: LeaveRequest) => {
    if (window.confirm(`Are you sure you want to revert the decision for ${request.employee.name} back to Pending?`)) {
      onUpdateStatus(request.id, LeaveStatus.Pending, '');
    }
  };

  const handleCommentSubmit = () => {
    if (selectedRequest && actionType) {
      onUpdateStatus(selectedRequest.id, actionType, comment);
      setIsCommentModalOpen(false);
      setSelectedRequest(null);
      setActionType(null);
    }
  };

  const toggleReportRow = React.useCallback((employeeId: string): void => {
    setExpandedReportEmployeeIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => next.add(id));
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  }, []);

  const runReportGeneration = React.useCallback((): void => {
    const todayDate = getNowIST();
    const selectedEmployeeIds = reportSelectedMemberIds.length > 0
      ? reportSelectedMemberIds
      : employees.filter(emp => emp.employeeStatus !== 'Ex-Staff').map(emp => emp.id);
    let reportRangeStart: Date | null = null;
    let reportRangeEnd: Date | null = null;
    let source = requests.filter((request) =>
      selectedEmployeeIds.indexOf(request.employee.id) !== -1 &&
      request.employee.employeeStatus !== 'Ex-Staff' &&
      (isWfhReport ? isWorkFromHomeRequest(request) : !isWorkFromHomeRequest(request))
    );

    if (reportDatePreset === 'Custom') {
      if (reportStartDate && reportEndDate) {
        const start = toDateValue(reportStartDate);
        const end = toDateValue(reportEndDate);
        if (start && end) {
          reportRangeStart = startOfDay(start);
          reportRangeEnd = endOfDay(end);
          source = source.filter((request) => getReportDaysForRequest(request, reportRangeStart, reportRangeEnd) > 0);
        }
      }
    } else {
      const range = resolvePresetRange(reportDatePreset, todayDate);
      reportRangeStart = range.start;
      reportRangeEnd = range.end;
      if (range.start && range.end) {
        source = source.filter((request) => getReportDaysForRequest(request, reportRangeStart, reportRangeEnd) > 0);
      }
    }

    // Determine report end date for cumulative calculations
    let reportEndAt = todayDate.getTime();
    if (reportDatePreset === 'Custom' && reportEndDate) {
      const end = toDateValue(reportEndDate);
      if (end) reportEndAt = endOfDay(end).getTime();
    } else if (reportDatePreset !== 'All Time') {
      const range = resolvePresetRange(reportDatePreset, todayDate);
      if (range.end) reportEndAt = range.end.getTime();
    }

    const grouped: Record<string, LeaveReportRow> = {};
    source.forEach((request) => {
      const key = request.employee.id;
      if (!grouped[key]) {
        // Calculate cumulative maternity/paternity for this employee up to reportEndAt
        const empRequests = requests.filter(r =>
          r.employee.id === key &&
          r.status === LeaveStatus.Approved &&
          !isWorkFromHomeRequest(r)
        );

        const calcCumulative = (typeSearch: string) => empRequests
          .filter(r => {
            const rDate = toDateValue(r.startDate);
            return rDate && rDate.getTime() <= reportEndAt &&
              String(r.leaveType || '').toLowerCase().includes(typeSearch);
          })
          .reduce((sum, r) => {
            const start = toDateValue(r.startDate);
            const end = toDateValue(r.endDate);
            if (!start) return sum + Number(r.days || 0);
            // Calculate actual elapsed days: from leave start to min(leaveEnd, reportEnd)
            const effectiveEnd = end ? Math.min(end.getTime(), reportEndAt) : reportEndAt;
            const elapsedMs = effectiveEnd - start.getTime();
            const elapsedDays = Math.max(0, Math.floor(elapsedMs / (1000 * 60 * 60 * 24)) + 1);
            // Cap at total requested days (r.days) to avoid overcounting
            const totalDays = r.isHalfDay ? 0.5 : Number(r.days || 0);
            return sum + Math.min(elapsedDays, totalDays);
          }, 0);

        const getDynamicQuota = (search: string) => {
          // Only assign a quota if this employee has ever requested this leave type
          const hasEverRequested = requests.some(r =>
            r.employee.id === key &&
            String(r.leaveType || '').toLowerCase().includes(search.toLowerCase())
          );
          if (!hasEverRequested) return 0;

          const qKey = Object.keys(leaveQuotas).find(k => k.toLowerCase().includes(search.toLowerCase()));
          const listQuota = qKey ? leaveQuotas[qKey] : 0;
          if (listQuota > 0) return listQuota;
          // Fallback to total days approved for this person if not in global list
          const totalDaysApproved = empRequests
            .filter(r => String(r.leaveType || '').toLowerCase().includes(search.toLowerCase()))
            .reduce((sum, r) => sum + (r.isHalfDay ? 0.5 : Number(r.days || 0)), 0);
          return totalDaysApproved > 0 ? totalDaysApproved : (search === 'maternity' ? 182 : 5);
        };

        const matUsed = calcCumulative('maternity');
        const patUsed = calcCumulative('paternity');
        const matQuota = getDynamicQuota('maternity');
        const patQuota = getDynamicQuota('paternity');

        grouped[key] = {
          employee: request.employee,
          planned: 0,
          unplanned: 0,
          workFromHome: 0,
          maternity: 0,
          maternityTotal: matUsed,
          maternityQuota: matQuota,
          paternity: 0,
          paternityTotal: patUsed,
          paternityQuota: patQuota,
          restrictedHoliday: 0,
          halfDay: 0,
          totalLeave: 0,
          details: []
        };
      }
      const row = grouped[key];
      const days = getReportDaysForRequest(request, reportRangeStart, reportRangeEnd);
      const countValue = request.isHalfDay ? 0.5 : 1;
      if (days <= 0) return;
      if (isWfhReport) {
        row.workFromHome = roundReportValue(row.workFromHome + days);
        if (request.isHalfDay) row.halfDay = roundReportValue(row.halfDay + countValue);
        row.totalLeave = roundReportValue(row.totalLeave + days);
      } else {
        const groupMeta = getReportGroupMeta(request, false);
        const bucketValue = days;
        if (groupMeta.key !== 'workFromHome') {
          row[groupMeta.key] = roundReportValue(row[groupMeta.key] + bucketValue);
        }
        if (request.isHalfDay) row.halfDay = roundReportValue(row.halfDay + countValue);
        // For maternity/paternity, use the dynamically calculated elapsed days (maternityTotal/paternityTotal)
        // instead of the full r.days, since those are already computed based on the report end date.
        if (groupMeta.key === 'maternity' || groupMeta.key === 'paternity') {
          // Don't add to totalLeave here; it will be set after the loop using the dynamic totals.
        } else {
          row.totalLeave = roundReportValue(row.totalLeave + bucketValue);
        }
      }

      const detailMeta = getReportGroupMeta(request, isWfhReport);
      const detailType = detailMeta.label;
      let group = row.details.find((d) => d.type === detailType);
      if (!group) {
        group = { type: detailType, entries: [] };
        row.details.push(group);
      }
      group.entries.push({
        requestId: request.id,
        employeeId: request.employee.id,
        employeeName: request.employee.name,
        department: request.employee.department,
        requestCategory: request.requestCategory || 'Leave',
        startDate: request.startDate,
        endDate: request.endDate,
        description: request.reason || 'No Information',
        status: request.status,
        count: countValue,
        days,
        submittedAt: request.submittedAt,
        approverName: request.approverName || '',
        approverComment: request.approverComment || '',
        isHalfDay: Boolean(request.isHalfDay),
        halfDayType: request.halfDayType || '',
        isRecurring: Boolean(request.isRecurring),
        recurringFrequency: request.recurringFrequency || ''
      });
    });

    // Add the dynamically calculated maternity/paternity elapsed days to totalLeave
    if (!isWfhReport) {
      Object.values(grouped).forEach(row => {
        row.totalLeave = roundReportValue(
          row.planned +
          row.unplanned +
          row.restrictedHoliday +
          row.maternityTotal +
          row.paternityTotal
        );
      });
    }

    const rows = Object.keys(grouped).map((key) => grouped[key]).sort((a, b) => a.employee.name.localeCompare(b.employee.name));
    setGeneratedReportRows(rows);
    setExpandedReportEmployeeIds(new Set<string>());
    setIsReportGenerated(true);
  }, [reportDatePreset, reportEndDate, reportSelectedMemberIds, reportStartDate, requests, isWfhReport]);

  const handleDownloadReport = React.useCallback(async (): Promise<void> => {
    if (generatedReportRows.length === 0) return;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(isWfhReport ? 'Work From Home Report' : 'Leave Report');

    // Define main summary columns
    const summaryHeaders = isWfhReport
      ? ['Name', 'Work From Home', 'Total']
      : ['Name', 'Planned', 'Unplanned'];
    if (!isWfhReport) {
      if (hasMaternity) summaryHeaders.push('Maternity');
      if (hasPaternity) summaryHeaders.push('Paternity');
      summaryHeaders.push('Restricted Holiday', 'Total Leave');
    }

    // Title
    const titleRow = worksheet.addRow([isWfhReport ? 'Monthly Report of Work From Home' : 'Monthly Report of Leave']);
    const titleEndCol = String.fromCharCode('A'.charCodeAt(0) + summaryHeaders.length - 1);
    worksheet.mergeCells(`A1:${titleEndCol}1`);
    titleRow.eachCell(cell => {
      cell.font = { bold: true, size: 14, color: { argb: 'FF2F5596' } };
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
    });
    worksheet.addRow([]); // Gap

    const summaryHeaderRow = worksheet.addRow(summaryHeaders);
    summaryHeaderRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5596' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    const columns: Partial<ExcelJS.Column>[] = [
      { key: 'col1', width: 30 },
      { key: 'col2', width: 15 },
      { key: 'col3', width: 15 }
    ];
    if (isWfhReport) {
      // Name, WFH, Total
    } else {
      if (hasMaternity) columns.push({ key: 'col4', width: 15 });
      if (hasPaternity) columns.push({ key: 'col5', width: 15 });
      columns.push(
        { key: 'col6', width: 15 },
        { key: 'col7', width: 15 }
      );
    }
    worksheet.columns = columns;

    const employeeRowColors = ['FFF5F8FF', 'FFFDF6E7', 'FFF1F9F3', 'FFF9F2F7', 'FFF2F4FF'];

    generatedReportRows.forEach((row, index) => {
      const rowFill = employeeRowColors[index % employeeRowColors.length];
      // Employee Summary Row
      const rowData = isWfhReport
        ? [row.employee.name, row.workFromHome, row.totalLeave]
        : [row.employee.name, row.planned, row.unplanned];
      if (!isWfhReport) {
        if (hasMaternity) rowData.push(row.maternityQuota > 0 ? `${row.maternityTotal} / ${row.maternityQuota}` : (row.maternityTotal > 0 ? `${row.maternityTotal} / 0` : '0'));
        if (hasPaternity) rowData.push(row.paternityQuota > 0 ? `${row.paternityTotal} / ${row.paternityQuota}` : (row.paternityTotal > 0 ? `${row.paternityTotal} / 0` : '0'));
        rowData.push(
          row.restrictedHoliday,
          row.totalLeave
        );
      }

      const empRow = worksheet.addRow(rowData);
      empRow.eachCell(cell => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFill } };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.alignment = { horizontal: 'left' };
      });

      // Nested Details
      row.details.forEach(group => {
        const groupDays = roundReportValue(group.entries.reduce((sum, entry) => sum + Number(entry.days || 0), 0));
        worksheet.addRow([]); // Small gap for grouping

        // Group Header (e.g., RH: 3)
        const groupHeader = worksheet.addRow([`${group.type}: ${groupDays}`]);
        worksheet.mergeCells(`A${groupHeader.number}:B${groupHeader.number}`);
        groupHeader.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5596' } };
        groupHeader.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        groupHeader.getCell(1).alignment = { horizontal: 'center' };

        // Detail Headers
        const detailHeaders = ['Event Start Date', 'Event End Date', 'Days', 'Description', 'Status'];
        const detailHeaderRow = worksheet.addRow(['', ...detailHeaders]);
        detailHeaderRow.eachCell((cell, colNum) => {
          if (colNum > 1) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
            cell.font = { bold: true, size: 9 };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          }
        });

        // Detail Entries
        group.entries.forEach(entry => {
          const statusLabel = entry.isHalfDay
            ? `${entry.status} (${entry.halfDayType === 'first' ? 'First Half' : 'Second Half'})`
            : entry.status;
          const entryRow = worksheet.addRow([
            '',
            entry.startDate,
            entry.endDate,
            roundReportValue(Number(entry.days || 0)),
            entry.description,
            statusLabel
          ]);
          entryRow.eachCell((cell, colNum) => {
            if (colNum > 1) {
              cell.font = { size: 9 };
              cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

              if (colNum === 6) { // Status column
                if (entry.status === LeaveStatus.Approved) cell.font = { color: { argb: 'FF198754' }, bold: true, size: 9 };
                else if (entry.status === LeaveStatus.Rejected) cell.font = { color: { argb: 'FFDC3545' }, bold: true, size: 9 };
              }
            }
          });
        });
      });

      worksheet.addRow([]); // Gap between employees
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `${isWfhReport ? 'wfh' : 'leave'}_report_${todayIST()}.xlsx`);
  }, [generatedReportRows, isWfhReport]);

  const handleDownloadPdf = React.useCallback((): void => {
    if (generatedReportRows.length === 0) return;

    const popup = window.open('', '_blank', 'width=1200,height=900');
    if (!popup) {
      alert('Please allow popups to generate PDF.');
      return;
    }

    const escapeHtml = (value: unknown): string => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    const formatDate = (dateStr: string) => {
      if (!dateStr) return '';
      try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      } catch {
        return dateStr;
      }
    };

    const periodDisplay = reportDatePreset === 'All Time' ? 'All Time' : `${formatDate(reportStartDate)} to ${formatDate(reportEndDate)}`;

    const employeeRowColors = ['#f5f8ff', '#fdf6e7', '#f1f9f3', '#f9f2f7', '#f2f4ff'];

    const rowsHtml = generatedReportRows.map((row, index) => {
      const rowFill = employeeRowColors[index % employeeRowColors.length];
      const detailsHtml = row.details.map(group => `
        <div class="detail-group">
          <div class="group-header">${escapeHtml(group.type)}: ${roundReportValue(group.entries.reduce((sum, entry) => sum + Number(entry.days || 0), 0))}</div>
          <table>
            <thead>
              <tr>
                <th style="width: 100px">Start Date</th>
                <th style="width: 100px">End Date</th>
                <th style="width: 70px">Days</th>
                <th>Description</th>
                <th style="width: 140px">Status</th>
              </tr>
            </thead>
            <tbody>
              ${group.entries.map(entry => {
        let statusBadges = `<span class="status-badge status-${entry.status.toLowerCase()}">${escapeHtml(entry.status)}</span>`;
        if (entry.isHalfDay) {
          const halfLabel = entry.halfDayType === 'first' ? 'First Half' : 'Second Half';
          statusBadges += `<span class="type-badge badge-half">(${escapeHtml(halfLabel)})</span>`;
        }
        if (entry.isRecurring) {
          statusBadges += `<span class="type-badge badge-recurring">Recurring (${escapeHtml(entry.recurringFrequency)})</span>`;
        }
        return `
                  <tr>
                    <td>${escapeHtml(entry.startDate)}</td>
                    <td>${escapeHtml(entry.endDate)}</td>
                    <td>${roundReportValue(Number(entry.days || 0))}</td>
                    <td>${escapeHtml(entry.description)}</td>
                    <td>${statusBadges}</td>
                  </tr>
                `;
      }).join('')}
            </tbody>
          </table>
        </div>
      `).join('');

      return `
        <div class="employee-section">
          <table class="summary-table">
            <thead>
              <tr>
                <th style="width: 200px">Employee Name</th>
                ${isWfhReport ? '<th>Work From Home</th>' : '<th>Planned</th><th>Unplanned</th>'}
                ${!isWfhReport && hasMaternity ? '<th>Maternity</th>' : ''}
                ${!isWfhReport && hasPaternity ? '<th>Paternity</th>' : ''}
                ${!isWfhReport ? '<th>RH</th>' : ''}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr style="background: ${rowFill};">
                <td style="font-weight: bold;">${escapeHtml(row.employee.name)}</td>
                ${isWfhReport ? `<td>${row.workFromHome}</td>` : `<td>${row.planned}</td><td>${row.unplanned}</td>`}
                ${!isWfhReport && hasMaternity ? `<td>${row.maternityQuota > 0 || row.maternityTotal > 0 ? `<span style="font-weight:bold;color:#11803f">${row.maternityTotal} / ${row.maternityQuota}</span>` : '0'}</td>` : ''}
                ${!isWfhReport && hasPaternity ? `<td>${row.paternityQuota > 0 || row.paternityTotal > 0 ? `<span style="font-weight:bold;color:#11803f">${row.paternityTotal} / ${row.paternityQuota}</span>` : '0'}</td>` : ''}
                ${!isWfhReport ? `<td>${row.restrictedHoliday}</td>` : ''}
                <td style="font-weight: bold; color: #2F5596;">${row.totalLeave}</td>
              </tr>
            </tbody>
          </table>
          ${detailsHtml}
        </div>
      `;
    }).join('');

    const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>${isWfhReport ? 'Work From Home Report' : 'Leave Report'}</title>
        <style>
          body { 
            font-family: 'Segoe UI', Arial, sans-serif; 
            margin: 25px 35px; 
            color: #333; 
            line-height: 1.3;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .report-title { font-size: 20px; font-weight: bold; color: #2F5596; margin-bottom: 2px; }
          .report-meta { font-size: 11px; color: #666; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 8px; }
          .employee-section { margin-bottom: 25px; page-break-inside: avoid; }
          .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 0; font-size: 11px; }
          .summary-table th { background: #2F5596 !important; color: white !important; padding: 6px 8px; font-weight: 600; border: 1px solid #234478; text-align: center; }
          .summary-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: center; }
          .detail-group { padding: 5px 10px 10px 20px; border-left: 2px solid #eee; margin-top: -1px; }
          .group-header { font-size: 10px; font-weight: bold; margin-bottom: 4px; color: white !important; background: #2F5596 !important; padding: 3px 10px; border-radius: 2px; display: inline-block; text-transform: uppercase; letter-spacing: 0.5px; }
          table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
          th, td { border: 1px solid #ddd; padding: 4px 8px; text-align: left; }
          th { background: #f1f5f9 !important; font-weight: 600; color: #334155 !important; }
          
          .status-badge { font-size: 9px; padding: 2px 6px; border-radius: 10px; font-weight: bold; display: inline-block; margin-right: 4px; }
          .status-approved { background: #e6f4ea; color: #1e7e34; }
          .status-pending { background: #fff4e5; color: #b7791f; }
          .status-rejected { background: #fdeaea; color: #c53030; }
          
          .type-badge { font-size: 9px; padding: 2px 6px; border-radius: 10px; font-weight: bold; display: inline-block; margin-top: 2px; }
          .badge-half { background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; }
          .badge-recurring { background: #f5f3ff; color: #6d28d9; border: 1px solid #ddd6fe; }
          
          @media print {
            body { margin: 15px; }
            .employee-section { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="report-title">Monthly Employee ${isWfhReport ? 'Work From Home' : 'Leave'} Report</div>
        <div class="report-meta">
          Generated: ${new Date().toLocaleString('en-GB')} | Period: ${periodDisplay}
        </div>
        ${rowsHtml}
      </body>
      </html>
    `;

    popup.document.write(html);
    popup.document.close();

    setTimeout(() => {
      popup.print();
    }, 500);
  }, [generatedReportRows, reportStartDate, reportEndDate, reportDatePreset, hasMaternity, hasPaternity, isWfhReport]);

  const handlePresetChange = (preset: string) => {
    setSelectedDateFilter(preset);
    const today = getNowIST();

    const toDateString = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    let sDate = '';
    let eDate = '';

    if (preset === 'Today') {
      sDate = toDateString(today);
      eDate = toDateString(today);
    } else if (preset === 'Yesterday') {
      const d = new Date(today);
      d.setDate(d.getDate() - 1);
      sDate = toDateString(d);
      eDate = toDateString(d);
    } else if (preset === 'This Week') {
      const first = new Date(today);
      first.setDate(first.getDate() - first.getDay());
      const last = new Date(first);
      last.setDate(first.getDate() + 6);
      sDate = toDateString(first);
      eDate = toDateString(last);
    } else if (preset === 'Last Week') {
      const first = new Date(today);
      first.setDate(first.getDate() - first.getDay() - 7);
      const last = new Date(today);
      last.setDate(today.getDate() - today.getDay() - 1);
      sDate = toDateString(first);
      eDate = toDateString(last);
    } else if (preset === 'This Month') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      sDate = toDateString(first);
      eDate = toDateString(last);
    } else if (preset === 'Last Month') {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      sDate = toDateString(first);
      eDate = toDateString(last);
    } else if (preset === 'Last 3 Months') {
      const first = new Date(today);
      first.setMonth(today.getMonth() - 3);
      sDate = toDateString(first);
      eDate = toDateString(today);
    } else if (preset === 'This Year') {
      const first = new Date(today.getFullYear(), 0, 1);
      const last = new Date(today.getFullYear(), 11, 31);
      sDate = toDateString(first);
      eDate = toDateString(last);
    } else if (preset === 'Last Year') {
      const first = new Date(today.getFullYear() - 1, 0, 1);
      const last = new Date(today.getFullYear() - 1, 11, 31);
      sDate = toDateString(first);
      eDate = toDateString(last);
    } else if (preset === 'All Time') {
      sDate = '';
      eDate = '';
    } else if (preset === 'Custom' || preset === 'Pre-set') {
      return;
    }

    if (preset !== 'Custom' && preset !== 'Pre-set') {
      setStartDate(sDate);
      setEndDate(eDate);
    }
  };

  const handleClearFilters = () => {
    setSelectedDateFilter('All Time');
    setStartDate('');
    setEndDate('');
    setSelectedMemberId(null);
  };

  // Calculate used leaves for a specific type and employee
  const calculateUsedLeaves = (employeeId: string, type: string) => {
    return requests
      .filter(r => r.employee.id === employeeId && r.leaveType === type && r.status === LeaveStatus.Approved)
      .reduce((sum, r) => sum + r.days, 0);
  };

  const modalTitle = actionType === LeaveStatus.Approved ? 'Approve Leave Request' : 'Reject Leave Request';
  const getApproverCommentPreview = React.useCallback((rawComment: string): string => {
    return String(rawComment || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  const modalFooter = (
    <>
      <button className="btn btn-default" onClick={() => setIsCommentModalOpen(false)}>Cancel</button>
      <button
        className={`btn ${actionType === LeaveStatus.Approved ? 'btn-primary' : 'btn-default'}`}
        onClick={handleCommentSubmit}
      >
        Confirm {actionType}
      </button>
    </>
  );

  const columns = React.useMemo<ColumnDef<LeaveRequest>[]>(() => ([
    {
      key: 'employee',
      header: 'Employee',
      accessor: (request) => `${request.employee.name} ${request.employee.id} ${request.employee.department}`,
      render: (request) => (
        <div className="d-flex align-items-center">
          <img className="rounded-circle border shadow-xs" src={request.employee.avatar} alt={request.employee.name} width="36" height="36" style={{ objectFit: 'cover' }} />
          <div className="ms-3">
            <div className="text-dark fw-medium" style={{ fontSize: '13px', lineHeight: '1.2' }}>{request.employee.name}</div>
            <div className="text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>ID: {request.employee.id} &bull; {request.employee.department}</div>
          </div>
        </div>
      )
    },
    ...(showLeaveBalance ? [{
      key: 'leaveBalance',
      header: 'Leave Balance',
      searchable: false,
      filterable: false,
      render: (request: LeaveRequest) => {
        const lowerType = String(request.leaveType || '').toLowerCase();
        const isSpecial = lowerType.includes('maternity') || lowerType.includes('paternity');

        let used = 0;
        let quota = 0;
        let label = '';

        if (isSpecial) {
          used = calculateUsedLeaves(request.employee.id, request.leaveType);
          quota = leaveQuotas[request.leaveType] || 0;
          label = request.leaveType;
        } else {
          // Grouped Other Leaves
          const otherTypes = Object.keys(leaveQuotas).filter(t => !t.toLowerCase().includes('maternity') && !t.toLowerCase().includes('paternity'));
          used = otherTypes.reduce((sum, t) => sum + calculateUsedLeaves(request.employee.id, t), 0);
          quota = otherTypes.reduce((sum, t) => sum + (leaveQuotas[t] || 0), 0);
          label = 'Other Leaves';
        }

        return (
          <div className="d-flex flex-column">
            <div className="d-flex align-items-center gap-2">
              <span className="">{used} / {quota}</span>
              <Info size={14} className="text-muted cursor-pointer" onClick={() => onViewBalance?.(request.employee)} />
            </div>
            <div className="text-muted" style={{ fontSize: '9px' }}>{label}</div>
          </div>
        );
      }
    }] : []),
    {
      key: 'leaveType',
      header: 'Type',
      accessor: (request) => `${request.leaveType} ${request.isHalfDay ? (request.halfDayType === 'first' ? 'First Half' : 'Second Half') : ''} ${request.isRecurring ? 'Recurring' : ''}`,
      render: (request) => {
        const typeLower = String(request.leaveType || '').toLowerCase();
        let dotColor = '#3b82f6'; // Default Blue
        if (typeLower.includes('unplanned') || typeLower.includes('sick')) dotColor = '#ef4444'; // Red
        else if (typeLower.includes('planned') || typeLower.includes('vacation')) dotColor = '#10b981'; // Green
        else if (typeLower.includes('maternity') || typeLower.includes('paternity') || typeLower.includes('restricted') || typeLower.includes('rh')) dotColor = '#f59e0b'; // Orange
        else if (typeLower.includes('work from home') || typeLower.includes('wfh')) dotColor = '#8b5cf6'; // Purple

        return (
          <div className="d-flex flex-column gap-1">
            <div className="d-flex align-items-center gap-2">
              <div className="rounded-circle" style={{ width: '6px', height: '6px', backgroundColor: dotColor }} />
              <span className="text-dark fw-medium" style={{ fontSize: '13px' }}>{request.leaveType}</span>
            </div>
            <div className="d-flex flex-wrap gap-1 mt-1">
              {request.isHalfDay && (
                <span
                  className="badge rounded-pill d-inline-flex align-items-center"
                  style={{
                    fontSize: '9px',
                    padding: '2px 8px',
                    backgroundColor: '#eef2ff',
                    color: '#4338ca',
                    border: '1px solid #c7d2fe',
                    fontWeight: 600
                  }}
                >
                  <Clock size={10} className="me-1" />
                  {request.halfDayType === 'first' ? 'First Half' : 'Second Half'}
                </span>
              )}
              {request.isRecurring && (
                <span
                  className="badge rounded-pill d-inline-flex align-items-center"
                  style={{
                    fontSize: '9px',
                    padding: '2px 8px',
                    backgroundColor: '#f5f3ff',
                    color: '#6d28d9',
                    border: '1px solid #ddd6fe',
                    fontWeight: 600
                  }}
                >
                  <RotateCcw size={10} className="me-1" />
                  Recurring ({request.recurringFrequency || 'N/A'})
                </span>
              )}
            </div>
          </div>
        );
      }
    },
    {
      key: 'dates',
      header: 'Dates & Duration',
      accessor: (request) => `${formatDateForDisplayIST(request.startDate)} ${formatDateForDisplayIST(request.endDate)} ${request.days} Day${request.days !== 1 ? 's' : ''}`,
      render: (request) => {
        const isSameDay = request.startDate === request.endDate;
        return (
          <div className="d-flex flex-column gap-1">
            <div className="text-dark fw-medium" style={{ fontSize: '13px' }}>
              {formatDateForDisplayIST(request.startDate)}
              {!isSameDay && <span className="text-muted mx-1 fw-normal">→</span>}
              {!isSameDay && formatDateForDisplayIST(request.endDate)}
            </div>
            <div>
              <span className="badge rounded-pill d-inline-flex align-items-center" style={{ backgroundColor: '#f3f4f6', color: '#4b5563', fontWeight: 500, fontSize: '10px', padding: '3px 8px' }}>
                <Clock size={11} className="me-1 text-muted" /> {request.days} Day{request.days !== 1 && 's'}
              </span>
            </div>
          </div>
        );
      }
    },
    {
      key: 'reason',
      header: 'Reason',
      accessor: (request) => request.reason,
      render: (request) => (
        <div className="text-muted text-truncate" style={{ maxWidth: '150px' }} title={request.reason}>
          {request.reason}
        </div>
      )
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (request) => `${request.status} ${request.approverName || ''}`,
      render: (request) => (
        <>
          <Badge status={request.status} />
          {request.status !== LeaveStatus.Pending && request.approverName && (
            <div className="text-muted mt-1" style={{ fontSize: '9px' }}>
              by {request.approverName}
              {request.approverComment && (
                <span className="approver-comment-tooltip ms-1">
                  <MessageSquare size={12} color="#2F5596" />
                  <span className="approver-comment-tooltip__box">
                    <span className="approver-comment-tooltip__label">HR Comment</span>
                    <span className="approver-comment-tooltip__text">{getApproverCommentPreview(request.approverComment)}</span>
                  </span>
                </span>
              )}
            </div>
          )}
        </>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      searchable: false,
      filterable: false,
      align: 'end',
      render: (request) => (
        <div className="d-flex align-items-center justify-content-end gap-3 leave-action-group">
          {request.status === LeaveStatus.Pending ? (
            <>
              <button
                onClick={() => handleActionClick(request, LeaveStatus.Approved)}
                className="p-0 border-0 bg-transparent flex-shrink-0"
                style={{ color: '#15803d', display: 'flex' }}
                title="Approve request"
                aria-label="Approve request"
              >
                <Check size={18} strokeWidth={2.5} />
              </button>
              <button
                onClick={() => handleActionClick(request, LeaveStatus.Rejected)}
                className="p-0 border-0 bg-transparent flex-shrink-0"
                style={{ color: '#dc2626', display: 'flex' }}
                title="Reject request"
                aria-label="Reject request"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </>
          ) : (
            <button
              onClick={() => handleRevertClick(request)}
              className="p-0 border-0 bg-transparent flex-shrink-0"
              style={{ color: '#2f5596', display: 'flex' }}
              title="Revert to pending"
              aria-label="Revert to pending"
            >
              <RotateCcw size={17} strokeWidth={2.2} />
            </button>
          )}
        </div>
      )
    }
  ]), [leaveQuotas, onViewBalance, calculateUsedLeaves, handleActionClick, handleRevertClick, getApproverCommentPreview, showLeaveBalance]);

  return (
    <>
      <div className="card shadow-sm border-0 bg-white px-4 pb-2">
        <div className="card-header bg-white d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3 py-3 border-bottom-0">
          <h2 className="h5 mb-0 fw-bold" style={{ color: '#2F5596' }}>{title}</h2>
          <div className="d-flex align-items-center gap-2">
            {showGenerateReportButton && (
              <button
                className="btn btn-sm btn-default d-flex align-items-center gap-1"
                onClick={() => {
                  setIsReportGenerated(false);
                  setGeneratedReportRows([]);
                  setReportSelectedMemberIds([]);
                  setIsReportFilterModalOpen(true);
                }}
              >
                <FileText size={14} /> Generate Report
              </button>
            )}
            <Filter className="text-muted" width="18" height="18" />
            <select
              value={filter}
              onChange={(e) => onFilterChange(e.target.value as LeaveStatus | 'All')}
              className="form-select form-select-sm"
              style={{ minWidth: '150px', borderRadius: '4px' }}
            >
              <option value="All">All Statuses</option>
              <option value={LeaveStatus.Pending}>Pending</option>
              <option value={LeaveStatus.Approved}>Approved</option>
              <option value={LeaveStatus.Rejected}>Rejected</option>
            </select>
          </div>
        </div>

        {/* Dynamic Filtering Section */}
        <div className="">
          {/* Team-Based Avatar Filtering */}
          <div className="border-top pt-2 pb-1">
            <div className="d-flex flex-wrap gap-3">
              {teams.map(teamName => {
                const teamMembers = employees.filter(emp => emp.department === teamName && emp.employeeStatus !== 'Ex-Staff');
                if (teamMembers.length === 0) return null;
                const teamLabel = /team$/i.test(teamName) ? teamName : `${teamName} Team`;

                return (
                  <div key={teamName} className="taskTeamBox px-1 mt-0">
                    <div className='top-assign'>
                      <div className='team'>
                        <label className="BdrBtm">
                          {teamLabel}
                        </label>
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-1">
                      {teamMembers.map(emp => (
                        <div
                          key={emp.id}
                          className={`avatar-selection cursor-pointer position-relative ${selectedMemberId === emp.id ? 'active' : ''}`}
                          onClick={() => setSelectedMemberId(selectedMemberId === emp.id ? null : emp.id)}
                          title={emp.name}
                        >
                          <img
                            src={emp.avatar}
                            alt={emp.name}
                            width="34"
                            height="34"
                            className={`rounded-circle border-2 border shadow-xs bg-white ${selectedMemberId === emp.id ? 'border-primary' : 'border-transparent'}`}
                            style={{ objectFit: 'cover', transition: 'all 0.2s' }}
                          />
                          {selectedMemberId === emp.id && (
                            <div className="position-absolute bottom-0 end-0 bg-primary rounded-circle border border-white" style={{ width: '8px', height: '8px' }} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Date Accordion */}
          <div className="accordion-filter border-top">
            <div
              className="d-flex align-items-center gap-2 py-2 cursor-pointer"
              onClick={() => setIsDateAccordionOpen(!isDateAccordionOpen)}
            >
              {isDateAccordionOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              <span className="fw-semibold">Date</span>
            </div>
            {isDateAccordionOpen && (
              <div className="ps-4 pb-3 animate-in fade-in">
                <div className="d-flex flex-wrap gap-4 mb-3">
                  {['Custom', 'Today', 'Yesterday', 'This Week', 'Last Week', 'This Month', 'Last Month', 'Last 3 Months', 'This Year', 'Last Year', 'All Time', 'Pre-set'].map(preset => (
                    <div key={preset} className="d-flex align-items-center gap-2">
                      <input
                        type="radio"
                        id={`date-${preset}`}
                        name="datePreset"
                        className="radio"
                        checked={selectedDateFilter === preset}
                        onChange={() => handlePresetChange(preset)}
                      />
                      <label htmlFor={`date-${preset}`} className="text-muted mb-0 cursor-pointer">{preset}</label>
                    </div>
                  ))}
                </div>
                <div className="d-flex align-items-center gap-3">
                  <div className="d-flex align-items-center gap-2">
                    <label className="text-muted">Start Date</label>
                    <input type="date" className="form-control form-control-sm" style={{ width: '140px' }} value={startDate} onChange={e => { setStartDate(e.target.value); setSelectedDateFilter('Custom'); }} />
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <label className="text-muted">End Date</label>
                    <input type="date" className="form-control form-control-sm" style={{ width: '140px' }} value={endDate} onChange={e => { setEndDate(e.target.value); setSelectedDateFilter('Custom'); }} />
                  </div>
                  <button className="btn btn-link btn-sm text-decoration-none fw-bold p-0" style={{ color: '#2F5596' }} onClick={handleClearFilters}>Clear</button>
                </div>
              </div>
            )}
          </div>

        </div>

        <CommonTable
          data={filteredRequests}
          columns={columns}
          getRowId={(row) => row.id}
          globalSearchPlaceholder="Search leave requests"
        />
      </div >

      <Modal
        isOpen={isCommentModalOpen}
        onClose={() => setIsCommentModalOpen(false)}
        title={modalTitle}
        createdInfo={formatAuditInfo(selectedRequest?.createdAt, selectedRequest?.createdByName)}
        modifiedInfo={formatAuditInfo(selectedRequest?.modifiedAt, selectedRequest?.modifiedByName)}
        onVersionHistoryClick={() => {
          if (!selectedRequest?.id) return;
          onOpenRequestVersionHistory?.(selectedRequest.id);
        }}
        onOpenFormClick={() => {
          if (!selectedRequest?.id) return;
          onOpenRequestForm?.(selectedRequest.id);
        }}
        footer={modalFooter}
      >
        <div className="animate-in fade-in">
          <p className="text-dark mb-4 p-3 bg-light rounded border">
            Decision for <strong>{selectedRequest?.employee.name}</strong><br />
            Leave Period: {selectedRequest?.startDate} to {selectedRequest?.endDate} ({selectedRequest?.days} days)
          </p>
          <div className="mb-3">
            <label htmlFor="approverComment" className="form-label text-muted">Approval / Rejection Comment</label>
            <textarea
              id="approverComment"
              className="form-control"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Enter details..."
              autoFocus
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isReportFilterModalOpen}
        onClose={() => setIsReportFilterModalOpen(false)}
        title={isWfhReport ? 'Employee Work From Home Report' : 'Employee Leave Report'}
        size="lg"
        footer={
          <>
            <button className="btn btn-default" onClick={() => setIsReportFilterModalOpen(false)}>Cancel</button>
            {!isReportGenerated ? (
              <button className="btn btn-primary px-4" onClick={runReportGeneration}>Submit</button>
            ) : (
              <>
                <button className="btn btn-default d-flex align-items-center gap-1" onClick={handleDownloadPdf}>
                  <FileText size={14} /> Download PDF
                </button>
                <button className="btn btn-default d-flex align-items-center gap-1" onClick={handleDownloadReport}>
                  <Download size={14} /> Download Excel
                </button>
                <button className="btn btn-primary px-4" onClick={runReportGeneration}>Refresh</button>
              </>
            )}
          </>
        }
      >
        <div className="row g-3 align-items-end">
          <div className="col-12">
            <div className="d-flex align-items-center justify-content-between mb-1">
              <h6 className="mb-0">Team Members</h6>
              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-primary btn-sm text-nowrap"
                  onClick={() => setReportSelectedMemberIds(employees.filter(emp => emp.employeeStatus !== 'Ex-Staff').map((emp) => emp.id))}
                >
                  Select All
                </button>
                <button
                  type="button"
                  className="btn btn-default btn-sm text-nowrap"
                  onClick={() => setReportSelectedMemberIds([])}
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="text-muted mb-2">
              {reportSelectedMemberIds.length === 0
                ? 'No users selected'
                : reportSelectedMemberIds.length === employees.filter(emp => emp.employeeStatus !== 'Ex-Staff').length
                  ? 'All users selected'
                  : `${reportSelectedMemberIds.length} user(s) selected`}
            </div>
          </div>
          <div className="col-12">
            <div className="d-flex flex-wrap gap-2 border rounded p-2" style={{ background: '#f7f9fc', borderColor: '#d9e2f2' }}>
              {teams.map((teamName) => {
                const teamMembers = employees.filter((emp) => emp.department === teamName && emp.employeeStatus !== 'Ex-Staff');
                if (teamMembers.length === 0) return null;
                const teamLabel = /team$/i.test(teamName) ? teamName : `${teamName} Team`;
                return (
                  <div key={`report-team-${teamName}`} style={{ minWidth: '190px' }}>
                    <div className='team'>
                      <label className="BdrBtm">
                        {teamLabel}
                      </label>
                    </div>
                    <div className="d-flex flex-wrap gap-1">
                      {teamMembers.map((emp) => {
                        const isActive = reportSelectedMemberIds.indexOf(emp.id) !== -1;
                        return (
                          <button
                            key={`report-member-${emp.id}`}
                            type="button"
                            className="p-0 border-0 bg-transparent"
                            title={`${emp.name} (${emp.id})`}
                            onClick={() => {
                              setReportSelectedMemberIds((prev) => {
                                const exists = prev.indexOf(emp.id) !== -1;
                                const next = exists ? prev.filter((id) => id !== emp.id) : [...prev, emp.id];
                                return next;
                              });
                            }}
                          >
                            <img
                              src={emp.avatar}
                              alt={emp.name}
                              width="30"
                              height="30"
                              className="rounded-circle"
                              style={{
                                objectFit: 'cover',
                                border: isActive ? '2px solid #2f5596' : '2px solid #d9e2f2',
                                boxShadow: isActive ? '0 0 0 1px #ffffff inset' : 'none'
                              }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="col-12">
            <label className="form-label">Date</label>
            <div className="d-flex flex-wrap gap-3 mb-2">
              {(['Custom', 'Today', 'Yesterday', 'This Week', 'Last Week', 'This Month', 'Last Month', 'Last 3 Months', 'This Year', 'Last Year', 'All Time'] as ReportDatePreset[]).map((preset) => (
                <div key={`report-${preset}`} className="SpfxCheckRadio">
                  <input
                    className="radio"
                    type="radio"
                    id={`report-preset-${preset}`}
                    checked={reportDatePreset === preset}
                    onChange={() => setReportDatePreset(preset)}
                  />
                  <label className="radio-label" htmlFor={`report-preset-${preset}`}>{preset}</label>
                </div>
              ))}
            </div>
          </div>
          <div className="col-md-6">
            <label className="form-label">Start Date</label>
            <input
              type="date"
              className="form-control"
              value={reportStartDate}
              onChange={(e) => { setReportStartDate(e.target.value); setReportDatePreset('Custom'); }}
            />
          </div>
          <div className="col-md-6">
            <label className="form-label">End Date</label>
            <input
              type="date"
              className="form-control"
              value={reportEndDate}
              onChange={(e) => { setReportEndDate(e.target.value); setReportDatePreset('Custom'); }}
            />
          </div>
        </div>
        {isReportGenerated && (
          <div className="mt-3 pt-3 border-top">
            <h3 className="h5 mb-3 fw-bold" style={{ color: '#2F5596' }}>
              {isWfhReport ? 'Monthly Report of Work From Home' : 'Monthly Report of Leave'}
            </h3>
            <div className="table-responsive border rounded" style={{ borderColor: '#d9e2f2' }}>
              <table className="table table-sm mb-0 align-middle">
                <thead style={{ background: '#eef3fb' }}>
                  <tr>
                    <th style={{ width: 28 }} />
                    <th>Name</th>
                    {isWfhReport ? <th>Work From Home</th> : (
                      <>
                        <th>Planned</th>
                        <th>Unplanned</th>
                      </>
                    )}
                    {!isWfhReport && hasMaternity && <th>Maternity</th>}
                    {!isWfhReport && hasPaternity && <th>Paternity</th>}
                    {!isWfhReport && <th>Restricted Holiday</th>}
                    <th>{isWfhReport ? 'Total' : 'Total Leave'}</th>
                  </tr>
                </thead>
                <tbody>
                  {generatedReportRows.length === 0 && (
                    <tr>
                      <td colSpan={reportColSpan} className="text-center text-muted py-3">No report data found for selected filters.</td>
                    </tr>
                  )}
                  {generatedReportRows.map((row) => {
                    const isOpen = expandedReportEmployeeIds.has(row.employee.id);
                    return (
                      <React.Fragment key={`report-row-${row.employee.id}`}>
                        <tr>
                          <td>
                            <button
                              className="p-0 border-0 bg-transparent d-flex align-items-center justify-content-center"
                              style={{ width: 18, height: 18, boxShadow: 'none' }}
                              onClick={() => toggleReportRow(row.employee.id)}
                            >
                              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          </td>
                          <td>{row.employee.name}</td>
                          {isWfhReport ? (
                            <td>{row.workFromHome}</td>
                          ) : (
                            <>
                              <td>{row.planned}</td>
                              <td>{row.unplanned}</td>
                            </>
                          )}
                          {!isWfhReport && hasMaternity && (
                            <td>
                              {row.maternityQuota > 0 || row.maternityTotal > 0 ? (
                                <span className="fw-bold text-success">
                                  {row.maternityTotal} / {row.maternityQuota}
                                </span>
                              ) : '0'}
                            </td>
                          )}
                          {!isWfhReport && hasPaternity && (
                            <td>
                              {row.paternityQuota > 0 || row.paternityTotal > 0 ? (
                                <span className="fw-bold text-success">
                                  {row.paternityTotal} / {row.paternityQuota}
                                </span>
                              ) : '0'}
                            </td>
                          )}
                          {!isWfhReport && <td>{row.restrictedHoliday}</td>}
                          <td>{row.totalLeave}</td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td />
                            <td colSpan={reportColSpan - 1}>
                              <div className="d-flex flex-column gap-3 py-2">
                                {row.details.map((detail) => (
                                  <div key={`detail-${row.employee.id}-${detail.type}`} className="border rounded p-2" style={{ borderColor: '#d9e2f2' }}>
                                    <div className="badge mb-2" style={{ background: '#2F5596' }}>
                                      {detail.type}: {roundReportValue(detail.entries.reduce((sum, entry) => sum + Number(entry.days || 0), 0))}
                                    </div>
                                    <div className="table-responsive">
                                      <table className="table table-sm mb-0">
                                        <thead style={{ background: '#f7f9fc' }}>
                                          <tr>
                                            <th>Event Start Date</th>
                                            <th>Event End Date</th>
                                            <th>Days</th>
                                            <th>Description</th>
                                            <th>Status</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {detail.entries.map((entry, idx) => (
                                            <tr key={`detail-entry-${row.employee.id}-${detail.type}-${idx}`}>
                                              <td>{formatDateForDisplayIST(entry.startDate)}</td>
                                              <td>{formatDateForDisplayIST(entry.endDate)}</td>
                                              <td>{roundReportValue(Number(entry.days || 0))}</td>
                                              <td>{entry.description}</td>
                                              <td>
                                                <span>{entry.status}</span>
                                                {entry.isHalfDay && (
                                                  <span className="text-muted ms-1" style={{ fontSize: '12px' }}>
                                                    ({entry.halfDayType === 'first' ? 'First Half' : 'Second Half'})
                                                  </span>
                                                )}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

export default LeaveRequestsTable;
