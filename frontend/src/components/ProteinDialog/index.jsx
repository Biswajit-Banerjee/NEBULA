import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ProteinViewer from '../ProteinViewer';

const ProteinDialog = ({ isOpen, onClose, ecNumber }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[120vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Protein Domain Information</DialogTitle>
        </DialogHeader>
        <ProteinViewer ecNumber={ecNumber} />
      </DialogContent>
    </Dialog>
  );
};

export default ProteinDialog;