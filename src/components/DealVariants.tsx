import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { VariantDetailDialog } from "./VariantDetailDialog";

interface DealVariant {
  id: string;
  variant_name: string;
  destination_id: string | null;
  start_date: string | null;
  end_date: string | null;
  total_price: number | null;
  notes: string | null;
  is_selected: boolean;
  destination?: {
    name: string;
  };
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

  useEffect(() => {
    fetchVariants();
    fetchDealDates();
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

  const fetchVariants = async () => {
    try {
      const { data, error } = await supabase
        .from("deal_variants")
        .select(`
          *,
          destination:destinations(name)
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
    if (!confirm("Opravdu chcete použít tuto variantu jako finální? Tato akce přepíše současné údaje obchodního případu.")) return;

    try {
      const { error } = await supabase.rpc("select_deal_variant", {
        p_variant_id: variantId,
      });

      if (error) throw error;

      toast({
        title: "Úspěch",
        description: "Varianta byla vybrána a údaje byly aktualizovány",
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

  const handleEditVariant = (variant: DealVariant) => {
    setEditingVariant(variant);
    setDialogOpen(true);
  };

  const handleAddVariant = () => {
    setEditingVariant(null);
    setDialogOpen(true);
  };

  const handleDialogClose = (success?: boolean) => {
    setDialogOpen(false);
    setEditingVariant(null);
    if (success) {
      fetchVariants();
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
                
                <div>
                  <p className="text-sm text-muted-foreground">Celková cena</p>
                  <p className="text-lg font-semibold">{formatPrice(variant.total_price)}</p>
                </div>

                {variant.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground">Poznámka</p>
                    <p className="text-sm">{variant.notes}</p>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  {!variant.is_selected && (
                    <Button
                      onClick={() => handleSelectVariant(variant.id)}
                      size="sm"
                      variant="default"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Vybrat jako finální
                    </Button>
                  )}
                  <Button
                    onClick={() => handleEditVariant(variant)}
                    size="sm"
                    variant="outline"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Upravit
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
      />
    </div>
  );
};
