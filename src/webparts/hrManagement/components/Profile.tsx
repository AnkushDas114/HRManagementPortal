import * as React from 'react';
import { Employee, UserRole } from '../types';
import { Mail, Phone, MapPin, Briefcase, Calendar, ShieldCheck, Edit2, Eye, EyeOff, Landmark, Wallet } from 'lucide-react';
import { formatDateForDisplayIST } from '../utils/dateTime';
import { SPFI } from '@pnp/sp';
import { updateEmployee } from '../services/EmployeeService';
import Modal from '../ui/Modal';

interface ProfileProps {
  user: Employee;
  role: UserRole;
  sp: SPFI;
  onBack: () => void;
  onUpdate: () => Promise<void>;
}

interface ProfileFormData {
  phone: string;
  location: string;
  reportingManager: string;
  pan: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
}

const Profile: React.FC<ProfileProps> = ({ user, role, sp, onBack, onUpdate }) => {
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isSensitiveDataVisible, setIsSensitiveDataVisible] = React.useState(false);

  const [formData, setFormData] = React.useState<ProfileFormData>({
    phone: '',
    location: '',
    reportingManager: '',
    pan: '',
    bankName: '',
    accountNumber: '',
    ifscCode: ''
  });

  React.useEffect(() => {
    setFormData({
      phone: user.phone || '',
      location: user.location || '',
      reportingManager: user.reportingManager || '',
      pan: user.pan || '',
      bankName: user.bankName || '',
      accountNumber: user.accountNumber || '',
      ifscCode: user.ifscCode || ''
    });
    setIsSensitiveDataVisible(false);
  }, [user]);

  const handleSave = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!user.itemId) return;

    setIsSaving(true);
    try {
      await updateEmployee(sp, user.itemId, {
        phone: formData.phone,
        location: formData.location,
        reportingManager: formData.reportingManager,
        pan: formData.pan,
        bankName: formData.bankName,
        accountNumber: formData.accountNumber,
        ifscCode: formData.ifscCode
      });
      await onUpdate();
      setIsEditModalOpen(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const displayText = React.useCallback((value?: string): string => {
    const cleaned = String(value || '').trim();
    return cleaned || 'N/A';
  }, []);

  const maskedText = React.useCallback((value?: string): string => {
    const cleaned = String(value || '').trim();
    if (!cleaned) return 'N/A';
    return isSensitiveDataVisible ? cleaned : '********';
  }, [isSensitiveDataVisible]);

  const formatCurrency = React.useCallback((value?: number): string => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(Number(value));
  }, []);

  const salaryText = React.useCallback((value?: number): string => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A';
    return isSensitiveDataVisible ? formatCurrency(value) : '********';
  }, [formatCurrency, isSensitiveDataVisible]);

  const payrollFields = [
    { label: 'Yearly CTC', value: salaryText(user.yearlyCTC) },
    { label: 'Salary Bonus', value: salaryText(user.salaryBonus) },
    { label: 'Salary Insurance', value: salaryText(user.salaryInsurance) },
    { label: 'Employee ESI', value: salaryText(user.employeeESI) },
    { label: 'Employer ESI', value: salaryText(user.employerESI) }
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h1 className="h2 mb-0" style={{ color: '#2F5596' }}>User Profile</h1>
        <button
          className="btn btn-default btn-sm d-flex align-items-center gap-2"
          onClick={onBack}
        >
          <Calendar size={16} /> Back to Dashboard
        </button>
      </div>

      <div className="row g-4">
        <div className="col-lg-4">
          <div className="card shadow-sm border-0 text-center p-4 h-100">
            <div className="position-relative d-inline-block mx-auto mb-3">
              <img
                src={user.avatar}
                alt={user.name}
                className="rounded-circle border border-4 border-white shadow-sm"
                style={{ width: '120px', height: '120px', objectFit: 'cover' }}
              />
              <button
                className="btn btn-primary btn-sm position-absolute bottom-0 end-0 rounded-circle p-2 d-flex align-items-center justify-content-center shadow"
                style={{ width: '32px', height: '32px', backgroundColor: '#2F5596' }}
                title="Change Avatar (Contact Admin)"
                type="button"
              >
                <Edit2 size={14} />
              </button>
            </div>
            <h3 className="h5 fw-bold mb-1">{displayText(user.name)}</h3>
            <p className="text-muted small mb-3">{displayText(user.department)} Department</p>
            <div className="d-flex justify-content-center gap-2 mb-4">
              <span className="badge rounded-pill px-3 py-2" style={{ backgroundColor: '#2F5596', fontSize: '10px' }}>
                {role === UserRole.HR ? 'ADMINISTRATOR' : 'EMPLOYEE'}
              </span>
              <span className="badge rounded-pill px-3 py-2 bg-success text-white" style={{ fontSize: '10px' }}>
                ACTIVE
              </span>
            </div>
            <hr className="my-4" />
            <div className="d-grid gap-2">
              <button
                className="btn btn-primary d-flex align-items-center justify-content-center gap-2 py-2"
                onClick={() => setIsEditModalOpen(true)}
                type="button"
              >
                <Edit2 size={16} /> Edit Profile Details
              </button>
            </div>
          </div>
        </div>

        <div className="col-lg-8">
          <div className="card shadow-sm border-0 p-4 h-100">
            <h3 className="h5 fw-bold mb-4 d-flex align-items-center gap-2" style={{ color: '#2F5596' }}>
              <ShieldCheck size={20} /> Professional Information
            </h3>

            <div className="row g-4">
              <div className="col-md-6">
                <div className="d-flex align-items-start gap-3">
                  <div className="p-2 rounded bg-light">
                    <Briefcase size={18} className="text-muted" />
                  </div>
                  <div>
                    <label className="text-muted small fw-bold text-uppercase d-block mb-1">Employee ID</label>
                    <span className="fw-medium">{displayText(user.id)}</span>
                  </div>
                </div>
              </div>

              <div className="col-md-6">
                <div className="d-flex align-items-start gap-3">
                  <div className="p-2 rounded bg-light">
                    <Mail size={18} className="text-muted" />
                  </div>
                  <div>
                    <label className="text-muted small fw-bold text-uppercase d-block mb-1">Email Address</label>
                    <span className="fw-medium">{displayText(user.email)}</span>
                  </div>
                </div>
              </div>

              <div className="col-md-6">
                <div className="d-flex align-items-start gap-3">
                  <div className="p-2 rounded bg-light">
                    <Phone size={18} className="text-muted" />
                  </div>
                  <div>
                    <label className="text-muted small fw-bold text-uppercase d-block mb-1">Phone Number</label>
                    <span className="fw-medium">{displayText(user.phone)}</span>
                  </div>
                </div>
              </div>

              <div className="col-md-6">
                <div className="d-flex align-items-start gap-3">
                  <div className="p-2 rounded bg-light">
                    <MapPin size={18} className="text-muted" />
                  </div>
                  <div>
                    <label className="text-muted small fw-bold text-uppercase d-block mb-1">Location</label>
                    <span className="fw-medium">{displayText(user.location)}</span>
                  </div>
                </div>
              </div>

              <div className="col-md-6">
                <div className="d-flex align-items-start gap-3">
                  <div className="p-2 rounded bg-light">
                    <Calendar size={18} className="text-muted" />
                  </div>
                  <div>
                    <label className="text-muted small fw-bold text-uppercase d-block mb-1">Joining Date</label>
                    <span className="fw-medium">{user.joiningDate ? formatDateForDisplayIST(user.joiningDate, 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="col-md-6">
                <div className="d-flex align-items-start gap-3">
                  <div className="p-2 rounded bg-light">
                    <Briefcase size={18} className="text-muted" />
                  </div>
                  <div>
                    <label className="text-muted small fw-bold text-uppercase d-block mb-1">Reporting Manager</label>
                    <span className="fw-medium">{displayText(user.reportingManager)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="d-flex align-items-center justify-content-between mt-5 mb-4 flex-wrap gap-2">
              <h3 className="h5 fw-bold mb-0 d-flex align-items-center gap-2" style={{ color: '#2F5596' }}>
                <Landmark size={20} /> Bank & Payroll Details
              </h3>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm d-flex align-items-center gap-2"
                onClick={() => setIsSensitiveDataVisible((prev) => !prev)}
              >
                {isSensitiveDataVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                {isSensitiveDataVisible ? 'Hide Salary Data' : 'Show Salary Data'}
              </button>
            </div>

            <div className="row g-3 mb-4">
              <div className="col-md-6">
                <div className="border rounded p-3 bg-light h-100">
                  <label className="text-muted small fw-bold text-uppercase d-block mb-1">PAN Number</label>
                  <span className="fw-medium">{maskedText(user.pan)}</span>
                </div>
              </div>
              <div className="col-md-6">
                <div className="border rounded p-3 bg-light h-100">
                  <label className="text-muted small fw-bold text-uppercase d-block mb-1">Bank Name</label>
                  <span className="fw-medium">{maskedText(user.bankName)}</span>
                </div>
              </div>
              <div className="col-md-6">
                <div className="border rounded p-3 bg-light h-100">
                  <label className="text-muted small fw-bold text-uppercase d-block mb-1">Account Number</label>
                  <span className="fw-medium">{maskedText(user.accountNumber)}</span>
                </div>
              </div>
              <div className="col-md-6">
                <div className="border rounded p-3 bg-light h-100">
                  <label className="text-muted small fw-bold text-uppercase d-block mb-1">IFSC Code</label>
                  <span className="fw-medium">{maskedText(user.ifscCode)}</span>
                </div>
              </div>
            </div>

            <h4 className="h6 fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: '#2F5596' }}>
              <Wallet size={16} /> Salary Structure
            </h4>
            <div className="row g-3">
              {payrollFields.map((field) => (
                <div className="col-md-4" key={field.label}>
                  <div className="border rounded p-3 h-100">
                    <label className="text-muted small fw-bold text-uppercase d-block mb-1">{field.label}</label>
                    <span className="fw-semibold">{field.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Profile Details"
        size="lg"
        footer={
          <div className="d-flex justify-content-between align-items-center w-100">
            <span className="small text-muted">Update details for {displayText(user.name)}</span>
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-outline-secondary" onClick={() => setIsEditModalOpen(false)}>Cancel</button>
              <button
                type="submit"
                form="edit-profile-form"
                className="btn btn-primary px-4"
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        }
      >
        <form id="edit-profile-form" onSubmit={handleSave}>
          <div className="row g-4">
            <div className="col-md-6">
              <div className="border rounded p-3 h-100">
                <h6 className="fw-bold mb-3" style={{ color: '#2F5596' }}>Contact Details</h6>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Phone Number</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 XXXXX XXXXX"
                  />
                </div>
                <div>
                  <label className="form-label fw-semibold">Location</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                    placeholder="City, Country"
                  />
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div className="border rounded p-3 h-100">
                <h6 className="fw-bold mb-3" style={{ color: '#2F5596' }}>Reporting & Bank Details</h6>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Reporting Manager</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.reportingManager}
                    onChange={e => setFormData({ ...formData, reportingManager: e.target.value })}
                    placeholder="Manager Name"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">PAN Number</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.pan}
                    onChange={e => setFormData({ ...formData, pan: e.target.value })}
                    placeholder="Enter PAN"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Bank Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.bankName}
                    onChange={e => setFormData({ ...formData, bankName: e.target.value })}
                    placeholder="Enter bank name"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Account Number</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.accountNumber}
                    onChange={e => setFormData({ ...formData, accountNumber: e.target.value })}
                    placeholder="Enter account number"
                  />
                </div>
                <div>
                  <label className="form-label fw-semibold">IFSC Code</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.ifscCode}
                    onChange={e => setFormData({ ...formData, ifscCode: e.target.value })}
                    placeholder="Enter IFSC code"
                  />
                </div>
              </div>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Profile;
