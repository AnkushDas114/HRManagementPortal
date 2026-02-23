import React from 'react';
import { ColumnSetting } from './TableTypes';

interface DataTableProps<T> {
  data: T[];
  columns: ColumnSetting[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  isAllSelected: boolean;
  sortKey: string | null;
  sortDirection: 'asc' | 'desc' | null;
  onSort: (key: string) => void;
  filters: Record<string, string>;
  onFilterChange: (key: string, val: string) => void;
  renderCell: (item: T, column: ColumnSetting) => React.ReactNode;
  viewportHeight: number;
  showActionColumn?: boolean;
  onEditClick?: (item: T) => void;
  showColumnFilter: boolean;
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  isAllSelected,
  sortKey,
  sortDirection,
  onSort,
  filters,
  onFilterChange,
  renderCell,
  viewportHeight,
  showActionColumn = false,
  onEditClick,
  showColumnFilter
}: DataTableProps<T>) {
  return (
    <div className="table-wrapper">
      <div 
        style={{ 
          maxHeight: `${viewportHeight}px`, 
          overflow: 'auto', 
          position: 'relative',
          backgroundColor: '#fff' 
        }}
      >
        <table 
          className="table table-hover align-middle mb-0" 
          style={{ 
            width: 'max-content', 
            minWidth: '100%',
            tableLayout: 'fixed',
            borderCollapse: 'separate',
            borderSpacing: 0
          }}
        >
          <thead
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 40,
              background: '#ffffff'
            }}
          >
            <tr style={{ position: 'relative', zIndex: 41, background: '#ffffff' }}>
              <th
                style={{
                  width: '40px',
                  position: 'sticky',
                  top: 0,
                  zIndex: 42,
                  background: '#ffffff'
                }}
                className="text-center"
              >
                <input 
                  type="checkbox" 
                  className="form-check-input" 
                  checked={isAllSelected} 
                  onChange={onToggleSelectAll} 
                />
              </th>
              {columns.map(col => (
                <th
                  key={col.id}
                  style={{
                    width: `${col.width}px`,
                    position: 'sticky',
                    top: 0,
                    zIndex: 42,
                    background: '#ffffff'
                  }}
                >
                  {showColumnFilter ? (
                    <div className="filter-input-group">
                      <input 
                        type="text" 
                        placeholder={col.label}
                        value={filters[col.key] || ''}
                        onChange={(e) => onFilterChange(col.key, e.target.value)}
                        autoComplete="off"
                      />
                      <div className="arrows" onClick={() => onSort(col.key)}>
                        <i className="bi bi-caret-up-fill" style={{color: (sortKey === col.key && sortDirection === 'asc') ? '#2F5596' : '#CCCCCC'}}></i>
                        <i className="bi bi-caret-down-fill" style={{color: (sortKey === col.key && sortDirection === 'desc') ? '#2F5596' : '#CCCCCC'}}></i>
                      </div>
                    </div>
                  ) : (
                    <div className="d-flex align-items-center justify-content-between py-1">
                      <span className="text-truncate">{col.label}</span>
                      <div className="arrows" onClick={() => onSort(col.key)} style={{ display: 'flex', flexDirection: 'column', fontSize: '10px', color: '#CCCCCC', lineHeight: 1, cursor: 'pointer', marginLeft: '4px' }}>
                        <i className="bi bi-caret-up-fill" style={{color: (sortKey === col.key && sortDirection === 'asc') ? '#2F5596' : '#CCCCCC'}}></i>
                        <i className="bi bi-caret-down-fill" style={{color: (sortKey === col.key && sortDirection === 'desc') ? '#2F5596' : '#CCCCCC'}}></i>
                      </div>
                    </div>
                  )}
                </th>
              ))}
              {showActionColumn && (
                <th
                  style={{
                    width: '50px',
                    position: 'sticky',
                    top: 0,
                    zIndex: 42,
                    background: '#ffffff'
                  }}
                />
              )}
            </tr>
          </thead>

          <tbody>
            {data.map(item => (
              <tr 
                key={item.id} 
                className={selectedIds.has(item.id) ? 'selected-row' : ''}
              >
                <td className="text-center" style={{ position: 'relative', zIndex: 1, background: '#fff' }}>
                  <input 
                    type="checkbox" 
                    className="form-check-input" 
                    checked={selectedIds.has(item.id)} 
                    onChange={() => onToggleSelect(item.id)} 
                  />
                </td>
                
                {columns.map(col => (
                  <td key={col.id} className="text-truncate" style={{ position: 'relative', zIndex: 1, background: '#fff' }}>
                    {renderCell(item, col)}
                  </td>
                ))}
                
                {showActionColumn && (
                  <td className="text-center" style={{ position: 'relative', zIndex: 1, background: '#fff' }}>
                    <button 
                      className="btn btn-link p-0 shadow-none border-0" 
                      onClick={() => onEditClick?.(item)}
                    >
                      <i className="bi bi-pencil-square" style={{color: '#2F5596'}}></i>
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={columns.length + (showActionColumn ? 2 : 1)} className="text-center py-5 text-muted">
                  No data found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
