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
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2">
      {/* Primary view tabs */}
      <div className="flex items-center gap-0.5 bg-white/85 dark:bg-slate-800/85 backdrop-blur-xl border border-slate-200/40 dark:border-slate-600/30 rounded-2xl p-1 shadow-lg shadow-slate-300/20 dark:shadow-black/25">
        {VIEW_OPTIONS.map((v) => {
          const Icon = v.icon;
          const active = activeView === v.id;
          return (
            <button
              key={v.id}
              onClick={() => onViewChange(v.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                active
                  ? 'bg-violet-500/90 text-white shadow-sm shadow-violet-400/20'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-700/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {v.label}
            </button>
          );
        })}

        <div className="w-px h-5 bg-slate-200/60 dark:bg-slate-700/40 mx-0.5" />

        <button
          onClick={onToggleSplit}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
            isSplit
              ? 'bg-violet-50 dark:bg-violet-700/20 text-violet-500 dark:text-violet-300/80'
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-700/50'
          }`}
          title={isSplit ? 'Single view' : 'Split view'}
        >
          {isSplit ? <Square className="w-3.5 h-3.5" /> : <Columns2 className="w-3.5 h-3.5" />}
          {isSplit ? 'Single' : 'Split'}
        </button>
      </div>

      {/* Secondary view — split mode */}
      {isSplit && (
        <div className="flex items-center gap-0.5 bg-white/85 dark:bg-slate-800/85 backdrop-blur-xl border border-slate-200/40 dark:border-slate-600/30 rounded-2xl p-1 shadow-lg shadow-slate-300/20 dark:shadow-black/25">
          {VIEW_OPTIONS.filter(v => v.id !== activeView).map((v) => {
            const Icon = v.icon;
            const active = secondaryView === v.id;
            return (
              <button
                key={v.id}
                onClick={() => onSecondaryViewChange(v.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  active
                    ? 'bg-emerald-500/90 text-white shadow-sm shadow-emerald-400/20'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-700/50'
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
