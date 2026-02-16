
import * as React from 'react';
import type { LeaveRequest, Employee } from '../types';
import { LeaveStatus } from '../types';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';
import CommonTable, { ColumnDef } from '../ui/CommonTable';
import { Check, X, Filter, MessageSquare, Info, RotateCcw, ChevronDown, ChevronRight, Search, Clock } from 'lucide-react';
import { formatDateIST, getNowIST, todayIST } from '../utils/dateTime';

interface LeaveRequestsTableProps {
  requests: LeaveRequest[];
  employees: Employee[];
  leaveQuotas: Record<string, number>;
  filter: LeaveStatus | 'All';
  onFilterChange: (filter: LeaveStatus | 'All') => void;
  onUpdateStatus: (id: number, status: LeaveStatus, comment: string) => void;
  onDelete: (id: number) => void;
  onViewBalance?: (employee: Employee) => void;
  teams: string[];
  title?: string;
  showLeaveBalance?: boolean;
}

const LeaveRequestsTable: React.FC<LeaveRequestsTableProps> = ({ requests, employees, leaveQuotas, filter, onFilterChange, onUpdateStatus, onDelete, onViewBalance, teams, title = 'Detailed Leave Applications', showLeaveBalance = true }) => {
  const [isCommentModalOpen, setIsCommentModalOpen] = React.useState(false);
  const [selectedRequest, setSelectedRequest] = React.useState<LeaveRequest | null>(null);
  const [comment, setComment] = React.useState('');
  const [actionType, setActionType] = React.useState<LeaveStatus.Approved | LeaveStatus.Rejected | null>(null);

  // Advanced Filtering State
  const [isDateAccordionOpen, setIsDateAccordionOpen] = React.useState(true);
  const [isSmartSearchOpen, setIsSmartSearchOpen] = React.useState(false);
  const [selectedDateFilter, setSelectedDateFilter] = React.useState('All Time');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [selectedMemberId, setSelectedMemberId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');

  const today = getNowIST();
  const todayStr = todayIST();

  // Comprehensive Filtering Logic
  const filteredRequests = React.useMemo(() => {
    return requests.filter(req => {
      // 1. Basic Status Filter
      if (filter !== 'All' && req.status !== filter) return false;

      // 2. Member Selection Filter (Avatar)
      if (selectedMemberId && req.employee.id !== selectedMemberId) return false;

      // 3. Search Query Filter (Name, ID, Role)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matches = req.employee.name.toLowerCase().includes(query) ||
          req.employee.id.toLowerCase().includes(query) ||
          req.employee.department.toLowerCase().includes(query) ||
          req.leaveType.toLowerCase().includes(query);
        if (!matches) return false;
      }

      // 4. Date Presets Filter
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
  }, [requests, filter, selectedMemberId, searchQuery, selectedDateFilter, startDate, endDate, todayStr]);

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

  const handleClearFilters = () => {
    setSelectedDateFilter('All Time');
    setStartDate('');
    setEndDate('');
    setSelectedMemberId(null);
    setSearchQuery('');
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
      <button className="btn btn-outline-secondary px-4 fw-medium" onClick={() => setIsCommentModalOpen(false)}>Cancel</button>
      <button
        className={`btn px-4 fw-bold text-white ${actionType === LeaveStatus.Approved ? 'btn-success' : 'btn-danger'}`}
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
            <div className="fw-bold text-dark small">{request.employee.name}</div>
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
            <span className="fw-bold small" style={{ color: '#2F5596' }}>{used} / {quota}</span>
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
          <span className="small fw-medium text-dark">{request.leaveType}</span>
          {request.isHalfDay && (
            <span className="badge bg-info-subtle text-info border border-info-subtle d-inline-block" style={{ fontSize: '8px', width: 'fit-content' }}>
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
          <div className="small text-dark fw-medium">{request.startDate} <span className="text-muted">to</span> {request.endDate}</div>
          <div className="small text-muted" style={{ fontSize: '10px' }}>{request.days} Full Day(s)</div>
        </>
      )
    },
    {
      key: 'reason',
      header: 'Reason',
      accessor: (request) => request.reason,
      render: (request) => (
        <div className="small text-muted text-truncate" style={{ maxWidth: '150px' }} title={request.reason}>
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
            <div className="small text-muted mt-1" style={{ fontSize: '9px' }}>
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
        <div className="d-flex align-items-center justify-content-end gap-2">
          {request.status === LeaveStatus.Pending ? (
            <>
              <button onClick={() => handleActionClick(request, LeaveStatus.Approved)} className="btn btn-sm btn-outline-success rounded p-1"><Check size={16} /></button>
              <button onClick={() => handleActionClick(request, LeaveStatus.Rejected)} className="btn btn-sm btn-outline-danger rounded p-1"><X size={16} /></button>
            </>
          ) : (
            <button onClick={() => handleRevertClick(request)} className="btn btn-sm btn-outline-secondary rounded p-1" style={{ opacity: 0.7 }}><RotateCcw size={16} /></button>
          )}
        </div>
      )
    }
  ]), [leaveQuotas, onViewBalance, calculateUsedLeaves, handleActionClick, handleRevertClick, getApproverCommentPreview, showLeaveBalance]);

  return (
    <>
      <div className="card shadow-sm border-0 bg-white">
        <div className="card-header bg-white d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3 py-3 border-bottom-0">
          <h2 className="h5 mb-0 fw-bold" style={{ color: '#2F5596' }}>{title}</h2>
          <div className="d-flex align-items-center gap-2">
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
        <div className="px-4 pb-2">
          {/* Team-Based Avatar Filtering */}
          <div className="border-top pt-3 pb-2">
            <div className="d-flex flex-wrap gap-5">
              {teams.map(teamName => {
                const teamMembers = employees.filter(emp => emp.department === teamName);
                if (teamMembers.length === 0) return null;
                const teamLabel = /team$/i.test(teamName) ? teamName : `${teamName} Team`;

                return (
                  <div key={teamName} className="team-filter-group">
                    <div className="small text-muted border-bottom mb-2 pb-1 fw-bold text-uppercase" style={{ fontSize: '10px', letterSpacing: '0.5px' }}>
                      {teamLabel}
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
              <span className="fw-bold small">Date</span>
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
                        className="form-check-input"
                        checked={selectedDateFilter === preset}
                        onChange={() => setSelectedDateFilter(preset)}
                      />
                      <label htmlFor={`date-${preset}`} className="small text-muted mb-0 cursor-pointer">{preset}</label>
                    </div>
                  ))}
                </div>
                <div className="d-flex align-items-center gap-3">
                  <div className="d-flex align-items-center gap-2">
                    <label className="small text-muted fw-bold">Start Date</label>
                    <input type="date" className="form-control form-control-sm" style={{ width: '140px' }} value={startDate} onChange={e => { setStartDate(e.target.value); setSelectedDateFilter('Custom'); }} />
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <label className="small text-muted fw-bold">End Date</label>
                    <input type="date" className="form-control form-control-sm" style={{ width: '140px' }} value={endDate} onChange={e => { setEndDate(e.target.value); setSelectedDateFilter('Custom'); }} />
                  </div>
                  <button className="btn btn-link btn-sm text-decoration-none fw-bold p-0" style={{ color: '#2F5596' }} onClick={handleClearFilters}>Clear</button>
                </div>
              </div>
            )}
          </div>

          {/* SmartSearch Accordion */}
          <div className="accordion-filter border-top mb-2">
            <div
              className="d-flex align-items-center gap-2 py-2 cursor-pointer"
              onClick={() => setIsSmartSearchOpen(!isSmartSearchOpen)}
            >
              {isSmartSearchOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              <span className="fw-bold small">SmartSearch – Filters</span>
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

        <CommonTable
          data={filteredRequests}
          columns={columns}
          getRowId={(row) => row.id}
          globalSearchPlaceholder="Search leave requests"
        />
      </div >

      <Modal isOpen={isCommentModalOpen} onClose={() => setIsCommentModalOpen(false)} title={modalTitle} footer={modalFooter}>
        <div className="animate-in fade-in">
          <p className="small text-dark mb-4 p-3 bg-light rounded border">
            Decision for <strong>{selectedRequest?.employee.name}</strong><br />
            Leave Period: {selectedRequest?.startDate} to {selectedRequest?.endDate} ({selectedRequest?.days} days)
          </p>
          <div className="mb-3">
            <label htmlFor="approverComment" className="form-label fw-bold small text-muted">Approval / Rejection Comment</label>
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
    </>
  );
};

export default LeaveRequestsTable;
