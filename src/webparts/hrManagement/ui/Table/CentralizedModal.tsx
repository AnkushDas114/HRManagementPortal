import React, { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string | ReactNode;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: ReactNode;
  zIndex?: number;
  createdInfo?: string;
  modifiedInfo?: string;
  onVersionHistoryClick?: () => void;
  onOpenFormClick?: () => void;
  showMeta?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  footer,
  zIndex = 1050,
  createdInfo,
  modifiedInfo,
  onVersionHistoryClick,
  onOpenFormClick,
  showMeta = true
}) => {
  if (!isOpen) return null;
  const showMetaRow = showMeta && !!(String(createdInfo || '').trim() || String(modifiedInfo || '').trim());

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)', zIndex }}>
      <div className={`modal-dialog modal-dialog-centered modal-${size} modal-dialog-scrollable`}>
        <div className="modal-content shadow-lg border-0" style={{ borderRadius: '4px', overflow: 'hidden' }}>
          {/* Header: Fixed, White, 1px Border Bottom, Padding 16px V / 20-24px H */}
          <div className="modal-header bg-white border-bottom align-items-center" style={{ padding: '16px 24px', borderColor: '#DDDDDD' }}>
            <div className="modal-title flex-grow-1" style={{ fontSize: '21px', fontWeight: 600, color: '#2F5596', fontFamily: 'Segoe UI' }}>
              {title}
            </div>
            <div className="d-flex align-items-center gap-3">
              <i className="bi bi-list fs-5 cursor-pointer" style={{ color: '#333333' }}></i>
              <button 
                type="button" 
                className="btn-close shadow-none border-0 p-0" 
                onClick={onClose} 
                aria-label="Close"
                style={{ background: 'none', fontSize: '20px' }}
              >
                <i className="bi bi-x-lg" style={{ color: '#333333' }}></i>
              </button>
            </div>
          </div>

          {/* Body: Scrollable, Background White, Page doesn't scroll */}
          <div className="modal-body bg-white" style={{ padding: '20px 24px', overflowY: 'auto' }}>
            {children}
          </div>

          {footer && (
            <div
              className={`modal-footer bg-white border-top d-flex align-items-center ${showMetaRow ? 'justify-content-between' : 'justify-content-end'}`}
              style={{ padding: '12px 16px', borderColor: '#DDDDDD', gap: '12px', flexWrap: 'nowrap' }}
            >
              {showMetaRow ? (
                <>
                  <div className="d-flex flex-column align-items-start" style={{ gap: '2px', flex: '1 1 auto', minWidth: 0 }}>
                    <div style={{ fontSize: '13px', color: '#5F728A' }}>Created {createdInfo}</div>
                    <div style={{ fontSize: '13px', color: '#5F728A' }}>Last modified {modifiedInfo}</div>
                    <button
                      type="button"
                      className="btn btn-link p-0 text-decoration-none"
                      style={{ color: '#2F5596', fontSize: '14px', lineHeight: '1.2' }}
                      onClick={onVersionHistoryClick}
                    >
                      Version History
                    </button>
                  </div>
                  <div className="d-flex align-items-center" style={{ gap: '12px', marginLeft: 'auto', flex: '0 0 auto' }}>
                    <button
                      type="button"
                      className="btn btn-link p-0 text-decoration-none"
                      style={{ color: '#2F5596', whiteSpace: 'nowrap' }}
                      onClick={onOpenFormClick}
                    >
                      Open Out-Of-The-Box Form
                    </button>
                    <div className="d-flex align-items-center" style={{ gap: '12px' }}>
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
            <div className="bg-white border-top d-flex justify-content-between align-items-center" style={{ padding: '12px 16px', borderColor: '#DDDDDD', gap: '12px' }}>
              <div className="d-flex flex-column align-items-start gap-1">
                <div style={{ fontSize: '13px', color: '#5F728A' }}>Created {createdInfo}</div>
                <div style={{ fontSize: '13px', color: '#5F728A' }}>Last modified {modifiedInfo}</div>
                <button
                  type="button"
                  className="btn btn-link p-0 text-decoration-none"
                  style={{ color: '#2F5596' }}
                  onClick={onVersionHistoryClick}
                >
                  Version History
                </button>
              </div>
              <button
                type="button"
                className="btn btn-link p-0 text-decoration-none"
                style={{ color: '#2F5596' }}
                onClick={onOpenFormClick}
              >
                Open Out-Of-The-Box Form
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Modal;
