import React, { useState, useEffect } from 'react';
import Modal from './CentralizedModal';
import { TableSettings } from './TableTypes';

interface DefaultSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: TableSettings;
  defaultSettings: TableSettings;
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

const DefaultSettingsModal: React.FC<DefaultSettingsModalProps> = ({ isOpen, onClose, settings, defaultSettings, onApply }) => {
  const [localSettings, setLocalSettings] = useState<TableSettings>(JSON.parse(JSON.stringify(defaultSettings)));
  const [overrideType, setOverrideType] = useState<'custom' | 'dont'>('dont');

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(JSON.parse(JSON.stringify(defaultSettings)));
      setOverrideType('dont');
    }
  }, [isOpen, defaultSettings]);

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

  const footer = (
    <>
      <button className="btn btn-primary px-4 py-1" onClick={() => onApply(localSettings)}>Apply</button>
      <button className="btn btn-default px-4 py-1" onClick={onClose}>Cancel</button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="xl" footer={footer} zIndex={1200} showMeta={false}>
      <div className="smart-settings-container px-1" style={{ fontFamily: 'Segoe UI, sans-serif' }}>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h4 className="modal-title m-0" style={{ color: '#1F2937' }}>
            Contact Database - SmartTable Settings
          </h4>
        </div>

        <hr className="my-2 opacity-10" />

        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="m-0 text-secondary" style={{ fontWeight: 600, fontSize: '15px' }}>
            Default Settings
          </h5>
          <div className="d-flex gap-4 align-items-center">
            <div className="form-check d-flex align-items-center gap-2 mb-0">
              <input className="form-check-input mt-0 shadow-none" type="radio" name="overrideRD" id="customORD" checked={overrideType === 'custom'} onChange={() => setOverrideType('custom')} />
              <label className="form-check-label" htmlFor="customORD">Customized settings to override</label>
            </div>
            <div className="form-check d-flex align-items-center gap-2 mb-0">
              <input className="form-check-input mt-0 shadow-none" type="radio" name="overrideRD" id="dontORD" checked={overrideType === 'dont'} onChange={() => setOverrideType('dont')} />
              <label className="form-check-label" htmlFor="dontORD">Don't override</label>
            </div>
          </div>
        </div>

        <div className="border rounded bg-white overflow-hidden mb-4 shadow-sm" style={{ borderColor: '#DDDDDD' }}>
          <div className="row g-0 border-bottom fw-bold" style={{ fontSize: '14px', backgroundColor: '#F4F4F4' }}>
            <div className="col-7 border-end ps-3 py-2 text-dark">Table Header</div>
            <div className="col-2 border-end text-center py-2 text-dark">Table Height</div>
            <div className="col-3 text-center py-2 text-dark">Table Header Icons</div>
          </div>
          <div className="row g-0 align-items-center">
            <div className="col-7 d-flex gap-5 ps-3 border-end py-3">
              <div className="form-check d-flex align-items-center gap-1 mb-0">
                <input className="form-check-input mt-0 shadow-none" type="checkbox" checked={localSettings.showHeader} onChange={() => setLocalSettings({ ...localSettings, showHeader: !localSettings.showHeader })} id="showHeaderD" />
                <label className="form-check-label" htmlFor="showHeaderD">Show Header <i className="bi bi-info-circle" style={{ color: '#2F5596' }}></i></label>
              </div>
              <div className="form-check d-flex align-items-center gap-1 mb-0">
                <input className="form-check-input mt-0 shadow-none" type="checkbox" checked={localSettings.showColumnFilter} onChange={() => setLocalSettings({ ...localSettings, showColumnFilter: !localSettings.showColumnFilter })} id="showFilterD" />
                <label className="form-check-label" htmlFor="showFilterD">Show Column Filter</label>
              </div>
              <div className="form-check d-flex align-items-center gap-1 mb-0">
                <input className="form-check-input mt-0 shadow-none" type="checkbox" checked={localSettings.showAdvancedSearch} onChange={() => setLocalSettings({ ...localSettings, showAdvancedSearch: !localSettings.showAdvancedSearch })} id="showSearchD" />
                <label className="form-check-label" htmlFor="showSearchD">Show Advanced Search</label>
              </div>
            </div>
            <div className="col-2 d-flex justify-content-center gap-4 border-end py-3">
              <div className="form-check d-flex align-items-center gap-1 mb-0">
                <input className="form-check-input mt-0 shadow-none" type="radio" name="heightModeD" checked={localSettings.tableHeight === 'Flexible'} onChange={() => setLocalSettings({ ...localSettings, tableHeight: 'Flexible' })} id="heightFlexD" />
                <label className="form-check-label" htmlFor="heightFlexD">Flexible</label>
              </div>
              <div className="form-check d-flex align-items-center gap-1 mb-0">
                <input className="form-check-input mt-0 shadow-none" type="radio" name="heightModeD" checked={localSettings.tableHeight === 'Fixed'} onChange={() => setLocalSettings({ ...localSettings, tableHeight: 'Fixed' })} id="heightFixedD" />
                <label className="form-check-label" htmlFor="heightFixedD">Fixed</label>
              </div>
            </div>
            <div className="col-3 d-flex justify-content-center py-3">
              <div className="d-flex border rounded bg-white overflow-hidden shadow-sm" style={{ borderColor: '#CCCCCC' }}>
                {AVAILABLE_ICONS.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`p-1 d-flex align-items-center justify-content-center ${idx !== AVAILABLE_ICONS.length - 1 ? 'border-end' : ''}`}
                    onClick={() => handleToggleIcon(item.id)}
                    style={{ cursor: 'pointer', width: '30px', height: '26px', backgroundColor: localSettings.visibleIcons.indexOf(item.id) !== -1 ? '#F4F4F4' : 'white' }}
                  >
                    <i className={`bi ${item.icon}`} style={{ fontSize: '14px', color: '#2F5596' }}></i>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <h5 className="section-title mb-2">Column Settings</h5>

        <div className="border rounded bg-white overflow-hidden mb-2" style={{ borderColor: '#DDDDDD' }}>
          <table className="table table-sm mb-0 align-middle" style={{ tableLayout: 'fixed' }}>
            <thead style={{ backgroundColor: '#F4F4F4' }}>
              <tr className="text-dark">
                <th className="ps-3 py-2 fw-bold" style={{ width: '40%' }}>
                  Columns <i className="bi bi-info-circle ms-1" style={{ color: '#2F5596' }}></i>
                </th>
                <th className="text-center py-2 fw-bold" style={{ width: '30%' }}>
                  Column Width <i className="bi bi-info-circle ms-1" style={{ color: '#2F5596' }}></i>
                </th>
                <th className="text-center py-2 fw-bold" style={{ width: '30%' }}>
                  Column Ordering <i className="bi bi-info-circle ms-1" style={{ color: '#2F5596' }}></i>
                </th>
              </tr>
            </thead>
            <tbody>
              {localSettings.columns.sort((a, b) => a.order - b.order).map((col) => (
                <tr key={col.id} style={{ borderBottom: '1px solid #DDDDDD' }}>
                  <td className="ps-3 py-2">
                    <div className="d-flex align-items-center gap-2">
                      <input className="form-check-input" type="checkbox" checked={col.visible} onChange={() => handleToggleColumn(col.id)} />
                      <span className="text-dark">{col.label} <i className="bi bi-pencil ms-2 cursor-pointer opacity-75" style={{ color: '#2F5596' }}></i></span>
                    </div>
                  </td>
                  <td className="py-2 border-start">
                    <div className="d-flex justify-content-center px-4">
                      <input
                        type="number"
                        className="form-control text-center shadow-none border"
                        style={{ width: '90px', height: '28px' }}
                        value={col.width}
                        onChange={(e) => handleWidthChange(col.id, parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </td>
                  <td className="py-2 border-start text-center">
                    <span className="text-muted">{col.order}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
};

export default DefaultSettingsModal;
