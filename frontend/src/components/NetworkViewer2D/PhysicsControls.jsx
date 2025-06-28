import React from "react";
import { X } from "lucide-react";

const PhysicsControls = ({
  tension,
  setTension,
  repulsion,
  setRepulsion,
  onClose,
}) => {
  return (
    <div className="absolute bottom-20 right-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm shadow-lg rounded-lg p-4 z-40 w-60 border border-gray-200 dark:border-slate-600">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-100">Physics</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"><X className="w-4 h-4"/></button>
      </div>

      <div className="mb-3">
        <label className="text-xs text-gray-600 dark:text-gray-300">Edge relaxation</label>
        <input
          type="range"
          min="50"
          max="300"
          step="10"
          value={tension}
          onChange={(e)=>setTension(parseInt(e.target.value))}
          className="w-full"
        />
        <div className="text-right text-xs text-gray-500 dark:text-gray-400">{tension}px</div>
      </div>

      <div>
        <label className="text-xs text-gray-600 dark:text-gray-300">Node repulsion</label>
        <input
          type="range"
          min="0"
          max="1000"
          step="50"
          value={repulsion}
          onChange={(e)=>setRepulsion(parseInt(e.target.value))}
          className="w-full"
        />
        <div className="text-right text-xs text-gray-500 dark:text-gray-400">{repulsion}</div>
      </div>
    </div>
  );
};

export default PhysicsControls; 