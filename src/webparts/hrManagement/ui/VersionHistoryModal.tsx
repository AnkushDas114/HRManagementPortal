import * as React from 'react';
import Modal from './Modal';
import type { VersionHistoryEntry } from '../services/VersionHistoryService';
import { formatDateForDisplayIST, getNowIST } from '../utils/dateTime';
import './VersionHistoryModal.css';

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  entries: VersionHistoryEntry[];
  isLoading?: boolean;
  error?: string;
}

const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  isOpen,
  onClose,
  title,
  entries,
  isLoading = false,
  error
}) => {
  const formatHistoryDateTime = React.useCallback((value: string): string => {
    const date = formatDateForDisplayIST(value, 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const parsed = new Date(value);
    const fallback = getNowIST();
    const source = Number.isNaN(parsed.getTime()) ? fallback : parsed;
    const time = source.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).replace(' ', '');
    return `${date || '-'} ${time}`;
  }, []);

  const splitChange = React.useCallback((change: string): { key: string; value: string } => {
    const normalized = String(change || '').trim();
    if (!normalized) return { key: '', value: '' };
    const firstColon = normalized.indexOf(':');
    if (firstColon <= 0) return { key: normalized, value: '' };
    return {
      key: normalized.slice(0, firstColon).trim(),
      value: normalized.slice(firstColon + 1).trim()
    };
  }, []);

  const body = (
    <div className="version-history-modal">
      {isLoading && <div className="text-muted small px-2 py-2">Loading version history...</div>}
      {!isLoading && error && <div className="alert alert-danger py-2 px-3 mb-0">{error}</div>}
      {!isLoading && !error && entries.length === 0 && <div className="text-muted small px-2 py-2">No version history found for this item.</div>}
      {!isLoading && !error && entries.length > 0 && (
        <div className="table-responsive version-history-table-wrap">
          <table className="table table-sm align-middle mb-0 version-history-table">
            <thead>
              <tr>
                <th style={{ width: '74px' }}>No</th>
                <th>Info</th>
                <th style={{ minWidth: '210px' }}>Modified by</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr key={`${entry.versionLabel}-${entry.modifiedAt}-${index}`}>
                  <td className="version-history-no">{entries.length - index}</td>
                  <td>
                    <div className="version-history-info-cell">
                      {entry.changes.map((change, changeIndex) => {
                        const pair = splitChange(change);
                        if (!pair.key && !pair.value) return null;
                        return (
                          <div className="version-history-info-row" key={`${entry.versionLabel}-${changeIndex}`}>
                            <div className="version-history-info-key">{pair.key || '-'}</div>
                            <div className="version-history-info-value">{pair.value || '-'}</div>
                          </div>
                        );
                      })}
                    </div>
                  </td>
                  <td>
                    <div className="version-history-modified-time">{formatHistoryDateTime(entry.modifiedAt)}</div>
                    <div className="version-history-modified-user">{entry.modifiedBy || '-'}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="lg"
    >
      {body}
    </Modal>
  );
};

export default VersionHistoryModal;
