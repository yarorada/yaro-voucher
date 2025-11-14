import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { FileText, Loader2 } from "lucide-react";

interface CreateVoucherFromContractProps {
  contractId: string;
  contractStatus: string;
}

export function CreateVoucherFromContract({
  contractId,
  contractStatus,
}: CreateVoucherFromContractProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCreateVoucher = async () => {
    setLoading(true);
    try {
      // Call edge function to translate and create voucher
      const { data, error } = await supabase.functions.invoke(
        "translate-contract-to-voucher",
        {
          body: { contractId },
        }
      );

      if (error) throw error;

      toast({
        title: "Voucher vytvořen",
        description: "Voucher byl úspěšně vytvořen a přeložen do angličtiny",
      });

      setOpen(false);
      
      // Navigate to the new voucher
      if (data?.voucher?.id) {
        navigate(`/vouchers/${data.voucher.id}`);
      }
    } catch (error) {
      console.error("Error creating voucher:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se vytvořit voucher. Zkuste to znovu.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Only show button for signed contracts
  if (contractStatus !== "signed") {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <FileText className="h-4 w-4 mr-2" />
          Vytvořit voucher
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-heading-2">Vytvořit voucher ze smlouvy</DialogTitle>
          <DialogDescription className="text-body">
            Systém automaticky vytvoří voucher s přeloženými službami do angličtiny.
            Voucher bude propojen s touto cestovní smlouvou.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="rounded-lg bg-muted p-4 space-y-2">
            <p className="text-sm font-medium">Co se stane:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Načtou se služby z cestovní smlouvy</li>
              <li>Služby se automaticky přeloží do angličtiny pomocí AI</li>
              <li>Vytvoří se nový voucher s přeloženými údaji</li>
              <li>Voucher se propojí s touto smlouvou</li>
            </ul>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Zrušit
            </Button>
            <Button onClick={handleCreateVoucher} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Vytvořit voucher
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
