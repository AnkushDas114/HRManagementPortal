
import * as React from 'react';
import { LeaveStatus, ConcernStatus } from '../types';

interface BadgeProps {
  status: LeaveStatus | ConcernStatus | string;
}

const Badge: React.FC<BadgeProps> = ({ status }) => {
  const normalized = String(status || '').trim().toLowerCase();
  let toneClass = 'status-chip--neutral';
  let inlineStyle: React.CSSProperties | undefined;

  switch (normalized) {
    case LeaveStatus.Approved.toLowerCase():
    case 'accepted':
    case ConcernStatus.Resolved.toLowerCase():
    case 'present':
      toneClass = 'text-primary';
      break;
    case LeaveStatus.Rejected.toLowerCase():
    case 'absent':
      toneClass = 'text-primary';
      break;
    case LeaveStatus.Pending.toLowerCase():
      toneClass = 'text-primary ';
      // inlineStyle = {
      //   color: '#a16207',
      //   background: '#fef3c7',
      //   borderColor: '#fde68a'
      // };
      break;
    case ConcernStatus.Open.toLowerCase():
    case 'unresolved':
      toneClass = 'text-primary';
      break;
    default:
      toneClass = 'text-primary';
  }

  return (
    <span className={` ${toneClass}`} style={inlineStyle}>
      {status}
    </span>
  );
};

export default Badge;
