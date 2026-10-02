import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Shapes, X, BookOpen } from 'lucide-react';
import KeyPanel from './KeyPanel';
import { KEY_VIEWS } from './keyData';
import TextSizeControl from '../TextSize/TextSizeControl';
import { useTextScale } from '../../lib/textScale';
import { openDocs as emitOpenDocs } from '../../lib/docsBus';

/**
 * "Key" button + popover listing every symbol the viewer draws.
 * `variant="toolbar"` = labelled pill, `variant="icon"` = square icon button.
 */
const KeyButton = ({ view, variant = 'toolbar', className = '', onOpenDocs }) => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const popRef = useRef(null);
  const { fontSize } = useTextScale();
  const def = KEY_VIEWS[view];

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (popRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!def) return null;

  const openDocs = () => {
    setOpen(false);
    emitOpenDocs(def.docSlug);
    onOpenDocs?.(def.docSlug);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Show the symbol key for this view"
        aria-expanded={open}
        className={variant === 'icon'
          ? `flex h-7 w-7 items-center justify-center rounded-lg text-content-muted transition-all hover:bg-surface-inset hover:text-brand ${open ? 'text-brand bg-brand/10' : ''} ${className}`
          : `inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${open ? 'border-brand/50 bg-brand/10 text-brand' : 'border-brd/50 text-content-secondary hover:text-content hover:bg-surface-overlay/70'} ${className}`}
        data-tour="key-btn"
      >
        <Shapes className={variant === 'icon' ? 'h-3.5 w-3.5' : 'w-3.5 h-3.5'} />
        {variant !== 'icon' && 'Key'}
      </button>
      {open && createPortal(
        <div
          ref={popRef}
          role="dialog"
          aria-label={def.title}
          className="fixed z-[300] right-4 top-20 bottom-4 w-[min(30rem,calc(100vw-2rem))] flex flex-col rounded-2xl border border-brd/60 bg-surface-overlay/98 shadow-2xl backdrop-blur-xl"
          style={fontSize}
        >
          <div className="flex flex-shrink-0 items-center gap-2 border-b border-brd/40 px-3 py-2" style={{ fontSize: '16px' }}>
            <Shapes className="h-4 w-4 text-brand" />
            <h3 className="flex-1 truncate text-sm font-bold text-content">{def.title}</h3>
            <TextSizeControl label={false} />
            <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 text-content-muted hover:bg-surface-inset hover:text-content" aria-label="Close key">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <KeyPanel view={view} />
          </div>
          <div className="flex-shrink-0 border-t border-brd/40 px-3 py-2" style={{ fontSize: '16px' }}>
            <button type="button" onClick={openDocs} className="inline-flex items-center gap-1.5 text-xs font-semibold text-link hover:underline">
              <BookOpen className="h-3.5 w-3.5" /> Read the full guide for this view
            </button>
          </div>
        </div>,
        // Inside a Radix dialog (Protein Domain Viewer) the popover must live in the
        // dialog, otherwise clicking it counts as an outside click and closes the dialog.
        btnRef.current?.closest('[role="dialog"]') || document.body,
      )}
    </>
  );
};

export default KeyButton;
