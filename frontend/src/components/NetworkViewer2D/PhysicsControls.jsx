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
    <div className="absolute top-4 right-20 bg-white/90 backdrop-blur-sm shadow-lg rounded-lg p-4 z-30 w-56">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-semibold text-gray-700">Physics</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4"/></button>
      </div>

      <div className="mb-3">
        <label className="text-xs text-gray-600">Edge relaxation</label>
        <input
          type="range"
          min="50"
          max="300"
          step="10"
          value={tension}
          onChange={(e)=>setTension(parseInt(e.target.value))}
          className="w-full"
        />
        <div className="text-right text-xs text-gray-500">{tension}px</div>
      </div>

      <div>
        <label className="text-xs text-gray-600">Node repulsion</label>
        <input
          type="range"
          min="0"
          max="1000"
          step="50"
          value={repulsion}
          onChange={(e)=>setRepulsion(parseInt(e.target.value))}
          className="w-full"
        />
        <div className="text-right text-xs text-gray-500">{repulsion}</div>
      </div>
    </div>
  );
};

export default PhysicsControls; 