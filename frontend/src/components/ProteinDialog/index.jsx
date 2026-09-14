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
      <DialogContent className="!max-w-[90vw] w-[90vw] max-h-[90vh] overflow-y-auto p-5">
        <DialogHeader>
          <DialogTitle>Protein Domain Information</DialogTitle>
          <DialogDescription className="sr-only">3D protein structure and domain visualization</DialogDescription>
        </DialogHeader>
        <ProteinViewer ecNumber={ecNumber} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
};

export default ProteinDialog;