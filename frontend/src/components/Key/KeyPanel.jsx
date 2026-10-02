import React from 'react';
import Glyph from './Glyphs';
import { KEY_VIEWS } from './keyData';

/**
 * Full symbol list for one viewer. Sized in `em`, so it follows whatever
 * font size its container sets (docs, popover, tour card).
 */
const KeyPanel = ({ view, showIntro = true, className = '' }) => {
  const def = KEY_VIEWS[view];
  if (!def) return null;
  return (
    <div className={`nebula-key not-prose ${className}`}>
      {showIntro && def.intro && <p className="mb-3 text-content-secondary leading-snug" style={{ fontSize: '0.9em' }}>{def.intro}</p>}
      {def.groups.map((g) => (
        <section key={g.title} className="mb-4 last:mb-0">
          <h4 className="mb-1.5 font-bold uppercase tracking-wider text-content-muted" style={{ fontSize: '0.72em' }}>{g.title}</h4>
          <ul className="divide-y divide-brd/30 rounded-lg border border-brd/40 bg-surface-secondary/50">
            {g.items.map(([id, label, meaning]) => (
              <li key={id} className="flex items-center gap-3 px-2.5 py-1.5">
                <span className="flex w-[4.25em] flex-shrink-0 justify-center"><Glyph id={id} /></span>
                <span className="min-w-0 leading-snug" style={{ fontSize: '0.92em' }}>
                  <span className="block font-semibold text-content">{label}</span>
                  <span className="block text-content-secondary">{meaning}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

export default KeyPanel;
