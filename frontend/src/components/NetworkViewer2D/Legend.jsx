import React from 'react';

const Legend = () => {
  return (
    <div className="mt-6 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
      {/* <div className="flex items-center space-x-4">
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-blue-200 border border-blue-500 mr-1"></div>
          <span>Compound</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-purple-200 border border-purple-500 rounded-sm mr-1"></div>
          <span>Reaction</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-3 rounded-md bg-white border border-purple-500 mr-1"></div>
          <span>EC Number</span>
        </div>
      </div> */}
      <div className="italic">
        Drag to move nodes • Scroll to zoom • Slider to change generations • Made with blood sweat & tears 
      </div>
    </div>
  );
};

export default Legend;