import React from 'react';
import { X } from 'lucide-react';

const HelpOverlay = ({ onClose }) => (
  <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
    <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-brd/70 bg-surface-overlay/95 shadow-2xl">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 rounded p-1 text-content-secondary hover:bg-surface-inset/60 hover:text-content"
        aria-label="Close help"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="max-h-[80vh] overflow-y-auto p-6">
        <h2 className="mb-4 text-lg font-semibold text-content">Viewer Help & Shortcuts</h2>

        <ul className="list-inside list-disc space-y-2 text-sm text-content">
          <li>
            <span className="font-medium">Drag</span> nodes to reposition them. Enable <em>Snap to Grid</em> in settings for precise alignment.
          </li>
          <li>
            <span className="font-medium">Scroll / two-finger swipe</span> to zoom in and out.
          </li>
          <li>
            <span className="font-medium">Ctrl + Click (Cmd + Click on Mac)</span> on a reaction side-node to collapse / expand paths.
          </li>
          <li>
            <span className="font-medium">Right-click</span> on any node for a context menu with options to change color, set opacity, edit label, hide/show, align groups, and transform selections.
          </li>
          <li>
            <span className="font-medium">Double-click</span> on a node to edit its label inline. Double-click an annotation to edit its text.
          </li>
          <li>
            <span className="font-medium">Shift + Click</span> to select multiple nodes (multi-select).
          </li>
          <li>
            <span className="font-medium">Ctrl/Cmd + Drag</span> on empty space to draw a selection box.
          </li>
          <li>
            <span className="font-medium">Middle-click</span> on a node to lock/unlock its position.
          </li>
          <li>
            <span className="font-medium">Text tool</span> (in Settings &gt; Colors) &ndash; click to activate, then click on the canvas to place text annotations. Edit, move, and delete them freely.
          </li>
        </ul>

        <h3 className="mt-6 mb-2 font-medium text-content">Toolbar actions</h3>
        <ul className="list-inside list-disc space-y-1 text-sm text-content">
          <li>Zoom &plusmn; &ndash; change zoom</li>
          <li>Reset (R) &ndash; re-run layout</li>
          <li>Fullscreen (F) &ndash; immersive mode</li>
          <li>SVG &darr; &ndash; export as SVG (with opacity, colors, annotations)</li>
          <li>PNG &darr; &ndash; export as high-res PNG</li>
          <li>SVG &uarr; &ndash; import layout from an SVG file</li>
          <li>Paint &ndash; brush tool for coloring edges</li>
          <li>Text mode &ndash; select and reposition labels, subtitles, and text boxes</li>
        </ul>

        <h3 className="mt-6 mb-2 font-medium text-content">Keyboard shortcuts</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-content">
          <span className="font-medium">+</span><span>Zoom in</span>
          <span className="font-medium">-</span><span>Zoom out</span>
          <span className="font-medium">0</span><span>Reset view</span>
          <span className="font-medium">Space</span><span>Play/Pause</span>
          <span className="font-medium">&larr; / &rarr;</span><span>Step generation</span>
          <span className="font-medium">R</span><span>Reset layout</span>
          <span className="font-medium">G</span><span>Toggle grid</span>
          <span className="font-medium">F</span><span>Fullscreen</span>
          <span className="font-medium">H</span><span>Help</span>
          <span className="font-medium">Ctrl+Z</span><span>Undo</span>
          <span className="font-medium">Ctrl+Shift+Z</span><span>Redo</span>
          <span className="font-medium">Delete</span><span>Delete selected text box</span>
          <span className="font-medium">Escape</span><span>Cancel / deselect</span>
        </div>

        <p className="mt-8 text-center text-xs text-content-muted">
          Made with &#10084;&#65039; &ndash; enjoy exploring!
        </p>
      </div>
    </div>
  </div>
);

export default HelpOverlay; 
