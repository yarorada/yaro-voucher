import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Copy, MoreHorizontal, Filter, Trash2, FileText, ScrollText } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import yaroLogo from "@/assets/yaro-logo-wide.png";
import { DealStatusBadge } from "@/components/DealStatusBadge";
import { format } from "date-fns";
import { formatDateDisplay } from "@/lib/utils";
import { cs } from "date-fns/locale";
import { formatPriceCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Deal {
  id: string;
  deal_number: string;
  name: string | null;
  status: "inquiry" | "quote" | "confirmed" | "completed" | "cancelled" | "dispatched";
  start_date: string | null;
  end_date: string | null;
  total_price: number | null;
  destination_id: string | null;
  discount_amount: number | null;
  adjustment_amount: number | null;
  discount_note: string | null;
  adjustment_note: string | null;
  notes: string | null;
  destinations: { name: string } | null;
  deal_travelers: { clients: { first_name: string; last_name: string } }[];
  created_at: string;
  updated_at: string;
}

const Deals = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [filteredDeals, setFilteredDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("updated_at");
  
  // Duplicate dialog state
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [dealToDuplicate, setDealToDuplicate] = useState<Deal | null>(null);
  const [duplicatePersonCount, setDuplicatePersonCount] = useState("1");
  const [duplicating, setDuplicating] = useState(false);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dealToDelete, setDealToDelete] = useState<Deal | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchDeals();
  }, []);

  useEffect(() => {
    filterDeals();
  }, [searchQuery, statusFilter, deals, sortBy]);

  const fetchDeals = async () => {
    try {
      const { data, error } = await supabase
        .from("deals")
        .select(`
          id,
          deal_number,
          name,
          status,
          start_date,
          end_date,
          total_price,
          destination_id,
          discount_amount,
          adjustment_amount,
          discount_note,
          adjustment_note,
          notes,
          created_at,
          updated_at,
          destinations:destination_id (name),
          deal_travelers (
            is_lead_traveler,
            clients:client_id (
              first_name,
              last_name
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDeals(data || []);
      setFilteredDeals(data || []);
    } catch (error) {
      console.error("Error fetching deals:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterDeals = () => {
    let filtered = deals;

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((deal) => deal.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (deal) =>
          deal.deal_number.toLowerCase().includes(query) ||
          deal.destinations?.name.toLowerCase().includes(query) ||
          deal.deal_travelers.some((dt: any) =>
            dt.clients && `${dt.clients.first_name} ${dt.clients.last_name}`
              .toLowerCase()
              .includes(query)
          )
      );
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "departure_asc": {
          if (!a.start_date && !b.start_date) return 0;
          if (!a.start_date) return 1;
          if (!b.start_date) return -1;
          return a.start_date.localeCompare(b.start_date);
        }
        case "return_asc": {
          if (!a.end_date && !b.end_date) return 0;
          if (!a.end_date) return 1;
          if (!b.end_date) return -1;
          return a.end_date.localeCompare(b.end_date);
        }
        case "updated_at":
        default:
          return (b as any).updated_at?.localeCompare((a as any).updated_at) || 0;
      }
    });

    setFilteredDeals(filtered);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return formatDateDisplay(dateString);
  };

  const formatPrice = (price: number | null) => formatPriceCurrency(price);

  const openDuplicateDialog = (deal: Deal, e: React.MouseEvent) => {
    e.stopPropagation();
    setDealToDuplicate(deal);
    setDuplicatePersonCount("1");
    setDuplicateDialogOpen(true);
  };

  const handleDuplicateDeal = async () => {
    if (!dealToDuplicate) return;
    
    const personCount = parseInt(duplicatePersonCount) || 1;
    setDuplicating(true);
    
    try {
      // First, fetch the services for this deal
      const { data: services, error: servicesLoadError } = await supabase
        .from("deal_services")
        .select("*")
        .eq("deal_id", dealToDuplicate.id)
        .order("order_index");
      
      if (servicesLoadError) throw servicesLoadError;

      // Generate new deal number
      const { data: newDealNumber, error: dealNumberError } = await supabase
        .rpc("generate_deal_number");
      
      if (dealNumberError) throw dealNumberError;
      
      // Create new deal
      const { data: newDeal, error: dealError } = await supabase
        .from("deals")
        .insert({
          deal_number: newDealNumber,
          name: dealToDuplicate.name ? `${dealToDuplicate.name} (kopie)` : null,
          status: "inquiry",
          destination_id: dealToDuplicate.destination_id,
          start_date: dealToDuplicate.start_date,
          end_date: dealToDuplicate.end_date,
          notes: dealToDuplicate.notes,
          discount_amount: dealToDuplicate.discount_amount,
          adjustment_amount: dealToDuplicate.adjustment_amount,
          discount_note: dealToDuplicate.discount_note,
          adjustment_note: dealToDuplicate.adjustment_note,
        })
        .select()
        .single();
      
      if (dealError) throw dealError;
      
      // Copy services with updated person count
      if (services && services.length > 0) {
        const newServices = services.map((service, index) => ({
          deal_id: newDeal.id,
          service_type: service.service_type,
          service_name: service.service_name,
          description: service.description,
          start_date: service.start_date,
          end_date: service.end_date,
          price: service.price,
          cost_price: service.cost_price,
          cost_currency: service.cost_currency,
          cost_price_original: service.cost_price_original,
          supplier_id: service.supplier_id,
          person_count: personCount,
          details: service.details as any,
          order_index: index,
        }));
        const { error: servicesError } = await supabase
          .from("deal_services")
          .insert(newServices);
        
        if (servicesError) throw servicesError;

        // Calculate and update total price
        const servicesTotal = services.reduce((sum, service) => {
          const servicePrice = (service.price || 0) * personCount;
          return sum + servicePrice;
        }, 0);
        const finalTotal = servicesTotal - (dealToDuplicate.discount_amount || 0) + (dealToDuplicate.adjustment_amount || 0);
        
        await supabase
          .from("deals")
          .update({ total_price: finalTotal })
          .eq("id", newDeal.id);
      }
      
      toast({
        title: "Úspěch",
        description: "Obchodní případ byl zduplikován",
      });
      
      setDuplicateDialogOpen(false);
      navigate(`/deals/${newDeal.id}`);
    } catch (error) {
      console.error("Error duplicating deal:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se zduplikovat obchodní případ",
        variant: "destructive",
      });
    } finally {
      setDuplicating(false);
    }
  };

  const handleDeleteDeal = async () => {
    if (!dealToDelete) return;
    setDeleting(true);
    try {
      // Delete related data first
      await Promise.all([
        supabase.from("deal_services").delete().eq("deal_id", dealToDelete.id),
        supabase.from("deal_travelers").delete().eq("deal_id", dealToDelete.id),
        supabase.from("deal_payments").delete().eq("deal_id", dealToDelete.id),
        supabase.from("deal_documents").delete().eq("deal_id", dealToDelete.id),
      ]);

      // Delete variants and their services
      const { data: variants } = await supabase
        .from("deal_variants")
        .select("id")
        .eq("deal_id", dealToDelete.id);
      if (variants && variants.length > 0) {
        const variantIds = variants.map(v => v.id);
        await supabase.from("deal_variant_services").delete().in("variant_id", variantIds);
        await supabase.from("deal_variants").delete().eq("deal_id", dealToDelete.id);
      }

      const { error } = await supabase.from("deals").delete().eq("id", dealToDelete.id);
      if (error) throw error;

      toast({ title: "Smazáno", description: "Obchodní případ byl smazán" });
      setDeleteDialogOpen(false);
      setDealToDelete(null);
      fetchDeals();
    } catch (error) {
      console.error("Error deleting deal:", error);
      toast({ title: "Chyba", description: "Nepodařilo se smazat obchodní případ", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)]">
      <div className="container max-w-6xl mx-auto py-8 px-4">
        <header className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-4xl font-bold text-foreground">Obchodní případy</h1>
              <p className="text-muted-foreground mt-2">Správa všech obchodních příležitostí</p>
            </div>
            <Button onClick={() => navigate("/deals/new")} variant="premium" className="gap-2 w-full md:w-auto">
              <Plus className="h-4 w-4" />
              Nový případ
            </Button>
          </div>
        </header>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Načítám obchodní případy...</p>
          </div>
        ) : deals.length === 0 ? (
          <Card className="p-12 text-center shadow-[var(--shadow-medium)]">
            <Plus className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Zatím žádné obchodní případy</h2>
            <p className="text-muted-foreground mb-6">Vytvořte svůj první obchodní případ</p>
            <Button onClick={() => navigate("/deals/new")} variant="premium">
              <Plus className="h-4 w-4 mr-2" />
              Vytvořit první případ
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-muted-foreground">
                  Celkem případů: <span className="font-semibold text-foreground">{deals.length}</span>
                  {(searchQuery || statusFilter !== "all") && filteredDeals.length !== deals.length && (
                    <span className="ml-2">
                      (zobrazeno: <span className="font-semibold text-foreground">{filteredDeals.length}</span>)
                    </span>
                  )}
                </p>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px] h-9">
                    <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Filtr statusu" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Všechny statusy</SelectItem>
                    <SelectItem value="inquiry">Poptávka</SelectItem>
                    <SelectItem value="quote">Nabídka odeslána</SelectItem>
                    <SelectItem value="confirmed">Potvrzeno</SelectItem>
                    <SelectItem value="dispatched">Expedováno</SelectItem>
                    <SelectItem value="completed">Dokončeno</SelectItem>
                    <SelectItem value="cancelled">Zrušeno</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[200px] h-9">
                    <SelectValue placeholder="Řazení" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="updated_at">Poslední změna</SelectItem>
                    <SelectItem value="departure_asc">Nejbližší odjezd</SelectItem>
                    <SelectItem value="return_asc">Datum návratu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Hledat podle čísla, destinace nebo klienta..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {filteredDeals.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">Nenalezeny žádné případy odpovídající vašemu hledání</p>
              </Card>
            ) : (
              filteredDeals.map((deal) => {
                const mainTravelers = [...deal.deal_travelers]
                  .filter((dt: any) => dt.clients)
                  .sort((a: any, b: any) => (b.is_lead_traveler ? 1 : 0) - (a.is_lead_traveler ? 1 : 0))
                  .map((dt: any) => `${dt.clients.first_name} ${dt.clients.last_name}`)
                  .join(", ");
                const displayName = deal.name || deal.destinations?.name || deal.deal_number;

                return (
                  <Card key={deal.id} className="p-4 md:p-6 hover:shadow-[var(--shadow-medium)] transition-shadow cursor-pointer" onClick={() => navigate(`/deals/${deal.id}`)}>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
                          <DealStatusBadge status={deal.status} />
                          <h3 className="text-lg md:text-xl font-bold text-foreground truncate">{displayName}</h3>
                        </div>
                        <div className="flex flex-wrap gap-2 md:gap-4 text-xs md:text-sm text-muted-foreground">
                          {mainTravelers && (
                            <span>
                              <span className="font-semibold text-foreground">Klient:</span> {mainTravelers}
                            </span>
                          )}
                          {deal.destinations?.name && (
                            <span>
                              <span className="font-semibold text-foreground">Destinace:</span> {deal.destinations.name}
                            </span>
                          )}
                          {deal.start_date && (
                            <span>
                              <span className="font-semibold text-foreground">Datum:</span> {formatDate(deal.start_date)}
                              {deal.end_date && ` - ${formatDate(deal.end_date)}`}
                            </span>
                          )}
                          {deal.total_price && (
                            <span>
                              <span className="font-semibold text-foreground">Cena:</span> {formatPrice(deal.total_price)}
                            </span>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/contracts/new?dealId=${deal.id}`); }}>
                            <ScrollText className="h-4 w-4 mr-2" />
                            Vytvořit smlouvu
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/vouchers/new?dealId=${deal.id}`); }}>
                            <FileText className="h-4 w-4 mr-2" />
                            Vytvořit voucher
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => openDuplicateDialog(deal, e)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplikovat
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => { e.stopPropagation(); setDealToDelete(deal); setDeleteDialogOpen(true); }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Smazat
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Duplicate Dialog */}
      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplikovat obchodní případ</DialogTitle>
            <DialogDescription>
              Vytvoří se kopie obchodního případu se všemi službami. 
              Zadejte počet osob pro nový případ.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="personCount">Počet osob</Label>
              <Input
                id="personCount"
                type="number"
                min="1"
                value={duplicatePersonCount}
                onChange={(e) => setDuplicatePersonCount(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateDialogOpen(false)}>
              Zrušit
            </Button>
            <Button onClick={handleDuplicateDeal} disabled={duplicating}>
              {duplicating ? "Duplikuji..." : "Duplikovat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Smazat obchodní případ</DialogTitle>
            <DialogDescription>
              Opravdu chcete smazat případ <strong>{dealToDelete?.deal_number}</strong>? Tato akce je nevratná a smaže všechny související služby, cestující a dokumenty.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Zrušit
            </Button>
            <Button variant="destructive" onClick={handleDeleteDeal} disabled={deleting}>
              {deleting ? "Mažu..." : "Smazat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Deals;
