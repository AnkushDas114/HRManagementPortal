
import * as React from 'react';
import { Employee, UserRole } from '../types';
import { Calendar } from 'lucide-react';

interface HeaderProps {
  role: UserRole;
  onRoleToggle: (role: UserRole) => void;
  canAccessHr?: boolean;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  users: Employee[];
}

const Header: React.FC<HeaderProps> = ({ role, onRoleToggle, canAccessHr = true }) => {
  return (
    <header className="navbar navbar-expand-lg navbar-light border-bottom shadow-sm sticky-top py-2">
      <div className="container-fluid hr-shell-container">
        <div className="d-flex align-items-center gap-2 navbar-brand">
          <div className="p-1 rounded bg-primary d-flex align-items-center justify-content-center shadow-xs">
            <Calendar size={18} color="white" />
          </div>
          <span className="fw-bold fs-6">Smalsus - HR Management Portal</span>
        </div>

        <div className="d-flex align-items-center gap-4">
          <div className="btn-group btn-group-sm gap-2" role="group">
            <button
              type="button"
              className={`btn ${role === UserRole.Employee ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => onRoleToggle(UserRole.Employee)}
            >
              Employee
            </button>
            {canAccessHr && (
              <button
                type="button"
                className={`btn ${role === UserRole.HR ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => onRoleToggle(UserRole.HR)}
              >
                HR Admin
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
