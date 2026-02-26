
import * as React from 'react';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { LeaveRequest, Employee } from '../types';
import { LeaveStatus } from '../types';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';
import CommonTable, { ColumnDef } from '../ui/CommonTable';
import { Check, X, Filter, MessageSquare, Info, RotateCcw, ChevronDown, ChevronRight, Clock, Download, FileText } from 'lucide-react';
import { formatAuditInfo, formatDateIST, getNowIST, todayIST } from '../utils/dateTime';

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
    days: number;
    submittedAt: string;
    approverName: string;
    approverComment: string;
    isHalfDay: boolean;
    halfDayType: string;
  }>;
}

interface LeaveReportRow {
  employee: Employee;
  planned: number;
  unplanned: number;
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

const classifyLeaveBucket = (request: LeaveRequest): 'planned' | 'unplanned' | 'restrictedHoliday' => {
  const leaveType = String(request.leaveType || '').toLowerCase();
  if (leaveType.indexOf('restricted') !== -1 || leaveType === 'rh') return 'restrictedHoliday';
  if (leaveType.indexOf('planned') !== -1) return 'planned';
  if (leaveType.indexOf('unplanned') !== -1) return 'unplanned';
  return 'unplanned';
};

const LeaveRequestsTable: React.FC<LeaveRequestsTableProps> = ({ requests, employees, leaveQuotas, filter, onFilterChange, onUpdateStatus, onDelete, onViewBalance, onOpenRequestForm, onOpenRequestVersionHistory, teams, title = 'Detailed Leave Applications', showLeaveBalance = true, showGenerateReportButton = true, externalOpenReportKey }) => {
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
      const reqDate = new Date(req.submittedAt);
      const reqTime = reqDate.getTime();
      const startOfDay = (d: Date) => { d.setHours(0, 0, 0, 0); return d.getTime(); };

      if (selectedDateFilter === 'Today') {
        return req.submittedAt === todayStr;
      }
      if (selectedDateFilter === 'Yesterday') {
        const yest = new Date(); yest.setDate(today.getDate() - 1);
        return req.submittedAt === formatDateIST(yest);
      }
      if (selectedDateFilter === 'This Week') {
        const first = new Date(); first.setDate(today.getDate() - today.getDay());
        return reqTime >= startOfDay(first);
      }
      if (selectedDateFilter === 'Last Week') {
        const first = new Date(); first.setDate(today.getDate() - today.getDay() - 7);
        const last = new Date(); last.setDate(today.getDate() - today.getDay() - 1);
        return reqTime >= startOfDay(first) && reqTime <= startOfDay(last);
      }
      if (selectedDateFilter === 'This Month') {
        const first = new Date(today.getFullYear(), today.getMonth(), 1);
        return reqTime >= startOfDay(first);
      }
      if (selectedDateFilter === 'Last Month') {
        const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const last = new Date(today.getFullYear(), today.getMonth(), 0);
        return reqTime >= startOfDay(first) && reqTime <= startOfDay(last);
      }
      if (selectedDateFilter === 'Last 3 Months') {
        const three = new Date(); three.setMonth(today.getMonth() - 3);
        return reqTime >= startOfDay(three);
      }
      if (selectedDateFilter === 'This Year') {
        const start = new Date(today.getFullYear(), 0, 1);
        return reqTime >= startOfDay(start);
      }
      if (selectedDateFilter === 'Last Year') {
        const start = new Date(today.getFullYear() - 1, 0, 1);
        const end = new Date(today.getFullYear() - 1, 11, 31);
        return reqTime >= startOfDay(start) && reqTime <= startOfDay(end);
      }
      if (selectedDateFilter === 'Custom' && startDate && endDate) {
        return req.submittedAt >= startDate && req.submittedAt <= endDate;
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
    const selectedEmployeeIds = reportSelectedMemberIds;
    let source = requests.filter((request) => selectedEmployeeIds.indexOf(request.employee.id) !== -1);

    if (reportDatePreset === 'Custom') {
      if (reportStartDate && reportEndDate) {
        const start = toDateValue(reportStartDate);
        const end = toDateValue(reportEndDate);
        if (start && end) {
          const startAt = startOfDay(start).getTime();
          const endAt = endOfDay(end).getTime();
          source = source.filter((request) => {
            const requestDate = toDateValue(request.startDate);
            if (!requestDate) return false;
            const requestAt = requestDate.getTime();
            return requestAt >= startAt && requestAt <= endAt;
          });
        }
      }
    } else {
      const range = resolvePresetRange(reportDatePreset, todayDate);
      if (range.start && range.end) {
        const startAt = range.start.getTime();
        const endAt = range.end.getTime();
        source = source.filter((request) => {
          const requestDate = toDateValue(request.startDate);
          if (!requestDate) return false;
          const requestAt = requestDate.getTime();
          return requestAt >= startAt && requestAt <= endAt;
        });
      }
    }

    const grouped: Record<string, LeaveReportRow> = {};
    source.forEach((request) => {
      const key = request.employee.id;
      if (!grouped[key]) {
        grouped[key] = {
          employee: request.employee,
          planned: 0,
          unplanned: 0,
          restrictedHoliday: 0,
          halfDay: 0,
          totalLeave: 0,
          details: []
        };
      }
      const row = grouped[key];
      const bucket = classifyLeaveBucket(request);
      const days = Number(request.days || 0);
      row[bucket] += days;
      if (request.isHalfDay) row.halfDay += days;
      row.totalLeave += days;

      const detailType = request.leaveType || 'Leave';
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
        days,
        submittedAt: request.submittedAt,
        approverName: request.approverName || '',
        approverComment: request.approverComment || '',
        isHalfDay: Boolean(request.isHalfDay),
        halfDayType: request.halfDayType || ''
      });
    });

