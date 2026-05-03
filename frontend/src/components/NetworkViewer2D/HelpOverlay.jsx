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
            <span className="font-medium">Drag</span> nodes to reposition them.
          </li>
          <li>
            <span className="font-medium">Scroll</span> to zoom in and out.
          </li>
          <li>
            <span className="font-medium">Ctrl + Click</span> on a reaction side-node to collapse / expand paths.
          </li>
        </ul>

        <h3 className="mt-6 mb-2 font-medium text-content">Toolbar actions</h3>
        <ul className="list-inside list-disc space-y-1 text-sm text-content">
          <li>Zoom ± – change zoom</li>
          <li>Rotate (R) – re-run layout or hold to spin</li>
          <li>Physics (P) – open physics panel</li>
          <li>Lock – freeze/unfreeze simulation</li>
          <li>Fullscreen (F) – immersive mode</li>
          <li>Download – export view as SVG</li>
        </ul>

        <h3 className="mt-6 mb-2 font-medium text-content">Keyboard shortcuts</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-content">
          <span className="font-medium">+</span><span>Zoom in</span>
          <span className="font-medium">-</span><span>Zoom out</span>
          <span className="font-medium">0</span><span>Reset view</span>
          <span className="font-medium">Space</span><span>Play/Pause</span>
          <span className="font-medium">← / →</span><span>Step generation</span>
          <span className="font-medium">R</span><span>Rotate layout</span>
          <span className="font-medium">P</span><span>Physics panel</span>
          <span className="font-medium">F</span><span>Fullscreen</span>
          <span className="font-medium">H</span><span>Help</span>
        </div>

        <p className="mt-8 text-center text-xs text-content-muted">
          Made with ❤️ – enjoy exploring!
        </p>
      </div>
    </div>
  </div>
);

export default HelpOverlay; 