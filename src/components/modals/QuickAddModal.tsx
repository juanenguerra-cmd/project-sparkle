import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Pill, ShieldAlert, Syringe, Users } from 'lucide-react';
import { Resident } from '@/lib/types';

interface QuickAddModalProps {
  open: boolean;
  onClose: () => void;
  resident?: Resident | null;
  onSelectIPCase: () => void;
  onSelectABTCase: () => void;
  onSelectVAXCase: () => void;
  onSelectOutbreakCase: () => void;
}

const QuickAddModal = ({ 
  open, 
  onClose, 
  resident,
  onSelectIPCase,
  onSelectABTCase,
  onSelectVAXCase,
  onSelectOutbreakCase
}: QuickAddModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            Quick Add {resident ? `for ${resident.name}` : 'Record'}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-4">
          <Button 
            variant="outline" 
            className="h-20 flex-col gap-2"
            onClick={() => {
              onClose();
              onSelectIPCase();
            }}
          >
            <ShieldAlert className="h-6 w-6 text-warning" />
            <span className="text-sm">IP Case</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-20 flex-col gap-2"
            onClick={() => {
              onClose();
              onSelectABTCase();
            }}
          >
            <Pill className="h-6 w-6 text-destructive" />
            <span className="text-sm">ABT Case</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-20 flex-col gap-2"
            onClick={() => {
              onClose();
              onSelectVAXCase();
            }}
          >
            <Syringe className="h-6 w-6 text-info" />
            <span className="text-sm">VAX Record</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-20 flex-col gap-2"
            onClick={() => {
              onClose();
              onSelectOutbreakCase();
            }}
          >
            <Users className="h-6 w-6 text-primary" />
            <span className="text-sm">Outbreak Case</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuickAddModal;
