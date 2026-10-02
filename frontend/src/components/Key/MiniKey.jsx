import React from 'react';
import Glyph from './Glyphs';
import { KEY_ITEM_BY_ID } from './keyData';

/** Compact symbol list for tour cards: [glyph] label. Sized in em. */
const MiniKey = ({ ids = [] }) => (
  <ul className="mb-3 grid grid-cols-1 gap-1 rounded-lg border border-brd/40 bg-surface-inset/40 p-1.5">
    {ids.map((id) => {
      const item = KEY_ITEM_BY_ID[id];
      if (!item) return null;
      return (
        <li key={id} className="flex items-center gap-2" title={item.meaning}>
          <Glyph id={id} className="!w-[3em] !h-[1.5em]" />
          <span className="leading-tight text-content-secondary" style={{ fontSize: '0.8em' }}>{item.label}</span>
        </li>
      );
    })}
  </ul>
);

export default MiniKey;
