import React, { useState } from 'react';
import ProteinDialog from '../ProteinDialog';

const ECDetails = ({ ec }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsDialogOpen(true)}
        className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-nfo bg-nfo-subtle/80 hover:bg-nfo-subtle rounded transition duration-150"
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