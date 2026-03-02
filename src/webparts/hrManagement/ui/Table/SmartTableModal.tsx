import React, { useState, useEffect } from 'react';
import Modal from './CentralizedModal';
import { TableSettings } from './TableTypes';
import OrderTypeModal from './OrderTypeModal';

interface SmartTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: TableSettings;
  defaultSettings: TableSettings;
  onOpenDefault: () => void;
  onApply: (settings: TableSettings) => void;
}

const AVAILABLE_ICONS = [
  { id: 'teams', icon: 'bi-microsoft-teams' },
  { id: 'import', icon: 'bi-box-arrow-in-right' },
  { id: 'excel', icon: 'bi-file-earmark-excel' },
  { id: 'print', icon: 'bi-printer' },
  { id: 'expand', icon: 'bi-arrows-angle-expand' },
  { id: 'pencil', icon: 'bi-pencil' },
  { id: 'sort', icon: 'bi-arrow-down-up' }
];

const SmartTableModal: React.FC<SmartTableModalProps> = ({ isOpen, onClose, settings, defaultSettings, onOpenDefault, onApply }) => {
  const [localSettings, setLocalSettings] = useState<TableSettings>(JSON.parse(JSON.stringify(settings)));
  const [orderTypeModalState, setOrderTypeModalState] = useState<{ isOpen: boolean; columnId: string; label: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(JSON.parse(JSON.stringify(settings)));
    }
  }, [isOpen, settings]);

  const handleToggleColumn = (id: string) => {
    setLocalSettings(prev => ({
      ...prev,
      columns: prev.columns.map(col =>
        col.id === id ? { ...col, visible: !col.visible } : col
      )
    }));
  };

  const handleToggleIcon = (iconId: string) => {
    setLocalSettings(prev => {
      const isVisible = prev.visibleIcons.indexOf(iconId) !== -1;
      const nextIcons = isVisible
        ? prev.visibleIcons.filter(i => i !== iconId)
        : [...prev.visibleIcons, iconId];
      return { ...prev, visibleIcons: nextIcons };
    });
  };

  const handleWidthChange = (id: string, width: number) => {
    setLocalSettings(prev => ({
      ...prev,
      columns: prev.columns.map(col =>
        col.id === id ? { ...col, width } : col
      )
    }));
  };

  const handleOpenOrderType = (colId: string, label: string) => {
    setOrderTypeModalState({ isOpen: true, columnId: colId, label });
  };

  const handleSaveOrderType = (order: 'Default' | 'Ascending' | 'Descending') => {
    // In a real app, this might update a column property. For now we just close.
    console.log(`Setting order for column ${orderTypeModalState?.columnId} to ${order}`);
    setOrderTypeModalState(null);
  };

  const header = (
    <div className="d-flex align-items-center justify-content-between w-100 pe-4">
      <span style={{ fontSize: '21px', fontWeight: 600, color: '#1F2937', fontFamily: 'Segoe UI' }}>
        Contact Database - SmartTable Settings
      </span>
      <div className="d-flex align-items-center gap-3">
        <button
          className="btn btn-link p-0 text-decoration-none"
          style={{ color: '#374151', fontWeight: 500, fontSize: '14px' }}
          onClick={onOpenDefault}
        >
          Default Settings
        </button>
        <button
          className="btn btn-link p-0 text-decoration-none d-flex align-items-center"
          style={{ color: '#374151', fontWeight: 500, fontSize: '14px' }}
          onClick={() => setLocalSettings(JSON.parse(JSON.stringify(defaultSettings)))}
        >
          Restore default table <i className="bi bi-info-circle ms-1" style={{ fontSize: '14px' }}></i>
        </button>
      </div>
    </div>
  );

  const footer = (
    <>
      <button className="btn btn-primary btn-save px-4" onClick={() => onApply(localSettings)}>Apply</button>
      <button className="btn btn-default btn-cancel px-4" onClick={onClose}>Cancel</button>
    </>
  );

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={header} size="xl" footer={footer} zIndex={1100} showMeta={false}>
        <div className="smart-settings-container px-1" style={{ fontFamily: 'Segoe UI, sans-serif' }}>

          <div className="section-title mb-2" style={{ fontSize: '15px', fontWeight: 600, color: '#333333' }}>
            Customized Setting
          </div>

          <div className="border rounded bg-white overflow-hidden mb-4 shadow-sm" style={{ borderColor: '#DDDDDD' }}>
            <div className="row g-0 border-bottom" style={{ backgroundColor: '#F4F4F4' }}>
              <div className="col-6 ps-3 py-2 fw-bold border-end" style={{ fontSize: '14px' }}>Table Header</div>
              <div className="col-2 text-center py-2 fw-bold border-end" style={{ fontSize: '14px' }}>Table Height</div>
              <div className="col-4 text-center py-2 fw-bold" style={{ fontSize: '14px' }}>Table Header Icons</div>
            </div>
            <div className="row g-0">
              <div className="col-6 p-3 border-end">
                <div className="d-flex gap-4">
                  <div className="form-check d-flex align-items-center gap-1 mb-0">
                    <input
                      className="form-check-input mt-0"
                      type="checkbox"
                      checked={localSettings.showHeader}
                      onChange={() => setLocalSettings(prev => ({ ...prev, showHeader: !prev.showHeader }))}
                      id="check-showHeader"
                    />
                    <label className="form-check-label" htmlFor="check-showHeader">
                      Show Header <i className="bi bi-info-circle opacity-50 ms-1" style={{ fontSize: '12px' }}></i>
                    </label>
                  </div>
                  <div className="form-check d-flex align-items-center gap-1 mb-0">
                    <input
                      className="form-check-input mt-0"
                      type="checkbox"
                      checked={localSettings.showColumnFilter}
                      onChange={() => setLocalSettings(prev => ({ ...prev, showColumnFilter: !prev.showColumnFilter }))}
                      id="check-showFilter"
                    />
                    <label className="form-check-label" htmlFor="check-showFilter">
                      Show Column Filter
                    </label>
                  </div>
                  <div className="form-check d-flex align-items-center gap-1 mb-0">
                    <input
                      className="form-check-input mt-0"
                      type="checkbox"
                      checked={localSettings.showAdvancedSearch}
                      onChange={() => setLocalSettings(prev => ({ ...prev, showAdvancedSearch: !prev.showAdvancedSearch }))}
                      id="check-showSearch"
                    />
                    <label className="form-check-label" htmlFor="check-showSearch">
                      Show Advanced Search
                    </label>
                  </div>
                </div>
              </div>

              <div className="col-2 p-3 border-end">
                <div className="d-flex justify-content-center gap-3">
                  <div className="form-check d-flex align-items-center gap-1 mb-0">
                    <input
                      className="form-check-input mt-0"
                      type="radio"
                      name="heightMode"
                      checked={localSettings.tableHeight === 'Flexible'}
                      onChange={() => setLocalSettings(prev => ({ ...prev, tableHeight: 'Flexible' }))}
                      id="h-Flexible"
                    />
                    <label className="form-check-label" htmlFor="h-Flexible">Flexible</label>
                  </div>
                  <div className="form-check d-flex align-items-center gap-1 mb-0">
                    <input
                      className="form-check-input mt-0"
                      type="radio"
                      name="heightMode"
                      checked={localSettings.tableHeight === 'Fixed'}
                      onChange={() => setLocalSettings(prev => ({ ...prev, tableHeight: 'Fixed' }))}
                      id="h-Fixed"
                    />
                    <label className="form-check-label" htmlFor="h-Fixed">Fixed</label>
                  </div>
                </div>
              </div>

              <div className="col-4 p-3 d-flex justify-content-center align-items-center">
                <div className="d-flex border rounded bg-white overflow-hidden shadow-sm" style={{ borderColor: '#CCCCCC' }}>
                  {AVAILABLE_ICONS.map((item, idx) => (
                    <div
                      key={item.id}
                      className={`p-1 d-flex align-items-center justify-content-center ${idx !== AVAILABLE_ICONS.length - 1 ? 'border-end' : ''}`}
                      onClick={() => handleToggleIcon(item.id)}
                      style={{
                        cursor: 'pointer',
                        width: '36px',
                        height: '30px',
                        backgroundColor: localSettings.visibleIcons.indexOf(item.id) !== -1 ? '#F4F4F4' : 'white',
                        borderColor: '#DDDDDD'
                      }}
                    >
                      <i className={`bi ${item.icon}`} style={{ fontSize: '16px', color: localSettings.visibleIcons.indexOf(item.id) !== -1 ? '#2F5596' : '#918D8D' }}></i>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="section-title mb-2" style={{ fontSize: '15px', fontWeight: 600 }}>
            Column Settings
          </div>

          <div className="border rounded bg-white overflow-hidden mb-2 shadow-sm" style={{ borderColor: '#DDDDDD' }}>
            <table className="table table-sm mb-0 align-middle" style={{ tableLayout: 'fixed' }}>
              <thead style={{ backgroundColor: '#F4F4F4' }}>
                <tr className="text-dark">
                  <th className="ps-3 py-2 fw-bold" style={{ width: '45%', fontSize: '14px' }}>
                    Columns <i className="bi bi-info-circle opacity-50 ms-1" style={{ fontSize: '12px' }}></i>
                  </th>
                  <th className="text-center py-2 fw-bold" style={{ width: '27.5%', fontSize: '14px' }}>
                    Column Width <i className="bi bi-info-circle opacity-50 ms-1" style={{ fontSize: '12px' }}></i>
                  </th>
                  <th className="text-center py-2 fw-bold" style={{ width: '27.5%', fontSize: '14px' }}>
                    Column Ordering <i className="bi bi-info-circle opacity-50 ms-1" style={{ fontSize: '12px' }}></i>
                  </th>
                </tr>
              </thead>
              <tbody>
                {localSettings.columns.sort((a, b) => a.order - b.order).map((col) => (
                  <tr key={col.id} style={{ borderBottom: '1px solid #DDDDDD' }}>
                    <td className="ps-3 py-2">
                      <div className="d-flex align-items-center gap-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={col.visible}
                          onChange={() => handleToggleColumn(col.id)}
                          id={`col-check-${col.id}`}
                        />
                        <label htmlFor={`col-check-${col.id}`} className="text-dark mb-0" style={{ fontSize: '14px', cursor: 'pointer' }}>{col.label}</label>
                        <i
                          className="bi bi-pencil cursor-pointer opacity-75 ms-1"
                          style={{ color: '#2F5596', fontSize: '12px' }}
                          onClick={() => handleOpenOrderType(col.id, col.label)}
                        ></i>
                      </div>
                    </td>
                    <td className="py-2 border-start">
                      <div className="d-flex justify-content-center gap-2 px-3">
                        <input
                          type="number"
                          className="form-control text-center shadow-none border"
                          style={{ width: '75px', height: '28px', fontSize: '14px' }}
                          value={col.width}
                          onChange={(e) => handleWidthChange(col.id, parseInt(e.target.value) || 0)}
                        />
                        <div
                          className="d-flex align-items-center justify-content-center rounded text-dark fw-bold border"
                          style={{ width: '75px', height: '28px', backgroundColor: '#EBEBEB', borderColor: '#CCCCCC', fontSize: '14px' }}
                        >
                          {col.width}
                        </div>
                      </div>
                    </td>
                    <td className="py-2 border-start">
                      <div className="d-flex justify-content-center gap-2 px-3 align-items-center">
                        <span className="text-muted" style={{ width: '30px', textAlign: 'center', fontSize: '14px' }}>{col.order}</span>
                        <div
                          className="d-flex align-items-center justify-content-center rounded text-dark fw-bold border"
                          style={{ width: '75px', height: '28px', backgroundColor: '#F4F4F4', borderColor: '#DDDDDD', fontSize: '14px' }}
                        >
                          {col.order}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {/* Type Of Order Modal */}
      <OrderTypeModal
        isOpen={orderTypeModalState?.isOpen || false}
        onClose={() => setOrderTypeModalState(null)}
        columnLabel={orderTypeModalState?.label || ''}
        currentOrder="Default"
        onSave={handleSaveOrderType}
      />
    </>
  );
};

export default SmartTableModal;
