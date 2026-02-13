
import * as React from 'react';
import type { LeaveRequest, Employee, AttendanceRecord, SalarySlip, Holiday, Policy, Concern, TeamEvent } from '../types';
import { LeaveStatus, ConcernStatus, ConcernType } from '../types';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';
import CommonTable, { ColumnDef } from '../ui/CommonTable';
import {
  Plus, Banknote, Download, FileText, Sun, Calendar as CalendarIcon, Info, UserCheck, Cake, PartyPopper, Clock, Flag, FileCheck, AlertCircle, MessageSquare, ChevronLeft, ChevronRight, Calendar
} from 'lucide-react';
import { formatDateForDisplayIST, getNowIST, monthNameIST, formatDateIST } from '../utils/dateTime';

interface EmployeePortalProps {
  user: Employee;
  requests: LeaveRequest[];
  attendance: AttendanceRecord[];
  salarySlips: SalarySlip[];
  policies: Policy[];
  holidays: Holiday[];
  concerns: Concern[];
  leaveQuotas: Record<string, number>;
  teamEvents: TeamEvent[];
  onRaiseConcern: (type: ConcernType, referenceId: string | number, description: string) => void;
  onSubmitLeave: () => void;
  onTabChange?: (tab: string) => void;
  activeTab: string;
}

