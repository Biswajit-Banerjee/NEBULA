import React, { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import SearchPanel from '../SearchPanel';

const SearchDrawer = ({
  isOpen,
  onClose,
  onSearch,
  isLoading,
  onToggleVisibility,
  searchPairs,
  setSearchPairs,
  combinedMode,
  toggleCombinedMode,
  results,
  onExportSession,
}) => {
  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleSearch = useCallback((...args) => {
    onSearch(...args);
    onClose();
  }, [onSearch, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-full max-w-md transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full bg-surface/95 backdrop-blur-2xl border-r border-brd/50 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-brd/50 flex-shrink-0">
            <div>
              <h2 className="text-base font-bold text-content">
                Search Configuration
              </h2>
              <p className="text-xs text-content-secondary mt-0.5">
                Configure search parameters
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-content-muted hover:text-content hover:bg-surface-inset transition-all duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* SearchPanel content */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <SearchPanel
              onSearch={handleSearch}
              isLoading={isLoading}
              onToggleVisibility={onToggleVisibility}
              searchPairs={searchPairs}
              setSearchPairs={setSearchPairs}
              combinedMode={combinedMode}
              toggleCombinedMode={toggleCombinedMode}
              results={results}
              onCollapseSidebar={null}
              onExportSession={onExportSession}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default SearchDrawer;
