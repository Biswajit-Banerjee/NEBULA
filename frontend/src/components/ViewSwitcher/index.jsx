import React from 'react';
import {
  Table2, Layers, Network, Columns2, Square, Undo2, MapPin,
} from 'lucide-react';

const VIEW_OPTIONS = [
  { id: 'table', label: 'Table', icon: Table2 },
  { id: 'network2d', label: '2D', icon: Layers },
  { id: 'network3d', label: '3D', icon: Network },
  { id: 'map', label: 'Map', icon: MapPin },
  { id: 'tree', label: 'Backtrace', icon: Undo2 },
];

const ViewSwitcher = ({
  activeView,
  onViewChange,
  isSplit,
  onToggleSplit,
  secondaryView,
  onSecondaryViewChange,
}) => {
  return (
    <div data-tour="view-switcher" className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2">
      {/* Primary view tabs */}
      <div className="flex items-center gap-0.5 bg-surface-overlay/85 backdrop-blur-xl border border-brd/40 rounded-2xl p-1 shadow-lg shadow-brd/20">
        {VIEW_OPTIONS.map((v) => {
          const Icon = v.icon;
          const active = activeView === v.id;
          return (
            <button
              key={v.id}
              onClick={() => onViewChange(v.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                active
                  ? 'bg-brand/90 text-content-inverse shadow-sm shadow-brand/20'
                  : 'text-content-secondary hover:text-content hover:bg-surface-inset/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {v.label}
            </button>
          );
        })}

        <div className="w-px h-5 bg-brd/60 mx-0.5" />

        <button
          data-tour="split-btn"
          onClick={onToggleSplit}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
            isSplit
              ? 'bg-brand/10 text-brand'
              : 'text-content-muted hover:text-content-secondary hover:bg-surface-inset/60'
          }`}
          title={isSplit ? 'Single view' : 'Split view'}
        >
          {isSplit ? <Square className="w-3.5 h-3.5" /> : <Columns2 className="w-3.5 h-3.5" />}
          {isSplit ? 'Single' : 'Split'}
        </button>
      </div>

      {/* Secondary view — split mode */}
      {isSplit && (
        <div className="flex items-center gap-0.5 bg-surface-overlay/85 backdrop-blur-xl border border-brd/40 rounded-2xl p-1 shadow-lg shadow-brd/20">
          {VIEW_OPTIONS.filter(v => v.id !== activeView).map((v) => {
            const Icon = v.icon;
            const active = secondaryView === v.id;
            return (
              <button
                key={v.id}
                onClick={() => onSecondaryViewChange(v.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  active
                    ? 'bg-ok/90 text-content-inverse shadow-sm shadow-ok/20'
                    : 'text-content-secondary hover:text-content hover:bg-surface-inset/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {v.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ViewSwitcher;