    const rows = Object.keys(grouped).map((key) => grouped[key]).sort((a, b) => a.employee.name.localeCompare(b.employee.name));
    setGeneratedReportRows(rows);
    setExpandedReportEmployeeIds(new Set<string>());
    setIsReportGenerated(true);
  }, [reportDatePreset, reportEndDate, reportSelectedMemberIds, reportStartDate, requests]);

  const handleDownloadReport = React.useCallback(async (): Promise<void> => {
    if (generatedReportRows.length === 0) return;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Leave Report');

    // Title
    const titleRow = worksheet.addRow(['Monthly Report of Leave']);
    worksheet.mergeCells('A1:F1');
    titleRow.eachCell(cell => {
      cell.font = { bold: true, size: 14, color: { argb: 'FF2F5596' } };
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
    });
    worksheet.addRow([]); // Gap

    // Define main summary columns
    const summaryHeaders = ['Name', 'Planned', 'Unplanned', 'Restricted Holiday', 'Half-Day', 'Total Leave'];
    const summaryHeaderRow = worksheet.addRow(summaryHeaders);
    summaryHeaderRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5596' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    worksheet.columns = [
      { key: 'col1', width: 30 },
      { key: 'col2', width: 20 },
      { key: 'col3', width: 20 },
      { key: 'col4', width: 20 },
      { key: 'col5', width: 20 },
      { key: 'col6', width: 20 }
    ];

    generatedReportRows.forEach((row) => {
      // Employee Summary Row
      const empRow = worksheet.addRow([
        row.employee.name,
        row.planned,
        row.unplanned,
        row.restrictedHoliday,
        row.halfDay,
        row.totalLeave
      ]);
      empRow.eachCell(cell => {
        cell.font = { bold: true };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.alignment = { horizontal: 'left' };
      });

      // Nested Details
      row.details.forEach(group => {
        worksheet.addRow([]); // Small gap for grouping

        // Group Header (e.g., RH: 3)
        const groupHeader = worksheet.addRow([`${group.type}: ${group.entries.length}`]);
        worksheet.mergeCells(`A${groupHeader.number}:B${groupHeader.number}`);
        groupHeader.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5596' } };
        groupHeader.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        groupHeader.getCell(1).alignment = { horizontal: 'center' };

        // Detail Headers
        const detailHeaders = ['Event Start Date', 'Event End Date', 'Description', 'Status'];
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
          const entryRow = worksheet.addRow([
            '',
            entry.startDate,
            entry.endDate,
            entry.description,
            entry.status
          ]);
          entryRow.eachCell((cell, colNum) => {
            if (colNum > 1) {
              cell.font = { size: 9 };
              cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

              if (colNum === 5) { // Status column
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
    saveAs(blob, `leave_report_${todayIST()}.xlsx`);
  }, [generatedReportRows]);

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
      accessor: (request) => request.employee.name,
      render: (request) => (
        <div className="d-flex align-items-center">
          <img className="rounded-circle border" src={request.employee.avatar} alt={request.employee.name} width="36" height="36" style={{ objectFit: 'cover' }} />
          <div className="ms-3">
            <div className="text-dark">{request.employee.name}</div>
            <div className="text-muted" style={{ fontSize: '10px' }}>ID: {request.employee.id} • {request.employee.department}</div>
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
        const used = calculateUsedLeaves(request.employee.id, request.leaveType);
        const quota = leaveQuotas[request.leaveType] || 0;
        return (
          <div className="d-flex align-items-center gap-2">
            <span style={{ color: '#2F5596' }}>{used} / {quota}</span>
            <Info size={14} className="text-muted cursor-pointer" onClick={() => onViewBalance?.(request.employee)} />
          </div>
        );
      }
    }] : []),
    {
      key: 'leaveType',
      header: 'Type',
      accessor: (request) => request.leaveType,
      render: (request) => (
        <div className="d-flex flex-column gap-1">
          <span className="text-dark">{request.leaveType}</span>
          {request.isHalfDay && (
            <span className="blockgray bgLightGay" style={{ fontSize: '8px', width: 'fit-content' }}>
              <Clock size={8} className="me-1" />
              {request.halfDayType === 'first' ? '1st Half' : '2nd Half'}
            </span>
          )}
        </div>
      )
    },
    {
      key: 'dates',
      header: 'Dates & Duration',
      accessor: (request) => `${request.startDate} ${request.endDate}`,
      render: (request) => (
        <>
          <div className="text-dark">{request.startDate} <span className="text-muted">to</span> {request.endDate}</div>
          <div className="text-muted" style={{ fontSize: '10px' }}>{request.days} Full Day(s)</div>
        </>
      )
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
      accessor: (request) => request.status,
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
        <div className="d-flex align-items-center justify-content-end gap-1 leave-action-group">
          {request.status === LeaveStatus.Pending ? (
            <>
              <button
                onClick={() => handleActionClick(request, LeaveStatus.Approved)}
                className="leave-action-btn leave-action-btn--approve"
                title="Approve request"
                aria-label="Approve request"
              >
                <Check size={17} strokeWidth={2.4} />
              </button>
              <button
                onClick={() => handleActionClick(request, LeaveStatus.Rejected)}
                className="leave-action-btn leave-action-btn--reject"
                title="Reject request"
                aria-label="Reject request"
              >
                <X size={17} strokeWidth={2.4} />
              </button>
            </>
          ) : (
            <button
              onClick={() => handleRevertClick(request)}
              className="leave-action-btn leave-action-btn--revert"
              title="Revert to pending"
              aria-label="Revert to pending"
            >
              <RotateCcw size={16} strokeWidth={2.2} />
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
          <div className="border-top pt-3 pb-2">
            <div className="d-flex flex-wrap gap-5">
              {teams.map(teamName => {
                const teamMembers = employees.filter(emp => emp.department === teamName);
                if (teamMembers.length === 0) return null;
                const teamLabel = /team$/i.test(teamName) ? teamName : `${teamName} Team`;

                return (
                  <div key={teamName} className="taskTeamBox px-2 mt-1">
                    <div className='top-assign'>
                    <div className='team'>
                      <label className="BdrBtm">
                        {teamLabel}
                      </label>
                    </div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
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
                        onChange={() => setSelectedDateFilter(preset)}
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
        title="Employee Leave Report"
        size="lg"
        footer={
          <>
            <button className="btn btn-default" onClick={() => setIsReportFilterModalOpen(false)}>Cancel</button>
            {!isReportGenerated ? (
              <button className="btn btn-primary px-4" onClick={runReportGeneration}>Submit</button>
            ) : (
              <>
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
                  onClick={() => setReportSelectedMemberIds(employees.map((emp) => emp.id))}
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
                : reportSelectedMemberIds.length === employees.length
                  ? 'All users selected'
                  : `${reportSelectedMemberIds.length} user(s) selected`}
            </div>
          </div>
          <div className="col-12">
            <div className="d-flex flex-wrap gap-4 border rounded p-2" style={{ background: '#f7f9fc', borderColor: '#d9e2f2' }}>
              {teams.map((teamName) => {
                const teamMembers = employees.filter((emp) => emp.department === teamName);
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
            <h3 className="h5 mb-3 fw-bold" style={{ color: '#2F5596' }}>Monthly Report of Leave</h3>
            <div className="table-responsive border rounded" style={{ borderColor: '#d9e2f2' }}>
              <table className="table table-sm mb-0 align-middle">
                <thead style={{ background: '#eef3fb' }}>
                  <tr>
                    <th style={{ width: 28 }} />
                    <th>Name</th>
                    <th>Planned</th>
                    <th>Unplanned</th>
                    <th>Restricted Holiday</th>
                    <th>Half-Day</th>
                    <th>Total Leave</th>
                  </tr>
                </thead>
                <tbody>
                  {generatedReportRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center text-muted py-3">No report data found for selected filters.</td>
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
                          <td>{row.planned}</td>
                          <td>{row.unplanned}</td>
                          <td>{row.restrictedHoliday}</td>
                          <td>{row.halfDay}</td>
                          <td>{row.totalLeave}</td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td />
                            <td colSpan={6}>
                              <div className="d-flex flex-column gap-3 py-2">
                                {row.details.map((detail) => (
                                  <div key={`detail-${row.employee.id}-${detail.type}`} className="border rounded p-2" style={{ borderColor: '#d9e2f2' }}>
                                    <div className="badge mb-2" style={{ background: '#2F5596' }}>{detail.type}: {detail.entries.length}</div>
                                    <div className="table-responsive">
                                      <table className="table table-sm mb-0">
                                        <thead style={{ background: '#f7f9fc' }}>
                                          <tr>
                                            <th>Event Start Date</th>
                                            <th>Event End Date</th>
                                            <th>Description</th>
                                            <th>Status</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {detail.entries.map((entry, idx) => (
                                            <tr key={`detail-entry-${row.employee.id}-${detail.type}-${idx}`}>
                                              <td>{entry.startDate}</td>
                                              <td>{entry.endDate}</td>
                                              <td>{entry.description}</td>
                                              <td>{entry.status}</td>
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
