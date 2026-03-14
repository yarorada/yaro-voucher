import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, CheckCircle2, Copy, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { VariantDetailDialog } from "./VariantDetailDialog";
import { formatPrice } from "@/lib/utils";
import { getServiceTotal } from "@/lib/servicePrice";

interface DealVariant {
  id: string;
  variant_name: string;
  destination_id: string | null;
  start_date: string | null;
  end_date: string | null;
  total_price: number | null;
  notes: string | null;
  is_selected: boolean;
  hide_price: boolean;
  destination?: {
    name: string;
  };
  deal_variant_services?: Array<{
    price: number | null;
    cost_price: number | null;
    cost_price_original: number | null;
    cost_currency: string | null;
    quantity: number;
    person_count: number | null;
    price_currency: string | null;
    details: any;
  }>;
}

interface DealVariantsProps {
  dealId: string;
  onVariantSelected?: () => void;
}

export const DealVariants = ({ dealId, onVariantSelected }: DealVariantsProps) => {
  const { toast } = useToast();
  const [variants, setVariants] = useState<DealVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<DealVariant | null>(null);
  const [dealDates, setDealDates] = useState<{ start_date: string | null; end_date: string | null }>({ 
    start_date: null, 
    end_date: null 
  });
  const [travelerCount, setTravelerCount] = useState(1);

  useEffect(() => {
    fetchVariants();
    fetchDealDates();
    fetchTravelerCount();
  }, [dealId]);

  const fetchDealDates = async () => {
    try {
      const { data, error } = await supabase
        .from("deals")
        .select("start_date, end_date")
        .eq("id", dealId)
        .single();

      if (error) throw error;
      if (data) {
        setDealDates({
          start_date: data.start_date,
          end_date: data.end_date,
        });
      }
    } catch (error) {
      console.error("Error fetching deal dates:", error);
    }
  };

  const fetchTravelerCount = async () => {
    try {
      const { count, error } = await supabase
        .from("deal_travelers")
        .select("*", { count: "exact", head: true })
        .eq("deal_id", dealId);

      if (error) throw error;
      setTravelerCount(count || 1);
    } catch (error) {
      console.error("Error fetching traveler count:", error);
    }
  };

  const fetchVariants = async () => {
    try {
      const { data, error } = await supabase
        .from("deal_variants")
        .select(`
          *,
          destination:destinations(name),
          deal_variant_services(price, cost_price, cost_price_original, cost_currency, quantity, person_count, price_currency, details)
        `)
        .eq("deal_id", dealId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setVariants(data || []);
    } catch (error) {
      console.error("Error fetching variants:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se načíst varianty",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectVariant = async (variantId: string) => {
    // Check for missing suppliers before confirming
    try {
      const { data: variantServices } = await supabase
        .from("deal_variant_services")
        .select("service_name, supplier_id")
        .eq("variant_id", variantId);

      const missingSupplier = variantServices?.filter(s => !s.supplier_id) || [];
      
      if (missingSupplier.length > 0) {
        const serviceNames = missingSupplier.map(s => s.service_name).join(", ");
        if (!confirm(
          `Upozornění: U následujících služeb není zadán dodavatel:\n\n${serviceNames}\n\nChcete přesto pokračovat s výběrem varianty?`
        )) return;
      } else {
        if (!confirm("Opravdu chcete vybrat tuto variantu jako finální?")) return;
      }

      const { error } = await supabase.rpc("select_deal_variant", {
        p_variant_id: variantId,
      });

      if (error) throw error;

      // Copy services to main deal
      await copyServicesToMain(variantId);

      // Update deal dates, destination, and prices from variant
      await updateDealFromVariant(variantId);

      // Auto-create payment schedule (50% deposit + 50% final)
      await createPaymentScheduleFromVariant(variantId);

      toast({
        title: "Úspěch",
        description: "Varianta byla vybrána, služby zkopírovány a platební kalendář vytvořen",
      });

      fetchVariants();
      onVariantSelected?.();
    } catch (error) {
      console.error("Error selecting variant:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se vybrat variantu",
        variant: "destructive",
      });
    }
  };

  const handleUnselectVariant = async (variantId: string) => {
    if (!confirm("Opravdu chcete zrušit výběr varianty? Služby v obchodním případu budou smazány.")) return;

    try {
      // Deselect the variant
      await supabase
        .from("deal_variants")
        .update({ is_selected: false })
        .eq("id", variantId);

      // Delete copied deal services
      await supabase
        .from("deal_services")
        .delete()
        .eq("deal_id", dealId);

      // Delete deal payments
      await supabase
        .from("deal_payments")
        .delete()
        .eq("deal_id", dealId);

      // Clear deal-level dates/price/destination
      await supabase
        .from("deals")
        .update({
          total_price: null,
          start_date: null,
          end_date: null,
          destination_id: null,
        })
        .eq("id", dealId);

      toast({
        title: "Úspěch",
        description: "Výběr varianty byl zrušen a služby smazány",
      });

      fetchVariants();
      onVariantSelected?.();
    } catch (error) {
      console.error("Error unselecting variant:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se zrušit výběr varianty",
        variant: "destructive",
      });
    }
  };

  const updateDealFromVariant = async (variantId: string) => {
    // Fetch variant info (destination) and its services (dates, prices)
    const [{ data: variant }, { data: services }] = await Promise.all([
      supabase.from("deal_variants").select("destination_id").eq("id", variantId).single(),
      supabase.from("deal_variant_services").select("start_date, end_date, price, cost_price, quantity, person_count, price_currency, details").eq("variant_id", variantId),
    ]);

    const updateData: Record<string, any> = {};

    // Propagate destination
    if (variant?.destination_id) {
      updateData.destination_id = variant.destination_id;
    }

    if (services && services.length > 0) {
      // Propagate earliest start_date and latest end_date
      const startDates = services.map(s => s.start_date).filter(Boolean).sort();
      const endDates = services.map(s => s.end_date).filter(Boolean).sort();
      if (startDates[0]) updateData.start_date = startDates[0];
      if (endDates[endDates.length - 1]) updateData.end_date = endDates[endDates.length - 1];

      // Propagate total_price and currency
      const totalPrice = services.reduce((sum, s) => sum + getServiceTotal(s), 0);
      if (totalPrice > 0) updateData.total_price = totalPrice;
      const serviceCurrency = services.find(s => (s as any).price_currency)?.price_currency;
      if (serviceCurrency) updateData.currency = serviceCurrency;
    }

    if (Object.keys(updateData).length > 0) {
      await supabase.from("deals").update(updateData).eq("id", dealId);
    }
  };

  const createPaymentScheduleFromVariant = async (variantId: string) => {
    // Get variant total price
    const { data: variantServices } = await supabase
      .from("deal_variant_services")
      .select("price, quantity")
      .eq("variant_id", variantId);

    if (!variantServices || variantServices.length === 0) return;

    const totalPrice = variantServices.reduce((sum, s) => sum + ((s.price || 0) * (s.quantity || 1)), 0); // payment schedule uses raw price*qty
    if (totalPrice <= 0) return;

    // Delete existing payments so we can recreate them for the new variant
    await supabase
      .from("deal_payments")
      .delete()
      .eq("deal_id", dealId);

    // Get deal start date for due dates
    const { data: deal } = await supabase
      .from("deals")
      .select("start_date")
      .eq("id", dealId)
      .single();

    const depositAmount = Math.round(totalPrice * 0.5);
    const finalAmount = totalPrice - depositAmount;

    const now = new Date();
    const startDate = deal?.start_date ? new Date(deal.start_date + "T00:00:00") : null;
    const daysUntilDeparture = startDate
      ? Math.floor((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    let payments;

    if (daysUntilDeparture < 45) {
      // Less than 45 days — single full payment (doplatek) due in 2 days
      const dueDateStr = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      payments = [
        {
          deal_id: dealId,
          payment_type: "final",
          amount: totalPrice,
          due_date: dueDateStr,
          notes: "Doplatek (plná výše)",
        },
      ];
    } else {
      // 45+ days — 50% deposit + 50% final
      const depositAmount = Math.round(totalPrice * 0.5);
      const finalAmount = totalPrice - depositAmount;
      const depositDue = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const finalDue = startDate
        ? new Date(startDate.getTime() - 30 * 24 * 60 * 60 * 1000)
        : new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

      payments = [
        {
          deal_id: dealId,
          payment_type: "deposit",
          amount: depositAmount,
          due_date: depositDue.toISOString().split("T")[0],
          notes: "1. záloha",
        },
        {
          deal_id: dealId,
          payment_type: "final",
          amount: finalAmount,
          due_date: finalDue.toISOString().split("T")[0],
          notes: "Doplatek",
        },
      ];
    }

    await supabase.from("deal_payments").insert(payments);
  };

  const handleDeleteVariant = async (variantId: string, isSelected: boolean) => {
    if (isSelected) {
      toast({
        title: "Chyba",
        description: "Nelze smazat vybranou variantu",
        variant: "destructive",
      });
      return;
    }

    if (!confirm("Opravdu chcete smazat tuto variantu?")) return;

    try {
      const { error } = await supabase
        .from("deal_variants")
        .delete()
        .eq("id", variantId);

      if (error) throw error;

      toast({
        title: "Úspěch",
        description: "Varianta byla smazána",
      });

      fetchVariants();
    } catch (error) {
      console.error("Error deleting variant:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se smazat variantu",
        variant: "destructive",
      });
    }
  };

  const handleDuplicateVariant = async (variant: DealVariant) => {
    try {
      // Create new variant
      const { data: newVariant, error: variantError } = await supabase
        .from("deal_variants")
        .insert({
          deal_id: dealId,
          variant_name: `${variant.variant_name} (kopie)`,
          destination_id: variant.destination_id,
          start_date: variant.start_date,
          end_date: variant.end_date,
          total_price: variant.total_price,
          notes: variant.notes,
          is_selected: false,
        })
        .select("id")
        .single();

      if (variantError) throw variantError;

      // Copy services
      const { data: services, error: svcError } = await supabase
        .from("deal_variant_services")
        .select("*")
        .eq("variant_id", variant.id)
        .order("order_index");

      if (svcError) throw svcError;

      if (services && services.length > 0) {
        const newServices = services.map(({ id, variant_id, created_at, updated_at, ...rest }) => ({
          ...rest,
          variant_id: newVariant.id,
        }));
        const { error: insertError } = await supabase
          .from("deal_variant_services")
          .insert(newServices);
        if (insertError) throw insertError;
      }

      toast({
        title: "Úspěch",
        description: "Varianta byla zduplikována",
      });
      fetchVariants();
    } catch (error) {
      console.error("Error duplicating variant:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se zduplikovat variantu",
        variant: "destructive",
      });
    }
  };

  const copyServicesToMain = async (variantId: string) => {
    // Get variant services
    const { data: variantServices, error: fetchError } = await supabase
      .from("deal_variant_services")
      .select("*")
      .eq("variant_id", variantId)
      .order("order_index");

    if (fetchError) throw fetchError;

    // Delete existing deal services
    const { error: deleteError } = await supabase
      .from("deal_services")
      .delete()
      .eq("deal_id", dealId);

    if (deleteError) throw deleteError;

    // Insert variant services as deal services
    if (variantServices && variantServices.length > 0) {
      const dealServices = variantServices.map((vs) => ({
        deal_id: dealId,
        service_type: vs.service_type,
        service_name: vs.service_name,
        description: vs.description,
        supplier_id: vs.supplier_id,
        start_date: vs.start_date,
        end_date: vs.end_date,
        person_count: vs.person_count,
        quantity: (vs as any).quantity || 1,
        price: vs.price,
        price_currency: (vs as any).price_currency || "CZK",
        cost_price: vs.cost_price,
        cost_currency: (vs as any).cost_currency || "CZK",
        cost_price_original: (vs as any).cost_price_original,
        details: vs.details,
        order_index: vs.order_index,
      }));

      const { error: insertError } = await supabase
        .from("deal_services")
        .insert(dealServices);

      if (insertError) throw insertError;
    }
  };

  const handleEditVariant = (variant: DealVariant) => {
    setEditingVariant(variant);
    setDialogOpen(true);
  };

  const handleAddVariant = () => {
    setEditingVariant(null);
    setDialogOpen(true);
  };

  const handleDialogClose = (success?: boolean) => {
    const wasSelectedVariant = editingVariant?.is_selected;
    setDialogOpen(false);
    setEditingVariant(null);
    // Always refetch — services may have been modified directly without clicking Save
    fetchVariants();
    if (success || wasSelectedVariant) {
      onVariantSelected?.();
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("cs-CZ");
  };

  

  if (loading) {
    return <div>Načítám varianty...</div>;
  }

  const selectedVariant = variants.find(v => v.is_selected);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Nabídkové varianty</h3>
          <p className="text-sm text-muted-foreground">
            Vytvořte a porovnejte různé varianty nabídky
          </p>
        </div>
        <Button onClick={handleAddVariant}>
          <Plus className="h-4 w-4 mr-2" />
          Přidat variantu
        </Button>
      </div>

      {selectedVariant && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Vybraná varianta</CardTitle>
            </div>
            <CardDescription>
              Zobrazené údaje odpovídají variantě: {selectedVariant.variant_name}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {variants.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <p className="text-muted-foreground mb-4">Zatím nejsou vytvořeny žádné varianty</p>
            <Button onClick={handleAddVariant} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Vytvořit první variantu
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {variants.map((variant) => (
            <Card key={variant.id} className={variant.is_selected ? "border-primary" : ""}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      {variant.variant_name}
                      {variant.is_selected && (
                        <Badge variant="default" className="ml-2">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Vybraná
                        </Badge>
                      )}
                    </CardTitle>
                    {variant.destination && (
                      <CardDescription>{variant.destination.name}</CardDescription>
                    )}
                  </div>
                  {!variant.is_selected ? (
                    <Button
                      onClick={() => handleSelectVariant(variant.id)}
                      size="sm"
                      className="bg-orange-500 hover:bg-orange-600 text-white shrink-0"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Vybrat jako finální
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleUnselectVariant(variant.id)}
                      size="sm"
                      variant="outline"
                      className="text-destructive border-destructive hover:bg-destructive/10 shrink-0"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Zrušit výběr
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Datum od</p>
                    <p className="font-medium">{formatDate(variant.start_date)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Datum do</p>
                    <p className="font-medium">{formatDate(variant.end_date)}</p>
                  </div>
                </div>
                
                {(() => {
                  const services = variant.deal_variant_services || [];
                  const currency = services.find(s => s.price_currency)?.price_currency || "CZK";
                  const revenue = services.reduce((sum, s) => sum + getServiceTotal(s), 0);

                  // Convert cost prices to selling currency
                  const costs = services.reduce((sum, s) => {
                    const mult = s.details?.price_mode === "per_person" ? (s.person_count || 1) : (s.quantity || 1);
                    const costCur = s.cost_currency || "CZK";
                    if (costCur === currency) {
                      const costVal = s.cost_price_original != null ? s.cost_price_original : (s.cost_price || 0);
                      return sum + costVal * mult;
                    }
                    if (currency === "CZK") {
                      return sum + (s.cost_price || 0) * mult;
                    }
                    const rateService = services.find(rs => rs.cost_price_original && rs.cost_price_original > 0 && rs.cost_price && rs.cost_price > 0 && rs.cost_currency === currency);
                    if (rateService) {
                      const rate = rateService.cost_price! / rateService.cost_price_original!;
                      return sum + ((s.cost_price || 0) / rate) * mult;
                    }
                    return sum + (s.cost_price || 0) * mult;
                  }, 0);

                  const profit = revenue - costs;
                  return (
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                         <p className="text-muted-foreground">Prodejní cena</p>
                         <p className="font-semibold">{formatPrice(revenue || variant.total_price, true, currency)}</p>
                       </div>
                       <div>
                         <p className="text-muted-foreground">Nákupní cena</p>
                         <p className="font-semibold">{formatPrice(costs || null, true, currency)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Zisk</p>
                        <p className={`font-semibold ${profit > 0 ? 'text-green-600 dark:text-green-400' : profit < 0 ? 'text-destructive' : ''}`}>
                          {services.length > 0 ? formatPrice(profit, true, currency) : '-'}
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {variant.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground">Poznámka</p>
                    <p className="text-sm">{variant.notes}</p>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id={`hide-price-${variant.id}`}
                    checked={variant.hide_price}
                    onChange={async (e) => {
                      const checked = e.target.checked;
                      await supabase.from("deal_variants").update({ hide_price: checked }).eq("id", variant.id);
                      fetchVariants();
                    }}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <label htmlFor={`hide-price-${variant.id}`} className="text-sm cursor-pointer text-muted-foreground select-none">
                    Neuváděj celkovou cenu
                  </label>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    onClick={() => handleEditVariant(variant)}
                    size="sm"
                    variant="outline"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Upravit
                  </Button>
                  <Button
                    onClick={() => handleDuplicateVariant(variant)}
                    size="sm"
                    variant="ghost"
                    title="Duplikovat variantu"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => handleDeleteVariant(variant.id, variant.is_selected)}
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <VariantDetailDialog
        dealId={dealId}
        variant={editingVariant}
        open={dialogOpen}
        onClose={handleDialogClose}
        dealStartDate={dealDates.start_date}
        dealEndDate={dealDates.end_date}
        defaultTravelerCount={travelerCount}
      />
    </div>
  );
};
