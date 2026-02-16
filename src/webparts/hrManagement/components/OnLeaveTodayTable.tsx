
import * as React from 'react';
import type { LeaveRequest, Employee } from '../types';
import { LeaveStatus } from '../types';
import { Users, Edit, Download, Plus, Search, Calendar, Clock, Info } from 'lucide-react';
import CommonTable, { ColumnDef } from '../ui/CommonTable';
import Modal from '../ui/Modal';
import { todayIST } from '../utils/dateTime';
import { SPFI } from '@pnp/sp';
import { createLeaveRequest } from '../services/LeaveRequestsService';

interface OnLeaveTodayTableProps {
  requests: LeaveRequest[];
  onEdit?: (request: LeaveRequest) => void;
  leaveQuotas: Record<string, number>;
  sp: SPFI;
  employees: Employee[];
  onRefresh: () => Promise<void>;
}

const OnLeaveTodayTable: React.FC<OnLeaveTodayTableProps> = ({ requests, onEdit, leaveQuotas = {}, sp, employees, onRefresh }) => {
  const today = todayIST();
  const [isAddLeaveModalOpen, setIsAddLeaveModalOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedEmployee, setSelectedEmployee] = React.useState<Employee | null>(null);

  const [leaveFormData, setLeaveFormData] = React.useState({
    leaveType: Object.keys(leaveQuotas)[0] || 'Sick',
    startDate: today,
    endDate: today,
    reason: '',
    isHalfDay: false,
    halfDayType: 'first' as 'first' | 'second',
    isRecurring: false,
    recurringFrequency: 'Daily' as 'Daily' | 'Weekly' | 'Monthly' | 'Yearly',
    dailyInterval: 1,
    dailyWeekdaysOnly: false,
    weeklyInterval: 1,
    weeklyDays: [] as string[],
    monthlyPattern: 'day' as 'day' | 'the',
    monthlyDay: 1,
    monthlyInterval: 1,
    monthlyWeekNumber: 'first' as 'first' | 'second' | 'third' | 'fourth' | 'last',
    monthlyWeekDay: 'Monday',
    monthlyIntervalThe: 1,
    yearlyPattern: 'every' as 'every' | 'the',
    yearlyMonth: 'January',
    yearlyInterval: 1,
    yearlyWeekNumber: 'first' as 'first' | 'second' | 'third' | 'fourth' | 'last',
    yearlyWeekDay: 'Monday',
    yearlyMonthThe: 'January',
    endDateOption: 'noEnd' as 'noEnd' | 'endBy' | 'endAfter',
    recurrenceEndDate: '',
    recurrenceOccurrences: 1
  });

  const onLeaveToday = React.useMemo(() => {
    const validTypes = Object.keys(leaveQuotas);
    return requests.filter(req => {
      const isStatusValid = req.status === LeaveStatus.Approved;
      const isDateValid = today >= req.startDate && today <= req.endDate;
      const isWorkFromHomeRequest = req.requestCategory === 'Work From Home' || /work\s*from\s*home|wfh/i.test(String(req.leaveType || ''));
      const isTypeValid = isWorkFromHomeRequest || validTypes.length === 0 || validTypes.indexOf(req.leaveType) !== -1;
      return isStatusValid && isDateValid && isTypeValid;
    });
  }, [requests, today, leaveQuotas]);

  const filteredEmployees = React.useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return employees.filter(emp =>
      emp.name.toLowerCase().includes(term) ||
      emp.id.toLowerCase().includes(term) ||
      (emp.email && emp.email.toLowerCase().includes(term))
    ).slice(0, 5);
  }, [employees, searchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) {
      alert("Please select an employee first.");
      return;
    }

    setIsSubmitting(true);
    try {
      const start = new Date(leaveFormData.startDate);
      const end = leaveFormData.isHalfDay ? start : new Date(leaveFormData.endDate);
      let days = 1;
      if (leaveFormData.isHalfDay) {
        days = 0.5;
      } else {
        const diffTime = Math.abs(end.getTime() - start.getTime());
        days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      }

      await createLeaveRequest(sp, selectedEmployee, leaveFormData, days);
      await onRefresh();
      setIsAddLeaveModalOpen(false);
      resetForm();
    } catch (error) {
      console.error("Failed to add leave:", error);
      alert("Failed to add leave request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedEmployee(null);
    setSearchTerm('');
    setLeaveFormData({
      ...leaveFormData,
      leaveType: Object.keys(leaveQuotas)[0] || 'Sick',
      startDate: today,
      endDate: today,
      reason: '',
      isHalfDay: false
    });
  };

  const exportToCSV = () => {
    if (onLeaveToday.length === 0) return;
    const headers = ['Employee Name', 'ID', 'Department', 'Leave Type', 'From', 'Until', 'Duration (Days)'];
    const rows = onLeaveToday.map(request => [
      request.employee.name,
      request.employee.id,
      request.employee.department,
      request.leaveType,
      request.startDate,
      request.endDate,
      request.days
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `on_leave_today_${today}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns = React.useMemo<ColumnDef<LeaveRequest>[]>(() => ([
    {
      key: 'employee',
      header: 'Employee',
      accessor: (request) => request.employee.name,
      render: (request) => (
        <div className="d-flex align-items-center gap-3">
          <img
            src={request.employee.avatar}
            alt={request.employee.name}
            className="rounded-circle border shadow-sm"
            style={{ width: '40px', height: '40px', objectFit: 'cover' }}
          />
          <div className="fw-semibold text-dark fs-6">{request.employee.name}</div>
        </div>
      )
    },
    {
      key: 'department',
      header: 'Department',
      accessor: (request) => request.employee.department,
      render: (request) => <span className="text-muted fw-medium">{request.employee.department}</span>
    },
    {
      key: 'leaveType',
      header: 'Request Type',
      render: (request) => (
        <span className="small fw-semibold py-1 px-3 rounded border" style={{ backgroundColor: '#f8f9fa', color: '#333' }}>
          {request.leaveType}
        </span>
      )
    },
    { key: 'startDate', header: 'From' },
    { key: 'endDate', header: 'Until' },
    {
      key: 'days',
      header: 'Duration',
      render: (request) => (
        <span className="fw-bold" style={{ color: '#2F5596', fontSize: '15px' }}>
          {request.days} Day(s)
        </span>
      )
    },
    {
      key: 'actions',
      header: 'Action',
      searchable: false,
      filterable: false,
      align: 'end',
      render: (request) => (
        <button
          type="button"
          className="btn btn-sm btn-outline-primary onleave-edit-btn d-inline-flex align-items-center gap-2 px-3 py-2 fw-medium"
          style={{ borderColor: '#2F5596', color: '#2F5596' }}
          onClick={() => onEdit?.(request)}
        >
          <Edit size={14} /> Edit
        </button>
      )
    }
  ]), [onEdit]);

  return (
    <>
      <div className="card shadow-sm border-0 animate-in fade-in overflow-hidden" style={{ borderRadius: '8px' }}>
        <div className="card-header bg-white d-flex justify-content-between align-items-center py-3 border-bottom border-light">
          <h2 className="h5 mb-0 d-flex align-items-center gap-2" style={{ color: '#2F5596', fontWeight: 600 }}>
            <Users size={20} /> Employees On Leave / WFH Today
          </h2>
          <div className="d-flex align-items-center gap-2">
            <button
              className="btn btn-primary btn-sm d-flex align-items-center gap-2 fw-bold px-3 shadow-xs"
              onClick={() => setIsAddLeaveModalOpen(true)}
              style={{ borderRadius: '4px' }}
            >
              <Plus size={16} /> Add Employee Leave/WFH
            </button>
            <button
              className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2 fw-medium px-3 shadow-xs"
              onClick={exportToCSV}
              style={{ borderRadius: '4px' }}
              disabled={onLeaveToday.length === 0}
            >
              <Download size={14} /> Export CSV
            </button>
            <span className="badge rounded-pill px-3 py-2" style={{ backgroundColor: '#2F5596', color: 'white', fontWeight: 600, fontSize: '12px' }}>
              {onLeaveToday.length} Currently Away
            </span>
          </div>
        </div>

        <CommonTable
          data={onLeaveToday}
          columns={columns}
          getRowId={(row) => row.id}
          globalSearchPlaceholder="Search leave/wfh"
        />
      </div>

      <Modal
        isOpen={isAddLeaveModalOpen}
        onClose={() => setIsAddLeaveModalOpen(false)}
        title="Apply Leave for Employee"
        footer={
          <>
            <button className="btn btn-link text-decoration-none" onClick={() => setIsAddLeaveModalOpen(false)}>Cancel</button>
            <button
              type="submit"
              form="apply-employee-leave-form"
              className="btn btn-primary px-4 fw-bold shadow-sm"
              disabled={isSubmitting || !selectedEmployee}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Leave'}
            </button>
          </>
        }
      >
        <form id="apply-employee-leave-form" onSubmit={handleSubmit}>
          <div className="row g-3">
            {/* Employee Search/Select */}
            <div className="col-12">
              <label className="form-label fw-bold d-flex align-items-center gap-2 text-dark">
                <Users size={16} className="text-primary" /> Find Employee
              </label>
              <div className="position-relative">
                <div className="position-absolute h-100 d-flex align-items-center ps-3" style={{ zIndex: 5 }}>
                  <Search size={16} className="text-muted" />
                </div>
                <input
                  type="text"
                  className="form-control ps-5 shadow-xs"
                  placeholder="Search by name, ID or email..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    if (selectedEmployee) setSelectedEmployee(null);
                  }}
                />
              </div>

              {filteredEmployees.length > 0 && !selectedEmployee && (
                <div className="position-absolute w-100 mt-1 shadow-lg bg-white border rounded-3 overflow-hidden" style={{ zIndex: 100 }}>
                  {filteredEmployees.map(emp => (
                    <button
                      key={emp.id}
                      type="button"
                      className="btn btn-light w-100 text-start d-flex align-items-center gap-3 p-3 border-bottom last-border-none hover-bg-light"
                      onClick={() => {
                        setSelectedEmployee(emp);
                        setSearchTerm(emp.name);
                      }}
                    >
                      <img src={emp.avatar} width="36" height="36" className="rounded-circle border" />
                      <div>
                        <div className="fw-bold small">{emp.name}</div>
                        <div className="text-muted small">ID: {emp.id} • {emp.department}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedEmployee && (
              <div className="col-12">
                <div className="p-3 rounded-3 border bg-light d-flex align-items-center gap-3">
                  <img src={selectedEmployee.avatar} width="48" height="48" className="rounded-circle border shadow-sm" />
                  <div>
                    <div className="fw-bold text-dark">{selectedEmployee.name}</div>
                    <div className="text-muted small">{selectedEmployee.position} • {selectedEmployee.department}</div>
                  </div>
                  <button type="button" className="btn btn-sm btn-outline-danger ms-auto" onClick={() => resetForm()}>Change</button>
                </div>
              </div>
            )}

            <div className="col-12">
              <label className="form-label fw-bold d-flex align-items-center gap-2 text-dark">
                <Info size={16} className="text-primary" /> Leave Type
              </label>
              <select
                className="form-select shadow-xs"
                value={leaveFormData.leaveType}
                onChange={e => setLeaveFormData({ ...leaveFormData, leaveType: e.target.value })}
              >
                {Object.keys(leaveQuotas).map(t => (<option key={t} value={t}>{t}</option>))}
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label fw-bold d-flex align-items-center gap-2">
                <Calendar size={16} className="text-primary" /> Start Date
              </label>
              <input
                type="date"
                className="form-control"
                value={leaveFormData.startDate}
                onChange={e => setLeaveFormData({ ...leaveFormData, startDate: e.target.value })}
                required
              />
            </div>

            <div className="col-md-6">
              <label className="form-label fw-bold d-flex align-items-center gap-2">
                <Calendar size={16} className="text-primary" /> End Date
              </label>
              <input
                type="date"
                className="form-control"
                value={leaveFormData.endDate}
                onChange={e => setLeaveFormData({ ...leaveFormData, endDate: e.target.value })}
                required
                disabled={leaveFormData.isHalfDay}
              />
            </div>

            <div className="col-12">
              <button
                type="button"
                className={`btn popup-option-toggle ${leaveFormData.isHalfDay ? 'popup-option-toggle--active' : ''}`}
                onClick={() => setLeaveFormData({ ...leaveFormData, isHalfDay: !leaveFormData.isHalfDay })}
                aria-pressed={leaveFormData.isHalfDay}
              >
                Request Half Day
              </button>
            </div>

            {leaveFormData.isHalfDay && (
              <div className="col-12 animate-in slide-in-from-top-1">
                <label className="form-label fw-bold small text-muted text-uppercase">Half Day Type</label>
                <div className="d-flex gap-4 p-2">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="hdType"
                      id="fh"
                      checked={leaveFormData.halfDayType === 'first'}
                      onChange={() => setLeaveFormData({ ...leaveFormData, halfDayType: 'first' })}
                    />
                    <label className="form-check-label" htmlFor="fh">First Half</label>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="hdType"
                      id="sh"
                      checked={leaveFormData.halfDayType === 'second'}
                      onChange={() => setLeaveFormData({ ...leaveFormData, halfDayType: 'second' })}
                    />
                    <label className="form-check-label" htmlFor="sh">Second Half</label>
                  </div>
                </div>
              </div>
            )}

            <div className="col-12">
              <button
                type="button"
                className={`btn popup-option-toggle ${leaveFormData.isRecurring ? 'popup-option-toggle--active' : ''}`}
                onClick={() => setLeaveFormData({ ...leaveFormData, isRecurring: !leaveFormData.isRecurring })}
                aria-pressed={leaveFormData.isRecurring}
              >
                Recurrence
              </button>
            </div>

            {leaveFormData.isRecurring && (
              <div className="col-12 animate-in fade-in">
                <div className="p-3 border rounded bg-white shadow-xs">
                  {/* Recurrence Pattern Selection */}
                  <div className="mb-3">
                    <label className="form-label fw-bold small text-primary text-uppercase">Recurrence Frequency</label>
                    <div className="d-flex flex-wrap gap-3">
                      {(['Daily', 'Weekly', 'Monthly', 'Yearly'] as const).map(freq => (
                        <div key={freq} className="form-check">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="recurringFrequency_alt"
                            id={`freq${freq}_alt`}
                            value={freq}
                            checked={leaveFormData.recurringFrequency === freq}
                            onChange={e => setLeaveFormData({ ...leaveFormData, recurringFrequency: e.target.value as any })}
                          />
                          <label className="form-check-label small fw-medium" htmlFor={`freq${freq}_alt`}>{freq}</label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pattern-specific options */}
                  <div className="mb-3">
                    {leaveFormData.recurringFrequency === 'Daily' && (
                      <div className="p-2 border rounded-3 bg-light-subtle">
                        <div className="form-check mb-2">
                          <input className="form-check-input" type="radio" name="dailyP" id="dE" checked={!leaveFormData.dailyWeekdaysOnly} onChange={() => setLeaveFormData({ ...leaveFormData, dailyWeekdaysOnly: false })} />
                          <label className="form-check-label small" htmlFor="dE">
                            every <input type="number" className="form-control form-control-sm d-inline-block mx-1" style={{ width: '60px' }} min="1" value={leaveFormData.dailyInterval} onChange={e => setLeaveFormData({ ...leaveFormData, dailyInterval: parseInt(e.target.value) || 1 })} /> days
                          </label>
                        </div>
                        <div className="form-check">
                          <input className="form-check-input" type="radio" name="dailyP" id="dW" checked={leaveFormData.dailyWeekdaysOnly} onChange={() => setLeaveFormData({ ...leaveFormData, dailyWeekdaysOnly: true })} />
                          <label className="form-check-label small" htmlFor="dW">every weekdays</label>
                        </div>
                      </div>
                    )}

                    {leaveFormData.recurringFrequency === 'Weekly' && (
                      <div className="p-2 border rounded-3 bg-light-subtle">
                        <div className="mb-2 small">
                          every <input type="number" className="form-control form-control-sm d-inline-block mx-1" style={{ width: '60px' }} min="1" value={leaveFormData.weeklyInterval} onChange={e => setLeaveFormData({ ...leaveFormData, weeklyInterval: parseInt(e.target.value) || 1 })} /> week(s) on
                        </div>
                        <div className="d-flex flex-wrap gap-2">
                          {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                            <div key={day} className="form-check form-check-inline">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id={`day${day}_alt`}
                                checked={leaveFormData.weeklyDays.indexOf(day) !== -1}
                                onChange={e => {
                                  const days = e.target.checked
                                    ? [...leaveFormData.weeklyDays, day]
                                    : leaveFormData.weeklyDays.filter(d => d !== day);
                                  setLeaveFormData({ ...leaveFormData, weeklyDays: days });
                                }}
                              />
                              <label className="form-check-label small" htmlFor={`day${day}_alt`}>{day.slice(0, 3)}</label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {leaveFormData.recurringFrequency === 'Monthly' && (
                      <div className="p-2 border rounded-3 bg-light-subtle">
                        <div className="form-check mb-2">
                          <input className="form-check-input" type="radio" name="mP" id="mD" checked={leaveFormData.monthlyPattern === 'day'} onChange={() => setLeaveFormData({ ...leaveFormData, monthlyPattern: 'day' })} />
                          <label className="form-check-label small" htmlFor="mD">
                            Day <input type="number" className="form-control form-control-sm d-inline-block mx-1" style={{ width: '50px' }} min="1" max="31" value={leaveFormData.monthlyDay} onChange={e => setLeaveFormData({ ...leaveFormData, monthlyDay: parseInt(e.target.value) || 1 })} /> of every <input type="number" className="form-control form-control-sm d-inline-block mx-1" style={{ width: '50px' }} min="1" value={leaveFormData.monthlyInterval} onChange={e => setLeaveFormData({ ...leaveFormData, monthlyInterval: parseInt(e.target.value) || 1 })} /> month(s)
                          </label>
                        </div>
                        <div className="form-check">
                          <input className="form-check-input" type="radio" name="mP" id="mT" checked={leaveFormData.monthlyPattern === 'the'} onChange={() => setLeaveFormData({ ...leaveFormData, monthlyPattern: 'the' })} />
                          <label className="form-check-label small" htmlFor="mT">
                            the <select className="form-select form-select-sm d-inline-block mx-1" style={{ width: 'auto' }} value={leaveFormData.monthlyWeekNumber} onChange={e => setLeaveFormData({ ...leaveFormData, monthlyWeekNumber: e.target.value as any })}>
                              <option value="first">first</option><option value="second">second</option><option value="third">third</option><option value="fourth">fourth</option><option value="last">last</option>
                            </select> <select className="form-select form-select-sm d-inline-block mx-1" style={{ width: 'auto' }} value={leaveFormData.monthlyWeekDay} onChange={e => setLeaveFormData({ ...leaveFormData, monthlyWeekDay: e.target.value })}>
                              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => <option key={d} value={d}>{d}</option>)}
                            </select> of every <input type="number" className="form-control form-control-sm d-inline-block mx-1" style={{ width: '50px' }} min="1" value={leaveFormData.monthlyIntervalThe} onChange={e => setLeaveFormData({ ...leaveFormData, monthlyIntervalThe: parseInt(e.target.value) || 1 })} /> month(s)
                          </label>
                        </div>
                      </div>
                    )}

                    {leaveFormData.recurringFrequency === 'Yearly' && (
                      <div className="p-2 border rounded-3 bg-light-subtle">
                        <div className="form-check mb-2">
                          <input className="form-check-input" type="radio" name="yP" id="yE" checked={leaveFormData.yearlyPattern === 'every'} onChange={() => setLeaveFormData({ ...leaveFormData, yearlyPattern: 'every' })} />
                          <label className="form-check-label small" htmlFor="yE">
                            every <select className="form-select form-select-sm d-inline-block mx-1" style={{ width: 'auto' }} value={leaveFormData.yearlyMonth} onChange={e => setLeaveFormData({ ...leaveFormData, yearlyMonth: e.target.value })}>
                              {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => <option key={m} value={m}>{m}</option>)}
                            </select> <input type="number" className="form-control form-control-sm d-inline-block mx-1" style={{ width: '50px' }} min="1" value={leaveFormData.yearlyInterval} onChange={e => setLeaveFormData({ ...leaveFormData, yearlyInterval: parseInt(e.target.value) || 1 })} />
                          </label>
                        </div>
                        <div className="form-check">
                          <input className="form-check-input" type="radio" name="yP" id="yT" checked={leaveFormData.yearlyPattern === 'the'} onChange={() => setLeaveFormData({ ...leaveFormData, yearlyPattern: 'the' })} />
                          <label className="form-check-label small" htmlFor="yT">
                            the <select className="form-select form-select-sm d-inline-block mx-1" style={{ width: 'auto' }} value={leaveFormData.yearlyWeekNumber} onChange={e => setLeaveFormData({ ...leaveFormData, yearlyWeekNumber: e.target.value as any })}>
                              <option value="first">first</option><option value="second">second</option><option value="third">third</option><option value="fourth">fourth</option><option value="last">last</option>
                            </select> <select className="form-select form-select-sm d-inline-block mx-1" style={{ width: 'auto' }} value={leaveFormData.yearlyWeekDay} onChange={e => setLeaveFormData({ ...leaveFormData, yearlyWeekDay: e.target.value })}>
                              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => <option key={d} value={d}>{d}</option>)}
                            </select> of <select className="form-select form-select-sm d-inline-block mx-1" style={{ width: 'auto' }} value={leaveFormData.yearlyMonthThe} onChange={e => setLeaveFormData({ ...leaveFormData, yearlyMonthThe: e.target.value })}>
                              {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Date Range for Recurrence */}
                  <div>
                    <label className="form-label fw-bold small text-primary text-uppercase">End Preference</label>
                    <div className="p-2 border rounded-3 bg-light-subtle">
                      <div className="form-check mb-2">
                        <input className="form-check-input" type="radio" name="endOpt" id="nE" checked={leaveFormData.endDateOption === 'noEnd'} onChange={() => setLeaveFormData({ ...leaveFormData, endDateOption: 'noEnd' })} />
                        <label className="form-check-label small" htmlFor="nE">no end date</label>
                      </div>
                      <div className="form-check mb-2">
                        <input className="form-check-input" type="radio" name="endOpt" id="eB" checked={leaveFormData.endDateOption === 'endBy'} onChange={() => setLeaveFormData({ ...leaveFormData, endDateOption: 'endBy' })} />
                        <label className="form-check-label small" htmlFor="eB">
                          end by <input type="date" className="form-control form-control-sm d-inline-block mx-1" style={{ width: '130px' }} value={leaveFormData.recurrenceEndDate} onChange={e => setLeaveFormData({ ...leaveFormData, recurrenceEndDate: e.target.value })} disabled={leaveFormData.endDateOption !== 'endBy'} />
                        </label>
                      </div>
                      <div className="form-check">
                        <input className="form-check-input" type="radio" name="endOpt" id="eA" checked={leaveFormData.endDateOption === 'endAfter'} onChange={() => setLeaveFormData({ ...leaveFormData, endDateOption: 'endAfter' })} />
                        <label className="form-check-label small" htmlFor="eA">
                          end after <input type="number" className="form-control form-control-sm d-inline-block mx-1" style={{ width: '50px' }} min="1" value={leaveFormData.recurrenceOccurrences} onChange={e => setLeaveFormData({ ...leaveFormData, recurrenceOccurrences: parseInt(e.target.value) || 1 })} disabled={leaveFormData.endDateOption !== 'endAfter'} /> occurrences
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="col-12">
              <label className="form-label fw-bold d-flex align-items-center gap-2">
                <Clock size={16} className="text-primary" /> Reason for Leave
              </label>
              <textarea
                className="form-control shadow-xs"
                rows={3}
                value={leaveFormData.reason}
                onChange={e => setLeaveFormData({ ...leaveFormData, reason: e.target.value })}
                placeholder="Briefly explain the reason for leave..."
                required
              ></textarea>
            </div>
          </div>
        </form>
      </Modal >
    </>
  );
};

export default OnLeaveTodayTable;
