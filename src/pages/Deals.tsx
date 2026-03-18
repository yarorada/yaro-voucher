import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useDataScope } from "@/hooks/useDataScope";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Copy, MoreHorizontal, Filter, Trash2, FileText, ScrollText, X } from "lucide-react";
import { DateRangeFilter, defaultDateRangeFilter, type DateRangeFilterValue } from "@/components/DateRangeFilter";
import { usePageToolbar } from "@/hooks/usePageToolbar";
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
import { formatDateDisplay, removeDiacritics } from "@/lib/utils";
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
  status: "inquiry" | "quote" | "approved" | "confirmed" | "completed" | "cancelled" | "dispatched";
  start_date: string | null;
  end_date: string | null;
  total_price: number | null;
  destination_id: string | null;
  discount_amount: number | null;
  adjustment_amount: number | null;
  discount_note: string | null;
  adjustment_note: string | null;
  notes: string | null;
  tee_times: any | null;
  destinations: { name: string; countries: { iso_code: string } | null } | null;
  lead_client_id: string | null;
  lead_client: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
  deal_travelers: { is_lead_traveler: boolean; client_id: string; order_index?: number; clients: { first_name: string; last_name: string } | null }[];
  deal_services: { service_type: string; service_name: string }[];
  created_at: string;
  updated_at: string;
}

const formatDateShort = (d: string | null) => {
  if (!d) return "";
  const date = new Date(d + "T00:00:00");
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
};

