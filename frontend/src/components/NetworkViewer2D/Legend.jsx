import React from 'react';

const Legend = () => (
  <div className="pointer-events-none absolute left-1/2 bottom-20 z-20 -translate-x-1/2 select-none">
    <div className="pointer-events-auto rounded-full bg-white/70 px-4 py-1 text-center text-xs font-medium text-gray-600 shadow-md backdrop-blur-sm dark:bg-slate-800/70 dark:text-gray-300">
      Drag nodes · Scroll to zoom · Use toolbar & slider for generations
    </div>
  </div>
);

export default Legend;