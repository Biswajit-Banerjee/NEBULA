import React from 'react';
import { X } from 'lucide-react';

const HelpOverlay = ({ onClose }) => (
  <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
    <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-gray-200/70 dark:border-slate-600/40 bg-white/95 dark:bg-slate-800/95 shadow-2xl">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 rounded p-1 text-gray-500 hover:bg-indigo-50/60 hover:text-gray-600 dark:text-gray-400 dark:hover:bg-slate-600/40 dark:hover:text-gray-200"
        aria-label="Close help"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="max-h-[80vh] overflow-y-auto p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-700 dark:text-slate-200">Viewer Help & Shortcuts</h2>

        <ul className="list-inside list-disc space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li>
            <span className="font-medium">Drag</span> nodes to reposition them.
          </li>
          <li>
            <span className="font-medium">Scroll</span> to zoom in and out.
          </li>
          <li>
            <span className="font-medium">Ctrl + Click</span> on a reaction side-node to collapse / expand pathways.
          </li>
        </ul>

        <h3 className="mt-6 mb-2 font-medium text-gray-700 dark:text-slate-200">Toolbar actions</h3>
        <ul className="list-inside list-disc space-y-1 text-sm text-gray-700 dark:text-gray-300">
          <li>Zoom ± – change zoom</li>
          <li>Rotate (R) – re-run layout or hold to spin</li>
          <li>Physics (P) – open physics panel</li>
          <li>Lock – freeze/unfreeze simulation</li>
          <li>Fullscreen (F) – immersive mode</li>
          <li>Download – export view as SVG</li>
        </ul>

        <h3 className="mt-6 mb-2 font-medium text-gray-700 dark:text-slate-200">Keyboard shortcuts</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-700 dark:text-gray-300">
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

        <p className="mt-8 text-center text-xs text-gray-500 dark:text-gray-400">
          Made with ❤️ – enjoy exploring!
        </p>
      </div>
    </div>
  </div>
);

export default HelpOverlay; 