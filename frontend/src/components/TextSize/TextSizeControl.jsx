import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { useTextScale } from '../../lib/textScale';

/**
 * Shared +/- text-size control. `compact` hides the percent readout reset
 * affordance styling for tight toolbars; the readout is always clickable
 * and resets to 100%.
 */
const TextSizeControl = ({ className = '', label = true }) => {
  const { percent, canInc, canDec, inc, dec, reset } = useTextScale();
  const btn = 'p-1 rounded-md text-content-secondary hover:bg-surface hover:text-content disabled:opacity-30 disabled:cursor-not-allowed transition-colors';
  return (
    <div
      className={`inline-flex items-center gap-0.5 bg-surface-inset rounded-lg p-0.5 ${className}`}
      role="group"
      aria-label="Text size"
    >
      {label && <span className="pl-1.5 pr-0.5 text-[11px] font-semibold text-content-muted select-none">Aa</span>}
      <button type="button" onClick={dec} disabled={!canDec} className={btn} title="Smaller text" aria-label="Decrease text size">
        <Minus className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={reset}
        className="min-w-[2.75rem] px-1 text-[11px] font-bold tabular-nums text-content-secondary hover:text-content select-none"
        title="Reset text size to 100%"
        aria-label={`Text size ${percent} percent. Click to reset.`}
      >
        {percent}%
      </button>
      <button type="button" onClick={inc} disabled={!canInc} className={btn} title="Larger text" aria-label="Increase text size">
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export default TextSizeControl;
