import React, { useState, useRef, useEffect } from 'react';

type SearchType = 'All Words' | 'Any Words' | 'Exact Phrase';

interface ToolbarProps {
  totalCount: number;
  showingCount: number;
  searchQuery: string;
  onSearchChange: (val: string) => void;
  searchType: SearchType;
  onSearchTypeChange: (type: SearchType) => void;
  onAdvancedSearchClick: () => void;
  onSettingsClick: () => void;
  onIconClick: (id: string) => void;
  visibleIcons: string[];
  actions?: React.ReactNode;
  showAdvancedSearch: boolean;
}

export const TableToolbar: React.FC<ToolbarProps> = ({
  totalCount,
  showingCount,
  searchQuery,
  onSearchChange,
  searchType,
  onSearchTypeChange,
  onAdvancedSearchClick,
  onSettingsClick,
  onIconClick,
  visibleIcons,
  actions,
  showAdvancedSearch
}) => {
  const [showSearchTypeDropdown, setShowSearchTypeDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSearchTypeDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const ToolbarIcon = ({ id, icon, title }: { id: string, icon: string, title: string }) => {
    if (visibleIcons.indexOf(id) === -1) return null;
    return (
      <button
        className="icon-btn-outline"
        title={title}
        onClick={() => onIconClick(id)}
        style={{ width: '32px', height: '32px' }}
      >
        <i className={`bi ${icon}`}></i>
      </button>
    );
  };

  return (
    <div className="toolbar">
      <ToolbarIcon id="sidebar" icon="bi-layout-sidebar-inset" title="Toggle Sidebar" />

      <span className="fw-medium text-dark ms-1" style={{ minWidth: 'max-content' }}>
        Showing {showingCount} of {totalCount}
      </span>

      <div className="search-container">
        <input
          type="text"
          placeholder="Search all"
          className="flex-grow-1"
          style={{ outline: 'none' }}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <i className="bi bi-search" style={{ color: '#2F5596' }}></i>
      </div>

      {showAdvancedSearch && (
        <>
          <button className="icon-btn-outline" onClick={onAdvancedSearchClick} title="Search Settings">
            <i className="bi bi-gear-fill" style={{ color: '#2F5596' }}></i>
          </button>

          <div className="custom-dropdown-container" ref={dropdownRef} style={{ position: 'relative' }}>
            <div
              className="custom-dropdown-trigger d-flex align-items-center justify-content-between bg-white border rounded px-2"
              style={{ height: '32px', minWidth: '110px', fontSize: '14px', cursor: 'pointer', borderColor: '#CCCCCC' }}
              onClick={() => setShowSearchTypeDropdown(!showSearchTypeDropdown)}
            >
              <span className="text-truncate">{searchType}</span>
              <i className={`bi bi-chevron-down ms-1 ${showSearchTypeDropdown ? 'rotate-180' : ''}`} style={{ transition: 'transform 0.2s', color: '#2F5596' }}></i>
            </div>
            {showSearchTypeDropdown && (
              <div className="custom-dropdown-list shadow-lg border rounded" style={{ position: 'absolute', top: '100%', left: 0, width: '100%', backgroundColor: 'white', zIndex: 1000, marginTop: '4px', borderColor: '#DDDDDD' }}>
                {(['All Words', 'Any Words', 'Exact Phrase'] as SearchType[]).map((option) => (
                  <div
                    key={option}
                    className={`custom-dropdown-item px-3 py-2 ${searchType === option ? 'fw-bold' : ''}`}
                    style={{ cursor: 'pointer', color: searchType === option ? '#2F5596' : '#333333', fontSize: '14px', backgroundColor: searchType === option ? '#F4F4F4' : 'white' }}
                    onClick={() => {
                      onSearchTypeChange(option);
                      setShowSearchTypeDropdown(false);
                    }}
                  >
                    {option}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className="ms-auto d-flex gap-2 align-items-center">
        <ToolbarIcon id="teams" icon="bi-microsoft-teams" title="Share to MS Teams" />
        <ToolbarIcon id="import" icon="bi-box-arrow-in-right" title="Import Data" />
        <ToolbarIcon id="excel" icon="bi-file-earmark-excel" title="Export to Excel" />
        <ToolbarIcon id="print" icon="bi-printer" title="Print Table" />
        <ToolbarIcon id="expand" icon="bi-arrows-angle-expand" title="Toggle Fullscreen" />
        <ToolbarIcon id="pencil" icon="bi-pencil" title="Quick Edit Mode" />
        <ToolbarIcon id="sort" icon="bi-arrow-down-up" title="Reset Sorting" />

        <div className="d-flex gap-2 ms-1">
          {actions}
        </div>

        <button className="icon-btn-outline ms-1" onClick={onSettingsClick} title="SmartTable Settings">
          <i className="bi bi-gear-fill" style={{ color: '#2F5596' }}></i>
        </button>
      </div>

      <style>{`
        .rotate-180 { transform: rotate(180deg); }
        .custom-dropdown-item:hover { background-color: #EBEBEB; color: #2F5596; }
      `}</style>
    </div>
  );
};
