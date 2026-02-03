import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, Loader2 } from "lucide-react";

interface DuplicateVoucherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (travelerCount: number) => void;
  loading: boolean;
  originalTravelerCount: number;
}

export const DuplicateVoucherDialog = ({
  open,
  onOpenChange,
  onConfirm,
  loading,
  originalTravelerCount,
}: DuplicateVoucherDialogProps) => {
  const [travelerCount, setTravelerCount] = useState(originalTravelerCount.toString());

  const handleConfirm = () => {
    const count = parseInt(travelerCount, 10);
    if (count > 0) {
      onConfirm(count);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Duplikovat voucher
          </DialogTitle>
          <DialogDescription>
            Zadejte počet cestujících pro nový voucher. Všechny služby, lety a tee times budou zkopírovány.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="travelerCount">Počet cestujících</Label>
            <Input
              id="travelerCount"
              type="number"
              min="1"
              max="50"
              value={travelerCount}
              onChange={(e) => setTravelerCount(e.target.value)}
              placeholder="Počet cestujících"
            />
            <p className="text-sm text-muted-foreground">
              Původní voucher měl {originalTravelerCount} cestujících
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Zrušit
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || !travelerCount || parseInt(travelerCount, 10) < 1}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Kopíruji...
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Duplikovat
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
