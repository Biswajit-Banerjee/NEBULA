import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronUp, ChevronDown, Table2, Layers, Network,
  Maximize2, Minimize2, Columns2, Square, GripHorizontal,
} from 'lucide-react';
import ViewPane from '../ViewPane';

const VIEW_OPTIONS = [
  { id: 'table', label: 'Table', icon: Table2 },
  { id: 'network2d', label: '2D', icon: Layers },
  { id: 'network3d', label: '3D', icon: Network },
];

const MiniTabBar = ({ activeView, onViewChange, exclude = null }) => (
  <div className="flex items-center gap-0.5 bg-slate-100/60 dark:bg-slate-700/50 rounded-lg p-0.5">
    {VIEW_OPTIONS.filter(v => v.id !== exclude).map((v) => {
      const Icon = v.icon;
      const active = activeView === v.id;
      return (
        <button
          key={v.id}
          onClick={() => onViewChange(v.id)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
            active
              ? 'bg-white/90 dark:bg-slate-600/60 text-violet-600 dark:text-violet-300/80 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{v.label}</span>
        </button>
      );
    })}
  </div>
);

const BottomTray = ({
  results,
  setResults,
  filteredResults,
  setFilteredResults,
  selectedRows,
  setSelectedRows,
  combinedMode,
  network2dRef,
  network3dRef,
  searchPairs,
  isOpen,
  onToggle,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSplit, setIsSplit] = useState(false);
  const [leftView, setLeftView] = useState('table');
  const [rightView, setRightView] = useState('network2d');

  // Fire resize when tray geometry changes so viewers adapt
  useEffect(() => {
    const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 320);
    return () => clearTimeout(t);
  }, [isExpanded, isSplit, isOpen]);

  const toggleSplit = useCallback(() => {
    setIsSplit(prev => {
      if (!prev) {
        // entering split — make sure both panes show different views
        if (leftView === rightView) {
          const alt = VIEW_OPTIONS.find(v => v.id !== leftView);
          if (alt) setRightView(alt.id);
        }
      }
      return !prev;
    });
  }, [leftView, rightView]);

  const handleLeftViewChange = useCallback((v) => {
    setLeftView(v);
    if (isSplit && v === rightView) {
      const alt = VIEW_OPTIONS.find(o => o.id !== v);
      if (alt) setRightView(alt.id);
    }
  }, [isSplit, rightView]);

  const handleRightViewChange = useCallback((v) => {
    setRightView(v);
    if (isSplit && v === leftView) {
      const alt = VIEW_OPTIONS.find(o => o.id !== v);
      if (alt) setLeftView(alt.id);
    }
  }, [isSplit, leftView]);

  const trayHeight = isExpanded ? 'h-[95vh]' : 'h-[70vh]';
  const resultCount = results?.length || 0;

  const sharedPaneProps = {
    results,
    setResults,
    filteredResults,
    setFilteredResults,
    selectedRows,
    setSelectedRows,
    searchPairs,
    network2dRef,
    network3dRef,
  };

  return (
    <div
      className={`
        fixed bottom-0 left-0 right-0 z-40
        bg-white/85 dark:bg-slate-800/85
        backdrop-blur-2xl
        border-t border-slate-200/50 dark:border-slate-600/35
        shadow-[0_-8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.2)]
        transition-all duration-300 ease-out
        ${trayHeight}
        ${isOpen ? 'translate-y-0' : 'translate-y-[calc(100%-44px)]'}
      `}
    >
      {/* ── Handle / Header ── */}
      <div className="flex items-center justify-between px-4 h-11 border-b border-slate-200/40 dark:border-slate-600/30 select-none flex-shrink-0">
        {/* Left cluster */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggle}
            className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-violet-500 dark:hover:text-violet-300/80 transition-colors"
          >
            <GripHorizontal className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            {isOpen
              ? <ChevronDown className="w-4 h-4" />
              : <ChevronUp className="w-4 h-4" />
            }
            <span className="text-xs font-semibold tracking-wide uppercase">
              {isOpen ? 'Results' : `Results${resultCount ? ` (${resultCount})` : ''}`}
            </span>
          </button>

          {/* View tabs (single mode only) */}
          {isOpen && !isSplit && (
            <div className="ml-2">
              <MiniTabBar activeView={leftView} onViewChange={handleLeftViewChange} />
            </div>
          )}
        </div>

        {/* Right cluster */}
        {isOpen && (
          <div className="flex items-center gap-1.5">
            {/* Split toggle */}
            <button
              onClick={toggleSplit}
              className={`p-1.5 rounded-lg text-xs transition-all duration-200 ${
                isSplit
                  ? 'bg-violet-50 dark:bg-violet-700/20 text-violet-500 dark:text-violet-300/80'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-700/50'
              }`}
              title={isSplit ? 'Single view' : 'Split view'}
            >
              {isSplit ? <Square className="w-4 h-4" /> : <Columns2 className="w-4 h-4" />}
            </button>

            {/* Expand / Minimize */}
            <button
              onClick={() => setIsExpanded(e => !e)}
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-700/50 transition-colors"
              title={isExpanded ? 'Minimize' : 'Maximize'}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>

      {/* ── Content ── */}
      {isOpen && (
        <div className="h-[calc(100%-44px)] overflow-hidden">
          {resultCount > 0 ? (
            isSplit ? (
              /* ── Split view ── */
              <div className="flex h-full divide-x divide-slate-200/60 dark:divide-slate-600/30">
                {/* Left pane */}
                <div className="flex-1 min-w-0 flex flex-col h-full">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50/50 dark:bg-slate-700/30 border-b border-slate-200/30 dark:border-slate-600/20">
                    <MiniTabBar activeView={leftView} onViewChange={handleLeftViewChange} exclude={rightView} />
                  </div>
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <ViewPane viewType={leftView} {...sharedPaneProps} />
                  </div>
                </div>

                {/* Right pane */}
                <div className="flex-1 min-w-0 flex flex-col h-full">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50/50 dark:bg-slate-700/30 border-b border-slate-200/30 dark:border-slate-600/20">
                    <MiniTabBar activeView={rightView} onViewChange={handleRightViewChange} exclude={leftView} />
                  </div>
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <ViewPane viewType={rightView} {...sharedPaneProps} />
                  </div>
                </div>
              </div>
            ) : (
              /* ── Single view ── */
              <div className="h-full overflow-hidden">
                <ViewPane viewType={leftView} {...sharedPaneProps} />
              </div>
            )
          ) : (
            /* ── Empty state ── */
            <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
              <Table2 className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">No results yet</p>
              <p className="text-xs mt-1">Run a search to see metabolic pathways here</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BottomTray;
