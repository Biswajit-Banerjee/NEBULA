import React from 'react';
import { X, BookOpen } from 'lucide-react';
import TextSizeControl from '../TextSize/TextSizeControl';
import KeyButton from '../Key/KeyButton';
import { useTextScale } from '../../lib/textScale';
import { openDocs } from '../../lib/docsBus';

const CONTENT = {
  'reaction-network': {
    title: 'Reaction Network: help and shortcuts',
    docSlug: 'view-reaction-network',
    mouse: [
      ['Drag', 'a node to move it. Turn on Snap to grid in Settings > Canvas for tidy alignment.'],
      ['Scroll / pinch', 'to zoom. Drag empty space to pan.'],
      ['Click', 'a node to pin it and highlight its connections. Shift+click pins several.'],
      ['Ctrl / Cmd + drag', 'on empty space to draw a selection box.'],
      ['Ctrl / Cmd + click', 'a reaction rectangle to collapse or expand everything beyond it.'],
      ['Middle-click', 'a node to lock or unlock its position (amber dashed ring).'],
      ['Right-click', 'a node for colour, opacity, hide, collapse, and Protein Viewer on EC ellipses.'],
      ['Text mode', 'turn it on in Settings > Text, click a label, subtitle or text box to select it, edit its words in the panel and drag it to move it.'],
    ],
    tools: [
      'Zoom +/- and Fit change the view; the gear arrow on the right opens Settings',
      'Text mode: click to place text boxes, then move, edit or delete them',
      'Paint edges: brush tool for colouring individual lines',
      'SVG / PNG: export. Import: reload positions from an exported SVG',
      'Generation timeline (bottom): play, step, window, speed',
    ],
    keys: [
      ['+ / -', 'Zoom in / out'], ['0', 'Fit to view'], ['Space', 'Play / pause generations'],
      ['Left / Right', 'Step one generation'], ['R', 'Re-run the layout'], ['G', 'Show / hide grid'],
      ['F', 'Fullscreen'], ['H', 'This help'], ['Ctrl+Z', 'Undo'], ['Ctrl+Shift+Z or Ctrl+Y', 'Redo'],
      ['Delete', 'Delete the selected text box'], ['Esc', 'Leave text mode / deselect'],
    ],
  },
  'metabolic-map': {
    title: 'Metabolic Map: help and shortcuts',
    docSlug: 'view-metabolic-map',
    mouse: [
      ['Drag', 'empty space to pan. In Custom layout, drag a compound to move it (in KEGG Layout compounds stay on their map positions).'],
      ['Scroll / pinch', 'to zoom.'],
      ['Click', 'a compound to pin it and highlight its reactions. Shift+click pins several.'],
      ['Ctrl + drag', 'on empty space to draw a selection box.'],
      ['Middle-click', 'a compound to lock or unlock its position (red dashed ring).'],
      ['Right-click', 'a compound (delete incoming / outgoing edges, or the node with bridge edges), an edge (delete it), or a group of pinned compounds (flip and rotate).'],
      ['Hover', 'a compound to highlight its reactions; reaction IDs show on hovered or pinned edges.'],
    ],
    tools: [
      'Gear arrow on the right: Map Settings (display, layout mode, colours, actions)',
      'Atom button (top left): SMILES backbone search',
      'Find Compound: jump to a compound by name or ID',
      'Download SVG / PNG from Actions',
    ],
    keys: [
      ['+ / -', 'Zoom in / out'], ['0', 'Fit to view'], ['R', 'Reset layout'], ['F', 'Fullscreen'], ['H', 'This help'],
      ['Enter', 'Run the backbone search (in the search box)'], ['Esc', 'Clear and close the backbone search'],
    ],
  },
};

const HelpOverlay = ({ onClose, view = 'reaction-network' }) => {
  const { fontSize } = useTextScale();
  const c = CONTENT[view] || CONTENT['reaction-network'];
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-[38em] overflow-hidden rounded-xl border border-brd/70 bg-surface-overlay shadow-2xl"
        style={fontSize}
        role="dialog"
        aria-label={c.title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-brd/40 px-4 py-2.5">
          <h2 className="flex-1 font-semibold text-content" style={{ fontSize: '1.1em' }}>{c.title}</h2>
          <TextSizeControl label={false} />
          <button onClick={onClose} className="rounded p-1 text-content-secondary hover:bg-surface-inset/60 hover:text-content" aria-label="Close help">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-5" style={{ fontSize: '0.92em' }}>
          <h3 className="mb-2 font-semibold text-content">Mouse</h3>
          <ul className="space-y-1.5 text-content">
            {c.mouse.map(([k, t]) => (
              <li key={k}><span className="font-semibold">{k}</span> <span className="text-content-secondary">{t}</span></li>
            ))}
          </ul>

          <h3 className="mb-2 mt-5 font-semibold text-content">Toolbar and panels</h3>
          <ul className="list-inside list-disc space-y-1 text-content-secondary">
            {c.tools.map((t) => <li key={t}>{t}</li>)}
          </ul>

          <h3 className="mb-2 mt-5 font-semibold text-content">Keyboard shortcuts</h3>
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            {c.keys.map(([k, t]) => (
              <React.Fragment key={k}>
                <kbd className="self-start whitespace-nowrap rounded border border-brd bg-surface-inset px-1.5 py-0.5 font-mono font-semibold text-content" style={{ fontSize: '0.85em' }}>{k}</kbd>
                <span className="text-content-secondary">{t}</span>
              </React.Fragment>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-brd/40 pt-4">
            <KeyButton view={view} />
            <button
              onClick={() => { onClose(); openDocs(c.docSlug); }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-link hover:underline"
            >
              <BookOpen className="h-3.5 w-3.5" /> Read the full guide for this view
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpOverlay;
