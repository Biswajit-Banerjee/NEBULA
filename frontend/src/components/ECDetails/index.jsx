import React, { useState } from 'react';
import ProteinDialog from '../ProteinDialog';

const ECDetails = ({ ec }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsDialogOpen(true)}
        className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-600/20 hover:bg-blue-200 dark:hover:bg-blue-600/30 rounded transition duration-150"
      >
        {ec}
      </button>
      
      <ProteinDialog 
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        ecNumber={ec}
      />
    </>
  );
};

export default ECDetails;