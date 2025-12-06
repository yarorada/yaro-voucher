import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EditContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: {
    id: string;
    contract_number: string;
    status: string;
    contract_date: string;
    total_price: number;
    deposit_amount?: number | null;
    terms?: string | null;
  };
  onUpdate: () => void;
}

export function EditContractDialog({
  open,
  onOpenChange,
  contract,
  onUpdate,
}: EditContractDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [contractDate, setContractDate] = useState<Date | undefined>(undefined);
  const [formData, setFormData] = useState({
    status: "",
    total_price: "",
    deposit_amount: "",
    terms: "",
  });

  useEffect(() => {
    if (contract) {
      setFormData({
        status: contract.status || "draft",
        total_price: contract.total_price?.toString() || "",
        deposit_amount: contract.deposit_amount?.toString() || "",
        terms: contract.terms || "",
      });
      setContractDate(contract.contract_date ? new Date(contract.contract_date) : undefined);
    }
  }, [contract]);

  const handleSave = async () => {
    setLoading(true);
    try {
      // @ts-ignore - Supabase types not updated
      const { error } = await (supabase as any)
        .from("travel_contracts")
        .update({
          status: formData.status,
          total_price: parseFloat(formData.total_price) || 0,
          deposit_amount: formData.deposit_amount ? parseFloat(formData.deposit_amount) : null,
          terms: formData.terms || null,
          contract_date: contractDate ? format(contractDate, "yyyy-MM-dd") : null,
        })
        .eq("id", contract.id);

      if (error) throw error;

      toast({
        title: "Uloženo",
        description: "Smlouva byla aktualizována",
      });
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating contract:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se uložit smlouvu",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upravit smlouvu {contract.contract_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Koncept</SelectItem>
                  <SelectItem value="sent">Odesláno</SelectItem>
                  <SelectItem value="signed">Podepsáno</SelectItem>
                  <SelectItem value="cancelled">Zrušeno</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Datum smlouvy</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !contractDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {contractDate
                      ? format(contractDate, "d. M. yyyy", { locale: cs })
                      : "Vyberte datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={contractDate}
                    onSelect={setContractDate}
                    initialFocus
                    locale={cs}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Celková cena (Kč)</Label>
              <Input
                type="number"
                value={formData.total_price}
                onChange={(e) => setFormData({ ...formData, total_price: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Záloha (Kč)</Label>
              <Input
                type="number"
                value={formData.deposit_amount}
                onChange={(e) => setFormData({ ...formData, deposit_amount: e.target.value })}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Dodatečné podmínky</Label>
            <Textarea
              value={formData.terms}
              onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
              placeholder="Speciální podmínky smlouvy..."
              rows={4}
            />
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Zrušit
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Ukládání..." : "Uložit změny"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}