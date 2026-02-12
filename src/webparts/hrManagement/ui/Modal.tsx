
import * as React from 'react';

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

  if (!isOpen) return null;

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }} onClick={onClose}>
      <div className={`modal-dialog modal-dialog-centered modal-dialog-scrollable ${size === 'lg' ? 'modal-lg' : ''}`} style={{ maxWidth: size === 'lg' ? '1200px' : '600px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-content shadow-lg border-0">
          <div className="modal-header border-bottom-0 pt-4 px-4">
            <h5 className="modal-title fw-bold text-primary fs-4">{title}</h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
          </div>
          <div className="modal-body px-4 pb-4">
            {children}
          </div>
          {footer && (
            <div className="modal-footer border-top-0 px-4 pb-4">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Modal;
