
import * as React from 'react';
import type { LeaveRequest, AttendanceRecord, Holiday, TeamEvent, Employee } from '../types';
import { LeaveStatus, AttendanceStatus } from '../types';
import StatCard from '../ui/StatCard';
import { generateLeaveSummaryReport } from '../services/geminiService';
import Modal from '../ui/Modal';
import { Sparkle, Users, CheckCircle, Clock, XCircle, UserCheck, Calendar as CalendarIcon, Flag, PartyPopper, Cake, MessageSquare, Plus, Calendar } from 'lucide-react';
import { formatDateForDisplayIST, monthNameIST, todayIST } from '../utils/dateTime';
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
  onAddTeamEvent: (event: Omit<TeamEvent, 'id'>, employeeId?: string) => void;
  onPendingClick?: () => void;
  onOnLeaveTodayClick?: () => void;
  onConcernsClick?: () => void;
}


const Dashboard: React.FC<DashboardProps> = ({ requests, attendanceRecords, concernsCount, holidays, teamEvents, employees, onAddTeamEvent, onPendingClick, onOnLeaveTodayClick, onConcernsClick }) => {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = React.useState(false);
  const [summary, setSummary] = React.useState('');
  const [isLoadingSummary, setIsLoadingSummary] = React.useState(false);

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

  const handleGenerateSummary = async () => {
    setIsLoadingSummary(true);
    setIsModalOpen(true);
    const result = await generateLeaveSummaryReport(requests);

    const html = result
      .replace(/^### (.*$)/gim, '<h4>$1</h4>')
      .replace(/^## (.*$)/gim, '<h3>$1</h3>')
      .replace(/^\* (.*$)/gim, '<li>$1</li>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/((<li>.*<\/li>\s*)+)/g, '<ul>$1</ul>');

    setSummary(html);
    setIsLoadingSummary(false);
  };

  const handleAddEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddTeamEvent(eventFormData, selectedEmployee?.id);
    setIsEventModalOpen(false);
    setEventFormData({
      name: '',
      type: 'Birthday',
      date: todayIST()
    });
    setSelectedEmployee(null);
    setEmployeeSearchTerm('');
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
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
                onClick={() => setIsEventModalOpen(true)}
              >
                <Plus size={14} /> Add Event
              </button>
            </div>
            <div className="d-flex flex-column gap-2 mt-1">
              {formattedEvents.map((item, idx) => (
                <div key={idx} className="d-flex align-items-center justify-content-between p-2 rounded hover-bg-light border border-transparent">
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
                  <div className="small badge bg-light text-dark border-0">{item.dateLabel}</div>
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="AI Generated Weekly Report">
        {isLoadingSummary ? (
          <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
            <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : (
          <div dangerouslySetInnerHTML={{ __html: summary }} />
        )}
      </Modal>

      {/* Add Event Modal */}
      <Modal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        title="Add New Team Event"
        footer={
          <>
            <button className="btn btn-default" onClick={() => setIsEventModalOpen(false)}>Cancel</button>
            <button type="submit" form="add-event-form" className="btn btn-primary fw-bold px-4">Add Event</button>
          </>
        }
      >
        <form id="add-event-form" onSubmit={handleAddEventSubmit}>
          <div className="mb-3">
            <label className="form-label small text-muted fw-bold">Event Title</label>
            <input
              type="text"
              className="form-control"
              required
              value={eventFormData.name}
              onChange={e => setEventFormData({ ...eventFormData, name: e.target.value })}
              placeholder="e.g. Birthday Celebration"
            />
          </div>
          <div className="mb-3 position-relative">
            <label className="form-label small text-muted fw-bold">Employee</label>
            <div className="input-group">
              <span className="input-group-text bg-white border-end-0">
                <Users size={14} className="text-muted" />
              </span>
              <input
                type="text"
                className="form-control border-start-0"
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
              <div className="position-absolute w-100 mt-1 shadow-sm border rounded bg-white" style={{ zIndex: 1000 }}>
                {filteredEmployees.map(emp => (
                  <div
                    key={emp.id}
                    className="p-2 d-flex align-items-center gap-2 hover-bg-light cursor-pointer border-bottom last-border-0"
                    onClick={() => handleSelectEmployee(emp)}
                  >
                    <img src={emp.avatar} alt={emp.name} className="rounded-circle" width="24" height="24" />
                    <div className="d-flex flex-column">
                      <span className="small fw-bold">{emp.name}</span>
                      <span className="text-muted" style={{ fontSize: '9px' }}>{emp.department}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mb-3">
            <label className="form-label small text-muted fw-bold">Event Type</label>
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
          <div className="mb-3">
            <label className="form-label small text-muted fw-bold">Date</label>
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

      <style>{`
        .card-clickable-wrapper:hover {
          transform: translateY(-5px);
        }
        .card-clickable-wrapper:active {
          transform: translateY(-2px);
        }
        .hover-bg-light:hover { background-color: #f8f9fa; }
      `}</style>
    </div>
  );
};

export default Dashboard;
