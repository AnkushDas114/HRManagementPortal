
import * as React from 'react';
import { Employee, UserRole } from '../types';
import { Mail, Phone, MapPin, Briefcase, Calendar, ShieldCheck, Edit2 } from 'lucide-react';
import { formatDateForDisplayIST } from '../utils/dateTime';
import { SPFI } from '@pnp/sp';
import { updateEmployee } from '../services/EmployeeService';
import Modal from '../ui/Modal'; // Assuming Modal is available or use internal

interface ProfileProps {
  user: Employee;
  role: UserRole;
  sp: SPFI;
  onBack: () => void;
  onUpdate: () => Promise<void>;
}

const Profile: React.FC<ProfileProps> = ({ user, role, sp, onBack, onUpdate }) => {
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  // Form State
  const [formData, setFormData] = React.useState({
    phone: '',
    location: '',
    reportingManager: ''
  });

  // Initialize form data when user changes
  React.useEffect(() => {
    setFormData({
      phone: user.phone || '',
      location: user.location || '',
      reportingManager: user.reportingManager || ''
    });
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.itemId) return;

    setIsSaving(true);
    try {
      await updateEmployee(sp, user.itemId, {
        phone: formData.phone,
        location: formData.location,
        reportingManager: formData.reportingManager
        // Note: We are only updating these specific fields as per requirement
      });
      await onUpdate(); // Refresh parent data
      setIsEditModalOpen(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

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
        {/* Profile Card */}
        <div className="col-lg-4">
          <div className="card shadow-sm border-0 text-center p-4 h-100">
            <div className="position-relative d-inline-block mx-auto mb-3">
              <img
                src={user.avatar}
                alt={user.name}
                className="rounded-circle border border-4 border-white shadow-sm"
                style={{ width: '120px', height: '120px', objectFit: 'cover' }}
              />
              {/* Avatar edit button - functionality can be expanded later if needed */}
              <button
                className="btn btn-primary btn-sm position-absolute bottom-0 end-0 rounded-circle p-2 d-flex align-items-center justify-content-center shadow"
                style={{ width: '32px', height: '32px', backgroundColor: '#2F5596' }}
                title="Change Avatar (Contact Admin)"
              >
                <Edit2 size={14} />
              </button>
            </div>
            <h3 className="h5 fw-bold mb-1">{user.name}</h3>
            <p className="text-muted small mb-3">{user.department} Department</p>
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
              >
                <Edit2 size={16} /> Edit Profile Details
              </button>
            </div>
          </div>
        </div>

        {/* Details Card */}
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
                    <span className="fw-medium">{user.id}</span>
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
                    <span className="fw-medium">{user.email || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Conditional Rendering for Phone */}
              {user.phone && (
                <div className="col-md-6">
                  <div className="d-flex align-items-start gap-3">
                    <div className="p-2 rounded bg-light">
                      <Phone size={18} className="text-muted" />
                    </div>
                    <div>
                      <label className="text-muted small fw-bold text-uppercase d-block mb-1">Phone Number</label>
                      <span className="fw-medium">{user.phone}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Conditional Rendering for Location */}
              {user.location && (
                <div className="col-md-6">
                  <div className="d-flex align-items-start gap-3">
                    <div className="p-2 rounded bg-light">
                      <MapPin size={18} className="text-muted" />
                    </div>
                    <div>
                      <label className="text-muted small fw-bold text-uppercase d-block mb-1">Location</label>
                      <span className="fw-medium">{user.location}</span>
                    </div>
                  </div>
                </div>
              )}

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

              {/* Conditional Rendering for Reporting Manager */}
              {user.reportingManager && (
                <div className="col-md-6">
                  <div className="d-flex align-items-start gap-3">
                    <div className="p-2 rounded bg-light">
                      <Briefcase size={18} className="text-muted" />
                    </div>
                    <div>
                      <label className="text-muted small fw-bold text-uppercase d-block mb-1">Reporting Manager</label>
                      <span className="fw-medium">{user.reportingManager}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <h3 className="h5 fw-bold mt-5 mb-4 d-flex align-items-center gap-2" style={{ color: '#2F5596' }}>
              <ShieldCheck size={20} /> Bank & Payroll Details
            </h3>
            <div className="row g-4">
              <div className="col-md-6">
                <label className="text-muted small fw-bold text-uppercase d-block mb-1">PAN Number</label>
                <span className="fw-medium">{user.pan || 'N/A'}</span>
              </div>
              <div className="col-md-6">
                <label className="text-muted small fw-bold text-uppercase d-block mb-1">Bank Name</label>
                <span className="fw-medium">{user.bankName || 'N/A'}</span>
              </div>
              <div className="col-md-6">
                <label className="text-muted small fw-bold text-uppercase d-block mb-1">Account Number</label>
                <span className="fw-medium">{user.accountNumber || 'N/A'}</span>
              </div>
              <div className="col-md-6">
                <label className="text-muted small fw-bold text-uppercase d-block mb-1">IFSC Code</label>
                <span className="fw-medium">{user.ifscCode || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Profile Details"
        footer={
          <>
            <button className="btn btn-link text-decoration-none" onClick={() => setIsEditModalOpen(false)}>Cancel</button>
            <button
              type="submit"
              form="edit-profile-form"
              className="btn btn-primary px-4"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        }
      >
        <form id="edit-profile-form" onSubmit={handleSave}>
          <div className="mb-3">
            <label className="form-label fw-bold">Phone Number</label>
            <input
              type="text"
              className="form-control"
              value={formData.phone}
              onChange={e => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+91 XXXXX XXXXX"
            />
          </div>
          <div className="mb-3">
            <label className="form-label fw-bold">Location</label>
            <input
              type="text"
              className="form-control"
              value={formData.location}
              onChange={e => setFormData({ ...formData, location: e.target.value })}
              placeholder="City, Country"
            />
          </div>
          <div className="mb-3">
            <label className="form-label fw-bold">Reporting Manager</label>
            <input
              type="text"
              className="form-control"
              value={formData.reportingManager}
              onChange={e => setFormData({ ...formData, reportingManager: e.target.value })}
              placeholder="Manager Name"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Profile;
