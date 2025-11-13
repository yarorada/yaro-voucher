import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { DateInput } from "@/components/ui/date-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SupplierCombobox } from "./SupplierCombobox";

interface VariantServiceDialogProps {
  variantId: string;
  service: any;
  open: boolean;
  onClose: (success?: boolean) => void;
}

export const VariantServiceDialog = ({
  variantId,
  service,
  open,
  onClose,
}: VariantServiceDialogProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [serviceType, setServiceType] = useState<"flight" | "hotel" | "golf" | "transfer" | "insurance" | "other">("hotel");
  const [serviceName, setServiceName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [price, setPrice] = useState("");
  const [personCount, setPersonCount] = useState("1");
  const [supplierId, setSupplierId] = useState("");

  useEffect(() => {
    if (service) {
      setServiceType(service.service_type);
      setServiceName(service.service_name);
      setDescription(service.description || "");
      setStartDate(service.start_date ? new Date(service.start_date) : undefined);
      setEndDate(service.end_date ? new Date(service.end_date) : undefined);
      setPrice(service.price?.toString() || "");
      setPersonCount(service.person_count?.toString() || "1");
      setSupplierId(service.supplier_id || "");
    } else {
      resetForm();
    }
  }, [service]);

  const resetForm = () => {
    setServiceType("hotel");
    setServiceName("");
    setDescription("");
    setStartDate(undefined);
    setEndDate(undefined);
    setPrice("");
    setPersonCount("1");
    setSupplierId("");
  };

  const handleSave = async () => {
    if (!serviceName.trim()) {
      toast({
        title: "Chyba",
        description: "Vyplňte název služby",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (service) {
        // Update existing service
        const { error } = await supabase
          .from("deal_variant_services")
          .update({
            service_type: serviceType,
            service_name: serviceName,
            description: description || null,
            start_date: startDate?.toISOString() || null,
            end_date: endDate?.toISOString() || null,
            price: price ? parseFloat(price) : null,
            person_count: personCount ? parseInt(personCount) : 1,
            supplier_id: supplierId || null,
          })
          .eq("id", service.id);

        if (error) throw error;
      } else {
        // Create new service
        const { error } = await supabase
          .from("deal_variant_services")
          .insert({
            variant_id: variantId,
            service_type: serviceType,
            service_name: serviceName,
            description: description || null,
            start_date: startDate?.toISOString() || null,
            end_date: endDate?.toISOString() || null,
            price: price ? parseFloat(price) : null,
            person_count: personCount ? parseInt(personCount) : 1,
            supplier_id: supplierId || null,
          });

        if (error) throw error;
      }

      toast({
        title: "Úspěch",
        description: service ? "Služba byla aktualizována" : "Služba byla přidána",
      });

      onClose(true);
      resetForm();
    } catch (error) {
      console.error("Error saving service:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se uložit službu",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {service ? "Upravit službu" : "Přidat službu"}
          </DialogTitle>
          <DialogDescription>
            Zadejte informace o službě pro tuto variantu
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="service-type">Typ služby *</Label>
            <Select value={serviceType} onValueChange={(value: any) => setServiceType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flight">Letenka</SelectItem>
                <SelectItem value="hotel">Ubytování</SelectItem>
                <SelectItem value="golf">Green Fee</SelectItem>
                <SelectItem value="transfer">Doprava</SelectItem>
                <SelectItem value="insurance">Pojištění</SelectItem>
                <SelectItem value="other">Ostatní</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="service-name">Název služby *</Label>
            <Input
              id="service-name"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder="např. Hotel Paradise Resort"
            />
          </div>

          <div>
            <Label htmlFor="description">Popis</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Podrobnosti o službě..."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="supplier">Dodavatel</Label>
            <SupplierCombobox
              value={supplierId}
              onChange={setSupplierId}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start-date">Datum od</Label>
              <DateInput
                value={startDate}
                onChange={setStartDate}
                placeholder="DD.MM.RR"
              />
            </div>
            <div>
              <Label htmlFor="end-date">Datum do</Label>
              <DateInput
                value={endDate}
                onChange={setEndDate}
                placeholder="DD.MM.RR"
                autoSetDate={() => startDate ? new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000) : undefined}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="person-count">Počet osob</Label>
              <Input
                id="person-count"
                type="number"
                min="1"
                value={personCount}
                onChange={(e) => setPersonCount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="price">Cena za osobu (Kč)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          {price && personCount && (
            <div className="bg-muted p-3 rounded-md">
              <p className="text-sm font-medium">
                Celková cena: {new Intl.NumberFormat("cs-CZ", {
                  style: "currency",
                  currency: "CZK",
                }).format(parseFloat(price) * parseInt(personCount))}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onClose()}>
              Zrušit
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Ukládám..." : service ? "Uložit změny" : "Přidat službu"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
