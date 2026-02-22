import React from 'react';
import { X } from 'lucide-react';

const PhysicsControls = ({
  tension,
  setTension,
  repulsion,
  setRepulsion,
  onClose,
}) => (
  <div className="absolute bottom-24 right-4 z-40 w-64 rounded-lg border border-gray-200/60 dark:border-slate-600/35 bg-white/90 dark:bg-slate-800/90 p-4 shadow-2xl backdrop-blur-lg">
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-sm font-semibold text-gray-600 dark:text-slate-200">Physics</h3>
      <button
        onClick={onClose}
        className="rounded p-1 hover:bg-indigo-50/60 dark:hover:bg-slate-600/40"
        aria-label="Close physics panel"
      >
        <X className="h-4 w-4" />
      </button>
    </div>

    <fieldset className="mb-4 space-y-2">
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">
        Edge relaxation
      </label>
      <input
        type="range"
        min="50"
        max="300"
        step="10"
        value={tension}
        onChange={(e) => setTension(parseInt(e.target.value))}
        className="w-full accent-indigo-500" />
      <div className="text-right text-xs text-gray-500 dark:text-gray-400">{tension} px</div>
    </fieldset>

    <fieldset className="space-y-2">
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">
        Node repulsion
      </label>
      <input
        type="range"
        min="0"
        max="1000"
        step="50"
        value={repulsion}
        onChange={(e) => setRepulsion(parseInt(e.target.value))}
        className="w-full accent-indigo-500" />
      <div className="text-right text-xs text-gray-500 dark:text-gray-400">{repulsion}</div>
    </fieldset>
  </div>
);

export default PhysicsControls; 