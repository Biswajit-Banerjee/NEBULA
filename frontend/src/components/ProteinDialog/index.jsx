import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ProteinViewer from '../ProteinViewer';

const ProteinDialog = ({ isOpen, onClose, ecNumber }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="!max-w-[90vw] w-[90vw] h-[90vh] max-h-[90vh] overflow-hidden p-5 flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Protein Domain Information</DialogTitle>
          <DialogDescription className="sr-only">3D protein structure and domain visualization</DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-hidden">
          <ProteinViewer ecNumber={ecNumber} onClose={onClose} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProteinDialog;