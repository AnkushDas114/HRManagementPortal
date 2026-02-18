import * as React from 'react';
import { Settings2 } from 'lucide-react';
import Modal from './Modal';
import { formatDateForDisplayIST } from '../utils/dateTime';
import './CommonTable.css';

type Align = 'start' | 'center' | 'end';

export interface ColumnDef<T> {
  key: string;
  header: string;
  accessor?: (row: T) => unknown;
  render?: (row: T) => React.ReactNode;
  width?: number | string;
  align?: Align;
  filterable?: boolean;
  searchable?: boolean;
}

export type SearchMode = 'all' | 'any' | 'exact';

interface CommonTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  getRowId?: (row: T, index: number) => string | number;
  showHeader?: boolean;
  showColumnFilters?: boolean;
  enableGlobalSearch?: boolean;
  globalSearchPlaceholder?: string;
  compact?: boolean;
  headerActions?: React.ReactNode;
  enableRowSelection?: boolean;
}

const normalize = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return formatDateForDisplayIST(value);
  return String(value);
};

const matchesSearch = (text: string, query: string, mode: SearchMode): boolean => {
  if (!query) return true;
  const hay = text.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return true;

  if (mode === 'exact') {
    return hay.includes(q);
  }

  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  if (mode === 'all') {
    return tokens.every(t => hay.includes(t));
  }
  return tokens.some(t => hay.includes(t));
};

