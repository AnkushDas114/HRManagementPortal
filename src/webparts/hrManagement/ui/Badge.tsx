
import * as React from 'react';
import { LeaveStatus } from '../types';

interface BadgeProps {
  status: LeaveStatus;
}

const Badge: React.FC<BadgeProps> = ({ status }) => {
  let colorClass = 'text-bg-secondary';
  
  switch(status) {
    case LeaveStatus.Approved:
      colorClass = 'text-bg-success';
      break;
    case LeaveStatus.Rejected:
      colorClass = 'text-bg-warning';
      break;
    case LeaveStatus.Pending:
      colorClass = 'text-bg-info text-white';
      break;
  }

  return (
    <span className={`badge rounded-pill px-3 py-2 text-uppercase ${colorClass}`} style={{ fontSize: '9px', letterSpacing: '0.5px' }}>
      {status}
    </span>
  );
};

export default Badge;