const Deals = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { scope } = useDataScope();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [filteredDeals, setFilteredDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("updated_at");
  const [dateFilter, setDateFilter] = useState<DateRangeFilterValue>(defaultDateRangeFilter);
  
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
  }, [scope, user?.id]);

  useEffect(() => {
    filterDeals();
  }, [searchQuery, statusFilter, deals, sortBy, dateFilter]);

  const fetchDeals = async () => {
    try {
      let query = supabase
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
          tee_times,
          created_at,
          updated_at,
          lead_client_id,
          lead_client:clients!deals_lead_client_id_fkey (first_name, last_name),
          destinations:destination_id (name, countries:country_id(iso_code)),
          deal_travelers (
            is_lead_traveler,
            client_id,
            order_index,
            clients:client_id (
              first_name,
              last_name
            )
          ),
          deal_services (service_type, service_name)
        `)
        .order("created_at", { ascending: false });

      if (scope === "own" && user?.id) {
        query = query.eq("user_id", user.id);
      }

      const { data, error } = await query;

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
      const query = removeDiacritics(searchQuery.toLowerCase());
      filtered = filtered.filter(
        (deal) =>
          removeDiacritics(deal.deal_number.toLowerCase()).includes(query) ||
          removeDiacritics(deal.destinations?.name?.toLowerCase() || "").includes(query) ||
          deal.deal_travelers.some((dt: any) =>
            dt.clients && removeDiacritics(`${dt.clients.first_name} ${dt.clients.last_name}`
              .toLowerCase())
              .includes(query)
          )
      );
    }

    // Filter by date range
    if (dateFilter.preset !== "all" && (dateFilter.from || dateFilter.to)) {
      filtered = filtered.filter((deal) => {
        const dateValue = dateFilter.dateField === "departure" ? deal.start_date : deal.end_date;
        if (!dateValue) return false;
        if (dateFilter.from && dateValue < dateFilter.from) return false;
        if (dateFilter.to && dateValue > dateFilter.to) return false;
        return true;
      });
    }

    // Sort
    const terminalStatuses = new Set(["completed", "cancelled"]);
    filtered = [...filtered].sort((a, b) => {
      // Completed/cancelled always at the bottom
      const aTerminal = terminalStatuses.has(a.status) ? 1 : 0;
      const bTerminal = terminalStatuses.has(b.status) ? 1 : 0;
      if (aTerminal !== bTerminal) return aTerminal - bTerminal;

      switch (sortBy) {
        case "deal_number_asc": {
          const numA = a.deal_number.match(/^D-(\d+)/)?.[1] || "";
          const numB = b.deal_number.match(/^D-(\d+)/)?.[1] || "";
          return numA < numB ? -1 : numA > numB ? 1 : 0;
        }
        case "deal_number_desc": {
          const numA = a.deal_number.match(/^D-(\d+)/)?.[1] || "";
          const numB = b.deal_number.match(/^D-(\d+)/)?.[1] || "";
          return numB < numA ? -1 : numB > numA ? 1 : 0;
        }
        case "departure_asc": {
          const da = a.start_date || "";
          const db = b.start_date || "";
          if (!da && !db) return 0;
          if (!da) return 1;
          if (!db) return -1;
          const today = new Date().toISOString().split("T")[0];
          const aFuture = da >= today;
          const bFuture = db >= today;
          if (aFuture && !bFuture) return -1;
          if (!aFuture && bFuture) return 1;
          if (aFuture) return da < db ? -1 : da > db ? 1 : 0;
          return db < da ? -1 : db > da ? 1 : 0;
        }
        case "departure_desc": {
          const da = a.start_date || "";
          const db = b.start_date || "";
          if (!da && !db) return 0;
          if (!da) return 1;
          if (!db) return -1;
          return db < da ? -1 : db > da ? 1 : 0;
        }
        case "return_asc": {
          const ea = a.end_date || "";
          const eb = b.end_date || "";
          if (!ea && !eb) return 0;
          if (!ea) return 1;
          if (!eb) return -1;
          return ea < eb ? -1 : ea > eb ? 1 : 0;
        }
        case "updated_at":
        default: {
          const ua = a.updated_at || "";
          const ub = b.updated_at || "";
          return ub < ua ? -1 : ub > ua ? 1 : 0;
        }
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
          tee_times: dealToDuplicate.tee_times,
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

  const toolbarButtonClass = "h-8 text-xs bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20";

  usePageToolbar(
    <>
      <div className="relative w-48 md:w-64">
        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Hledat..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 pr-7 h-8 text-xs"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <Select value={sortBy} onValueChange={setSortBy}>
        <SelectTrigger className="w-[150px] h-8 text-xs">
          <SelectValue placeholder="Řazení" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="updated_at">Poslední změna</SelectItem>
          <SelectItem value="deal_number_desc">Číslo ↓</SelectItem>
          <SelectItem value="deal_number_asc">Číslo ↑</SelectItem>
          <SelectItem value="departure_asc">Odjezd ↑</SelectItem>
          <SelectItem value="departure_desc">Odjezd ↓</SelectItem>
          <SelectItem value="return_asc">Návrat</SelectItem>
        </SelectContent>
      </Select>
      <DateRangeFilter value={dateFilter} onChange={setDateFilter} />
      <Button onClick={() => navigate("/deals/new")} className={toolbarButtonClass + " gap-1"}>
        <Plus className="h-3.5 w-3.5" />
        Nový případ
      </Button>
    </>,
    [searchQuery, statusFilter, sortBy, dateFilter]
  );

  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)]">
      <div className="container max-w-6xl mx-auto py-8 px-4">

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Načítám obchodní případy...</p>
          </div>
        ) : deals.length === 0 ? (
          <Card className="p-12 text-center shadow-[var(--shadow-medium)]">
            <Plus className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-heading-2 text-foreground mb-2">Zatím žádné obchodní případy</h2>
            <p className="text-body text-muted-foreground mb-6">Vytvořte svůj první obchodní případ</p>
            <Button onClick={() => navigate("/deals/new")} variant="premium">
              <Plus className="h-4 w-4 mr-2" />
              Vytvořit první případ
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Status tabs */}
            <div className="flex items-center gap-1 flex-wrap border-b border-border pb-0">
              {([
                { value: "all", label: "Všechny" },
                { value: "inquiry", label: "Poptávka" },
                { value: "quote", label: "Nabídka odeslána" },
                { value: "approved", label: "Schváleno" },
                { value: "confirmed", label: "Potvrzeno" },
                { value: "dispatched", label: "Odbaveno" },
                { value: "completed", label: "Dokončeno" },
                { value: "cancelled", label: "Zrušeno" },
              ] as const).map((tab) => {
                const count = tab.value === "all" ? deals.length : deals.filter(d => d.status === tab.value).length;
                const isActive = statusFilter === tab.value;
                return (
                  <button
                    key={tab.value}
                    onClick={() => setStatusFilter(tab.value)}
                    className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                      isActive
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                    }`}
                  >
                    {tab.label}
                    {count > 0 && (
                      <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                        isActive ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                      }`}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {filteredDeals.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">Nenalezeny žádné případy odpovídající vašemu hledání</p>
              </Card>
            ) : (
              filteredDeals.map((deal) => {
                // Sort travelers by order_index to find the first traveler (non-orderer preferred on tie)
                const sortedTravelers = [...(deal.deal_travelers || [])].sort((a: any, b: any) => {
                  const idxDiff = (a.order_index ?? 999) - (b.order_index ?? 999);
                  if (idxDiff !== 0) return idxDiff;
                  // On tie, prefer non-lead (is_lead_traveler=false) as "first traveler"
                  return (a.is_lead_traveler ? 1 : 0) - (b.is_lead_traveler ? 1 : 0);
                });
                const firstByOrder = sortedTravelers[0];

                // Orderer = traveler with is_lead_traveler, OR the lead_client_id if not in travelers
                const ordererInTravelers = deal.deal_travelers?.find((dt: any) => dt.is_lead_traveler);
                const leadClientId = deal.lead_client_id;

                // leadName for metadata row — prefer orderer, fallback to first
                const leadClient = ordererInTravelers?.clients || firstByOrder?.clients;
                const leadName = leadClient ? `${leadClient.first_name} ${leadClient.last_name}` : "";

                const mainTravelers = [...deal.deal_travelers]
                  .filter((dt: any) => dt.clients)
                  .sort((a: any, b: any) => (b.is_lead_traveler ? 1 : 0) - (a.is_lead_traveler ? 1 : 0))
                  .map((dt: any) => `${dt.clients.first_name} ${dt.clients.last_name}`)
                  .join(", ");

                // Use deal.name if available but always compute display description from live data
                // to ensure bullet separators are correct regardless of how name was stored.
                let displayDesc = "";
                {
                  const iso = deal.destinations?.countries?.iso_code;
                  const hotel = deal.deal_services?.find((s) => s.service_type === "hotel");
                  const ordererClients = ordererInTravelers?.clients;
                  const leadClientJoin = Array.isArray(deal.lead_client) ? deal.lead_client[0] : deal.lead_client;
                  const primaryClient = ordererClients || leadClientJoin || (!deal.lead_client_id ? firstByOrder?.clients : null);
                  const primaryName = primaryClient ? `${primaryClient.first_name} ${primaryClient.last_name}` : "";
                  const descParts: string[] = [];
                  if (primaryName) descParts.push(primaryName);
                  if (iso) descParts.push(iso);
                  if (hotel) descParts.push(hotel.service_name);
                  if (deal.start_date) descParts.push(formatDateShort(deal.start_date));
                  displayDesc = descParts.join(" • ");
                  if (!ordererInTravelers && leadClientJoin) {
                    displayDesc += ` (${leadClientJoin.first_name} ${leadClientJoin.last_name})`;
                  }
                  // Fallback to stored name if no parts could be computed
                  if (!displayDesc && deal.name) {
                    displayDesc = deal.name.replace(/^D-\d{6,}\s*[-–]?\s*/i, "").trim();
                  }
                }

                const getBaseNumber = (dn: string) => {
                  const match = dn.match(/^D-\d{6}/);
                  return match ? match[0] : dn;
                };

                return (
                  <Card key={deal.id} className="p-3 sm:p-4 md:p-6 hover:shadow-[var(--shadow-medium)] transition-shadow cursor-pointer" onClick={() => navigate(`/deals/${deal.id}`)}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {/* Row 1: Status + Number + Name ISO Hotel Date */}
                        <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
                          <DealStatusBadge status={deal.status} />
                          <span className="font-bold text-foreground">{getBaseNumber(deal.deal_number)}</span>
                          {displayDesc && (
                            <span className="text-foreground">{displayDesc}</span>
                          )}
                        </div>
                        {/* Row 3: Metadata grid */}
                        <div className="grid grid-cols-1 xs:grid-cols-2 md:flex md:flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                          {leadName && (
                            <span className="truncate">
                              <span className="font-semibold text-foreground">Klient:</span> {leadName}
                            </span>
                          )}
                          {deal.destinations?.name && (
                            <span className="truncate">
                              <span className="font-semibold text-foreground">Destinace:</span> {deal.destinations.name}
                            </span>
                          )}
                          {deal.start_date && (
                            <span className="truncate">
                              <span className="font-semibold text-foreground">Datum:</span> {formatDate(deal.start_date)}
                              {deal.end_date && ` – ${formatDate(deal.end_date)}`}
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
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
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
