
import React, { useState, useEffect } from 'react';
import Modal from './CentralizedModal';

interface AdvancedSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFields: string[];
  onApply: (fields: string[]) => void;
}

const AdvancedSearchModal: React.FC<AdvancedSearchModalProps> = ({ isOpen, onClose, selectedFields, onApply }) => {
  const [localFields, setLocalFields] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) setLocalFields([...selectedFields]);
  }, [isOpen, selectedFields]);

  const fields = ['Name', 'Email Address', 'Organization', 'Department', 'Position', 'Site', 'Type Of Contact', 'All content'];

  const handleToggle = (f: string) => {
    setLocalFields(prev => prev.indexOf(f) !== -1 ? prev.filter(item => item !== f) : [...prev, f]);
  };

  const footer = (
    <div className="d-flex justify-content-center gap-2 w-100 py-1">
      <button className="btn btn-primary px-4 py-1" style={{ backgroundColor: '#2b579a', border: 'none', borderRadius: '4px' }} onClick={() => onApply(localFields)}>Apply Fields</button>
      <button className="btn btn-outline-primary px-4 py-1 bg-white" onClick={onClose}>Cancel</button>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configure Advanced Search" size="md" footer={footer} zIndex={1150} showMeta={false}>
      <div className="p-2">
        <p className="small text-muted mb-3">Select the fields to include in the global search functionality:</p>
        {fields.map(f => (
          <div key={f} className="form-check mb-2">
            <input className="form-check-input" type="checkbox" checked={localFields.indexOf(f) !== -1} onChange={() => handleToggle(f)} id={`adv-${f}`} />
            <label className="form-check-label small" htmlFor={`adv-${f}`}>{f}</label>
          </div>
        ))}
      </div>
    </Modal>
  );
};

export default AdvancedSearchModal;
