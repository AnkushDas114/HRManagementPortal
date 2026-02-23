import * as React from 'react';
import { SmartTable } from './Table/SmartTable';
import { ColumnSetting, TableSettings } from './Table/TableTypes';
import { formatDateForDisplayIST } from '../utils/dateTime';

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

const getComparableValue = (value: unknown): string | number => {
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'boolean') return value ? 1 : 0;
  return normalize(value).toLowerCase();
};

const CommonTable = <T,>({
  data,
  columns,
  getRowId,
  showHeader = true,
  showColumnFilters = true,
  enableGlobalSearch = true,
  globalSearchPlaceholder = 'Search',
  // compact = false,
  headerActions,
  // enableRowSelection = false,
}: CommonTableProps<T>): JSX.Element => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchType, setSearchType] = React.useState<'All Words' | 'Any Words' | 'Exact Phrase'>('All Words');
  const [searchFields, setSearchFields] = React.useState<string[]>(columns.filter(c => c.searchable !== false).map(c => c.key));
  const [filters, setFilters] = React.useState<Record<string, string>>({});
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc' | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  const [tableSettings, setTableSettings] = React.useState<TableSettings>(() => ({
    showHeader,
    showColumnFilter: showColumnFilters,
    showAdvancedSearch: enableGlobalSearch,
    tableHeight: 'Flexible',
    columns: columns.map((col, index) => ({
      id: col.key,
      key: col.key,
      label: col.header,
      visible: true,
      width: typeof col.width === 'number' ? col.width : (typeof col.width === 'string' ? parseInt(col.width) || 150 : 150),
      order: index,
    })),
    visibleIcons: ['search', 'filter', 'settings'],
  }));

  const defaultSettings = React.useMemo<TableSettings>(() => ({
    showHeader,
    showColumnFilter: showColumnFilters,
    showAdvancedSearch: enableGlobalSearch,
    tableHeight: 'Flexible',
    columns: columns.map((col, index) => ({
      id: col.key,
      key: col.key,
      label: col.header,
      visible: true,
      width: 150,
      order: index,
    })),
    visibleIcons: ['search', 'filter', 'settings'],
  }), [columns, showHeader, showColumnFilters, enableGlobalSearch]);

  const mappedData = React.useMemo(() => {
    return data.map((item, index) => {
      const id = getRowId ? String(getRowId(item, index)) : ((item as any).id ? String((item as any).id) : String(index));
      return { ...item, id };
    }) as (T & { id: string })[];
  }, [data, getRowId]);

  const processedData = React.useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const searchableColumns = columns.filter(c => c.searchable !== false);
    const activeSearchColumns = searchFields.length > 0
      ? searchableColumns.filter(c => searchFields.indexOf(c.key) !== -1)
      : searchableColumns;

    const matchesSearch = (row: T & { id: string }): boolean => {
      if (!normalizedQuery) return true;
      const combined = activeSearchColumns
        .map((col) => {
          const value = col.accessor ? col.accessor(row as unknown as T) : (row as any)[col.key];
          return normalize(value).toLowerCase();
        })
        .join(' ');

      if (searchType === 'Exact Phrase') return combined.indexOf(normalizedQuery) !== -1;

      const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
      if (tokens.length === 0) return true;
      if (searchType === 'All Words') return tokens.every(token => combined.indexOf(token) !== -1);
      return tokens.some(token => combined.indexOf(token) !== -1);
    };

    const matchesFilters = (row: T & { id: string }): boolean => {
      return Object.keys(filters).every((key) => {
        const filterValue = (filters[key] || '').trim().toLowerCase();
        if (!filterValue) return true;
        const col = columns.find(c => c.key === key);
        if (!col) return true;
        const value = col.accessor ? col.accessor(row as unknown as T) : (row as any)[col.key];
        return normalize(value).toLowerCase().indexOf(filterValue) !== -1;
      });
    };

    const filteredRows = mappedData.filter(row => matchesSearch(row) && matchesFilters(row));
    if (!sortKey || !sortDirection) return filteredRows;

    const sortCol = columns.find(c => c.key === sortKey);
    if (!sortCol) return filteredRows;

    return filteredRows
      .map((row, idx) => ({ row, idx }))
      .sort((a, b) => {
        const left = sortCol.accessor ? sortCol.accessor(a.row as unknown as T) : (a.row as any)[sortCol.key];
        const right = sortCol.accessor ? sortCol.accessor(b.row as unknown as T) : (b.row as any)[sortCol.key];
        const l = getComparableValue(left);
        const r = getComparableValue(right);

        let result = 0;
        if (typeof l === 'number' && typeof r === 'number') {
          result = l - r;
        } else {
          result = String(l).localeCompare(String(r), undefined, { numeric: true, sensitivity: 'base' });
        }

        if (result === 0) return a.idx - b.idx;
        return sortDirection === 'asc' ? result : -result;
      })
      .map(item => item.row);
  }, [mappedData, columns, searchQuery, searchType, searchFields, filters, sortKey, sortDirection]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc'));
      if (sortDirection === 'desc') setSortKey(null);
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set<string>();
      prev.forEach(id => next.add(id));
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === processedData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(processedData.map(item => item.id)));
    }
  };

  const renderCell = (item: T, columnSetting: ColumnSetting) => {
    const colDef = columns.find(c => c.key === columnSetting.key);
    if (!colDef) return null;
    if (colDef.render) return colDef.render(item);
    const value = colDef.accessor ? colDef.accessor(item) : (item as any)[colDef.key];
    return normalize(value);
  };

  return (
    <div className="common-table-upgrade w-100">
      <SmartTable
        data={processedData}
        totalCount={mappedData.length}
        columns={tableSettings.columns}
        tableSettings={tableSettings}
        onSettingsChange={setTableSettings}
        defaultSettings={defaultSettings}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onToggleSelectAll={handleToggleSelectAll}
        isAllSelected={processedData.length > 0 && processedData.every(item => selectedIds.has(item.id))}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchType={searchType}
        onSearchTypeChange={setSearchType}
        searchFields={searchFields}
        onSearchFieldsChange={setSearchFields}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={handleSort}
        filters={filters}
        onFilterChange={(key, val) => setFilters(prev => ({ ...prev, [key]: val }))}
        renderCell={renderCell as (item: any, column: ColumnSetting) => React.ReactNode}
        viewportHeight={600}
        onIconClick={() => { }}
        toolbarActions={headerActions}
        showActionColumn={false}
      />
      <style>{`
        .common-table-upgrade {
          background: #fff;
          border-radius: 8px;
          overflow: visible;
          border: 1px solid #d5dfeb;
          box-shadow: 0 8px 22px rgba(14, 30, 52, 0.06);
          position: relative;
          z-index: 1;
        }
        .common-table-upgrade .smart-table-wrapper {
          padding: 0;
          position: relative;
          z-index: 1;
        }
        .common-table-upgrade .toolbar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          background: linear-gradient(180deg, #fbfdff 0%, #f6f9fd 100%);
          border-bottom: 1px solid #e2e9f2;
          flex-wrap: nowrap;
          overflow: visible;
          position: relative;
          z-index: 50;
        }
        .common-table-upgrade .small-text {
          font-size: 12px;
          color: #475569;
          white-space: nowrap;
        }
        .common-table-upgrade .search-container {
          min-width: 190px;
          max-width: 240px;
          width: 100%;
          display: flex;
          align-items: center;
          gap: 6px;
          border: 1px solid #c8d5e5;
          border-radius: 4px;
          padding: 0 8px;
          height: 32px;
          background: #fff;
        }
        .common-table-upgrade .search-container input {
          border: 0;
          outline: none;
          flex: 1;
          min-width: 0;
          font-size: 12px;
          background: transparent;
        }
        .common-table-upgrade .search-container i {
          color: #6b7280;
          font-size: 12px;
        }
        .common-table-upgrade .icon-btn-outline {
          width: 32px;
          height: 32px;
          border: 1px solid #ccd8e7;
          border-radius: 4px;
          background: #fff;
          color: #31547f;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          flex: 0 0 32px;
        }
        .common-table-upgrade .icon-btn-outline:hover {
          border-color: #9fb3cc;
          background: #f7faff;
        }
        .common-table-upgrade .custom-dropdown-trigger {
          height: 32px !important;
          min-width: 110px;
          font-size: 12px !important;
          border-color: #c8d5e5 !important;
        }
        .common-table-upgrade .custom-dropdown-container {
          position: relative;
          z-index: 80;
        }
        .common-table-upgrade .custom-dropdown-list {
          z-index: 2000 !important;
        }
        .common-table-upgrade .ms-auto {
          margin-left: auto !important;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: nowrap;
          white-space: nowrap;
        }
        .common-table-upgrade .table-wrapper {
          border-top: 1px solid #edf2f7;
        }
        .common-table-upgrade .table-wrapper table {
          margin-bottom: 0;
          background: #ffffff;
        }
        .common-table-upgrade .table-wrapper thead {
          background: #ffffff;
        }
        .common-table-upgrade .table-wrapper thead tr {
          background: #ffffff;
        }
        .common-table-upgrade .table-wrapper thead th {
          background: #ffffff;
          vertical-align: bottom;
          border-bottom: 1px solid #d6e0ee;
          padding: 8px 10px;
        }
        .common-table-upgrade .table-wrapper tbody tr {
          background: #ffffff;
        }
        .common-table-upgrade .table-wrapper tbody td {
          padding: 10px;
          border-bottom: 1px solid #e6edf5;
          color: #27384f;
          font-size: 13px;
          background: #ffffff;
        }
        .common-table-upgrade .filter-input-group {
          position: relative;
          background: #ffffff;
        }
        .common-table-upgrade .filter-input-group input {
          width: 100%;
          height: 28px;
          border: 1px solid #d1dceb;
          border-radius: 4px;
          background: #fff;
          font-size: 12px;
          color: #27384f;
          padding: 0 22px 0 8px;
        }
        .common-table-upgrade .filter-input-group input::placeholder {
          color: #8da4c1;
        }
        .common-table-upgrade .filter-input-group .arrows {
          position: absolute;
          right: 6px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          flex-direction: column;
          line-height: 0.7;
          font-size: 8px;
          color: #cbd5e1;
          cursor: pointer;
          user-select: none;
        }
        .common-table-upgrade .filter-input-group .arrows i {
          height: 8px;
          display: block;
        }
        @media (max-width: 900px) {
          .common-table-upgrade .toolbar {
            flex-wrap: wrap;
          }
          .common-table-upgrade .ms-auto {
            margin-left: 0 !important;
            width: 100%;
            justify-content: flex-start;
            flex-wrap: wrap;
          }
          .common-table-upgrade .search-container {
            max-width: none;
            flex: 1 1 220px;
          }
        }
      `}</style>
    </div>
  );
};

export default CommonTable;
