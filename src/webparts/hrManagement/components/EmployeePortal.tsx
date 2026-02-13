
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
  const [selectedApprovalNote, setSelectedApprovalNote] = React.useState<LeaveRequest | null>(null);
  const [selectedConcern, setSelectedConcern] = React.useState<Concern | null>(null);

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

  const currentMonthSalarySlip = React.useMemo(() => {
    const currentMonth = normalizeText(monthNameIST());
    const currentYear = String(getNowIST().getFullYear());
    return mySalaries.find((slip) => normalizeText(slip.month) === currentMonth && String(slip.year) === currentYear);
  }, [mySalaries, normalizeText]);

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
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
            body { font-family: 'Roboto', sans-serif; position: relative; margin: 0; padding: 20px; color: #333; }
            .container { border: 2px solid #5a8bd8; padding: 0; min-height: 900px; position: relative; max-width: 900px; margin: 0 auto; }
            
            /* Header */
            .header { padding: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
            .logo-area { display: flex; align-items: center; gap: 10px; }
            .logo-text { font-size: 52px; font-weight: 800; color: #406085; font-family: sans-serif; letter-spacing: -1px; line-height: 1; margin: 0; }
            
            .company-details { text-align: right; max-width: 400px; padding-top: 5px; }
            .company-name { font-size: 16px; font-weight: 700; color: #333; margin-bottom: 5px; }
            .address { font-size: 11px; color: #555; line-height: 1.4; font-weight: 500; }

            /* Grid Layouts */
            table { width: 100%; border-collapse: collapse; }
            
            .main-table { width: 100%; border-top: 2px solid #5a8bd8; }
            .main-table th, .main-table td { border: 1px solid #999; vertical-align: middle; }
            
            /* Section Headers */
            .section-header { text-align: center; font-weight: bold; background: #fff; font-size: 14px; padding: 5px; }
            
            /* Employee Details Table */
            .emp-table td { padding: 4px 5px; font-size: 11px; }
            .emp-label { font-weight: normal; color: #333; width: 120px; }
            .emp-val { font-weight: bold; color: #000; }

            /* New Header Row Style */
            .salary-slip-header { font-weight: bold; text-align: center; font-size: 14px; padding: 5px; border-bottom: 1px solid #999; }
            .month-header { font-weight: bold; text-align: center; font-size: 14px; padding: 5px; width: 100px; border-left: 1px solid #999; }
            
            /* Salary Table */
            .salary-table { width: 100%; border: none; }
            .salary-table td { padding: 0; vertical-align: top; border: none; }
            .income-col { border-right: 1px solid #999; width: 50%; }
            .deduction-col { width: 50%; }

            .item-row { display: flex; border-bottom: 1px solid #eee; padding: 6px 8px; font-size: 12px; }
            .item-row.header { background: #fff; font-weight: bold; border-bottom: 1px solid #999; }
            .item-name { flex: 1; }
            .item-amount { width: 100px; text-align: right; font-weight: 500; }
            
            .total-row { display: flex; justify-content: space-between; padding: 6px 8px; font-weight: bold; font-size: 12px; border-top: 1px solid #999; border-bottom: 1px solid #5a8bd8; }
            
            /* Net Salary Section */
            .net-salary-section { border-top: 2px solid #5a8bd8; border-bottom: 2px solid #5a8bd8; padding: 8px 10px; display: flex; justify-content: space-between; align-items: center; font-weight: bold; font-size: 14px; }
            
            .words-row { padding: 8px; font-style: italic; font-size: 12px; text-align: center; color: #333; border-bottom: 1px solid #999; background: #fdfdfd; }

            /* Watermark */
            .bg-watermark {
                position: absolute;
                top: 55%;
                left: 50%;
                transform: translate(-50%, -50%) rotate(-30deg);
                font-size: 100px;
                color: rgba(0, 0, 0, 0.04);
                z-index: -1;
                font-weight: bold;
                white-space: nowrap;
                pointer-events: none;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="bg-watermark">Smalsus Infolabs</div>

            <!-- Header -->
            <div class="header">
               <div class="logo-area">
                  <h1 class="logo-text">Smalsus</h1>
               </div>
               <div class="company-details">
                  <div class="company-name">Smalsus Infolabs Pvt .Ltd.</div>
                  <div class="address">
                    Kirti Tower, Plot no 13&13C, Techzone 4, Greater Noida west,<br/>
                    Uttar Pradesh 201009
                  </div>
               </div>
            </div>

            <table class="main-table">
               <!-- Title Row -->
               <tr>
                  <td class="salary-slip-header" style="border-right: 1px solid #999;">Salary Slip</td>
                  <td class="month-header">Month</td>
                  <td class="month-header">${escapeHtml(slip.month)}-${escapeHtml(slip.year.slice(-2))}</td>
               </tr>

               <!-- Employee Details -->
               <tr>
                  <td colspan="3" style="padding: 0;">
                     <div style="display: flex;">
                        <div style="width: 50%; border-right: 1px solid #999;">
                           <table class="emp-table">
                              <tr><td class="emp-label">Employee Name</td><td class="emp-val">${escapeHtml(user.name)}</td></tr>
                              <tr><td class="emp-label">Employee Code</td><td class="emp-val">${escapeHtml(user.id)}</td></tr>
                              <tr><td class="emp-label">Designation</td><td class="emp-val">${escapeHtml(user.position || 'Software Engineer')}</td></tr>
                              <tr><td class="emp-label">PAN</td><td class="emp-val">${escapeHtml(user.pan || '-')}</td></tr>
                              <tr><td class="emp-label">Bank Account Number</td><td class="emp-val">${escapeHtml(user.accountNumber || '-')}</td></tr>
                              <tr><td class="emp-label">Bank Name</td><td class="emp-val">${escapeHtml(user.bankName || '-')}</td></tr>
                              <tr><td class="emp-label">IFSC Code</td><td class="emp-val">${escapeHtml(user.ifscCode || '-')}</td></tr>
                           </table>
                        </div>
                        <div style="width: 50%;">
                           <table class="emp-table">
                              <tr><td class="emp-label">Date of Joining</td><td class="emp-val">${escapeHtml(formatDateForDisplayIST(user.joiningDate, 'en-US', { day: '2-digit', month: 'short', year: '2-digit' }))}</td></tr>
                              <tr><td class="emp-label">Total Working Days</td><td class="emp-val">${slip.workingDays || 30}</td></tr>
                              <tr><td class="emp-label">Paid days</td><td class="emp-val">${slip.paidDays || 30}</td></tr>
                              <tr><td class="emp-label">&nbsp;</td><td class="emp-val">&nbsp;</td></tr>
                              <tr><td class="emp-label">&nbsp;</td><td class="emp-val">&nbsp;</td></tr>
                              <tr><td class="emp-label">&nbsp;</td><td class="emp-val">&nbsp;</td></tr>
                              <tr><td class="emp-label">&nbsp;</td><td class="emp-val">&nbsp;</td></tr>
                           </table>
                        </div>
                     </div>
                  </td>
               </tr>

               <!-- Income / Deduction Headers -->
               <tr>
                  <td colspan="3" style="padding: 0;">
                     <div style="display: flex; border-bottom: 1px solid #999;">
                        <div class="section-header" style="width: 50%; border-right: 1px solid #999;">Income</div>
                        <div class="section-header" style="width: 50%;">Deductions</div>
                     </div>
                  </td>
               </tr>

               <!-- Salary Body -->
               <tr>
                  <td colspan="3" style="padding: 0;">
                     <div style="display: flex;">
                        <!-- Incomes -->
                        <div class="income-col">
                           <div class="item-row header">
                              <div class="item-name">Particulars</div>
                              <div class="item-amount">Amount</div>
                           </div>
                           <div class="item-row">
                              <div class="item-name">Basic Salary</div>
                              <div class="item-amount">${escapeHtml(formatCurrencyINR(slip.basic || 0)).replace('₹', '')}</div>
                           </div>
                           <div class="item-row">
                              <div class="item-name">HRA</div>
                              <div class="item-amount">${escapeHtml(formatCurrencyINR(slip.hra || 0)).replace('₹', '')}</div>
                           </div>
                           <div class="item-row">
                              <div class="item-name">Others / Allowances</div>
                              <div class="item-amount">${escapeHtml(formatCurrencyINR(slip.allowances || 0)).replace('₹', '')}</div>
                           </div>
                           <div class="item-row">
                              <div class="item-name">Bonus</div>
                              <div class="item-amount">${escapeHtml(formatCurrencyINR(slip.bonus || 0)).replace('₹', '')}</div>
                           </div>
                           
                           <!-- Spacer to push Total to bottom -->
                           <div style="height: 100px;"></div>
                           
                           <div class="total-row">
                              <div>Total</div>
                              <div>${escapeHtml(formatCurrencyINR(gross)).replace('₹', '')}</div>
                           </div>
                        </div>

                        <!-- Deductions -->
                        <div class="deduction-col">
                           <div class="item-row header">
                              <div class="item-name">Particulars</div>
                              <div class="item-amount">Amount</div>
                           </div>
                           <div class="item-row">
                              <div class="item-name">Employee - PF Contribution</div>
                              <div class="item-amount">${escapeHtml(formatCurrencyINR(slip.employeePF || 0)).replace('₹', '')}</div>
                           </div>
                           <div class="item-row">
                              <div class="item-name">ESI</div>
                              <div class="item-amount">${escapeHtml(formatCurrencyINR(slip.esi || 0)).replace('₹', '')}</div>
                           </div>
                           <div class="item-row">
                              <div class="item-name">Insurance</div>
                              <div class="item-amount">${escapeHtml(formatCurrencyINR(slip.insurance || 0)).replace('₹', '')}</div>
                           </div>
                           <div class="item-row">
                              <div class="item-name">Other Deductions</div>
                              <div class="item-amount">${escapeHtml(formatCurrencyINR(otherDeductions)).replace('₹', '')}</div>
                           </div>

                           <!-- Spacer to push Total to bottom -->
                           <div style="height: 100px;"></div>

                           <div class="total-row">
                              <div>Total</div>
                              <div>${escapeHtml(formatCurrencyINR(deductionsTotal)).replace('₹', '')}</div>
                           </div>
                        </div>
                     </div>
                  </td>
               </tr>

               <!-- Net Salary -->
               <tr>
                  <td colspan="3" style="padding: 0; border: none;">
                     <div class="net-salary-section">
                        <div>Net Salary</div>
                        <div>${escapeHtml(formatCurrencyINR(slip.netPay || 0)).replace('₹', '')}</div>
                     </div>
                  </td>
               </tr>
                <tr>
                  <td colspan="3" style="padding: 0;">
                      <div style="display: flex; align-items: center; padding: 8px;">
                        <div style="font-weight: bold; width: 150px;">Rs- ${escapeHtml(formatCurrencyINR(slip.netPay || 0)).replace('₹', '')}</div>
                        <div style="font-style: italic; font-size: 12px; margin-left: 20px;">${netPayInWords}</div>
                      </div>
                  </td>
               </tr>
            </table>

            <!-- Footer (optional empty space or note) -->
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
                    <span className="badge bg-light text-dark border" style={{ fontSize: '10px' }}>Ref: {c.referenceId}</span>
                    <span className={`badge ${c.status === ConcernStatus.Open ? 'bg-warning text-dark' : 'bg-success text-white'}`} style={{ fontSize: '10px' }}>{c.status}</span>
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
                      <span className="small fw-bold text-primary">HR Resolution:</span>
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
        <span className={`badge ${rec.status === 'Present' ? 'bg-success text-white' : 'bg-danger text-white'}`} style={{ fontSize: '9px' }}>
          {rec.status.toUpperCase()}
        </span>
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
          className="btn btn-sm btn-light border text-primary fw-bold"
          style={{ fontSize: '10px' }}
          onClick={() => handleOpenConcern(ConcernType.Leave, r.id)}
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

  // Independent recent attendance for Dashboard (ignores View Mode)
  const recentAttendanceRecords = React.useMemo(() => {
    return attendance
      .filter(a => idsMatch(a.employeeId, user.id) || normalizeText(a.employeeName) === normalizeText(user.name))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
  }, [attendance, user, idsMatch, normalizeText]);

  const renderDashboardTab = () => {
    return (
      <div className="animate-in fade-in pb-5">
        <div className="mb-4 d-flex justify-content-between align-items-end p-4">
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
                <div className={`badge border ${currentMonthSalarySlip ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning-emphasis'}`}>
                  {currentMonthSalarySlip ? 'Paid' : 'Not Paid'}
                </div>
              </div>

              <div className="d-flex align-items-center gap-3 mb-4 mt-2">
                <div className="p-3 rounded-circle bg-light d-flex align-items-center justify-content-center" style={{ width: '64px', height: '64px' }}>
                  <Banknote size={32} color="#2F5596" />
                </div>
                <div>
                  {currentMonthSalarySlip ? (
                    <>
                      <div className="small text-muted fw-medium">{currentMonthSalarySlip.month} {currentMonthSalarySlip.year} Slip</div>
                      <div className="h3 fw-bold mb-0 text-dark">₹{currentMonthSalarySlip.netPay.toLocaleString()}</div>
                    </>
                  ) : (
                    <>
                      <div className="small text-muted fw-medium">{monthNameIST()} {getNowIST().getFullYear()} Slip</div>
                      <div className="h5 fw-bold mb-0 text-warning-emphasis">Pending Salary for this month</div>
                    </>
                  )}
                </div>
              </div>
              <div className="d-grid">
                <button
                  className={`btn fw-bold d-flex align-items-center justify-content-center gap-2 py-2 shadow-sm ${currentMonthSalarySlip ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => currentMonthSalarySlip && downloadSalarySlipPdf(currentMonthSalarySlip)}
                  disabled={!currentMonthSalarySlip}
                >
                  <Download size={18} /> {currentMonthSalarySlip ? 'Download Monthly Slip' : 'Salary Pending'}
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
                {recentAttendanceRecords.map((rec, i) => (
                  <div key={i} className="d-flex align-items-center justify-content-between pb-2 border-bottom border-light last-border-none">
                    <div className="d-flex align-items-center gap-3">
                      <div className="small fw-bold text-dark">{formatDateForDisplayIST(rec.date, 'en-US', { day: 'numeric', month: 'short' })}</div>
                      <div className="small text-muted">{rec.clockIn ? `${rec.clockIn} - ${rec.clockOut || '...'}` : '-'}</div>
                    </div>
                    <span className={`badge rounded-pill px-3 py-2 text-uppercase ${rec.status === 'Present' ? 'text-bg-success' : 'text-bg-warning'}`} style={{ fontSize: '9px', letterSpacing: '0.5px' }}>
                      {rec.status}
                    </span>
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
                <span className={`badge ${selectedConcern.status === ConcernStatus.Open ? 'bg-warning text-dark' : 'bg-success text-white'}`}>
                  {selectedConcern.status.toUpperCase()}
                </span>
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
    </div>
  );
};

export default EmployeePortal;
