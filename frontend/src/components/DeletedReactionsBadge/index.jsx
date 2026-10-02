import React, { useState, useRef, useEffect } from 'react';
import { Trash2, RotateCcw, X } from 'lucide-react';

/**
 * DeletedReactionsBadge — compact indicator + popover shared by Table,
 * Network2D and Map toolbars. Shows how many reactions were removed from
 * the current result set and lets the user restore them (individually or
 * all at once) so broken paths can be un-done without re-running search.
 */
const DeletedReactionsBadge = ({ deletedRows = [], onRestoreRows }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!deletedRows || deletedRows.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-err-subtle/70 text-err border border-err/20 hover:bg-err-subtle transition-all"
        title="Reactions deleted from the results — click to review or restore"
      >
        <Trash2 className="w-3.5 h-3.5" />
        {deletedRows.length} deleted
      </button>

      {open && (
        <div className="absolute right-0 mt-2 z-50 w-72 max-h-80 overflow-auto bg-surface-overlay/95 backdrop-blur-xl border border-brd/50 rounded-xl shadow-2xl shadow-black/20 animate-in fade-in-0 slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between px-3 py-2 border-b border-brd/40 sticky top-0 bg-surface-overlay/95">
            <span className="text-xs font-bold text-content">Deleted reactions</span>
            <button
              onClick={() => { onRestoreRows && onRestoreRows(deletedRows); setOpen(false); }}
              className="flex items-center gap-1 text-[11px] font-semibold text-ok hover:text-ok/80"
            >
              <RotateCcw className="w-3 h-3" /> Restore all
            </button>
          </div>
          <div className="divide-y divide-brd/20">
            {deletedRows.map((row, idx) => (
              <div key={`${row.reaction}-${idx}`} className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-surface-inset/50">
                <div className="min-w-0">
                  <div className="font-mono text-xs font-semibold text-content truncate">{row.reaction}</div>
                  <div className="text-[10px] text-content-muted truncate">{row.source} → {row.target}</div>
                </div>
                <button
                  onClick={() => onRestoreRows && onRestoreRows([row])}
                  className="flex-shrink-0 p-1 rounded text-content-muted hover:text-ok hover:bg-ok/10"
                  title="Restore this reaction"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DeletedReactionsBadge;
