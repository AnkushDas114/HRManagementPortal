
import * as React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  isTotal?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, isTotal = false }) => {
  return (
    <div className={`card border-0 shadow-sm h-100 ${isTotal ? 'bg-primary text-white' : 'bg-white'}`}>
      <div className="card-body p-4 d-flex align-items-center justify-content-between">
        <div>
          <h6 className={`card-subtitle mb-2 fw-bold text-uppercase small ${isTotal ? 'text-white-50' : 'text-muted'}`} style={{ letterSpacing: '0.5px' }}>
            {title}
          </h6>
          <h2 className="card-title mb-0 fw-bold">{value}</h2>
        </div>
        <div className={`p-3 rounded-circle d-flex align-items-center justify-content-center ${isTotal ? 'bg-white bg-opacity-25' : 'bg-light text-primary'}`} style={{ width: '56px', height: '56px' }}>
          {React.isValidElement(icon)
            ? React.cloneElement(icon as React.ReactElement<{ size?: number }>, { size: 28 })
            : icon}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
