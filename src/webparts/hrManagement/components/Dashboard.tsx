
import * as React from 'react';
import type { LeaveRequest, AttendanceRecord, Holiday, TeamEvent, Employee } from '../types';
import { LeaveStatus, AttendanceStatus } from '../types';
import StatCard from '../ui/StatCard';
import { generateLeaveSummaryReport } from '../services/geminiService';
import Modal from '../ui/Modal';
import { Sparkle, Users, CheckCircle, Clock, XCircle, UserCheck, Calendar as CalendarIcon, Flag, PartyPopper, Cake, MessageSquare, Plus, Calendar, Trash2, Edit3 } from 'lucide-react';
import { formatDateForDisplayIST, monthNameIST, todayIST, getNowIST } from '../utils/dateTime';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

const RxXAxis = XAxis as unknown as React.ComponentType<any>;
const RxYAxis = YAxis as unknown as React.ComponentType<any>;
const RxBar = Bar as unknown as React.ComponentType<any>;

interface DashboardProps {
  requests: LeaveRequest[];
  attendanceRecords: AttendanceRecord[];
  concernsCount: number;
  holidays: Holiday[];
  teamEvents: TeamEvent[];
  employees: Employee[];
  onAddTeamEvent: (event: Omit<TeamEvent, 'id'>, employeeId?: string) => Promise<void> | void;
  onUpdateTeamEvent: (eventId: number, event: Omit<TeamEvent, 'id'>, employeeId?: string) => Promise<void> | void;
  onDeleteTeamEvent: (eventId: number) => void;
  onPendingClick?: () => void;
  onOnLeaveTodayClick?: () => void;
  onConcernsClick?: () => void;
}


