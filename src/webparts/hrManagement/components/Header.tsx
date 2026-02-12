
import * as React from 'react';
import { Employee, UserRole } from '../types';
import { Calendar } from 'lucide-react';

interface HeaderProps {
  role: UserRole;
  onRoleToggle: (role: UserRole) => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  users: Employee[];
  selectedUserId?: string;
  onUserChange?: (userId: string) => void;
}

const Header: React.FC<HeaderProps> = ({ role, onRoleToggle, activeTab, onTabChange, users, selectedUserId, onUserChange }) => {
  const selectedUser = React.useMemo(
    () => users.find((u) => u.id === selectedUserId) || users[0],
    [users, selectedUserId]
  );

  return (
    <header className="navbar navbar-expand-lg navbar-light bg-white border-bottom shadow-sm sticky-top py-2">
      <div className="container-xl">
        <div className="d-flex align-items-center gap-2 navbar-brand">
          <div className="p-1 rounded bg-primary d-flex align-items-center justify-content-center">
            <Calendar size={18} color="white" />
          </div>
          <span className="fw-bold fs-6">Smalsus - IT Portal</span>
        </div>

        <div className="d-flex align-items-center gap-4">
          <div className="btn-group btn-group-sm" role="group">
            <button
              type="button"
              className={`btn ${role === UserRole.Employee ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => onRoleToggle(UserRole.Employee)}
            >
              Employee
            </button>
            <button
              type="button"
              className={`btn ${role === UserRole.HR ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => onRoleToggle(UserRole.HR)}
            >
              HR Admin
            </button>
          </div>

          <div className="d-flex align-items-center gap-2 ps-3 border-start">
            <div className="text-end d-none d-sm-block">
              <select
                className="form-select form-select-sm fw-bold"
                style={{ minWidth: '180px', fontSize: '12px' }}
                value={selectedUser?.id || ''}
                onChange={(e) => onUserChange?.(e.target.value)}
              >
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
              <div className="text-muted text-truncate" style={{ fontSize: '10px', maxWidth: '180px' }}>
                {selectedUser?.department || (role === UserRole.HR ? 'Admin' : 'Employee')}
              </div>
            </div>
            <img
              src={selectedUser?.avatar || "https://i.pravatar.cc/150?u=user"}
              alt={selectedUser?.name || "User"}
              className="rounded-circle border"
              style={{ width: '32px', height: '32px' }}
              onClick={() => onTabChange?.('profile')}
            />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
