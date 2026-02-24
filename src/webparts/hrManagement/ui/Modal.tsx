
import * as React from 'react';
import './Modal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  scrollable?: boolean;
  createdInfo?: string;
  modifiedInfo?: string;
  onVersionHistoryClick?: () => void;
  onOpenFormClick?: () => void;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  scrollable = true,
  createdInfo,
  modifiedInfo,
  onVersionHistoryClick,
  onOpenFormClick,
}) => {
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
  const dialogScrollableClass = scrollable ? 'modal-dialog-scrollable' : '';
  const bodyClass = scrollable ? 'hr-modal-body' : 'hr-modal-body hr-modal-body--auto';
  const showMetaRow = !!(String(createdInfo || '').trim() || String(modifiedInfo || '').trim());

  return (
    <div className="hr-modal-backdrop">
      <div
        className={`hr-modal ${dialogSizeClass}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`modal-dialog modal-dialog-centered ${dialogScrollableClass} hr-modal-dialog`}>
          <div className="modal-content hr-modal-content">
            <div className="modal-header hr-modal-header">
              <h5 className="modal-title hr-modal-title">{title}</h5>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
            </div>
            <div className={bodyClass}>
              {children}
            </div>
            {footer && (
              <div className={`modal-footer hr-modal-footer gap-2 ${showMetaRow ? 'hr-modal-footer--with-meta' : ''}`}>
                {showMetaRow ? (
                  <>
                    <div className="hr-modal-footer-meta">
                      <div className="hr-modal-meta-line">Created {createdInfo}</div>
                      <div className="hr-modal-meta-line">Last modified {modifiedInfo}</div>
                      <button
                        type="button"
                        className="btn btn-link p-0 hr-modal-meta-link"
                        onClick={onVersionHistoryClick}
                      >
                        Version History
                      </button>
                    </div>
                    <div className="hr-modal-footer-right">
                      <button
                        type="button"
                        className="btn btn-link p-0 hr-modal-meta-link hr-modal-footer-open-link"
                        onClick={onOpenFormClick}
                      >
                        Open Out-Of-The-Box Form
                      </button>
                      <div className="hr-modal-footer-actions">
                        {footer}
                      </div>
                    </div>
                  </>
                ) : (
                  footer
                )}
              </div>
            )}
            {!footer && showMetaRow && (
              <div className="hr-modal-meta-row">
                <div className="hr-modal-meta-left">
                  <div className="hr-modal-meta-line">Created {createdInfo}</div>
                  <div className="hr-modal-meta-line">Last modified {modifiedInfo}</div>
                  <button
                    type="button"
                    className="btn btn-link p-0 hr-modal-meta-link"
                    onClick={onVersionHistoryClick}
                  >
                    Version History
                  </button>
                </div>
                <button
                  type="button"
                  className="btn btn-link p-0 hr-modal-meta-link"
                  onClick={onOpenFormClick}
                >
                  Open Out-Of-The-Box Form
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal;
