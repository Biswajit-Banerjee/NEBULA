import React from 'react';
import { X } from 'lucide-react';

const PhysicsControls = ({
  tension,
  setTension,
  repulsion,
  setRepulsion,
  onClose,
}) => (
  <div className="absolute bottom-24 right-4 z-40 w-64 rounded-lg border border-gray-200 bg-white/90 p-4 shadow-2xl backdrop-blur-lg dark:border-slate-600 dark:bg-slate-800/90">
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-100">Physics</h3>
      <button
        onClick={onClose}
        className="rounded p-1 hover:bg-indigo-50 dark:hover:bg-slate-700"
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
        className="w-full accent-indigo-600" />
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
        className="w-full accent-indigo-600" />
      <div className="text-right text-xs text-gray-500 dark:text-gray-400">{repulsion}</div>
    </fieldset>
  </div>
);

export default PhysicsControls; 