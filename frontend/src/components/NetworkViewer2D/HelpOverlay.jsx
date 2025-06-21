import React from "react";
import { X } from "lucide-react";

const HelpOverlay = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
          aria-label="Close help"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Viewer Help & Shortcuts</h2>

        <ul className="space-y-2 text-sm text-gray-700 list-disc list-inside">
          <li><span className="font-medium">Drag</span> nodes to reposition them manually.</li>
          <li><span className="font-medium">Scroll</span> to zoom in and out.</li>
          <li><span className="font-medium">Ctrl + Click</span> on a reaction side-node to collapse / expand upstream or downstream pathways.</li>
        </ul>

        <h3 className="mt-4 mb-2 font-medium text-gray-800">Toolbar actions</h3>
        <ul className="space-y-1 text-sm text-gray-700 list-disc list-inside">
          <li><span className="font-medium">Zoom ±</span> – zoom controls.</li>
          <li><span className="font-medium">Reset View</span> – centre & fit graph.</li>
          <li><span className="font-medium">Reset Layout (R)</span> – re-run layout for current generation.</li>
          <li><span className="font-medium">Colour by Generation (C)</span> – toggle pastel gradient per generation.</li>
          <li><span className="font-medium">Physics (P)</span> – show/hide force-simulation sliders.</li>
          <li><span className="font-medium">Fullscreen (F)</span> – immerse the visualization.</li>
          <li><span className="font-medium">Download</span> – export current view as SVG.</li>
        </ul>

        <h3 className="mt-4 mb-2 font-medium text-gray-800">Keyboard shortcuts</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-700">
          <span className="font-medium">+</span><span>Zoom in</span>
          <span className="font-medium">-</span><span>Zoom out</span>
          <span className="font-medium">0</span><span>Reset view</span>
          <span className="font-medium">Space</span><span>Play/Pause generations</span>
          <span className="font-medium">← / →</span><span>Step generation</span>
          <span className="font-medium">R</span><span>Reset layout for current generation</span>
          <span className="font-medium">C</span><span>Toggle Sadist mode</span>
          <span className="font-medium">P</span><span>Show/Hide physics panel</span>
          <span className="font-medium">F</span><span>Toggle fullscreen</span>
          <span className="font-medium">H</span><span>Help</span>
        </div>

        <p className="mt-6 text-xs text-gray-500 text-center">Made with ❤️ – enjoy exploring!</p>
      </div>
    </div>
  );
};

export default HelpOverlay; 