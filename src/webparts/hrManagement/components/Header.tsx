
import * as React from 'react';
import { Employee, UserRole } from '../types';
import { Calendar } from 'lucide-react';

interface HeaderProps {
  role: UserRole;
  onRoleToggle: (role: UserRole) => void;
  canAccessHr?: boolean;
  currentUser?: Employee;
  onTabChange?: (tab: string) => void;
}

const Header: React.FC<HeaderProps> = ({ role, onRoleToggle, canAccessHr = true, currentUser, onTabChange }) => {
  const portalTitle = canAccessHr ? 'Smalsus - HR Management Portal' : 'Smalsus - Employee Management Portal';
  return (
    <header className="navbar navbar-expand-lg navbar-light border-bottom shadow-sm sticky-top py-2">
      <div className="container-fluid hr-shell-container">
        <div className="d-flex align-items-center gap-2 navbar-brand">
          <div className="p-1 rounded card-bg-primary d-flex align-items-center justify-content-center shadow-xs">
            <Calendar size={18} color="white" />
          </div>
          <span className="fw-bold fs-6">{portalTitle}</span>
        </div>

        <div className="d-flex align-items-center gap-4">
          <div className="btn-group btn-group-sm gap-2" role="group">
            <button
              type="button"
              className={`btn ${role === UserRole.Employee ? 'btn-primary' : 'btn-default'}`}
              onClick={() => onRoleToggle(UserRole.Employee)}
            >
              Employee
            </button>
            {canAccessHr && (
              <button
                type="button"
                className={`btn ${role === UserRole.HR ? 'btn-primary' : 'btn-default'}`}
                onClick={() => onRoleToggle(UserRole.HR)}
              >
                HR Admin
              </button>
            )}
          </div>
          <button
            type="button"
            className="btn p-0 border-0 bg-transparent d-flex align-items-center ms-2"
            onClick={() => onTabChange?.('profile')}
            title="Open Profile"
            aria-label="Open Profile"
          >
            <img
              src={currentUser?.avatar || "https://i.pravatar.cc/150?u=user"}
              alt={currentUser?.name || "User"}
              className="rounded-circle border shadow-xs"
              style={{ width: '34px', height: '34px', objectFit: 'cover' }}
            />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