const EmployeePortal: React.FC<EmployeePortalProps> = ({ user, requests, attendance, salarySlips, policies, holidays, concerns, leaveQuotas, teamEvents, onRaiseConcern, onSubmitLeave, onTabChange, activeTab }) => {
  const [isPolicyModalOpen, setIsPolicyModalOpen] = React.useState(false);
  const [isConcernModalOpen, setIsConcernModalOpen] = React.useState(false);
  const [targetType, setTargetType] = React.useState<ConcernType>(ConcernType.General);
  const [targetRefId, setTargetRefId] = React.useState<string | number>('');
  const [concernDescription, setConcernDescription] = React.useState('');
  const [isBalanceModalOpen, setIsBalanceModalOpen] = React.useState(false);

  // Attendance Navigation State
  const [viewMode, setViewMode] = React.useState<'Daily' | 'Weekly' | 'Monthly'>('Weekly');
  const [referenceDate, setReferenceDate] = React.useState<Date>(getNowIST());

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

  const idsMatch = React.useCallback((a: unknown, b: unknown): boolean => {
    const idA = normalizeCompactId(a);
    const idB = normalizeCompactId(b);
    if (!idA || !idB) return false;
    if (idA === idB) return true;

    const numA = normalizeNumericId(a);
    const numB = normalizeNumericId(b);
    return !!numA && !!numB && numA === numB;
  }, [normalizeCompactId, normalizeNumericId]);

  const extractPayrollEmployeeTokens = React.useCallback((payrollKey: string): { name: string; id: string } => {
    const raw = String(payrollKey || '').trim();
    if (!raw) return { name: '', id: '' };

    // Expected format: EmployeeName-EmployeeID-Month-Year (name can contain hyphens)
    const parts = raw.split('-').map((p) => p.trim()).filter(Boolean);
    if (parts.length < 4) return { name: '', id: '' };

    const id = parts[parts.length - 3] || '';
    const name = parts.slice(0, parts.length - 3).join('-');
    return { name, id };
  }, []);

  const myRequests = React.useMemo(() =>
    requests
      .filter(r => {
        if (idsMatch(r.employee.id, user.id)) return true;
        const reqEmail = normalizeText(r.employee.email);
        const userEmail = normalizeText(user.email);
        if (reqEmail && userEmail && reqEmail === userEmail) return true;
        return normalizeText(r.employee.name) === normalizeText(user.name);
      })
      .sort((a, b) => b.id - a.id),
    [requests, user, idsMatch, normalizeText]);

  const mySalaries = React.useMemo(() =>
    salarySlips
      .filter((s) => {
        if (idsMatch(s.employeeId, user.id)) return true;
        if (user.itemId && idsMatch(s.employeeId, user.itemId)) return true;

        const payrollParsed = extractPayrollEmployeeTokens(s.payrollKey || '');
        const payrollEmployeeName = normalizeText(payrollParsed.name);
        const payrollEmployeeId = normalizeText(payrollParsed.id);
        const userName = normalizeText(user.name);
        const userId = normalizeText(user.id);
        const userEmail = normalizeText(user.email);
        const userItemId = normalizeText(user.itemId);

        // Strict matching only for current user records.
        if (payrollEmployeeName && userName && payrollEmployeeName === userName) return true;
        if (payrollEmployeeId && userId && idsMatch(payrollEmployeeId, userId)) return true;
        if (payrollEmployeeId && userItemId && idsMatch(payrollEmployeeId, userItemId)) return true;

        // Defensive fallback if any tenant stores email in payrollKey.
        const payrollKey = normalizeText(s.payrollKey);
        if (payrollKey && userEmail && payrollKey.split('-').map((x) => x.trim()).indexOf(userEmail) !== -1) return true;

        return false;
      })
      .sort((a, b) => {
        const monthOrder: Record<string, number> = {
          january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
          july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
        };

        const yearA = Number(a.year || 0);
        const yearB = Number(b.year || 0);
        if (!Number.isNaN(yearA) && !Number.isNaN(yearB) && yearA !== yearB) {
          return yearB - yearA;
        }

        const monthA = monthOrder[normalizeText(a.month)] || 0;
        const monthB = monthOrder[normalizeText(b.month)] || 0;
        if (monthA !== monthB) {
          return monthB - monthA;
        }

        const aTime = new Date(a.generatedDate || '').getTime();
        const bTime = new Date(b.generatedDate || '').getTime();
        if (!Number.isNaN(aTime) && !Number.isNaN(bTime)) return bTime - aTime;
        return (b.generatedDate || '').localeCompare(a.generatedDate || '');
      }),
    [salarySlips, user.id, user.name, user.email, user.itemId, idsMatch, normalizeText, extractPayrollEmployeeTokens]);

  const myAttendance = React.useMemo(() => {
    return attendance.filter(a => {
      // 1. User matching
      const isMine = idsMatch(a.employeeId, user.id) || normalizeText(a.employeeName) === normalizeText(user.name);
      if (!isMine) return false;

      // 2. View mode filtering
      const refDateStr = formatDateIST(referenceDate);

      if (viewMode === 'Daily') {
        return a.date === refDateStr;
      }

      if (viewMode === 'Weekly') {
        const startOfWeek = new Date(referenceDate);
        startOfWeek.setDate(referenceDate.getDate() - referenceDate.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const recStart = new Date(a.date);
        recStart.setHours(0, 0, 0, 0);

        return recStart >= startOfWeek && recStart <= endOfWeek;
      }

      if (viewMode === 'Monthly') {
        const recDateObj = new Date(a.date);
        return recDateObj.getMonth() === referenceDate.getMonth() && recDateObj.getFullYear() === referenceDate.getFullYear();
      }

      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [attendance, user, idsMatch, normalizeText, viewMode, referenceDate]);

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

  const myConcerns = React.useMemo(() =>
    concerns
      .filter(c => idsMatch(c.employeeId, user.id))
      .sort((a, b) => b.id - a.id),
    [concerns, user.id, idsMatch]);

  const handleOpenConcern = (type: ConcernType, refId: string | number) => {
    setTargetType(type);
    setTargetRefId(refId);
    setConcernDescription('');
    setIsConcernModalOpen(true);
  };

  const handleSubmitConcern = (e: React.FormEvent) => {
    e.preventDefault();
    onRaiseConcern(targetType, targetRefId, concernDescription);
    setIsConcernModalOpen(false);
  };

  const formatCurrencyINR = React.useCallback((value: number): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number.isFinite(value) ? value : 0);
  }, []);

  const escapeHtml = React.useCallback((value: unknown): string => {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }, []);

  const htmlToInnerText = React.useCallback((value: unknown): string => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';

    // Browser-safe conversion from rich HTML to plain text.
    const parser = new DOMParser();
    const doc = parser.parseFromString(raw, 'text/html');
    return (doc.body?.textContent || '').trim();
  }, []);

  const downloadSalarySlipPdf = React.useCallback((slip?: SalarySlip): void => {
    if (!slip) return;
    const gross = (slip.basic || 0) + (slip.hra || 0) + (slip.allowances || 0);

    const popup = window.open('', '_blank', 'width=980,height=800');
    if (!popup) {
      alert('Please allow popups to download salary PDF.');
      return;
    }

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Salary Slip - ${escapeHtml(slip.month)} ${escapeHtml(slip.year)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 28px; color: #1f2937; }
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
            .title { font-size: 24px; font-weight: 700; color: #1d4d9b; }
            .meta { font-size: 13px; color: #475569; text-align: right; }
            .card { border: 1px solid #dbe2ea; border-radius: 8px; padding: 14px; margin-bottom: 14px; }
            .card-title { font-weight: 700; margin-bottom: 8px; color: #1d4d9b; }
            .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px 14px; font-size: 13px; }
            .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 14px; font-size: 13px; }
            .label { color: #64748b; font-size: 12px; margin-bottom: 2px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 8px; font-size: 13px; }
            th { text-align: left; background: #f8fafc; color: #334155; }
            td:last-child { text-align: right; font-weight: 600; }
            .total { font-size: 22px; font-weight: 700; color: #0f8a4b; text-align: right; margin-top: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">Salary Slip</div>
            <div class="meta">
              <div><strong>Pay Period:</strong> ${escapeHtml(slip.month)} ${escapeHtml(slip.year)}</div>
              <div><strong>Generated On:</strong> ${escapeHtml(formatDateForDisplayIST(slip.generatedDate, 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }))}</div>
            </div>
          </div>

          <div class="card">
            <div class="card-title">Employee Information</div>
            <div class="grid3">
              <div><div class="label">Name</div><div>${escapeHtml(user.name)}</div></div>
              <div><div class="label">Employee ID</div><div>${escapeHtml(user.id)}</div></div>
              <div><div class="label">Department</div><div>${escapeHtml(user.department)}</div></div>
            </div>
          </div>

          <div class="card">
            <div class="card-title">Bank Details</div>
            <div class="grid2">
              <div><div class="label">PAN Number</div><div>${escapeHtml(user.pan || '-')}</div></div>
              <div><div class="label">Bank Name</div><div>${escapeHtml(user.bankName || '-')}</div></div>
              <div><div class="label">Account Number</div><div>${escapeHtml(user.accountNumber || '-')}</div></div>
              <div><div class="label">IFSC Code</div><div>${escapeHtml(user.ifscCode || '-')}</div></div>
            </div>
          </div>

          <div class="card">
            <div class="card-title">Salary Breakdown</div>
            <table>
              <thead>
                <tr><th>Component</th><th>Amount</th></tr>
              </thead>
              <tbody>
                <tr><td>Basic Pay</td><td>${escapeHtml(formatCurrencyINR(slip.basic || 0))}</td></tr>
                <tr><td>HRA</td><td>${escapeHtml(formatCurrencyINR(slip.hra || 0))}</td></tr>
                <tr><td>Allowances</td><td>${escapeHtml(formatCurrencyINR(slip.allowances || 0))}</td></tr>
                <tr><td>Gross</td><td>${escapeHtml(formatCurrencyINR(gross))}</td></tr>
                <tr><td>Total Deductions</td><td>${escapeHtml(formatCurrencyINR(slip.deductions || 0))}</td></tr>
              </tbody>
            </table>
            <div class="total">Net Pay: ${escapeHtml(formatCurrencyINR(slip.netPay || 0))}</div>
          </div>
          <script>window.onload = function(){ window.print(); };</script>
        </body>
      </html>
    `;

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  }, [escapeHtml, formatCurrencyINR, user]);

  const currentMonthHolidays = React.useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    return holidays.filter(h => {
      const hDate = new Date(h.date);
      return hDate.getMonth() === currentMonth;
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [holidays]);

  const formattedCelebrations = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime());
    tomorrow.setDate(tomorrow.getDate() + 1);

    return teamEvents.map(event => {
      const eventDate = new Date(event.date);
      eventDate.setHours(0, 0, 0, 0);

      let dateLabel = '';
      if (eventDate.getTime() === today.getTime()) {
        dateLabel = 'Today';
      } else if (eventDate.getTime() === tomorrow.getTime()) {
        dateLabel = 'Tomorrow';
      } else {
        dateLabel = formatDateForDisplayIST(eventDate, 'en-US', { month: 'short', day: 'numeric' });
      }

      let icon = <CalendarIcon size={16} className="text-secondary" />;
      if (event.type === 'Birthday') icon = <Cake size={16} className="text-danger" />;
      if (event.type === 'Work Anniversary') icon = <PartyPopper size={16} className="text-warning" />;
      if (event.type === 'Meeting') icon = <UserCheck size={16} className="text-primary" />;

      return {
        ...event,
        dateLabel,
        icon,
        avatar: event.employee?.avatar || `https://i.pravatar.cc/150?u=${encodeURIComponent(event.name)}`
      };
    }).sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    }).slice(0, 5); // Just show top 5 for portal view
  }, [teamEvents]);

  // Dynamic leave balance calculations
  const leaveStats = React.useMemo(() => {
    // Only count APPROVED leaves for usage
    const approved = myRequests.filter(r => r.status === LeaveStatus.Approved);

    // Iterate over ALL defined quotas to show them dynamically
    return Object.keys(leaveQuotas).map(type => {
      const used = approved
        .filter(r => r.leaveType === type)
        .reduce((sum, r) => sum + r.days, 0);

      const total = leaveQuotas[type];

      // Determine icon based on type name (case insensitive checks)
      let icon = <FileText size={14} className="text-primary" />;
      const lowerType = type.toLowerCase();

      if (lowerType.includes('sick')) icon = <FileText size={14} className="text-danger" />;
      else if (lowerType.includes('earned') || lowerType.includes('vacation')) icon = <Sun size={14} className="text-warning" />;
      else if (lowerType.includes('un-planned') || lowerType.includes('unplanned') || lowerType.includes('casual')) icon = <AlertCircle size={14} className="text-info" />;

      return {
        label: type,
        icon: icon,
        val: `${used}/${total} Days`,
        used,
        total,
        left: Math.max(0, total - used)
      };
    });
  }, [myRequests, leaveQuotas]);

  const ConcernSection = ({ type }: { type: ConcernType }) => {
    const filteredConcerns = myConcerns.filter(c => c.type === type);

    if (filteredConcerns.length === 0) return null;

    return (
      <div className="mt-5 animate-in fade-in">
        <h6 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: '#2F5596' }}>
          <MessageSquare size={16} /> My {type} Concerns & History
        </h6>
        <div className="row g-3">
          {filteredConcerns.map(c => (
            <div key={c.id} className="col-12">
              <div className="card shadow-sm border-0 p-3 bg-white">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-light text-dark border" style={{ fontSize: '10px' }}>Ref: {c.referenceId}</span>
                    <span className={`badge ${c.status === ConcernStatus.Open ? 'bg-warning text-dark' : 'bg-success text-white'}`} style={{ fontSize: '10px' }}>{c.status}</span>
                  </div>
                  <span className="small text-muted" style={{ fontSize: '11px' }}>{c.submittedAt}</span>
                </div>
                <div className="p-2 rounded bg-light border-start border-3 border-warning mb-2">
                  <p className="mb-0 small text-dark"><strong>Query:</strong> {c.description}</p>
                </div>
                {c.reply ? (
                  <div className="p-2 rounded mt-2" style={{ backgroundColor: '#f0f9ff', borderLeft: '3px solid #0ea5e9' }}>
                    <div className="d-flex justify-content-between mb-1">
                      <span className="small fw-bold text-primary">HR Resolution:</span>
                      <span className="small text-muted" style={{ fontSize: '10px' }}>{c.repliedAt}</span>
                    </div>
                    <p className="mb-0 small text-dark">{htmlToInnerText(c.reply)}</p>
                  </div>
                ) : (
                  <p className="mb-0 small text-muted font-italic"><Clock size={12} className="me-1" /> Under Review...</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const attendanceColumns = React.useMemo<ColumnDef<AttendanceRecord>[]>(() => ([
    { key: 'date', header: 'Date', accessor: (rec) => rec.date, render: (rec) => <span className="fw-bold">{rec.date}</span> },
    {
      key: 'status',
      header: 'Work Status',
      accessor: (rec) => rec.status,
      render: (rec) => (
        <span className={`badge ${rec.status === 'Present' ? 'bg-success text-white' : 'bg-danger text-white'}`} style={{ fontSize: '9px' }}>
          {rec.status.toUpperCase()}
        </span>
      )
    },
    { key: 'clockIn', header: 'Clock In', accessor: (rec) => rec.clockIn || '', render: (rec) => rec.clockIn || '--:--' },
    { key: 'clockOut', header: 'Clock Out', accessor: (rec) => rec.clockOut || '', render: (rec) => rec.clockOut || '--:--' },
    {
      key: 'actions',
      header: 'Action',
      searchable: false,
      filterable: false,
      align: 'end',
      render: (rec) => (
        <button
          className="btn btn-sm btn-light border text-primary fw-bold"
          style={{ fontSize: '10px' }}
          onClick={() => handleOpenConcern(ConcernType.Attendance, rec.date)}
        >
          <AlertCircle size={12} className="me-1" /> Raise Concern
        </button>
      )
    }
  ]), [handleOpenConcern]);

  const salaryColumns = React.useMemo<ColumnDef<SalarySlip>[]>(() => ([
    { key: 'period', header: 'Pay Period', accessor: (slip) => `${slip.month} ${slip.year}`, render: (slip) => <span className="fw-bold">{slip.month} {slip.year}</span> },
    { key: 'basic', header: 'Basic Salary', accessor: (slip) => slip.basic, render: (slip) => `₹${slip.basic.toLocaleString()}` },
    { key: 'deductions', header: 'Total Deductions', accessor: (slip) => slip.deductions, render: (slip) => <span className="text-danger">₹{slip.deductions.toLocaleString()}</span> },
    { key: 'netPay', header: 'Net Paid', accessor: (slip) => slip.netPay, render: (slip) => <span className="fw-bold text-success">₹{slip.netPay.toLocaleString()}</span> },
    {
      key: 'actions',
      header: 'Actions',
      searchable: false,
      filterable: false,
      align: 'end',
      render: (slip) => (
        <div className="d-flex justify-content-end gap-2">
          <button className="btn btn-sm btn-outline-primary" style={{ borderColor: '#2F5596', color: '#2F5596' }} onClick={() => downloadSalarySlipPdf(slip)}>
            <Download size={14} /> PDF
          </button>
          <button
            className="btn btn-sm btn-light border text-primary fw-bold"
            style={{ fontSize: '10px' }}
            onClick={() => handleOpenConcern(ConcernType.Salary, slip.id)}
          >
            <AlertCircle size={12} className="me-1" /> Raise Concern
          </button>
        </div>
      )
    }
  ]), [downloadSalarySlipPdf, handleOpenConcern]);

  const leaveColumns = React.useMemo<ColumnDef<LeaveRequest>[]>(() => ([
    { key: 'duration', header: 'Duration', accessor: (r) => `${r.startDate} ${r.endDate}`, render: (r) => <span className="fw-medium">{r.startDate} - {r.endDate}</span> },
    { key: 'leaveType', header: 'Type', accessor: (r) => r.leaveType },
    { key: 'days', header: 'Days', accessor: (r) => r.days, render: (r) => `${r.days} Days` },
    { key: 'status', header: 'Status', accessor: (r) => r.status, render: (r) => <Badge status={r.status} /> },
    {
      key: 'actions',
      header: 'Action',
      searchable: false,
      filterable: false,
      align: 'end',
      render: (r) => (
        <button
          className="btn btn-sm btn-light border text-primary fw-bold"
          style={{ fontSize: '10px' }}
          onClick={() => handleOpenConcern(ConcernType.Leave, r.id)}
        >
          <AlertCircle size={12} className="me-1" /> Raise Concern
        </button>
      )
    }
  ]), [handleOpenConcern]);

  const renderDashboardTab = () => {
    return (
      <div className="animate-in fade-in pb-5">
        <div className="mb-4 d-flex justify-content-between align-items-end">
          <div>
            <h2 className="h2 fw-bold mb-1" style={{ color: '#333' }}>Welcome, {user.name.split(' ')[0]}!</h2>
            <p className="text-muted small mb-0">Here is your summary for today.</p>
          </div>
          <div className="text-end d-none d-md-block">
            <span className="small fw-bold text-muted d-block">Current Date</span>
            <span className="fw-medium text-dark">{formatDateForDisplayIST(getNowIST(), 'en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
          </div>
        </div>

        <div className="row g-4 mb-4">
          <div className="col-lg-5">
            <div className="card shadow-sm border-0 h-100 p-4 bg-white">
              <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
                <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                  <Banknote size={18} color="#2F5596" /> Latest Payroll Summary
                </h6>
                <div className="badge bg-success-subtle text-success border">Paid</div>
              </div>
              <div className="d-flex align-items-center gap-3 mb-4 mt-2">
                <div className="p-3 rounded-circle bg-light d-flex align-items-center justify-content-center" style={{ width: '64px', height: '64px' }}>
                  <Banknote size={32} color="#2F5596" />
                </div>
                <div>
                  <div className="small text-muted fw-medium">{mySalaries[0]?.month} {mySalaries[0]?.year} Slip</div>
                  <div className="h3 fw-bold mb-0 text-dark">₹{mySalaries[0]?.netPay.toLocaleString()}</div>
                </div>
              </div>
              <div className="d-grid">
                <button
                  className="btn btn-primary fw-bold d-flex align-items-center justify-content-center gap-2 py-2 shadow-sm"
                  onClick={() => downloadSalarySlipPdf(mySalaries[0])}
                >
                  <Download size={18} /> Download Monthly Slip
                </button>
              </div>
            </div>
          </div>

          <div className="col-lg-3">
            <div className="card shadow-sm border-0 h-100 p-4">
              <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
                <h6 className="fw-bold mb-0 text-dark">Leave Balance</h6>
                <button className="btn btn-link p-0 border-0" onClick={() => setIsBalanceModalOpen(true)}>
                  <Info size={14} className="text-muted" />
                </button>
              </div>
              <div className="d-flex flex-column gap-3">
                {leaveStats.map((item, idx) => (
                  <div key={idx} className="d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-2 small fw-medium text-dark">
                      {item.icon} {item.label}
                    </div>
                    <div className="small fw-bold">{item.val} </div>
                  </div>
                ))}
              </div>
              <div className="mt-auto pt-3 border-top">
                <button
                  className="btn btn-link btn-sm p-0 text-decoration-none d-flex align-items-center gap-1 fw-bold"
                  style={{ color: '#2F5596', fontSize: '12px' }}
                  onClick={() => setIsPolicyModalOpen(true)}
                >
                  <FileCheck size={14} /> View Leave Policy
                </button>
              </div>
            </div>
          </div>

          <div className="col-lg-4">
            <div className="card shadow-sm border-0 h-100 p-4">
              <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
                <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                  <PartyPopper size={18} color="#E44D26" /> Team Celebrations
                </h6>
              </div>
              <div className="d-flex flex-column gap-2 mt-1">
                {formattedCelebrations.map((item, idx) => (
                  <div key={idx} className="d-flex align-items-center justify-content-between p-2 rounded hover-bg-light transition-all border border-transparent hover-border-light">
                    <div className="d-flex align-items-center gap-3">
                      <div className="p-0 rounded-circle bg-light d-flex align-items-center justify-content-center overflow-hidden" style={{ width: '32px', height: '32px' }}>
                        <img src={item.avatar} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <div>
                        <div className="small fw-bold text-dark">{item.name}</div>
                        <div className="text-muted d-flex align-items-center gap-1" style={{ fontSize: '10px' }}>
                          {item.icon} {item.type}
                        </div>
                      </div>
                    </div>
                    <div className="small badge bg-light text-dark border-0">{item.dateLabel}</div>
                  </div>
                ))}
                {formattedCelebrations.length === 0 && (
                  <div className="text-center py-4 text-muted small">No upcoming team events.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="row g-4">
          <div className="col-lg-7">
            <div className="card shadow-sm border-0 p-4 h-100">
              <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
                <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                  <Flag size={18} color="#2F5596" /> Upcoming Holidays ({monthNameIST()})
                </h6>
                <span className="small text-muted">{currentMonthHolidays.length} Holidays this month</span>
              </div>
              <div className="row g-3 mt-1">
                {currentMonthHolidays.length > 0 ? (
                  currentMonthHolidays.map(holiday => (
                    <div key={holiday.id} className="col-md-6">
                      <div className="p-3 rounded border bg-light d-flex align-items-center gap-3">
                        <div className={`p-2 rounded d-flex align-items-center justify-content-center ${holiday.type === 'Public' ? 'bg-primary' : 'bg-secondary'}`} style={{ width: '40px', height: '40px' }}>
                          <CalendarIcon size={18} className="text-white" />
                        </div>
                        <div>
                          <div className="small fw-bold text-dark">{holiday.name}</div>
                          <div className="text-muted d-flex align-items-center gap-1" style={{ fontSize: '11px' }}>
                            <Clock size={10} /> {formatDateForDisplayIST(holiday.date, 'en-US', { day: 'numeric', month: 'short' })} • {holiday.type}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-12 text-center py-4 text-muted small">No more holidays left in this month.</div>
                )}
              </div>
            </div>
          </div>

          <div className="col-lg-5">
            <div className="card shadow-sm border-0 p-4 h-100">
              <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
                <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                  <UserCheck size={18} color="#2F5596" /> Recent Attendance
                </h6>
                <button className="btn btn-link btn-sm p-0 text-decoration-none small" style={{ color: '#2F5596' }} onClick={() => onTabChange && onTabChange('attendance')}>View History</button>
              </div>
              <div className="d-flex flex-column gap-3 mt-2">
                {myAttendance.slice(0, 3).map((rec, i) => (
                  <div key={i} className="d-flex align-items-center justify-content-between pb-2 border-bottom border-light last-border-none">
                    <div className="d-flex align-items-center gap-3">
                      <div className="small fw-bold text-dark">{formatDateForDisplayIST(rec.date, 'en-US', { day: 'numeric', month: 'short' })}</div>
                      <div className="small text-muted">{rec.clockIn} - {rec.clockOut}</div>
                    </div>
                    <Badge status={rec.status === 'Present' ? LeaveStatus.Approved : LeaveStatus.Rejected} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Balance Summary Modal */}
        <Modal
          isOpen={isBalanceModalOpen}
          onClose={() => setIsBalanceModalOpen(false)}
          title="Balance Summary"
        >
          <div className="text-center mb-4">
            <h5 className="fw-bold text-primary mb-1">{user.name}</h5>
            <p className="text-muted small">Employee ID: {user.id}</p>
          </div>
          <div className="row g-3">
            {leaveStats.map((item, idx) => (
              <div key={idx} className="col-6">
                <div className="card h-100 border p-3 text-center shadow-xs hover-shadow-sm transition-all" style={{ borderRadius: '12px' }}>
                  <div className="display-5 fw-bold text-primary mb-1">{item.left}</div>
                  <div className="small fw-bold text-dark mb-2">{item.label}</div>
                  <div className="progress mb-2" style={{ height: '4px' }}>
                    <div
                      className="progress-bar bg-primary"
                      role="progressbar"
                      style={{ width: `${(item.used / (item.total || 1)) * 100}%` }}
                    ></div>
                  </div>
                  <div className="text-muted" style={{ fontSize: '10px' }}>
                    Used {item.used} / {item.total}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-top text-center">
            <button className="btn btn-light border fw-bold px-4" onClick={() => setIsBalanceModalOpen(false)}>Close</button>
          </div>
        </Modal>
      </div>
    );
  };

  return (
    <div className="animate-in fade-in duration-500 pb-5">
      {activeTab === 'dashboard' && renderDashboardTab()}

      {activeTab === 'attendance' && (
        <>
          <div className="card shadow-sm border-0 mb-4 px-4 py-3">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
              <div className="d-flex align-items-center gap-3">
                {/* View Toggles */}
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
                <div className="d-flex align-items-center gap-2 bg-light rounded-pill px-2 py-1 border shadow-xs">
                  <button className="btn btn-sm btn-link text-dark p-1 rounded-circle" onClick={handlePrev}>
                    <ChevronLeft size={20} />
                  </button>
                  <div className="fw-bold px-3 text-center" style={{ minWidth: '180px', color: '#2F5596', fontSize: '13px' }}>
                    {getDateDisplay()}
                  </div>
                  <button className="btn btn-sm btn-link text-dark p-1 rounded-circle" onClick={handleNext}>
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            </div>

            <CommonTable
              data={myAttendance}
              columns={attendanceColumns}
              getRowId={(row, index) => `${row.employeeId}-${row.date}-${index}`}
              globalSearchPlaceholder="Search attendance"
            />
          </div>
          <ConcernSection type={ConcernType.Attendance} />
        </>
      )}

      {activeTab === 'salary' && (
        <>
          <div className="card shadow-sm border-0 mb-4 p-4">
            <h5 className="fw-bold mb-4" style={{ color: '#2F5596' }}>Personal Salary Records</h5>
            <CommonTable
              data={mySalaries}
              columns={salaryColumns}
              getRowId={(row) => row.id}
              globalSearchPlaceholder="Search salaries"
            />
          </div>
          <ConcernSection type={ConcernType.Salary} />
        </>
      )}

      {activeTab === 'leave' && (
        <>
          <div className="card shadow-sm border-0 mb-4 py-3 px-3 d-flex flex-row justify-content-between align-items-center bg-white">
            <div>
              <h5 className="mb-0 fw-bold" style={{ color: '#2F5596' }}>Leave Request History</h5>
              <p className="small text-muted mb-0">Manage your leave applications</p>
            </div>
            <button className="btn btn-primary d-flex align-items-center gap-1 px-4 py-2 fw-bold shadow-sm" onClick={onSubmitLeave}>
              <Plus size={18} /> New Request
            </button>
          </div>

          <div className="card shadow-sm border-0 overflow-hidden mb-4">
            <CommonTable
              data={myRequests}
              columns={leaveColumns}
              getRowId={(row) => row.id}
              globalSearchPlaceholder="Search leave history"
            />
          </div>
          <ConcernSection type={ConcernType.Leave} />
        </>
      )}

      <Modal
        isOpen={isConcernModalOpen}
        onClose={() => setIsConcernModalOpen(false)}
        title={`Raise ${targetType} Concern`}
        footer={
          <>
            <button className="btn btn-default" onClick={() => setIsConcernModalOpen(false)}>Cancel</button>
            <button type="submit" form="raise-concern-form" className="btn btn-primary fw-bold px-4">Submit Concern</button>
          </>
        }
      >
        <form id="raise-concern-form" onSubmit={handleSubmitConcern}>
          <div className="alert alert-info py-2" style={{ fontSize: '12px' }}>
            <Info size={14} className="me-1" /> Raising concern for <strong>{targetType}</strong> (Ref: {targetRefId}).
          </div>
          <div className="mb-3">
            <label className="form-label small text-muted fw-bold text-uppercase">Description</label>
            <textarea
              className="form-control"
              rows={5}
              required
              value={concernDescription}
              onChange={e => setConcernDescription(e.target.value)}
              placeholder={`Detail your ${targetType.toLowerCase()} related issue here...`}
            ></textarea>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isPolicyModalOpen} onClose={() => setIsPolicyModalOpen(false)} title="Company Leave Policies">
        <div className="policy-content small" style={{ color: '#333', lineHeight: '1.6' }}>
          {policies.map((policy, idx) => (
            <div key={policy.id} className="mb-4">
              <h6 className="fw-bold text-dark mb-2 border-bottom pb-1 d-flex justify-content-between align-items-center">
                <span>{idx + 1}. {policy.title}</span>
                <span className="small text-muted fw-normal" style={{ fontSize: '10px' }}>{policy.lastUpdated}</span>
              </h6>
              <div className="ps-2" style={{ whiteSpace: 'pre-wrap' }}>{policy.content}</div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default EmployeePortal;
