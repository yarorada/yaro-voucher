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
import { DestinationCombobox } from "./DestinationCombobox";
import { VariantServiceDialog } from "./VariantServiceDialog";
import { Plus, Edit, Trash2, Plane, Hotel, Navigation, Car, Shield, FileText } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface VariantService {
  id: string;
  service_type: "flight" | "hotel" | "golf" | "transfer" | "insurance" | "other";
  service_name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  price: number | null;
  person_count: number | null;
  supplier_id: string | null;
  suppliers?: {
    name: string;
  };
}

interface VariantDetailDialogProps {
  dealId: string;
  variant: any;
  open: boolean;
  onClose: (success?: boolean) => void;
  dealStartDate?: string | null;
  dealEndDate?: string | null;
}

export const VariantDetailDialog = ({
  dealId,
  variant,
  open,
  onClose,
  dealStartDate,
  dealEndDate,
}: VariantDetailDialogProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [variantName, setVariantName] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState("");
  const [services, setServices] = useState<VariantService[]>([]);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<VariantService | null>(null);

  useEffect(() => {
    if (variant) {
      setVariantName(variant.variant_name || "");
      setDestinationId(variant.destination_id || "");
      setStartDate(variant.start_date ? new Date(variant.start_date) : undefined);
      setEndDate(variant.end_date ? new Date(variant.end_date) : undefined);
      setNotes(variant.notes || "");
      fetchServices(variant.id);
    } else {
      resetForm();
    }
  }, [variant]);

  const resetForm = () => {
    setVariantName("");
    setDestinationId("");
    setStartDate(dealStartDate ? new Date(dealStartDate) : undefined);
    setEndDate(dealEndDate ? new Date(dealEndDate) : undefined);
    setNotes("");
    setServices([]);
  };

  const fetchServices = async (variantId: string) => {
    try {
      const { data, error } = await supabase
        .from("deal_variant_services")
        .select(`
          *,
          suppliers(name)
        `)
        .eq("variant_id", variantId);

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error("Error fetching variant services:", error);
    }
  };

  const calculateTotalPrice = () => {
    return services.reduce((sum, service) => {
      const servicePrice = (service.price || 0) * (service.person_count || 1);
      return sum + servicePrice;
    }, 0);
  };

  const handleSave = async () => {
    if (!variantName.trim()) {
      toast({
        title: "Chyba",
        description: "Vyplňte název varianty",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const totalPrice = calculateTotalPrice();
      
      if (variant) {
        // Update existing variant
        const { error } = await supabase
          .from("deal_variants")
          .update({
            variant_name: variantName,
            destination_id: destinationId || null,
            start_date: startDate?.toISOString() || null,
            end_date: endDate?.toISOString() || null,
            total_price: totalPrice,
            notes: notes || null,
          })
          .eq("id", variant.id);

        if (error) throw error;
      } else {
        // Create new variant
        const { data, error } = await supabase
          .from("deal_variants")
          .insert({
            deal_id: dealId,
            variant_name: variantName,
            destination_id: destinationId || null,
            start_date: startDate?.toISOString() || null,
            end_date: endDate?.toISOString() || null,
            total_price: totalPrice,
            notes: notes || null,
            is_selected: false,
          })
          .select()
          .single();

        if (error) throw error;
        
        // Fetch services for the new variant (should be empty initially)
        if (data) {
          fetchServices(data.id);
        }
      }

      toast({
        title: "Úspěch",
        description: variant ? "Varianta byla aktualizována" : "Varianta byla vytvořena",
      });

      onClose(true);
      resetForm();
    } catch (error) {
      console.error("Error saving variant:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se uložit variantu",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm("Opravdu chcete smazat tuto službu?")) return;

    try {
      const { error } = await supabase
        .from("deal_variant_services")
        .delete()
        .eq("id", serviceId);

      if (error) throw error;

      toast({
        title: "Úspěch",
        description: "Služba byla smazána",
      });

      if (variant) {
        fetchServices(variant.id);
      }
    } catch (error) {
      console.error("Error deleting service:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se smazat službu",
        variant: "destructive",
      });
    }
  };

  const handleServiceSaved = () => {
    if (variant) {
      fetchServices(variant.id);
    }
  };

  const getServiceIcon = (type: VariantService["service_type"]) => {
    switch (type) {
      case "flight": return <Plane className="h-4 w-4" />;
      case "hotel": return <Hotel className="h-4 w-4" />;
      case "golf": return <Navigation className="h-4 w-4" />;
      case "transfer": return <Car className="h-4 w-4" />;
      case "insurance": return <Shield className="h-4 w-4" />;
      case "other": return <FileText className="h-4 w-4" />;
    }
  };

  const getServiceTypeLabel = (type: VariantService["service_type"]) => {
    switch (type) {
      case "flight": return "Letenka";
      case "hotel": return "Ubytování";
      case "golf": return "Green Fee";
      case "transfer": return "Doprava";
      case "insurance": return "Pojištění";
      case "other": return "Ostatní";
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("cs-CZ");
  };

  const formatPrice = (price: number | null) => {
    if (!price) return "-";
    return new Intl.NumberFormat("cs-CZ", {
      style: "currency",
      currency: "CZK",
    }).format(price);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={() => onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {variant ? "Upravit variantu" : "Nová varianta"}
            </DialogTitle>
            <DialogDescription>
              Vytvořte variantu nabídky s různými destinacemi a službami
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="variant-name">Název varianty *</Label>
                <Input
                  id="variant-name"
                  value={variantName}
                  onChange={(e) => setVariantName(e.target.value)}
                  placeholder="např. Varianta A - Marrakech"
                />
              </div>

              <div>
                <Label htmlFor="destination">Destinace</Label>
                <DestinationCombobox
                  value={destinationId}
                  onValueChange={setDestinationId}
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

              <div>
                <Label htmlFor="notes">Poznámky</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Poznámky k této variantě..."
                  rows={3}
                />
              </div>
            </div>

            {variant && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">Služby</h4>
                    <p className="text-sm text-muted-foreground">
                      Celková cena: {formatPrice(calculateTotalPrice())}
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setEditingService(null);
                      setServiceDialogOpen(true);
                    }}
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Přidat službu
                  </Button>
                </div>

                {services.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Zatím nejsou přidány žádné služby
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Typ</TableHead>
                        <TableHead>Název</TableHead>
                        <TableHead>Datum</TableHead>
                        <TableHead>Počet osob</TableHead>
                        <TableHead>Cena</TableHead>
                        <TableHead className="w-[100px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {services.map((service) => (
                        <TableRow key={service.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getServiceIcon(service.service_type)}
                              <span className="text-sm">
                                {getServiceTypeLabel(service.service_type)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{service.service_name}</div>
                              {service.suppliers && (
                                <div className="text-sm text-muted-foreground">
                                  {service.suppliers.name}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(service.start_date)}
                            {service.end_date && ` - ${formatDate(service.end_date)}`}
                          </TableCell>
                          <TableCell>{service.person_count || 1}</TableCell>
                          <TableCell className="font-medium">
                            {formatPrice((service.price || 0) * (service.person_count || 1))}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                onClick={() => {
                                  setEditingService(service);
                                  setServiceDialogOpen(true);
                                }}
                                size="sm"
                                variant="ghost"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                onClick={() => handleDeleteService(service.id)}
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}

            {!variant && (
              <p className="text-sm text-muted-foreground">
                Po vytvoření varianty budete moci přidat služby
              </p>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => onClose()}>
                Zrušit
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Ukládám..." : variant ? "Uložit změny" : "Vytvořit variantu"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {variant && (
        <VariantServiceDialog
          variantId={variant.id}
          service={editingService}
          open={serviceDialogOpen}
          onClose={(success) => {
            setServiceDialogOpen(false);
            setEditingService(null);
            if (success) {
              handleServiceSaved();
            }
          }}
        />
      )}
    </>
  );
};
