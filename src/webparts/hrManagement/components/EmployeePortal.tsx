
import * as React from 'react';
import type { LeaveRequest, Employee, AttendanceRecord, SalarySlip, Holiday, Policy, Concern, TeamEvent } from '../types';
import { LeaveStatus, ConcernStatus, ConcernType } from '../types';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';
import CommonTable, { ColumnDef } from '../ui/CommonTable';
import {
  Plus, Download, FileText, Sun, Calendar as CalendarIcon, Info, UserCheck, Cake, PartyPopper, Clock, Flag, FileCheck, AlertCircle, MessageSquare, ChevronLeft, ChevronRight, Calendar, Users, Sparkle
} from 'lucide-react';
import { formatDateForDisplayIST, getNowIST, monthNameIST, formatDateIST, todayIST } from '../utils/dateTime';
import { numberToWords } from '../utils/numberToWords';

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
  onSubmitLeave: (preferredTab?: 'leave' | 'workFromHome') => void;
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
  const [selectedApprovalNote, setSelectedApprovalNote] = React.useState<LeaveRequest | null>(null);
  const [selectedConcern, setSelectedConcern] = React.useState<Concern | null>(null);
  const [selectedCelebration, setSelectedCelebration] = React.useState<TeamEvent | null>(null);
  const [eventBurst, setEventBurst] = React.useState<{ id: number; type: TeamEvent['type'] } | null>(null);
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

  const parseRecordDate = React.useCallback((value: string): Date | null => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [year, month, day] = raw.split('-').map(Number);
      const parsed = new Date(year, month - 1, day, 12, 0, 0);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, []);

  const getWorkDurationMinutes = React.useCallback((value: unknown): number | null => {
    const raw = String(value || '').trim();
    if (!raw || raw === '--:--' || raw === '-:--') return null;
    const match = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    return (hours * 60) + minutes;
  }, []);

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

  const myLeaveRequests = React.useMemo(
    () => myRequests.filter((request) => request.requestCategory !== 'Work From Home'),
    [myRequests]
  );

  const myWorkFromHomeRequests = React.useMemo(
    () => myRequests.filter((request) => request.requestCategory === 'Work From Home'),
    [myRequests]
  );

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

  const toPlainText = React.useCallback((value: unknown, fallback = ''): string => {
    const plain = htmlToInnerText(value);
    return plain || fallback;
  }, [htmlToInnerText]);

  const downloadSalarySlipPdf = React.useCallback((slip?: SalarySlip): void => {
    if (!slip) return;
    const gross = (slip.basic || 0) + (slip.hra || 0) + (slip.allowances || 0) + (slip.bonus || 0);
    const deductionsTotal = (slip.deductions || 0);
    // Determine "Other Deductions" by subtracting known components from the total deductions field
    const knownDeductions = (slip.employeePF || 0) + (slip.esi || 0) + (slip.insurance || 0);
    const otherDeductions = Math.max(0, deductionsTotal - knownDeductions);
    const netPayInWords = numberToWords(slip.netPay || 0);
    const formatAmount = (value: number): string => new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(Number.isFinite(value) ? value : 0);
    const monthShort = String(slip.month || '').slice(0, 3);
    const yearShort = String(slip.year || '').slice(-2);
    const monthLabel = `${monthShort}-${yearShort}`;
    const generatedAt = formatDateForDisplayIST(new Date(), 'en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).replace(',', '');
    const joiningDate = formatDateForDisplayIST(user.joiningDate, 'en-GB', {
      day: '2-digit',
      month: 'short',
      year: '2-digit'
    }).replace(/ /g, '-');

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
            @page { size: A4; margin: 8mm; }
            body { margin: 0; padding: 0; font-family: "Segoe UI", Arial, sans-serif; color: #1f2937; background: #ffffff; }
            .top-line { width: 100%; max-width: 780px; margin: 0 auto 6px auto; font-size: 11px; display: flex; justify-content: space-between; color: #374151; }
            .sheet { width: 100%; max-width: 780px; margin: 0 auto; border: 1px solid #4a86e8; position: relative; min-height: 1088px; }
            .watermark {
              position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
              font-size: 72px; color: rgba(42, 84, 153, 0.05); transform: rotate(-32deg); font-weight: 700;
              pointer-events: none; user-select: none; z-index: 0;
            }
            .content { position: relative; z-index: 1; }
            .header { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #4a86e8; min-height: 68px; }
            .brand { font-size: 56px; font-weight: 700; color: #405f88; display: flex; align-items: center; padding: 8px 16px; letter-spacing: -0.4px; }
            .company { text-align: right; padding: 18px 20px 10px 20px; }
            .company .name { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
            .company .addr { font-size: 11px; line-height: 1.3; color: #4b5563; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 12px; }
            td, th { border: 1px solid #d1d5db; padding: 4px 6px; vertical-align: middle; }
            .section-title { font-weight: 700; text-align: center; background: #fff; }
            .h-center { text-align: center; font-weight: 700; }
            .right { text-align: right; }
            .bold { font-weight: 700; }
            .blank { height: 20px; }
            .net-row td { font-size: 24px; font-weight: 700; border-top: 1px solid #4a86e8; border-bottom: 1px solid #4a86e8; }
            .note-row td { font-size: 16px; font-weight: 700; }
            .words { font-size: 12px !important; font-style: italic; color: #4b5563; font-weight: 500 !important; }
            .empty-space { height: 130px; }
          </style>
        </head>
        <body>
          <div class="top-line">
            <div>${escapeHtml(generatedAt)}</div>
            <div>Salary Slip - ${escapeHtml(slip.month)} ${escapeHtml(slip.year)}</div>
            <div></div>
          </div>
          <div class="sheet">
            <div class="content">
              <div class="watermark">Smalsus Infolabs</div>
              <div class="header">
                <div class="brand">Smalsus</div>
                <div class="company">
                  <div class="name">Smalsus Infolabs Pvt .Ltd.</div>
                  <div class="addr">Kirti Tower, Plot no 13&13C, Techzone 4, Greater Noida west,<br/>Uttar Pradesh 201009</div>
                </div>
              </div>
              <table>
                <colgroup>
                  <col style="width:19%">
                  <col style="width:30%">
                  <col style="width:19%">
                  <col style="width:16%">
                  <col style="width:16%">
                </colgroup>
                <tr>
                  <td colspan="3" class="section-title">Salary Slip</td>
                  <td class="h-center">Month</td>
                  <td class="h-center">${escapeHtml(monthLabel)}</td>
                </tr>
                <tr><td>Employee Name</td><td class="bold">${escapeHtml(user.name)}</td><td>Date of Joining</td><td colspan="2" class="bold">${escapeHtml(joiningDate)}</td></tr>
                <tr><td>Employee Code</td><td class="bold">${escapeHtml(user.id)}</td><td>Total Working Days</td><td colspan="2" class="bold">${escapeHtml(slip.workingDays || 30)}</td></tr>
                <tr><td>Designation</td><td class="bold">${escapeHtml(user.position || 'Software developer')}</td><td>Paid days</td><td colspan="2" class="bold">${escapeHtml(slip.paidDays || 30)}</td></tr>
                <tr><td>PAN</td><td class="bold">${escapeHtml(user.pan || '-')}</td><td></td><td colspan="2"></td></tr>
                <tr><td>Bank Account Number</td><td class="bold">${escapeHtml(user.accountNumber || '-')}</td><td></td><td colspan="2"></td></tr>
                <tr><td>Bank Name</td><td class="bold">${escapeHtml(user.bankName || '-')}</td><td></td><td colspan="2"></td></tr>
                <tr><td>IFSC Code</td><td class="bold">${escapeHtml(user.ifscCode || '-')}</td><td></td><td colspan="2"></td></tr>
                <tr>
                  <td colspan="2" class="section-title">Income</td>
                  <td colspan="3" class="section-title">Deductions</td>
                </tr>
                <tr>
                  <td class="bold">Particulars</td>
                  <td class="bold right">Amount</td>
                  <td class="bold">Particulars</td>
                  <td colspan="2" class="bold right">Amount</td>
                </tr>
                <tr><td>Basic Salary</td><td class="right">${escapeHtml(formatAmount(slip.basic || 0))}.00</td><td>Employee - PF Contribution</td><td colspan="2" class="right">${escapeHtml(formatAmount(slip.employeePF || 0))}.00</td></tr>
                <tr><td>HRA</td><td class="right">${escapeHtml(formatAmount(slip.hra || 0))}.00</td><td>ESI</td><td colspan="2" class="right">${escapeHtml(formatAmount(slip.esi || 0))}.00</td></tr>
                <tr><td>Others / Allowances</td><td class="right">${escapeHtml(formatAmount(slip.allowances || 0))}.00</td><td>Insurance</td><td colspan="2" class="right">${escapeHtml(formatAmount(slip.insurance || 0))}.00</td></tr>
                <tr><td>Bonus</td><td class="right">${escapeHtml(formatAmount(slip.bonus || 0))}.00</td><td>Other Deductions</td><td colspan="2" class="right">${escapeHtml(formatAmount(otherDeductions))}.00</td></tr>
                <tr class="empty-space"><td></td><td></td><td></td><td colspan="2"></td></tr>
                <tr><td class="bold">Total</td><td class="right bold">${escapeHtml(formatAmount(gross))}.00</td><td class="bold">Total</td><td colspan="2" class="right bold">${escapeHtml(formatAmount(deductionsTotal))}.00</td></tr>
                <tr class="net-row"><td colspan="3">Net Salary</td><td colspan="2" class="right">${escapeHtml(formatAmount(slip.netPay || 0))}.00</td></tr>
                <tr class="note-row"><td colspan="2">Rs- ${escapeHtml(formatAmount(slip.netPay || 0))}.00</td><td colspan="3" class="words">${escapeHtml(netPayInWords)}</td></tr>
              </table>
            </div>
          </div>
          <script>window.onload = function(){ window.print(); };</script>
        </body>
      </html>
    `;

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  }, [escapeHtml, user]);

  const handleSalarySlipDownload = React.useCallback((slip?: SalarySlip): void => {
    if (!slip) return;

    const fileUrl = String(slip.slipPdfUrl || '').trim();
    if (fileUrl) {
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = `Salary-Slip-${slip.month}-${slip.year}.pdf`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    downloadSalarySlipPdf(slip);
  }, [downloadSalarySlipPdf]);

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
      if (['Festival', 'Holi', 'Diwali', 'Durga Puja', 'Christmas Day', 'New Year'].indexOf(event.type) !== -1) {
        icon = <Sparkle size={16} className="text-info" />;
      }

      return {
        ...event,
        dateLabel,
        icon,
        plainDescription: toPlainText(event.description)
      };
    }).sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    }).slice(0, 5); // Just show top 5 for portal view
  }, [teamEvents, toPlainText]);

  const triggerEventBurst = React.useCallback((type: TeamEvent['type']) => {
    const id = Date.now();
    setEventBurst({ id, type });
    window.setTimeout(() => {
      setEventBurst((prev) => (prev?.id === id ? null : prev));
    }, 2600);
  }, []);

  const burstConfig = React.useMemo(() => {
    const type = eventBurst?.type || 'Other';
    if (type === 'Birthday') return { color: '#ec4899', symbols: ['🎉', '🎂', '🎈'] };
    if (type === 'Work Anniversary') return { color: '#f59e0b', symbols: ['🏆', '🎊', '✨'] };
    if (type === 'Meeting') return { color: '#3b82f6', symbols: ['📌', '💼', '🗓️'] };
    if (type === 'Holi') return { color: '#a855f7', symbols: ['🌈', '🎨', '✨'] };
    if (type === 'Diwali') return { color: '#f97316', symbols: ['🪔', '🎆', '✨'] };
    if (type === 'Durga Puja') return { color: '#ef4444', symbols: ['🙏', '🌺', '✨'] };
    if (type === 'Christmas Day') return { color: '#16a34a', symbols: ['🎄', '🎁', '✨'] };
    if (type === 'New Year') return { color: '#2563eb', symbols: ['🎆', '🥳', '✨'] };
    if (type === 'Festival') return { color: '#06b6d4', symbols: ['🎊', '✨', '🎉'] };
    return { color: '#2f5596', symbols: ['✨', '🎉', '🎊'] };
  }, [eventBurst]);

  const burstParticles = React.useMemo(() => {
    if (!eventBurst) return [];
    return Array.from({ length: 52 }).map((_, index) => {
      const angle = (Math.PI * 2 * index) / 52;
      const distance = 220 + Math.random() * 680;
      return {
        id: `${eventBurst.id}-${index}`,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        rotate: Math.random() * 360,
        delay: Math.random() * 200,
        size: 16 + Math.random() * 22,
        duration: 1800 + Math.random() * 900
      };
    });
  }, [eventBurst]);

  // Dynamic leave balance calculations
  const leaveStats = React.useMemo(() => {
    // Only count APPROVED leaves for usage
    const approved = myLeaveRequests.filter(r => r.status === LeaveStatus.Approved);

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
  }, [myLeaveRequests, leaveQuotas]);

  const totalLeavesTaken = React.useMemo(
    () => leaveStats.reduce((sum, item) => sum + (Number(item.used) || 0), 0),
    [leaveStats]
  );

  const totalLeavesLeft = React.useMemo(
    () => leaveStats.reduce((sum, item) => sum + (Number(item.left) || 0), 0),
    [leaveStats]
  );

  const ConcernSection = ({ type }: { type: ConcernType }) => {
    const filteredConcerns = myConcerns.filter(c => c.type === type);

    if (filteredConcerns.length === 0) return null;

    return (
      <div className="mt-5 animate-in fade-in p-3">
        <h6 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: '#2F5596' }}>
          <MessageSquare size={16} /> My {type} Concerns & History
        </h6>
        <div className="d-flex flex-wrap gap-3">
          {filteredConcerns.map(c => (
            <button
              key={c.id}
              type="button"
              className="btn text-start p-0 border-0 bg-transparent"
              onClick={() => setSelectedConcern(c)}
              style={{ width: '320px', maxWidth: '100%' }}
            >
              <div className="card shadow-sm border h-100 p-3 bg-white hover-bg-light">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div className="d-flex align-items-center gap-2">
                    <span className="status-chip status-chip--neutral">Ref: {c.referenceId}</span>
                    <Badge status={c.status === ConcernStatus.Open ? 'Unresolved' : c.status} />
                  </div>
                  <span className="small text-muted" style={{ fontSize: '11px' }}>{c.submittedAt}</span>
                </div>
                <div className="p-2 rounded bg-light border-start border-3 border-warning mb-2">
                  <p
                    className="mb-0 small text-dark"
                    title={toPlainText(c.description)}
                    style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    <strong>Query:</strong> {toPlainText(c.description)}
                  </p>
                </div>
                {c.reply ? (
                  <div className="p-2 rounded mt-2" style={{ backgroundColor: '#f0f9ff', borderLeft: '3px solid #0ea5e9' }}>
                    <div className="d-flex justify-content-between mb-1">
                      <span className="small fw-bold color-primary">HR Resolution:</span>
                      <span className="small text-muted" style={{ fontSize: '10px' }}>{c.repliedAt}</span>
                    </div>
                    <p
                      className="mb-0 small text-dark"
                      title={toPlainText(c.reply)}
                      style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {toPlainText(c.reply)}
                    </p>
                  </div>
                ) : (
                  <p className="mb-0 small text-muted font-italic"><Clock size={12} className="me-1" /> Under Review...</p>
                )}
              </div>
            </button>
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
        <Badge status={rec.status} />
      )
    },
    { key: 'clockIn', header: 'Clock In', accessor: (rec) => rec.clockIn || '', render: (rec) => rec.clockIn || '--:--' },
    { key: 'clockOut', header: 'Clock Out', accessor: (rec) => rec.clockOut || '', render: (rec) => rec.clockOut || '--:--' },
    {
      key: 'workDuration',
      header: 'Total Working Hours',
      accessor: (rec) => rec.workDuration || '',
      render: (rec) => rec.workDuration || '--:--'
    },
    {
      key: 'actions',
      header: 'Action',
      searchable: false,
      filterable: false,
      align: 'end',
      render: (rec) => (
        <button
          className="btn btn-sm btn-light border color-primary fw-bold"
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
          <button className="btn btn-sm salary-download-btn" onClick={() => handleSalarySlipDownload(slip)}>
            <Download size={14} /> Download Slip
          </button>
          <button
            className="btn btn-sm btn-light border color-primary fw-bold"
            style={{ fontSize: '10px' }}
            onClick={() => handleOpenConcern(ConcernType.Salary, slip.id)}
          >
            <AlertCircle size={12} className="me-1" /> Raise Concern
          </button>
        </div>
      )
    }
  ]), [handleOpenConcern, handleSalarySlipDownload]);

  const leaveColumns = React.useMemo<ColumnDef<LeaveRequest>[]>(() => ([
    { key: 'duration', header: 'Duration', accessor: (r) => `${r.startDate} ${r.endDate}`, render: (r) => <span className="fw-medium">{r.startDate} - {r.endDate}</span> },
    { key: 'leaveType', header: 'Type', accessor: (r) => r.leaveType },
    { key: 'days', header: 'Days', accessor: (r) => r.days, render: (r) => `${r.days} Days` },
    { key: 'status', header: 'Status', accessor: (r) => r.status, render: (r) => <Badge status={r.status} /> },
    {
      key: 'hrMessage',
      header: 'HR Message',
      accessor: (r) => toPlainText(r.approverComment, 'No message'),
      render: (r) => {
        const message = toPlainText(r.approverComment, 'No message');
        return (
          <span
            className="d-inline-block text-truncate"
            title={message}
            style={{ maxWidth: '260px' }}
          >
            {message}
          </span>
        );
      }
    },
    {
      key: 'actions',
      header: 'Action',
      searchable: false,
      filterable: false,
      align: 'end',
      render: (r) => (
        <button
          className="btn btn-sm btn-light border color-primary fw-bold"
          style={{ fontSize: '10px' }}
          onClick={() => handleOpenConcern(r.requestCategory === 'Work From Home' ? ConcernType.WorkFromHome : ConcernType.Leave, r.id)}
        >
          <AlertCircle size={12} className="me-1" /> Raise Concern
        </button>
      )
    }
  ]), [handleOpenConcern, toPlainText]);

  // const approvedLeaveNotes = React.useMemo(() =>
  //   myRequests
  //     .filter((request) => request.status === LeaveStatus.Approved && (request.approverName || request.approverComment))
  //     .sort((a, b) => b.id - a.id),
  //   [myRequests]);

  const lowWorkingHoursRecords = React.useMemo(() => {
    const now = getNowIST();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    return attendance
      .filter((record) => {
        const isMine = idsMatch(record.employeeId, user.id) || normalizeText(record.employeeName) === normalizeText(user.name);
        if (!isMine) return false;

        const workedMinutes = getWorkDurationMinutes(record.workDuration);
        const isLowHours = record.status === 'Present' && workedMinutes !== null && workedMinutes > 0 && workedMinutes < 540;
        if (!isLowHours) return false;

        const recordDate = parseRecordDate(record.date);
        if (!recordDate) return false;
        const recordDay = new Date(recordDate.getFullYear(), recordDate.getMonth(), recordDate.getDate(), 0, 0, 0, 0);

        return recordDay >= monthStart && recordDay <= todayStart;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [attendance, user, idsMatch, normalizeText, parseRecordDate, getWorkDurationMinutes]);

  const recentAttendanceRecords = React.useMemo(() => {
    return attendance
      .filter(a => idsMatch(a.employeeId, user.id) || normalizeText(a.employeeName) === normalizeText(user.name))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
  }, [attendance, user, idsMatch, normalizeText]);

  const onLeaveWfhTodayRecords = React.useMemo(() => {
    const today = todayIST();
    const validTypes = Object.keys(leaveQuotas || {});

    return requests.filter((req) => {
      const isStatusValid = req.status === LeaveStatus.Approved;
      const isDateValid = today >= req.startDate && today <= req.endDate;
      const isWorkFromHomeRequest = req.requestCategory === 'Work From Home' || /work\s*from\s*home|wfh/i.test(String(req.leaveType || ''));
      const isTypeValid = isWorkFromHomeRequest || validTypes.length === 0 || validTypes.indexOf(req.leaveType) !== -1;

      return isStatusValid && isDateValid && isTypeValid;
    });
  }, [requests, leaveQuotas]);

  const renderDashboardTab = () => {
    return (
      <div className="animate-in fade-in pb-5">
        {eventBurst && (
          <div className="event-burst-overlay" aria-hidden="true">
            <div className="event-burst-flash" style={{ background: burstConfig.color }} />
            {burstParticles.map((particle, index) => (
              <span
                key={particle.id}
                className="event-burst-particle"
                style={{
                  ['--x' as any]: `${particle.x}px`,
                  ['--y' as any]: `${particle.y}px`,
                  ['--rot' as any]: `${particle.rotate}deg`,
                  ['--delay' as any]: `${particle.delay}ms`,
                  ['--dur' as any]: `${particle.duration}ms`,
                  ['--event-color' as any]: burstConfig.color,
                  fontSize: `${particle.size}px`
                }}
              >
                {burstConfig.symbols[index % burstConfig.symbols.length]}
              </span>
            ))}
          </div>
        )}
        <div className="mb-4 d-flex justify-content-between align-items-end p-4">
          <div>
            <h2 className="h2 fw-bold mb-1 color-primary">Welcome, {user.name.split(' ')[0]}!</h2>
            <p className="text-muted small mb-0">Here is your summary for today.</p>
          </div>
          <div className="text-end d-none d-md-block">
            <span className="small fw-bold text-muted d-block">Current Date</span>
            <span className="fw-medium text-dark">{formatDateForDisplayIST(getNowIST(), 'en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
          </div>
        </div>

        <div className="row g-4 mb-4 mx-2">
          <div className="col-lg-3">
            <div className="card shadow-sm border-0 h-100 p-4 bg-white">
              <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
                <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                  <UserCheck size={18} color="#2F5596" /> Low Working Hours (&lt; 9h)
                </h6>
                <span className="small fw-bold text-danger-emphasis">{lowWorkingHoursRecords.length} record(s)</span>
              </div>
              <div
                className="d-flex flex-column gap-3 mt-2 pe-1"
                style={{ maxHeight: lowWorkingHoursRecords.length > 5 ? '320px' : 'none', overflowY: lowWorkingHoursRecords.length > 5 ? 'auto' : 'visible' }}
              >
                {lowWorkingHoursRecords.map((rec, i) => (
                  <div key={`${rec.employeeId}-${rec.date}-${i}`} className="d-flex align-items-center justify-content-between pb-2 border-bottom border-light last-border-none">
                    <div className="d-flex flex-column">
                      <div className="small fw-bold text-dark">{formatDateForDisplayIST(rec.date, 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                      <div className="small text-muted">{rec.clockIn || '--:--'} - {rec.clockOut || '--:--'}</div>
                    </div>
                    <span className="badge bg-danger-subtle text-danger border-0" style={{ fontSize: '10px' }}>
                      {rec.workDuration || '--:--'} Low
                    </span>
                  </div>
                ))}
                {lowWorkingHoursRecords.length === 0 && (
                  <div className="text-center py-4 text-muted small">No low working hour records found for this month.</div>
                )}
              </div>
            </div>
          </div>

          <div className="col-lg-3">
            <div className="card shadow-sm border-0 h-100 p-4 bg-white">
              <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
                <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                  <Users size={18} color="#2F5596" /> On Leave / WFH Today
                </h6>
                <span className="small fw-bold text-primary-emphasis">{onLeaveWfhTodayRecords.length} record(s)</span>
              </div>
              <div
                className="d-flex flex-column gap-3 mt-2 pe-1"
                style={{ maxHeight: onLeaveWfhTodayRecords.length > 5 ? '320px' : 'none', overflowY: onLeaveWfhTodayRecords.length > 5 ? 'auto' : 'visible' }}
              >
                {onLeaveWfhTodayRecords.map((rec, i) => (
                  <div key={`${rec.id}-${i}`} className="d-flex align-items-center justify-content-between pb-2 border-bottom border-light last-border-none">
                    <div className="small fw-bold text-dark">{rec.employee.name}</div>
                    <span className="badge card-bg-primary-subtle text-primary border-0" style={{ fontSize: '10px' }}>
                      {rec.requestCategory === 'Work From Home' ? 'Work From Home' : rec.leaveType}
                    </span>
                  </div>
                ))}
                {onLeaveWfhTodayRecords.length === 0 && (
                  <div className="text-center py-4 text-muted small">No on leave or WFH records for today.</div>
                )}
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
              <div
                className="d-flex flex-column gap-3 pe-1"
                style={{ maxHeight: leaveStats.length > 5 ? '320px' : 'none', overflowY: leaveStats.length > 5 ? 'auto' : 'visible' }}
              >
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

          <div className="col-lg-3">
            <div className="card shadow-sm border-0 h-100 p-4">
              <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
                <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                  <PartyPopper size={18} color="#E44D26" /> Team Celebrations
                </h6>
              </div>
              <div
                className="d-flex flex-column gap-2 mt-1 pe-1"
                style={{ maxHeight: formattedCelebrations.length > 5 ? '320px' : 'none', overflowY: formattedCelebrations.length > 5 ? 'auto' : 'visible' }}
              >
                {formattedCelebrations.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="btn text-start p-0 border-0 bg-transparent"
                    onClick={() => {
                      triggerEventBurst(item.type);
                      setSelectedCelebration(item);
                    }}
                  >
                    <div className="d-flex align-items-center justify-content-between p-2 rounded hover-bg-light transition-all border border-transparent hover-border-light">
                    <div className="d-flex align-items-center gap-3">
                      <div>
                        <div className="small fw-bold" style={{ color: '#2f5596' }}>{item.name}</div>
                        <div className="text-muted d-flex align-items-center gap-1" style={{ fontSize: '10px' }}>
                          {item.icon} {item.type}
                        </div>
                        {item.plainDescription && (
                          <div
                            className="text-muted"
                            style={{ fontSize: '10px', maxWidth: '180px', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                          >
                            {item.plainDescription}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="small badge bg-light text-dark border-0">{item.dateLabel}</div>
                    </div>
                  </button>
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
                        <div className={`p-2 rounded d-flex align-items-center justify-content-center ${holiday.type === 'Public' ? 'card-bg-primary' : 'bg-secondary'}`} style={{ width: '40px', height: '40px' }}>
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
                {recentAttendanceRecords.map((rec, i) => (
                  <div key={i} className="d-flex align-items-center justify-content-between pb-2 border-bottom border-light last-border-none">
                    <div className="d-flex align-items-center gap-3">
                      <div className="small fw-bold text-dark">{formatDateForDisplayIST(rec.date, 'en-US', { day: 'numeric', month: 'short' })}</div>
                      <div className="small text-muted">{rec.clockIn ? `${rec.clockIn} - ${rec.clockOut || '...'}` : '-'}</div>
                    </div>
                    <Badge status={rec.status} />
                  </div>
                ))}
                {recentAttendanceRecords.length === 0 && (
                  <div className="text-center py-4 text-muted small">No recent attendance records found.</div>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Balance Summary Modal */}
        <Modal
          isOpen={isBalanceModalOpen}
          onClose={() => setIsBalanceModalOpen(false)}
          title="Balance Summary"
          size="sm"
          scrollable={false}
        >
          <div className="text-center mb-2">
            <h5 className="fw-bold text-primary mb-1">{user.name}</h5>
            <p className="text-muted small">Employee ID: {user.id}</p>
          </div>

          <div className="row g-2 mb-2">
            <div className="col-6">
              <div className="p-2 border rounded bg-light text-center h-100">
                <div className="small text-muted fw-semibold" style={{ fontSize: '11px' }}>Total Leaves Left</div>
                <div className="h6 mb-0 text-primary fw-bold">{totalLeavesLeft}</div>
              </div>
            </div>
            <div className="col-6">
              <div className="p-2 border rounded bg-light text-center h-100">
                <div className="small text-muted fw-semibold" style={{ fontSize: '11px' }}>Total Leaves Taken</div>
                <div className="h6 mb-0 text-danger fw-bold">{totalLeavesTaken}</div>
              </div>
            </div>
          </div>

          <div className="row g-2">
            {leaveStats.length === 0 && (
              <div className="col-12">
                <div className="text-muted small text-center">No leave quota data found.</div>
              </div>
            )}
            {leaveStats.map((item, idx) => (
              <div key={idx} className="col-12">
                <div className="card h-100 border p-2 text-center shadow-xs" style={{ borderRadius: '10px' }}>
                  <div className="fw-bold text-primary mb-1" style={{ fontSize: '2rem', lineHeight: 1 }}>{item.left}</div>
                  <div className="small fw-bold text-dark mb-1" style={{ fontSize: '12px' }}>{item.label}</div>
                  <div className="progress mb-1" style={{ height: '3px' }}>
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
          <div className="mt-3 pt-2 border-top text-center">
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
            <button className="btn btn-primary d-flex align-items-center gap-1 px-4 py-2 fw-bold shadow-sm" onClick={() => onSubmitLeave('leave')}>
              <Plus size={18} /> New Request
            </button>
          </div>

          <div className="card shadow-sm border-0 overflow-hidden mb-4">
            <CommonTable
              data={myLeaveRequests}
              columns={leaveColumns}
              getRowId={(row) => row.id}
              globalSearchPlaceholder="Search leave history"
            />
          </div>

          {/* {approvedLeaveNotes.length > 0 && (
            <div className="card shadow-sm border-0 p-3 mb-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="mb-0 fw-bold d-flex align-items-center gap-2" style={{ color: '#2F5596' }}>
                  <MessageSquare size={16} /> HR Approval Notes
                </h6>
                <span className="small text-muted">{approvedLeaveNotes.length} Approved Notes</span>
              </div>
              <div className="d-flex flex-wrap gap-3">
                {approvedLeaveNotes.map((request) => (
                  <button
                    key={`approval-note-${request.id}`}
                    type="button"
                    className="btn text-start p-0 border-0 bg-transparent"
                    onClick={() => setSelectedApprovalNote(request)}
                    style={{ width: '260px' }}
                  >
                    <div className="card border h-100 p-3 shadow-xs hover-bg-light">
                      {(() => {
                        const noteMessage = toPlainText(request.approverComment, 'No comment provided.');
                        return (
                          <>
                            <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                              <div className="small fw-bold text-dark text-truncate">{request.leaveType}</div>
                              <Badge status={request.status} />
                            </div>
                            <div className="small text-muted mb-1 text-truncate">{request.startDate} - {request.endDate}</div>
                            <div className="small fw-semibold text-primary text-truncate">By: {request.approverName || 'HR'}</div>
                            <div
                              className="small text-muted text-truncate mt-1"
                              title={noteMessage}
                              style={{ maxWidth: '100%' }}
                            >
                              {noteMessage}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )} */}
          <ConcernSection type={ConcernType.Leave} />
        </>
      )}

      {activeTab === 'work-from-home' && (
        <>
          <div className="card shadow-sm border-0 mb-4 py-3 px-3 d-flex flex-row justify-content-between align-items-center bg-white">
            <div>
              <h5 className="mb-0 fw-bold" style={{ color: '#2F5596' }}>Work From Home Requests</h5>
              <p className="small text-muted mb-0">Manage your work from home applications</p>
            </div>
            <button className="btn btn-primary d-flex align-items-center gap-1 px-4 py-2 fw-bold shadow-sm" onClick={() => onSubmitLeave('workFromHome')}>
              <Plus size={18} /> New Request
            </button>
          </div>

          <div className="card shadow-sm border-0 overflow-hidden mb-4">
            <CommonTable
              data={myWorkFromHomeRequests}
              columns={leaveColumns}
              getRowId={(row) => row.id}
              globalSearchPlaceholder="Search work from home history"
            />
          </div>

          <ConcernSection type={ConcernType.WorkFromHome} />
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

      <Modal
        isOpen={!!selectedApprovalNote}
        onClose={() => setSelectedApprovalNote(null)}
        title="HR Approval Details"
      >
        {selectedApprovalNote && (
          <div className="d-flex flex-column gap-3">
            <div className="p-3 border rounded bg-light">
              <div className="small text-muted mb-1">Leave Details</div>
              <div className="fw-bold">{selectedApprovalNote.leaveType}</div>
              <div className="small text-muted">{selectedApprovalNote.startDate} - {selectedApprovalNote.endDate} ({selectedApprovalNote.days} days)</div>
            </div>
            <div className="p-3 border rounded bg-white">
              <div className="small text-muted mb-1">Approved By</div>
              <div className="fw-semibold">{selectedApprovalNote.approverName || 'HR'}</div>
            </div>
            <div className="p-3 border rounded bg-white">
              <div className="small text-muted mb-1">HR Message</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {toPlainText(selectedApprovalNote.approverComment, 'No comment provided.')}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!selectedConcern}
        onClose={() => setSelectedConcern(null)}
        title="Concern Details"
      >
        {selectedConcern && (
          <div className="d-flex flex-column gap-3">
            <div className="p-3 border rounded bg-light">
              <div className="d-flex justify-content-between align-items-start gap-2">
                <div>
                  <div className="small text-muted mb-1">Reference</div>
                  <div className="fw-semibold">Ref: {selectedConcern.referenceId}</div>
                </div>
                <Badge status={selectedConcern.status === ConcernStatus.Open ? 'Unresolved' : selectedConcern.status} />
              </div>
              <div className="small text-muted mt-2">Submitted: {selectedConcern.submittedAt}</div>
              {selectedConcern.repliedAt && (
                <div className="small text-muted">Replied: {selectedConcern.repliedAt}</div>
              )}
            </div>
            <div className="p-3 border rounded bg-white">
              <div className="small text-muted mb-1">Query</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {toPlainText(selectedConcern.description, 'No query message.')}
              </div>
            </div>
            <div className="p-3 border rounded bg-white">
              <div className="small text-muted mb-1">HR Resolution</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {toPlainText(selectedConcern.reply, 'No HR resolution yet.')}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!selectedCelebration}
        onClose={() => setSelectedCelebration(null)}
        title="Team Event Details"
      >
        {selectedCelebration && (
          <div className="d-flex flex-column gap-3">
            <div className="p-3 border rounded bg-light">
              <div className="small text-muted mb-1">Event</div>
              <div className="fw-bold">{selectedCelebration.name}</div>
              <div className="small text-muted mt-1">
                {selectedCelebration.type} • {formatDateForDisplayIST(selectedCelebration.date, 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
              {selectedCelebration.employee?.name && (
                <div className="small text-muted mt-1">Employee: {selectedCelebration.employee.name}</div>
              )}
            </div>
            <div className="p-3 border rounded bg-white">
              <div className="small text-muted mb-1">Description</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {toPlainText(selectedCelebration.description, 'No description provided.')}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default EmployeePortal;
