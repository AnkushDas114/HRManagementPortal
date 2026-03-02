import * as React from 'react';
import { Employee, UserRole } from '../types';
import { Mail, Briefcase, Calendar, ShieldCheck, Edit2, Eye, EyeOff, Landmark, Wallet } from 'lucide-react';
import { formatAuditInfo, formatDateForDisplayIST } from '../utils/dateTime';
import { SPFI } from '@pnp/sp';
import { clearEmployeeProfileImage, getImageLibraryFolders, getImagesByFolder, ProfileGalleryImage, replaceEmployeeProfileImage, SPFolder, updateEmployee } from '../services/EmployeeService';
import Modal from '../ui/Modal';
import { openOutOfBoxListItemForm } from '../utils/sharePointForm';
import { showAlert } from '../ui/CustomAlert';

interface ProfileProps {
  user: Employee;
  role: UserRole;
  sp: SPFI;
  onBack: () => void;
  onUpdate: () => Promise<void>;
  onOpenVersionHistory?: (itemId: number) => void;
}

interface ProfileFormData {
  name?: string;
  id?: string;
  email?: string;
  department?: string;
  position?: string;
  joiningDate?: string;
  phone?: string;
  location?: string;
  reportingManager?: string;
  pan?: string;
  uan?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
}

const Profile: React.FC<ProfileProps> = ({ user, role, sp, onBack, onUpdate, onOpenVersionHistory }) => {
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isSensitiveDataVisible, setIsSensitiveDataVisible] = React.useState(false);
  const [employeeModalTab, setEmployeeModalTab] = React.useState<'professional' | 'banking' | 'image'>('professional');
  const [profileUploadFile, setProfileUploadFile] = React.useState<File | null>(null);
  const [profilePreviewUrl, setProfilePreviewUrl] = React.useState<string>('');
  const [selectedGalleryImageUrl, setSelectedGalleryImageUrl] = React.useState<string>('');
  const [removeProfileImage, setRemoveProfileImage] = React.useState(false);
  const [profileImageFolders, setProfileImageFolders] = React.useState<SPFolder[]>([]);
  const [selectedProfileFolder, setSelectedProfileFolder] = React.useState<SPFolder | null>(null);
  const [profileFolderImages, setProfileFolderImages] = React.useState<ProfileGalleryImage[]>([]);
  const [isLoadingProfileFolders, setIsLoadingProfileFolders] = React.useState(false);
  const [isLoadingFolderImages, setIsLoadingFolderImages] = React.useState(false);
  const selectedProfileFolderRef = React.useRef<SPFolder | null>(null);

  const [formData, setFormData] = React.useState<ProfileFormData>({
    name: '',
    id: '',
    email: '',
    department: '',
    position: '',
    joiningDate: '',
    pan: '',
    uan: '',
    bankName: '',
    accountNumber: '',
    ifscCode: ''
  });

  React.useEffect(() => {
    setFormData({
      name: user.name || '',
      id: user.id || '',
      email: user.email || '',
      department: user.department || '',
      position: user.position || '',
      joiningDate: user.joiningDate || '',
      phone: user.phone || '',
      location: user.location || '',
      reportingManager: user.reportingManager || '',
      pan: user.pan || '',
      uan: user.uan || '',
      bankName: user.bankName || '',
      accountNumber: user.accountNumber || '',
      ifscCode: user.ifscCode || ''
    });
    setProfileUploadFile(null);
    setProfilePreviewUrl('');
    setSelectedGalleryImageUrl('');
    setRemoveProfileImage(false);
    setEmployeeModalTab('professional');
    setIsSensitiveDataVisible(false);
  }, [user]);

  React.useEffect(() => {
    if (!profileUploadFile) {
      setProfilePreviewUrl('');
      return;
    }
    const objectUrl = URL.createObjectURL(profileUploadFile);
    setProfilePreviewUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [profileUploadFile]);

  const loadImagesForFolder = React.useCallback(async (folder: SPFolder): Promise<void> => {
    setIsLoadingFolderImages(true);
    setSelectedProfileFolder(folder);
    try {
      const webInfo = await sp.web.select('Url')();
      const siteUrl = String((webInfo as { Url?: string })?.Url || window.location.href);
      const images = await getImagesByFolder(sp, siteUrl, folder.ServerRelativeUrl);
      const mapped: ProfileGalleryImage[] = images.map((image) => ({
        folder: folder.Name,
        name: image.fileName,
        url: image.serverRelativeUrl
      }));
      setProfileFolderImages(mapped);
    } catch (error) {
      console.error(`Failed to load images for folder ${folder.Name}`, error);
      setProfileFolderImages([]);
    } finally {
      setIsLoadingFolderImages(false);
    }
  }, [sp]);

  const loadProfileImageFolders = React.useCallback(async (): Promise<void> => {
    setIsLoadingProfileFolders(true);
    try {
      const webInfo = await sp.web.select('Url')();
      const siteUrl = String((webInfo as { Url?: string })?.Url || window.location.href);
      const folders = await getImageLibraryFolders(sp, siteUrl);
      setProfileImageFolders(folders);

      if (!folders.length) {
        setSelectedProfileFolder(null);
        setProfileFolderImages([]);
        return;
      }

      const selected = selectedProfileFolderRef.current
        ? folders.find((folder) => folder.ServerRelativeUrl === selectedProfileFolderRef.current?.ServerRelativeUrl) || folders[0]
        : folders[0];

      await loadImagesForFolder(selected);
    } catch (error) {
      console.error('Failed to load image library folders', error);
      setProfileImageFolders([]);
      setSelectedProfileFolder(null);
      setProfileFolderImages([]);
    } finally {
      setIsLoadingProfileFolders(false);
    }
  }, [loadImagesForFolder, sp]);

  React.useEffect(() => {
    selectedProfileFolderRef.current = selectedProfileFolder;
  }, [selectedProfileFolder]);

  React.useEffect(() => {
    if (!isEditModalOpen) return;
    void loadProfileImageFolders();
  }, [isEditModalOpen, loadProfileImageFolders]);

  const handleSave = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!user.itemId) return;

    setIsSaving(true);
    try {
      await updateEmployee(sp, user.itemId, {
        name: formData.name,
        id: formData.id,
        email: formData.email,
        department: formData.department,
        position: formData.position,
        joiningDate: formData.joiningDate,
        phone: formData.phone,
        location: formData.location,
        reportingManager: formData.reportingManager,
        pan: formData.pan,
        uan: formData.uan,
        bankName: formData.bankName,
        accountNumber: formData.accountNumber,
        ifscCode: formData.ifscCode
      });
      if (removeProfileImage) {
        await clearEmployeeProfileImage(sp, user.itemId);
      } else if (selectedGalleryImageUrl) {
        const response = await fetch(selectedGalleryImageUrl);
        const blob = await response.blob();
        const extension = selectedGalleryImageUrl.split('.').pop()?.split('?')[0] || 'jpg';
        const imageName = `profile-${user.itemId}.${extension}`;
        await replaceEmployeeProfileImage(sp, user.itemId, blob, imageName);
      } else if (profileUploadFile) {
        await replaceEmployeeProfileImage(sp, user.itemId, profileUploadFile, profileUploadFile.name);
      }
      await onUpdate();
      setIsEditModalOpen(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      showAlert('Failed to update profile. Please try again.');
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
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 profile-shell">
      <div className="d-flex align-items-center justify-content-between mb-3 profile-shell__header">
        <h1 className="h3 mb-0 profile-shell__title">User Profile</h1>
        <button
          className="btn btn-outline-primary btn-sm d-flex align-items-center gap-2"
          onClick={onBack}
        >
          <Calendar size={16} /> Back to Dashboard
        </button>
      </div>

      <div className="row g-3 profile-shell__grid">
        <div className="col-lg-4">
          <div className="card shadow-sm border-0 text-center p-3 h-100 profile-summary-card">
            <div className="position-relative d-inline-block mx-auto mb-2">
              <img
                src={user.avatar}
                alt={user.name}
                className="rounded-circle border border-4 border-white shadow-sm"
                style={{ width: '108px', height: '108px', objectFit: 'cover' }}
              />
            </div>
            <h3 className="h5 fw-bold mb-1">{displayText(user.name)}</h3>
            <p className="text-muted small mb-2">{displayText(user.department)} Department</p>
            <hr className="my-3" />
            <div className="d-grid gap-2">
              <button
                className="btn btn-primary d-flex align-items-center justify-content-center gap-2 py-2"
                onClick={() => {
                  setEmployeeModalTab('professional');
                  setIsEditModalOpen(true);
                }}
                type="button"
              >
                <Edit2 size={16} /> Edit Profile Data
              </button>
            </div>
          </div>
        </div>

        <div className="col-lg-8">
          <div className="card shadow-sm border-0 p-3 p-md-4 h-100 profile-details-card">
            <h3 className="h5 fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: '#2F5596' }}>
              <ShieldCheck size={20} /> Professional Information
            </h3>

            <div className="row g-3">
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
                    <Briefcase size={18} className="text-muted" />
                  </div>
                  <div>
                    <label className="text-muted small fw-bold text-uppercase d-block mb-1">Designation</label>
                    <span className="fw-medium">{displayText(user.position)}</span>
                  </div>
                </div>
              </div>

              <div className="col-md-6">
                <div className="d-flex align-items-start gap-3">
                  <div className="p-2 rounded bg-light">
                    <Briefcase size={18} className="text-muted" />
                  </div>
                  <div>
                    <label className="text-muted small fw-bold text-uppercase d-block mb-1">Department</label>
                    <span className="fw-medium">{displayText(user.department)}</span>
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

            </div>

            <div className="d-flex align-items-center justify-content-between mt-4 mb-3 flex-wrap gap-2">
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

            <div className="row g-2 g-md-3 mb-3">
              <div className="col-md-6">
                <div className="border rounded p-3 bg-light h-100">
                  <label className="text-muted small fw-bold text-uppercase d-block mb-1">PAN Number</label>
                  <span className="fw-medium">{maskedText(user.pan)}</span>
                </div>
              </div>
              <div className="col-md-6">
                <div className="border rounded p-3 bg-light h-100">
                  <label className="text-muted small fw-bold text-uppercase d-block mb-1">UAN Number</label>
                  <span className="fw-medium">{maskedText(user.uan)}</span>
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

            <h4 className="h6 fw-bold mb-2 d-flex align-items-center gap-2" style={{ color: '#2F5596' }}>
              <Wallet size={16} /> Salary Structure
            </h4>
            <div className="row g-2 g-md-3">
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
        title={`Edit Profile Data - ${displayText(user.name)}`}
        createdInfo={formatAuditInfo(user.createdAt, user.createdByName)}
        modifiedInfo={formatAuditInfo(user.modifiedAt, user.modifiedByName)}
        onVersionHistoryClick={() => {
          if (!user.itemId) return;
          onOpenVersionHistory?.(user.itemId);
        }}
        onOpenFormClick={() => { openOutOfBoxListItemForm(sp, 'EmployeeMaster', user.itemId).catch(() => undefined); }}
        size="lg"
        footer={
          <div className="d-flex justify-content-between align-items-center w-100">
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
          <ul className="nav nav-tabs mb-3">
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${employeeModalTab === 'professional' ? 'active' : ''}`}
                onClick={() => setEmployeeModalTab('professional')}
              >
                PROFESSIONAL DETAILS
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${employeeModalTab === 'banking' ? 'active' : ''}`}
                onClick={() => setEmployeeModalTab('banking')}
              >
                BANKING DETAILS
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${employeeModalTab === 'image' ? 'active' : ''}`}
                onClick={() => setEmployeeModalTab('image')}
              >
                PROFILE IMAGE
              </button>
            </li>
          </ul>

          <div className="row g-3">
            {employeeModalTab === 'professional' && (
              <>
                <h6 className="fw-bold color-primary border-bottom pb-2">Professional Details</h6>
                <div className="col-md-6">
                  <label className="form-label fw-bold">Full Name</label>
                  <input type="text" className="form-control" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-bold">Employee ID</label>
                  <input type="text" className="form-control" value={formData.id || ''} onChange={e => setFormData({ ...formData, id: e.target.value })} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-bold">Email</label>
                  <input type="email" className="form-control" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-bold">Department</label>
                  <select className="form-select" value={formData.department || ''} onChange={e => setFormData({ ...formData, department: e.target.value })} required>
                    <option value="">Select Department</option>
                    <option value="SPFx">SPFx</option>
                    <option value="Design">Design</option>
                    <option value="QA">QA</option>
                    <option value="HR">HR</option>
                    <option value="Finance">Finance</option>
                    <option value="Smalsus Lead">Smalsus Lead</option>
                    <option value="Portfolio Lead">Portfolio Lead</option>
                    <option value="Management">Management</option>
                    <option value="Trainee">Trainee</option>
                    <option value="Project Management Trainee">Project Management Trainee</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-bold">Designation</label>
                  <input type="text" className="form-control" value={formData.position || ''} onChange={e => setFormData({ ...formData, position: e.target.value })} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-bold">Joining Date (DOJ)</label>
                  <input type="date" className="form-control" value={formData.joiningDate || ''} onChange={e => setFormData({ ...formData, joiningDate: e.target.value })} required />
                </div>
              </>
            )}

            {employeeModalTab === 'banking' && (
              <>
                <h6 className="fw-bold color-primary border-bottom pb-2">Banking Details</h6>
                <div className="col-md-6">
                  <label className="form-label fw-bold">PAN Number</label>
                  <input type="text" className="form-control" value={formData.pan || ''} onChange={e => setFormData({ ...formData, pan: e.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-bold">UAN Number</label>
                  <input type="text" className="form-control" value={formData.uan || ''} onChange={e => setFormData({ ...formData, uan: e.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-bold">Bank Name</label>
                  <input type="text" className="form-control" value={formData.bankName || ''} onChange={e => setFormData({ ...formData, bankName: e.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-bold">Account Number</label>
                  <input type="text" className="form-control" value={formData.accountNumber || ''} onChange={e => setFormData({ ...formData, accountNumber: e.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-bold">IFSC Code</label>
                  <input type="text" className="form-control" value={formData.ifscCode || ''} onChange={e => setFormData({ ...formData, ifscCode: e.target.value })} />
                </div>
              </>
            )}

            {employeeModalTab === 'image' && (
              <>
                <h6 className="fw-bold color-primary border-bottom pb-2">Profile Image</h6>
                <div className="col-12 d-flex align-items-center gap-3">
                  <img
                    src={profilePreviewUrl || user.avatar}
                    width="72"
                    height="72"
                    className="rounded-circle border"
                    style={{ objectFit: 'cover' }}
                    alt={displayText(user.name)}
                  />
                  <div>
                    <div className="small text-muted">Current profile image</div>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger mt-1"
                      onClick={() => {
                        setRemoveProfileImage(true);
                        setProfileUploadFile(null);
                        setProfilePreviewUrl('');
                        setSelectedGalleryImageUrl('');
                      }}
                    >
                      Remove Image
                    </button>
                  </div>
                </div>
                <div className="col-12">
                  <label className="form-label fw-bold">Upload New Image</label>
                  <input
                    type="file"
                    className="form-control"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setProfileUploadFile(file);
                      setSelectedGalleryImageUrl('');
                      setRemoveProfileImage(false);
                    }}
                  />
                </div>
                <div className="col-12">
                  <div className="d-flex justify-content-between align-items-center">
                    <label className="form-label fw-bold mb-0">Choose from Gallery Folders</label>
                    <button type="button" className="btn btn-sm color-primary" onClick={() => void loadProfileImageFolders()}>Refresh</button>
                  </div>
                </div>
                <div className="col-12">
                  <div className="row g-3">
                    <div className="col-md-4">
                      <div className="border rounded p-2" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        {isLoadingProfileFolders && <div className="text-muted small p-2">Loading image folders...</div>}
                        {!isLoadingProfileFolders && profileImageFolders.length === 0 && (
                          <div className="text-muted small p-2">No folders found in Images library.</div>
                        )}
                        {profileImageFolders.map((folder) => {
                          const isActive = selectedProfileFolder?.ServerRelativeUrl === folder.ServerRelativeUrl;
                          return (
                            <button
                              type="button"
                              key={folder.ServerRelativeUrl}
                              className={`btn btn-sm w-100 text-start mb-1 ${isActive ? 'btn-primary' : 'btn-light'}`}
                              onClick={() => { loadImagesForFolder(folder).catch(() => undefined); }}
                            >
                              <span>{folder.Name}</span>
                              <span className="float-end">{folder.ItemCount}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="col-md-8">
                      <div className="border rounded p-2" style={{ minHeight: '300px' }}>
                        {selectedProfileFolder && (
                          <div className="small fw-semibold mb-2">Images in "{selectedProfileFolder.Name}"</div>
                        )}
                        {!selectedProfileFolder && (
                          <div className="text-muted small">Select a folder to view images.</div>
                        )}
                        {isLoadingFolderImages && <div className="text-muted small">Loading folder images...</div>}
                        {!isLoadingFolderImages && selectedProfileFolder && profileFolderImages.length === 0 && (
                          <div className="text-muted small">No images found in this folder.</div>
                        )}
                        {!isLoadingFolderImages && profileFolderImages.length > 0 && (
                          <div className="d-flex flex-wrap gap-2">
                            {profileFolderImages.map((image) => {
                              const isSelected = selectedGalleryImageUrl === image.url;
                              return (
                                <button
                                  type="button"
                                  key={`${image.folder}-${image.url}`}
                                  className={`btn p-1 border ${isSelected ? 'border-primary' : 'border-light'}`}
                                  onClick={() => {
                                    setSelectedGalleryImageUrl(image.url);
                                    setProfileUploadFile(null);
                                    setRemoveProfileImage(false);
                                    setProfilePreviewUrl('');
                                  }}
                                  title={image.name}
                                >
                                  <img
                                    src={image.url}
                                    alt={image.name}
                                    width="72"
                                    height="72"
                                    style={{ objectFit: 'cover', borderRadius: 6 }}
                                  />
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Profile;
