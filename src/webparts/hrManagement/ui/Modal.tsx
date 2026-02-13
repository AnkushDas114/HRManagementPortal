
import * as React from 'react';
import './Modal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, size = 'md' }) => {
  React.useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => document.body.classList.remove('modal-open');
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const dialogSizeClass = size === 'sm' ? 'hr-modal-dialog--sm' : size === 'lg' ? 'hr-modal-dialog--lg' : '';

  return (
    <div className="hr-modal-backdrop" onClick={onClose}>
      <div
        className={`hr-modal ${dialogSizeClass}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable hr-modal-dialog">
          <div className="modal-content hr-modal-content">
            <div className="modal-header hr-modal-header">
              <h5 className="modal-title hr-modal-title">{title}</h5>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
            </div>
            <div className="modal-body hr-modal-body">
              {children}
            </div>
            {footer && (
              <div className="modal-footer hr-modal-footer">
                {footer}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal;
