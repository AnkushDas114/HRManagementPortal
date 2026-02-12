
import * as React from 'react';
import type { LeaveRequest } from '../types';
import { LeaveStatus } from '../types';
import { Users, Edit, Download } from 'lucide-react';
import CommonTable, { ColumnDef } from '../ui/CommonTable';
import { todayIST } from '../utils/dateTime';

interface OnLeaveTodayTableProps {
  requests: LeaveRequest[];
  onEdit?: (request: LeaveRequest) => void;
  leaveQuotas?: Record<string, number>;
}

const OnLeaveTodayTable: React.FC<OnLeaveTodayTableProps> = ({ requests, onEdit, leaveQuotas = {} }) => {
  const today = todayIST();

  const onLeaveToday = React.useMemo(() => {
    // Get valid unofficial leave types from quotas keys
    const validTypes = Object.keys(leaveQuotas);

    return requests.filter(req => {
      const isStatusValid = req.status === LeaveStatus.Approved || req.status === LeaveStatus.Pending;
      const isDateValid = today >= req.startDate && today <= req.endDate;
      const isTypeValid = validTypes.length === 0 || validTypes.indexOf(req.leaveType) !== -1;

      return isStatusValid && isDateValid && isTypeValid;
    });
  }, [requests, today, leaveQuotas]);

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
            className="shadow-sm border"
            style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '4px' }}
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
      header: 'Leave Type',
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
          className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-2 px-3 py-2 fw-medium"
          style={{ borderColor: '#2F5596', color: '#2F5596' }}
          onClick={() => onEdit?.(request)}
        >
          <Edit size={14} /> Edit
        </button>
      )
    }
  ]), [onEdit]);

  return (
    <div className="card shadow-sm border-0 animate-in fade-in overflow-hidden" style={{ borderRadius: '8px' }}>
      <div className="card-header bg-white d-flex justify-content-between align-items-center py-3 border-bottom border-light">
        <h2 className="h5 mb-0 d-flex align-items-center gap-2" style={{ color: '#2F5596', fontWeight: 600 }}>
          <Users size={20} /> Employees ON Leave Today
        </h2>
        <div className="d-flex align-items-center gap-2">
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
        globalSearchPlaceholder="Search on leave"
      />
    </div>
  );
};

export default OnLeaveTodayTable;