const Dashboard: React.FC<DashboardProps> = ({ requests, attendanceRecords, concernsCount, holidays, teamEvents, employees, onAddTeamEvent, onUpdateTeamEvent, onDeleteTeamEvent, onPendingClick, onOnLeaveTodayClick, onConcernsClick }) => {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = React.useState(false);
  const [editingEventId, setEditingEventId] = React.useState<number | null>(null);
  const [summary, setSummary] = React.useState('');
  const [isLoadingSummary, setIsLoadingSummary] = React.useState(false);
  const [insightTab, setInsightTab] = React.useState<'overview' | 'leave' | 'attendance'>('overview');

  // Add Event Form State
  const [eventFormData, setEventFormData] = React.useState<Omit<TeamEvent, 'id'>>({
    name: '',
    type: 'Birthday',
    date: todayIST()
  });
  const [employeeSearchTerm, setEmployeeSearchTerm] = React.useState('');
  const [selectedEmployee, setSelectedEmployee] = React.useState<Employee | null>(null);
  const [showSuggestions, setShowSuggestions] = React.useState(false);

  const filteredEmployees = React.useMemo(() => {
    if (!employeeSearchTerm) return [];
    return employees.filter(emp =>
      emp.name.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
      (emp.email && emp.email.toLowerCase().includes(employeeSearchTerm.toLowerCase()))
    ).slice(0, 5);
  }, [employees, employeeSearchTerm]);

  const handleSelectEmployee = (emp: Employee) => {
    setSelectedEmployee(emp);
    setEmployeeSearchTerm(emp.name);
    setShowSuggestions(false);
  };

  const resetEventForm = React.useCallback(() => {
    setEditingEventId(null);
    setEventFormData({
      name: '',
      type: 'Birthday',
      date: todayIST()
    });
    setSelectedEmployee(null);
    setEmployeeSearchTerm('');
    setShowSuggestions(false);
  }, []);

  const handleOpenAddEventModal = React.useCallback(() => {
    resetEventForm();
    setIsEventModalOpen(true);
  }, [resetEventForm]);

  const handleOpenEditEventModal = React.useCallback((event: TeamEvent) => {
    const matchedEmployee = event.employee
      ? employees.find((emp) => emp.id === event.employee?.id || (event.employee?.email && emp.email === event.employee.email)) || event.employee
      : null;

    setEditingEventId(event.id);
    setEventFormData({
      name: event.name,
      type: event.type,
      date: event.date
    });
    setSelectedEmployee(matchedEmployee);
    setEmployeeSearchTerm(matchedEmployee?.name || '');
    setShowSuggestions(false);
    setIsEventModalOpen(true);
  }, [employees]);

  const stats = React.useMemo(() => {
    const today = todayIST();
    return {
      total: requests.length,
      pending: requests.filter(r => r.status === LeaveStatus.Pending).length,
      approved: requests.filter(r => r.status === LeaveStatus.Approved).length,
      onLeaveToday: requests.filter(r => r.status === LeaveStatus.Approved && today >= r.startDate && today <= r.endDate).length,
      presentToday: attendanceRecords.filter(r => r.date === today && r.status === AttendanceStatus.Present).length,
    };
  }, [requests, attendanceRecords]);

  const currentMonthHolidays = React.useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    return holidays.filter(h => {
      const hDate = new Date(h.date);
      return hDate.getMonth() === currentMonth;
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [holidays]);

  const formattedEvents = React.useMemo(() => {
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

      let icon = <Calendar size={16} className="text-secondary" />;
      if (event.type === 'Birthday') icon = <Cake size={16} className="text-danger" />;
      if (event.type === 'Work Anniversary') icon = <PartyPopper size={16} className="text-warning" />;
      if (event.type === 'Meeting') icon = <Users size={16} className="text-primary" />;
      if (event.type === 'Festival') icon = <Sparkle size={16} className="text-info" />;

      return {
        ...event,
        dateLabel,
        icon,
        avatar: event.employee?.avatar || `https://i.pravatar.cc/150?u=${event.name}`
      };
    }).sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  }, [teamEvents]);

  const leaveTypeData = React.useMemo(() => {
    const data = requests.reduce((acc, req) => {
      if (req.status === LeaveStatus.Approved) {
        acc[req.leaveType] = (acc[req.leaveType] || 0) + req.days;
      }
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [requests]);

  const departmentRequestData = React.useMemo(() => {
    const grouped = requests.reduce((acc, req) => {
      const dept = req.employee?.department || 'Unknown';
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped).map(([name, value]) => ({ name, value }));
  }, [requests]);

  const chartColors = ['#1f7ae0', '#f5b323', '#14b8a6', '#8b5cf6', '#ef4444', '#06b6d4'];

  const weeklyInsights = React.useMemo(() => {
    const toDateValue = (value: unknown): Date | null => {
      const raw = String(value || '').trim();
      if (!raw) return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const [year, month, day] = raw.split('-').map(Number);
        const date = new Date(year, month - 1, day, 12, 0, 0);
        return Number.isNaN(date.getTime()) ? null : date;
      }
      const parsed = new Date(raw);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const today = getNowIST();
    const weekStart = new Date(today);
    const weekOffset = (today.getDay() + 6) % 7; // Monday-first week
    weekStart.setDate(today.getDate() - weekOffset);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const isInWeek = (date: Date | null): boolean => {
      if (!date) return false;
      return date >= weekStart && date <= weekEnd;
    };

    const weeklyRequests = requests.filter((request) => {
      const submittedDate = toDateValue(request.submittedAt);
      const fallbackDate = toDateValue(request.startDate);
      return isInWeek(submittedDate || fallbackDate);
    });

    const weeklyApproved = weeklyRequests.filter((request) => request.status === LeaveStatus.Approved);
    const weeklyPending = weeklyRequests.filter((request) => request.status === LeaveStatus.Pending).length;

    const approvedDaysThisWeek = requests
      .filter((request) => request.status === LeaveStatus.Approved)
      .reduce((total, request) => {
        const leaveStart = toDateValue(request.startDate);
        const leaveEnd = toDateValue(request.endDate) || leaveStart;
        if (!leaveStart || !leaveEnd) return total;

        const overlapStart = leaveStart > weekStart ? leaveStart : weekStart;
        const overlapEnd = leaveEnd < weekEnd ? leaveEnd : weekEnd;
        if (overlapStart > overlapEnd) return total;

        const overlapDays = Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        return total + Math.max(0, overlapDays);
      }, 0);

    const departmentCounts = weeklyRequests.reduce((acc, request) => {
      const dept = request.employee?.department || 'Unknown';
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topDepartment = Object.keys(departmentCounts).reduce(
      (best, current) => (!best || departmentCounts[current] > departmentCounts[best] ? current : best),
      ''
    );

    const leaveTypeCounts = weeklyApproved.reduce((acc, request) => {
      const type = request.leaveType || 'Other';
      acc[type] = (acc[type] || 0) + (request.days || 0);
      return acc;
    }, {} as Record<string, number>);

    const topLeaveType = Object.keys(leaveTypeCounts).reduce(
      (best, current) => (!best || leaveTypeCounts[current] > leaveTypeCounts[best] ? current : best),
      ''
    );

    const weeklyAttendance = attendanceRecords.filter((record) => isInWeek(toDateValue(record.date)));
    const presentCount = weeklyAttendance.filter((record) => record.status === AttendanceStatus.Present).length;
    const absentCount = weeklyAttendance.filter((record) => record.status === AttendanceStatus.Absent).length;
    const onLeaveCount = weeklyAttendance.filter((record) => record.status === AttendanceStatus.OnLeave).length;
    const trackableAttendance = weeklyAttendance.filter((record) => record.status !== AttendanceStatus.Weekend);
    const presentRate = trackableAttendance.length > 0 ? Math.round((presentCount / trackableAttendance.length) * 100) : 0;

    const approvalRate = weeklyRequests.length > 0 ? Math.round((weeklyApproved.length / weeklyRequests.length) * 100) : 0;
    const rejectedRequests = weeklyRequests.filter((request) => request.status === LeaveStatus.Rejected).length;
    const avgDaysPerRequest = weeklyRequests.length > 0
      ? Number((weeklyRequests.reduce((sum, request) => sum + (request.days || 0), 0) / weeklyRequests.length).toFixed(1))
      : 0;

    return {
      rangeLabel: `${formatDateForDisplayIST(weekStart, 'en-US', { day: 'numeric', month: 'short' })} - ${formatDateForDisplayIST(weekEnd, 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`,
      totalRequests: weeklyRequests.length,
      approvedRequests: weeklyApproved.length,
      pendingRequests: weeklyPending,
      rejectedRequests,
      approvalRate,
      avgDaysPerRequest,
      approvedDaysThisWeek,
      presentRate,
      presentCount,
      absentCount,
      onLeaveCount,
      attendanceTracked: trackableAttendance.length,
      topDepartment: topDepartment || 'N/A',
      topDepartmentCount: topDepartment ? departmentCounts[topDepartment] : 0,
      topLeaveType: topLeaveType || 'N/A',
      topLeaveTypeDays: topLeaveType ? leaveTypeCounts[topLeaveType] : 0
    };
  }, [requests, attendanceRecords]);

  const formatSummaryToHtml = React.useCallback((raw: string): string => {
    const normalized = String(raw || '').replace(/\r\n/g, '\n').trim();
    if (!normalized) return '<p>No summary generated.</p>';

    const escapeHtml = (value: string): string =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const inlineFormat = (value: string): string =>
      escapeHtml(value).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    const lines = normalized.split('\n');
    let html = '';
    let inList = false;

    lines.forEach((rawLine) => {
      const line = rawLine.trim();

      if (!line) {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        return;
      }

      const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
      if (headingMatch) {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        const level = headingMatch[1].length;
        const text = inlineFormat(headingMatch[2]);
        const tag = level === 1 ? 'h2' : level === 2 ? 'h3' : 'h4';
        html += `<${tag}>${text}</${tag}>`;
        return;
      }

      const bulletMatch = line.match(/^[-*•]\s+(.*)$/);
      if (bulletMatch) {
        if (!inList) {
          html += '<ul>';
          inList = true;
        }
        html += `<li>${inlineFormat(bulletMatch[1])}</li>`;
        return;
      }

      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += `<p>${inlineFormat(line)}</p>`;
    });

    if (inList) {
      html += '</ul>';
    }

    return html || '<p>No summary generated.</p>';
  }, []);

  const handleGenerateSummary = async () => {
    setIsModalOpen(true);
    setInsightTab('overview');
    setIsLoadingSummary(true);
    try {
      const result = await generateLeaveSummaryReport(requests);
      setSummary(formatSummaryToHtml(result));
    } catch (error) {
      console.error('Failed to generate AI summary:', error);
      setSummary('<p>Unable to generate the report right now. Please try again.</p>');
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const handleAddEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEventId !== null) {
      await Promise.resolve(onUpdateTeamEvent(editingEventId, eventFormData, selectedEmployee?.id));
    } else {
      await Promise.resolve(onAddTeamEvent(eventFormData, selectedEmployee?.id));
    }
    setIsEventModalOpen(false);
    resetEventForm();
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4 p-3">
        <h2 className="h3 fw-semibold text-secondary">Dashboard Overview</h2>
        <button
          onClick={handleGenerateSummary}
          disabled={isLoadingSummary}
          className="btn btn-primary d-flex align-items-center shadow-sm"
        >
          <Sparkle className="me-2" style={{ width: '20px', height: '20px' }} />
          {isLoadingSummary ? 'Generating...' : 'Generate AI Weekly Report'}
        </button>
      </div>

      <div className="row g-4">
        <div className="col-12 col-sm-6 col-lg-4 col-xl-2">
          <StatCard title="Present Today" value={stats.presentToday} icon={<UserCheck className="text-info" />} />
        </div>
        <div className="col-12 col-sm-6 col-lg-4 col-xl-2">
          <div
            onClick={onOnLeaveTodayClick}
            className="h-100 card-clickable-wrapper"
            style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
          >
            <StatCard title="On Leave Today" value={stats.onLeaveToday} icon={<Users className="text-primary" />} />
          </div>
        </div>
        <div className="col-12 col-sm-6 col-lg-4 col-xl-2">
          <div
            onClick={onPendingClick}
            className="h-100 card-clickable-wrapper"
            style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
          >
            <StatCard title="Leaves Request" value={stats.pending} icon={<Clock className="text-warning" />} />
          </div>
        </div>
        <div className="col-12 col-sm-6 col-lg-4 col-xl-2">
          <div
            onClick={onConcernsClick}
            className="h-100 card-clickable-wrapper"
            style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
          >
            <StatCard title="Raised Concerns" value={concernsCount} icon={<MessageSquare className="text-danger" />} />
          </div>
        </div>
        <div className="col-12 col-sm-6 col-lg-4 col-xl-2">
          <StatCard title="Approved Requests" value={stats.approved} icon={<CheckCircle className="text-success" />} />
        </div>
        <div className="col-12 col-sm-6 col-lg-4 col-xl-2">
          <StatCard title="Total Requests" value={stats.total} icon={<XCircle className="text-white" />} isTotal />
        </div>
      </div>

      <div className="row g-4 mt-4">
        <div className="col-12 col-lg-8">
          <div className="card shadow-sm border-0 h-100 p-4">
            <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
              <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                <Flag size={18} color="#2F5596" /> Upcoming Holidays ({monthNameIST()})
              </h6>
              <span className="small text-muted">{currentMonthHolidays.length} Holidays this month</span>
            </div>
            <div className="row g-3">
              {currentMonthHolidays.length > 0 ? (
                currentMonthHolidays.map(holiday => (
                  <div key={holiday.id} className="col-md-6 col-xl-4">
                    <div className="p-3 rounded border bg-light d-flex align-items-center gap-2">
                      <div className={`p-2 rounded d-flex align-items-center justify-content-center ${holiday.type === 'Public' ? 'bg-primary' : 'bg-secondary'}`} style={{ minWidth: '36px', height: '36px' }}>
                        <CalendarIcon size={16} className="text-white" />
                      </div>
                      <div className="overflow-hidden">
                        <div className="small fw-bold text-dark text-truncate">{holiday.name}</div>
                        <div className="text-muted small" style={{ fontSize: '10px' }}>
                          {formatDateForDisplayIST(holiday.date, 'en-US', { day: 'numeric', month: 'short' })}
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
        <div className="col-12 col-lg-4">
          <div className="card shadow-sm border-0 h-100 p-4">
            <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
              <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                <PartyPopper size={18} color="#E44D26" /> Team Celebrations
              </h6>
              <button
                className="btn btn-sm btn-outline-primary border d-flex align-items-center gap-1 fw-bold px-2 py-1"
                style={{ fontSize: '10px', color: '#2F5596', borderColor: '#2F5596' }}
                onClick={handleOpenAddEventModal}
              >
                <Plus size={14} /> Add Event
              </button>
            </div>
            <div className="d-flex flex-column gap-2 mt-1">
              {formattedEvents.map((item) => (
                <div key={item.id} className="d-flex align-items-center justify-content-between p-2 rounded hover-bg-light border border-transparent">
                  <div className="d-flex align-items-center gap-3">
                    <div className="p-0 rounded-circle bg-light d-flex align-items-center justify-content-center overflow-hidden" style={{ width: '32px', height: '32px' }}>
                      <img src={(item as any).avatar} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div>
                      <div className="small fw-bold text-dark">{item.employee?.name || 'Team Event'}</div>
                      <div className="text-muted d-flex flex-column gap-0" style={{ fontSize: '10px' }}>
                        <div className="fw-medium text-primary mb-1">{item.name}</div>
                        <div className="d-flex align-items-center gap-1">
                          {item.icon} {item.type}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <div className="small badge bg-light text-dark border-0">{item.dateLabel}</div>
                    <button
                      type="button"
                      className="event-edit-btn"
                      onClick={() => handleOpenEditEventModal(item)}
                      aria-label={`Edit ${item.name}`}
                      title="Edit event"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      className="event-delete-btn"
                      onClick={() => onDeleteTeamEvent(item.id)}
                      aria-label={`Delete ${item.name}`}
                      title="Delete event"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {formattedEvents.length === 0 && (
                <div className="text-center py-4 text-muted small">No upcoming team events.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 row g-4">
        <div className="col-12 col-lg-6">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <h3 className="h5 fw-semibold text-secondary mb-4">Approved Leave Days by Type</h3>
              {leaveTypeData.length === 0 ? (
                <div className="text-muted small">No approved leave data yet.</div>
              ) : (
                <div style={{ width: '100%', height: '260px' }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={leaveTypeData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={1}
                      >
                        {leaveTypeData.map((entry, idx) => (
                          <Cell key={`${entry.name}-${idx}`} fill={chartColors[idx % chartColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`${value} days`, 'Approved Leave']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-6">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <h3 className="h5 fw-semibold text-secondary mb-4">Leave Requests by Department</h3>
              {departmentRequestData.length === 0 ? (
                <div className="text-muted small">No requests yet.</div>
              ) : (
                <div style={{ width: '100%', height: '260px' }}>
                  <ResponsiveContainer>
                    <BarChart data={departmentRequestData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <RxXAxis dataKey="name" />
                      <RxYAxis allowDecimals={false} />
                      <Tooltip formatter={(value: number) => [value, 'Requests']} />
                      <Legend />
                      <RxBar dataKey="value" name="Number of Requests" fill="#7dbc95" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="AI Generated Weekly Report" size="lg">
        {isLoadingSummary ? (
          <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
            <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : (
          <div className="ai-weekly-modal-layout p-4">
            <div className="ai-week-insights">
              <div className="ai-week-insights__head">
                <div>
                  <h6 className="mb-1">This Week Insights</h6>
                  <p className="mb-0">{weeklyInsights.rangeLabel}</p>
                </div>
              </div>

              <div className="ai-week-insights__tabs">
                <button type="button" className={`btn btn-sm ${insightTab === 'overview' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setInsightTab('overview')}>Overview</button>
                <button type="button" className={`btn btn-sm ${insightTab === 'leave' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setInsightTab('leave')}>Leave</button>
                <button type="button" className={`btn btn-sm ${insightTab === 'attendance' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setInsightTab('attendance')}>Attendance</button>
              </div>

              {insightTab === 'overview' && (
                <div className="ai-week-insights__grid">
                  <div className="ai-week-insights__card">
                    <div className="ai-week-insights__label">Weekly Requests</div>
                    <div className="ai-week-insights__value">{weeklyInsights.totalRequests}</div>
                  </div>
                  <div className="ai-week-insights__card">
                    <div className="ai-week-insights__label">Approval Rate</div>
                    <div className="ai-week-insights__value">{weeklyInsights.approvalRate}%</div>
                  </div>
                  <div className="ai-week-insights__card">
                    <div className="ai-week-insights__label">Pending Requests</div>
                    <div className="ai-week-insights__value">{weeklyInsights.pendingRequests}</div>
                  </div>
                  <div className="ai-week-insights__card">
                    <div className="ai-week-insights__label">Approved Leave Days</div>
                    <div className="ai-week-insights__value">{weeklyInsights.approvedDaysThisWeek}</div>
                  </div>
                  <div className="ai-week-insights__card">
                    <div className="ai-week-insights__label">Present Rate</div>
                    <div className="ai-week-insights__value">{weeklyInsights.presentRate}%</div>
                  </div>
                  <div className="ai-week-insights__card">
                    <div className="ai-week-insights__label">Top Department</div>
                    <div className="ai-week-insights__value ai-week-insights__value--text">{weeklyInsights.topDepartment}</div>
                    <div className="ai-week-insights__meta">{weeklyInsights.topDepartmentCount} requests</div>
                  </div>
                </div>
              )}

              {insightTab === 'leave' && (
                <div className="ai-week-insights__grid">
                  <div className="ai-week-insights__card">
                    <div className="ai-week-insights__label">Approved</div>
                    <div className="ai-week-insights__value">{weeklyInsights.approvedRequests}</div>
                  </div>
                  <div className="ai-week-insights__card">
                    <div className="ai-week-insights__label">Rejected</div>
                    <div className="ai-week-insights__value">{weeklyInsights.rejectedRequests}</div>
                  </div>
                  <div className="ai-week-insights__card">
                    <div className="ai-week-insights__label">Avg Days / Request</div>
                    <div className="ai-week-insights__value">{weeklyInsights.avgDaysPerRequest}</div>
                  </div>
                </div>
              )}

              {insightTab === 'attendance' && (
                <div className="ai-week-insights__grid">
                  <div className="ai-week-insights__card">
                    <div className="ai-week-insights__label">Present Records</div>
                    <div className="ai-week-insights__value">{weeklyInsights.presentCount}</div>
                  </div>
                  <div className="ai-week-insights__card">
                    <div className="ai-week-insights__label">Absent Records</div>
                    <div className="ai-week-insights__value">{weeklyInsights.absentCount}</div>
                  </div>
                  <div className="ai-week-insights__card">
                    <div className="ai-week-insights__label">On Leave Records</div>
                    <div className="ai-week-insights__value">{weeklyInsights.onLeaveCount}</div>
                  </div>
                </div>
              )}

              <div className="ai-week-insights__note">
                Most used leave type this week: <strong>{weeklyInsights.topLeaveType}</strong> ({weeklyInsights.topLeaveTypeDays} days)
                {weeklyInsights.attendanceTracked > 0 && (
                  <span className="ms-2">• Attendance tracked entries: <strong>{weeklyInsights.attendanceTracked}</strong></span>
                )}
              </div>
            </div>

            <div className="ai-report-shell">
              <div className="ai-report-content" dangerouslySetInnerHTML={{ __html: summary }} />
            </div>
          </div>
        )}
      </Modal>

      {/* Add Event Modal */}
      <Modal
        isOpen={isEventModalOpen}
        onClose={() => {
          setIsEventModalOpen(false);
          resetEventForm();
        }}
        title={editingEventId !== null ? 'Edit Team Event' : 'Add New Team Event'}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => {
              setIsEventModalOpen(false);
              resetEventForm();
            }}>Cancel</button>
            <button type="submit" form="add-event-form" className="btn btn-primary fw-bold px-4">{editingEventId !== null ? 'Update Event' : 'Add Event'}</button>
          </>
        }
      >
        <form id="add-event-form" className="event-modal-form" onSubmit={handleAddEventSubmit}>
          <div className="event-modal-field">
            <label className="form-label fw-bold">Event Title</label>
            <input
              type="text"
              className="form-control"
              required
              value={eventFormData.name}
              onChange={e => setEventFormData({ ...eventFormData, name: e.target.value })}
              placeholder="e.g. Birthday Celebration"
            />
          </div>
          <div className="event-modal-field position-relative">
            <label className="form-label fw-bold">Employee</label>
            <div className="smartsearch-box">
              <Users size={14} className="smartsearch-icon" />
              <input
                type="text"
                className="form-control"
                value={employeeSearchTerm}
                onChange={e => {
                  setEmployeeSearchTerm(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Search employee..."
              />
            </div>

            {/* People Picker Suggestions */}
            {showSuggestions && filteredEmployees.length > 0 && (
              <div className="event-employee-suggestions">
                {filteredEmployees.map(emp => (
                  <div
                    key={emp.id}
                    className="event-employee-suggestion-item"
                    onClick={() => handleSelectEmployee(emp)}
                  >
                    <img src={emp.avatar} alt={emp.name} className="rounded-circle" width="24" height="24" />
                    <div className="d-flex flex-column">
                      <span className="small fw-bold">{emp.name}</span>
                      <span className="text-muted event-employee-department">{emp.department}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="event-modal-field">
            <label className="form-label fw-bold">Event Type</label>
            <select
              className="form-select"
              value={eventFormData.type}
              onChange={e => setEventFormData({ ...eventFormData, type: e.target.value as any })}
            >
              <option value="Birthday">Birthday</option>
              <option value="Work Anniversary">Work Anniversary</option>
              <option value="Meeting">Meeting</option>
              <option value="Festival">Festival</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="event-modal-field event-modal-field--last">
            <label className="form-label fw-bold">Date</label>
            <input
              type="date"
              className="form-control"
              required
              value={eventFormData.date}
              onChange={e => setEventFormData({ ...eventFormData, date: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Dashboard;