const CommonTable = <T,>({
  data,
  columns,
  getRowId,
  showHeader = true,
  showColumnFilters = true,
  enableGlobalSearch = true,
  globalSearchPlaceholder = 'Search',
  compact = false,
  headerActions,
  enableRowSelection = false,
}: CommonTableProps<T>): JSX.Element => {
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [searchMode, setSearchMode] = React.useState<SearchMode>('all');
  const [globalQuery, setGlobalQuery] = React.useState('');
  const [columnFilters, setColumnFilters] = React.useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = React.useState<Record<string, boolean>>({});

  const [headerVisible, setHeaderVisible] = React.useState(showHeader);
  const [filtersVisible, setFiltersVisible] = React.useState(showColumnFilters);
  const [searchVisible, setSearchVisible] = React.useState(enableGlobalSearch);

  type ColumnConfig = {
    key: string;
    header: string;
    visible: boolean;
    width?: number | string;
    order: number;
  };

  const [columnConfig, setColumnConfig] = React.useState<ColumnConfig[]>(() =>
    columns.map((col, index) => ({
      key: col.key,
      header: col.header,
      visible: true,
      width: col.width,
      order: index + 1,
    }))
  );

  const [draftConfig, setDraftConfig] = React.useState<ColumnConfig[]>(columnConfig);
  const [draftHeaderVisible, setDraftHeaderVisible] = React.useState(headerVisible);
  const [draftFiltersVisible, setDraftFiltersVisible] = React.useState(filtersVisible);
  const [draftSearchVisible, setDraftSearchVisible] = React.useState(searchVisible);

  React.useEffect(() => {
    setHeaderVisible(showHeader);
    setFiltersVisible(showColumnFilters);
    setSearchVisible(enableGlobalSearch);
  }, [showHeader, showColumnFilters, enableGlobalSearch]);

  React.useEffect(() => {
    setColumnConfig((prev) => {
      const next: ColumnConfig[] = columns.map((col, index) => {
        const existing = prev.find(p => p.key === col.key);
        return {
          key: col.key,
          header: col.header,
          visible: existing ? existing.visible : true,
          width: existing?.width ?? col.width,
          order: existing?.order ?? index + 1,
        };
      });
      return next;
    });
  }, [columns]);

  const openSettings = () => {
    setDraftConfig(columnConfig.map(c => ({ ...c })));
    setDraftHeaderVisible(headerVisible);
    setDraftFiltersVisible(filtersVisible);
    setDraftSearchVisible(searchVisible);
    setIsSettingsOpen(true);
  };

  const applySettings = () => {
    setColumnConfig(draftConfig.map(c => ({ ...c })));
    setHeaderVisible(draftHeaderVisible);
    setFiltersVisible(draftFiltersVisible);
    setSearchVisible(draftSearchVisible);
    setIsSettingsOpen(false);
  };

  const sortedColumns = React.useMemo(() => {
    const configMap = new Map(columnConfig.map(c => [c.key, c]));
    return columns
      .map(col => {
        const cfg = configMap.get(col.key);
        return {
          col,
          cfg,
        };
      })
      .filter(({ cfg }) => cfg?.visible !== false)
      .sort((a, b) => (a.cfg?.order ?? 0) - (b.cfg?.order ?? 0))
      .map(({ col, cfg }) => ({ ...col, width: cfg?.width ?? col.width }));
  }, [columns, columnConfig]);

  const filtered = React.useMemo(() => {
    const searchableColumns = sortedColumns.filter(c => c.searchable !== false);
    const filterableColumns = sortedColumns.filter(c => c.filterable !== false);

    return data.filter((row) => {
      const perColumnOk = filterableColumns.every(col => {
        const filterValue = (columnFilters[col.key] || '').trim();
        if (!filterValue) return true;
        const cell = col.accessor ? col.accessor(row) : (row as Record<string, unknown>)[col.key];
        return normalize(cell).toLowerCase().includes(filterValue.toLowerCase());
      });
      if (!perColumnOk) return false;

      if (!searchVisible) return true;
      if (!globalQuery.trim()) return true;

      const combined = searchableColumns
        .map(col => {
          const cell = col.accessor ? col.accessor(row) : (row as Record<string, unknown>)[col.key];
          return normalize(cell);
        })
        .join(' ');

      return matchesSearch(combined, globalQuery, searchMode);
    });
  }, [data, sortedColumns, columnFilters, globalQuery, searchMode, searchVisible]);

  return (
    <div className="common-table">
      {searchVisible && (
        <div className="common-table__toolbar">
          <div className="common-table__count">Showing {filtered.length} of {data.length}</div>
          <div className="common-table__search">
            <div className="input-group input-group-sm common-table__search-group">
              {/* <span className="input-group-text">Search</span> */}
              <input
                type="text"
                className="form-control"
                placeholder={globalSearchPlaceholder}
                value={globalQuery}
                onChange={e => setGlobalQuery(e.target.value)}
              />
            </div>
            <button type="button" className="btn btn-light btn-sm common-table__icon-btn" aria-label="Settings" onClick={openSettings}>
              <Settings2 size={20} strokeWidth={2.3} className="common-table__icon-svg" />
            </button>
            <select
              className="form-select form-select-sm common-table__mode"
              value={searchMode}
              onChange={e => setSearchMode(e.target.value as SearchMode)}
            >
              <option value="all">All Words</option>
              <option value="any">Any Words</option>
              <option value="exact">Exact Phrase</option>
            </select>
          </div>
          <div className="common-table__actions">{headerActions}</div>
        </div>
      )}

      <div className="table-responsive common-table__responsive">
        <table className={`table table-hover align-middle mb-0 ${compact ? 'table-sm' : ''}`}>
          {headerVisible && (
            <thead className="table-light">
              <tr>
                {enableRowSelection && (
                  <th style={{ width: 36 }} className="text-center">
                    <input
                      type="checkbox"
                      className="form-check-input common-table__checkbox"
                      checked={filtered.length > 0 && filtered.every((row, idx) => selectedIds[String(getRowId ? getRowId(row, idx) : idx)])}
                      onChange={(e) => {
                        const next: Record<string, boolean> = {};
                        if (e.target.checked) {
                          filtered.forEach((row, idx) => {
                            next[String(getRowId ? getRowId(row, idx) : idx)] = true;
                          });
                        }
                        setSelectedIds(next);
                      }}
                    />
                  </th>
                )}
                {sortedColumns.map(col => (
                  <th
                    key={col.key}
                    style={{ width: col.width }}
                    className={`${col.align ? `text-${col.align}` : ''} common-table__head-cell`.trim()}
                  >
                    <div className="fw-bold small common-table__header-label">{col.header}</div>
                    {filtersVisible && col.filterable !== false && (
                      <input
                        type="text"
                        className="form-control form-control-sm mt-1 common-table__filter"
                        value={columnFilters[col.key] || ''}
                        onChange={e => setColumnFilters(prev => ({ ...prev, [col.key]: e.target.value }))}
                        placeholder={col.header}
                      />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {filtered.map((row, index) => {
              const rowKey = getRowId ? getRowId(row, index) : index;
              return (
                <tr key={rowKey}>
                  {enableRowSelection && (
                    <td className="text-center">
                      <input
                        type="checkbox"
                        className="form-check-input common-table__checkbox"
                        checked={!!selectedIds[String(rowKey)]}
                        onChange={(e) => setSelectedIds(prev => ({ ...prev, [String(rowKey)]: e.target.checked }))}
                      />
                    </td>
                  )}
                  {sortedColumns.map(col => (
                    <td key={col.key} className={`${col.align ? `text-${col.align}` : ''} common-table__cell`.trim()}>
                      {col.render ? col.render(row) : normalize(col.accessor ? col.accessor(row) : (row as Record<string, unknown>)[col.key])}
                    </td>
                  ))}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={sortedColumns.length + (enableRowSelection ? 1 : 0)} className="text-center text-muted py-4">
                  No data found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="Common Table Settings"
        size="lg"
        footer={
          <div className="d-flex justify-content-end gap-2 w-100">
            <button className="btn btn-outline-secondary" onClick={() => setIsSettingsOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={applySettings}>Apply</button>
          </div>
        }
      >
        <div className="common-table-settings">
          <div className="common-table-settings__panel">
            <div className="fw-bold mb-2">Customized Setting</div>
            <div className="border rounded p-3 bg-white h-100">
              <div className="small fw-bold text-muted mb-2">Table Header</div>
              <div className="form-check mb-2">
                <input className="form-check-input" type="checkbox" id="showHeader" checked={draftHeaderVisible} onChange={(e) => setDraftHeaderVisible(e.target.checked)} />
                <label className="form-check-label" htmlFor="showHeader">Show Header</label>
              </div>
              <div className="form-check mb-2">
                <input className="form-check-input" type="checkbox" id="showFilters" checked={draftFiltersVisible} onChange={(e) => setDraftFiltersVisible(e.target.checked)} />
                <label className="form-check-label" htmlFor="showFilters">Show Column Filter</label>
              </div>
              <div className="form-check">
                <input className="form-check-input" type="checkbox" id="showSearch" checked={draftSearchVisible} onChange={(e) => setDraftSearchVisible(e.target.checked)} />
                <label className="form-check-label" htmlFor="showSearch">Show Advanced Search</label>
              </div>
            </div>
          </div>

          <div className="common-table-settings__panel common-table-settings__panel--wide">
            <div className="fw-bold mb-2">Column Settings</div>
            <div className="border rounded overflow-auto">
              <div className="row g-0 border-bottom bg-light small fw-bold text-muted">
                <div className="col-5 p-2">Columns</div>
                <div className="col-4 p-2">Column Width</div>
                <div className="col-3 p-2">Column Ordering</div>
              </div>
              {draftConfig.map((col, idx) => (
                <div key={col.key} className="row g-0 border-bottom align-items-center">
                  <div className="col-5 p-2 d-flex align-items-center gap-2">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={col.visible}
                      onChange={(e) => {
                        const next = [...draftConfig];
                        next[idx] = { ...next[idx], visible: e.target.checked };
                        setDraftConfig(next);
                      }}
                    />
                    <span className="small">{col.header}</span>
                  </div>
                  <div className="col-4 p-2">
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      value={typeof col.width === 'number' ? col.width : Number(col.width) || ''}
                      onChange={(e) => {
                        const next = [...draftConfig];
                        const val = e.target.value === '' ? undefined : Number(e.target.value);
                        next[idx] = { ...next[idx], width: val };
                        setDraftConfig(next);
                      }}
                    />
                  </div>
                  <div className="col-3 p-2">
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      value={col.order}
                      onChange={(e) => {
                        const next = [...draftConfig];
                        next[idx] = { ...next[idx], order: Number(e.target.value) || col.order };
                        setDraftConfig(next);
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CommonTable;
