
import * as React from 'react';
import { LeaveStatus, ConcernStatus } from '../types';

interface BadgeProps {
  status: LeaveStatus | ConcernStatus | string;
}

const Badge: React.FC<BadgeProps> = ({ status }) => {
  const normalized = String(status || '').trim().toLowerCase();
  let toneClass = 'status-chip--neutral';

  switch (normalized) {
    case LeaveStatus.Approved.toLowerCase():
    case 'accepted':
    case ConcernStatus.Resolved.toLowerCase():
    case 'present':
      toneClass = 'status-chip--success';
      break;
    case LeaveStatus.Rejected.toLowerCase():
    case 'absent':
      toneClass = 'status-chip--danger';
      break;
    case LeaveStatus.Pending.toLowerCase():
      toneClass = 'status-chip--pending';
      break;
    case ConcernStatus.Open.toLowerCase():
    case 'unresolved':
      toneClass = 'status-chip--warning';
      break;
    default:
      toneClass = 'status-chip--neutral';
  }

  return (
    <span className={`status-chip ${toneClass}`}>
      {status}
    </span>
  );
};

export default Badge;
