import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { useDataScope } from "@/hooks/useDataScope";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, FileText, Edit, Copy, Search, Trash2, Mail, MoreHorizontal, Eye, X } from "lucide-react";
import { usePageToolbar } from "@/hooks/usePageToolbar";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DuplicateVoucherDialog } from "@/components/DuplicateVoucherDialog";

interface Voucher {
  id: string;
  voucher_code: string;
  voucher_number: number;
  client_name: string;
  hotel_name: string;
  services: any;
  issue_date: string;
  created_at: string;
  client_id: string;
  expiration_date: string | null;
  sent_at: string | null;
  creator_email?: string;
  clients?: {
    first_name: string;
    last_name: string;
  };
}

const VouchersList = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { scope } = useDataScope();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [filteredVouchers, setFilteredVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [voucherToDelete, setVoucherToDelete] = useState<string | null>(null);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [voucherToDuplicate, setVoucherToDuplicate] = useState<string | null>(null);
  const [originalTravelerCount, setOriginalTravelerCount] = useState(1);

  useEffect(() => {
    fetchVouchers();
  }, [scope, user?.id]);

  useEffect(() => {
    filterVouchers();
  }, [searchQuery, statusFilter, vouchers]);

  const fetchVouchers = async () => {
    try {
      // Fetch vouchers
      let query = supabase
        .from("vouchers")
        .select(
          `
          *,
          clients:client_id (
            first_name,
            last_name
          ),
          deals:deal_id (
            destinations:destination_id (
              name,
              countries:country_id (iso_code)
            )
          )
        `,
        )
        .order("created_at", { ascending: false });

      if (scope === "own" && user?.id) {
        query = query.eq("user_id", user.id);
      }

      const { data: vouchersData, error: vouchersError } = await query;

      // Fetch profiles to get creator emails
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email");

      if (profilesError) throw profilesError;

      // Create a map of user_id to email
      const emailMap = new Map(profilesData?.map(p => [p.id, p.email]) || []);

      // Combine data
      const transformedData = vouchersData?.map((voucher: any) => ({
        ...voucher,
        creator_email: emailMap.get(voucher.user_id)
      }));

      setVouchers(transformedData || []);
      setFilteredVouchers(transformedData || []);
    } catch (error) {
      console.error("Error fetching vouchers:", error);
      toast.error("Nepodařilo se načíst vouchery");
    } finally {
      setLoading(false);
    }
  };

  const filterVouchers = () => {
    let filtered = vouchers;

    // Filter by status
    if (statusFilter === "sent") {
      filtered = filtered.filter(v => !!v.sent_at);
    } else if (statusFilter === "unsent") {
      filtered = filtered.filter(v => !v.sent_at);
    }

    if (!searchQuery.trim()) {
      setFilteredVouchers(filtered);
      return;
    }

    const query = searchQuery.toLowerCase();
    filtered = filtered.filter((voucher) => {
      const clientName = voucher.clients
        ? `${voucher.clients.first_name} ${voucher.clients.last_name}`.toLowerCase()
        : voucher.client_name.toLowerCase();
      const hotelName = (voucher.hotel_name || "").toLowerCase();
      const voucherCode = voucher.voucher_code.toLowerCase();

      return clientName.includes(query) || hotelName.includes(query) || voucherCode.includes(query);
    });

    // Sort
    if (sortBy === "newest") {
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortBy === "oldest") {
      filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (sortBy === "number_desc") {
      filtered.sort((a, b) => b.voucher_number - a.voucher_number);
    } else if (sortBy === "number_asc") {
      filtered.sort((a, b) => a.voucher_number - b.voucher_number);
    }

    setFilteredVouchers(filtered);
  };

  const handleDeleteClick = (voucherId: string) => {
    setVoucherToDelete(voucherId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!voucherToDelete) return;

    try {
      setLoading(true);

      // Get the voucher to be deleted to know its year
      const voucherToRemove = vouchers.find(v => v.id === voucherToDelete);
      if (!voucherToRemove) return;

      const year = new Date(voucherToRemove.issue_date).getFullYear();

      // Delete voucher_travelers first (foreign key constraint)
      await supabase.from("voucher_travelers").delete().eq("voucher_id", voucherToDelete);

      // Delete voucher
      const { error } = await supabase.from("vouchers").delete().eq("id", voucherToDelete);

      if (error) throw error;

      // Renumber remaining vouchers for this year
      await renumberVouchersForYear(year);

      toast.success("Voucher úspěšně smazán a čísla aktualizována!");
      setDeleteDialogOpen(false);
      setVoucherToDelete(null);
      fetchVouchers();
    } catch (error) {
      console.error("Error deleting voucher:", error);
      toast.error("Nepodařilo se smazat voucher");
    } finally {
      setLoading(false);
    }
  };

  const renumberVouchersForYear = async (year: number) => {
    try {
      // Get all vouchers for the year, ordered by created_at
      const startOfYear = `${year}-01-01`;
      const endOfYear = `${year}-12-31`;
      
      const { data: yearVouchers, error: fetchError } = await supabase
        .from("vouchers")
        .select("id, issue_date, created_at")
        .gte("issue_date", startOfYear)
        .lte("issue_date", endOfYear)
        .order("created_at", { ascending: true });

      if (fetchError) throw fetchError;

      // Update each voucher with new sequential number
      for (let i = 0; i < (yearVouchers?.length || 0); i++) {
        const voucher = yearVouchers![i];
        const newNumber = i + 1;
        const yearSuffix = String(year).slice(-2);
        const newCode = `YT-${yearSuffix}${String(newNumber).padStart(3, "0")}`;

        await supabase
          .from("vouchers")
          .update({ 
            voucher_number: newNumber, 
            voucher_code: newCode 
          })
          .eq("id", voucher.id);
      }

      // Update the counter table
      await supabase
        .from("voucher_counters")
        .upsert({ year, last_number: yearVouchers?.length || 0 });

    } catch (error) {
      console.error("Error renumbering vouchers:", error);
    }
  };

  const handleDuplicateClick = async (voucherId: string) => {
    try {
      // Fetch traveler count to show in dialog
      const { data: travelers, error } = await supabase
        .from("voucher_travelers")
        .select("id")
        .eq("voucher_id", voucherId);

      if (error) throw error;

      setOriginalTravelerCount(travelers?.length || 1);
      setVoucherToDuplicate(voucherId);
      setDuplicateDialogOpen(true);
    } catch (error) {
      console.error("Error fetching traveler count:", error);
      setOriginalTravelerCount(1);
      setVoucherToDuplicate(voucherId);
      setDuplicateDialogOpen(true);
    }
  };

  const handleDuplicateConfirm = async (travelerCount: number) => {
    if (!voucherToDuplicate) return;

    try {
      setLoading(true);

      // Fetch the voucher to duplicate with all details
      const { data: originalVoucher, error: fetchError } = await supabase
        .from("vouchers")
        .select("*")
        .eq("id", voucherToDuplicate)
        .single();

      if (fetchError) throw fetchError;

      // Update services PAX field based on new traveler count
      const updatedServices = (originalVoucher.services as any[])?.map((service: any) => ({
        ...service,
        pax: `${travelerCount} ADT`,
      })) || [];

      // Update flights PAX field
      const updatedFlights = (originalVoucher.flights as any[])?.map((flight: any) => ({
        ...flight,
        pax: `${travelerCount} ADT`,
      })) || [];

      // Update tee times golfers field
      const updatedTeeTimes = (originalVoucher.tee_times as any[])?.map((teeTime: any) => ({
        ...teeTime,
        golfers: travelerCount.toString(),
      })) || [];

      // Create new voucher with all data including flights and tee_times
      const { data: newVoucher, error: insertError } = await supabase
        .from("vouchers")
        .insert({
          client_id: originalVoucher.client_id,
          client_name: originalVoucher.client_name,
          hotel_name: originalVoucher.hotel_name,
          services: updatedServices,
          expiration_date: originalVoucher.expiration_date,
          supplier_id: originalVoucher.supplier_id,
          flights: updatedFlights,
          tee_times: updatedTeeTimes,
          voucher_number: 0, // Temporary value - will be set by trigger
        } as any)
        .select()
        .single();

      if (insertError) throw insertError;

      toast.success(`Voucher úspěšně duplikován pro ${travelerCount} cestujících!`);
      setDuplicateDialogOpen(false);
      setVoucherToDuplicate(null);
      fetchVouchers();
    } catch (error) {
      console.error("Error duplicating voucher:", error);
      toast.error("Nepodařilo se duplikovat voucher");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear()).slice(-2);
    return `${day}.${month}.${year}`;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear()).slice(-2);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  };

  const toolbarButtonClass = "h-8 text-xs bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20";

  usePageToolbar(
    <div className="flex items-center gap-1.5 w-full min-w-0">
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Hledat..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 pr-7 h-8 text-xs w-full"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <Select value={sortBy} onValueChange={setSortBy}>
        <SelectTrigger className="w-auto h-8 text-xs shrink-0 gap-1">
          <SelectValue placeholder="Řazení" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Nejnovější</SelectItem>
          <SelectItem value="oldest">Nejstarší</SelectItem>
          <SelectItem value="number_desc">Číslo ↓</SelectItem>
          <SelectItem value="number_asc">Číslo ↑</SelectItem>
        </SelectContent>
      </Select>
      <Button onClick={() => navigate("/create")} size="icon" className="h-8 w-8 shrink-0 sm:hidden">
        <Plus className="h-4 w-4" />
      </Button>
      <Button onClick={() => navigate("/create")} className={toolbarButtonClass + " gap-1 hidden sm:inline-flex shrink-0"}>
        <Plus className="h-3.5 w-3.5" />
        Přidat voucher
      </Button>
    </div>,
    [searchQuery, sortBy]
  );

  return (
    <PageShell>
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Načítám vouchery...</p>
          </div>
        ) : vouchers.length === 0 ? (
          <Card className="p-12 text-center shadow-[var(--shadow-medium)]">
            <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-heading-2 text-foreground mb-2">Zatím žádné vouchery</h2>
            <p className="text-body text-muted-foreground mb-6">Vytvořte svůj první cestovní voucher</p>
            <Button onClick={() => navigate("/create")} variant="premium">
              <Plus className="h-4 w-4 mr-2" />
              Vytvořit první voucher
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Status tabs */}
            {isMobile ? (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {([
                    { value: "all", label: "Všechny" },
                    { value: "sent", label: "Odesláno" },
                    { value: "unsent", label: "Neodesláno" },
                  ] as const).map((tab) => {
                    const count = tab.value === "all"
                      ? vouchers.length
                      : tab.value === "sent"
                        ? vouchers.filter(v => !!v.sent_at).length
                        : vouchers.filter(v => !v.sent_at).length;
                    return (
                      <SelectItem key={tab.value} value={tab.value}>
                        {tab.label} {count > 0 && `(${count})`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-1 flex-wrap border-b border-border pb-0">
                {([
                  { value: "all", label: "Všechny" },
                  { value: "sent", label: "Odesláno" },
                  { value: "unsent", label: "Neodesláno" },
                ] as const).map((tab) => {
                  const count = tab.value === "all"
                    ? vouchers.length
                    : tab.value === "sent"
                      ? vouchers.filter(v => !!v.sent_at).length
                      : vouchers.filter(v => !v.sent_at).length;
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
            )}

            {filteredVouchers.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">Nenalezeny žádné vouchery odpovídající vašemu hledání</p>
              </Card>
            ) : (
              filteredVouchers.map((voucher) => {
                const displayName = voucher.clients
                  ? `${voucher.clients.first_name} ${voucher.clients.last_name}`
                  : voucher.client_name;
                const destination = (voucher as any).deals?.destinations?.name;
                const countryIso = (voucher as any).deals?.destinations?.countries?.iso_code || "";
                
                // Resolve hotel name: prefer explicit field, fallback to hotel service name
                const hotelName = voucher.hotel_name ||
                  (() => {
                    const servs = Array.isArray(voucher.services) ? voucher.services : [];
                    const hotelSvc = servs.find((s: any) => 
                      s.service_type === 'hotel' || 
                      (typeof s.name === 'string' && s.name.toLowerCase().startsWith('accommodation'))
                    );
                    if (!hotelSvc) return null;
                    const raw = hotelSvc.service_name || hotelSvc.name || '';
                    // Extract "Hotel Name" from "Accommodation in Room Type in Hotel Name"
                    const match = raw.match(/accommodation in .+ in (.+)/i);
                    return match ? match[1].trim() : raw || null;
                  })();

                // Get earliest service start_date and latest service end_date
                const servicesArr = Array.isArray(voucher.services) ? voucher.services : [];
                const firstServiceDate = servicesArr
                  .map((s: any) => s.dateFrom || s.start_date)
                  .filter(Boolean)
                  .sort()
                  [0] || null;

                const lastServiceDate = servicesArr
                  .map((s: any) => s.dateTo || s.end_date || s.dateFrom || s.start_date)
                  .filter(Boolean)
                  .sort()
                  .slice(-1)[0] || null;

                // Check if voucher is utilized (set by daily backend job) or locally expired
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isExpired = (voucher as any).status === 'utilized'
                  || (voucher.expiration_date && new Date(voucher.expiration_date) < today)
                  || (lastServiceDate && new Date(lastServiceDate) < today);

                return (
                  <Card 
                    key={voucher.id} 
                    className={`p-3 md:p-6 hover:shadow-[var(--shadow-medium)] transition-shadow cursor-pointer ${
                      isExpired ? 'bg-muted/50 opacity-75' : ''
                    }`}
                    onClick={() => navigate(`/voucher/${voucher.id}`)}
                  >
                    {/* Row 1: Badge + Code + Menu */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        {voucher.sent_at ? (
                          <Badge className="text-xs shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white border-transparent">Odesláno</Badge>
                        ) : isExpired ? (
                          <Badge className="text-xs shrink-0 bg-muted-foreground hover:bg-muted-foreground/80 text-white border-transparent">Využitý</Badge>
                        ) : (
                          <Badge className="text-xs shrink-0 bg-gray-500 hover:bg-gray-600 text-white border-transparent">Neodesláno</Badge>
                        )}
                        <span className="font-bold text-foreground truncate">{voucher.voucher_code}</span>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/voucher/${voucher.id}`); }}>
                            <Eye className="h-4 w-4 mr-2" />
                            Náhled
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/edit/${voucher.id}`); }}>
                            <Edit className="h-4 w-4 mr-2" />
                            Upravit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicateClick(voucher.id); }} disabled={loading}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplikovat
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => { e.stopPropagation(); handleDeleteClick(voucher.id); }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Smazat
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {/* Row 2: Summary line */}
                    <div className="text-xs text-muted-foreground truncate mb-1">
                      {[displayName, countryIso, hotelName, firstServiceDate ? formatDate(firstServiceDate) : null].filter(Boolean).join(" • ")}
                    </div>
                    {/* Row 3: Metadata */}
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {destination && (
                        <span className="truncate">
                          <span className="font-semibold text-foreground">Destinace:</span> {destination}
                        </span>
                      )}
                      <span className="truncate">
                        <span className="font-semibold text-foreground">Vytvořeno:</span> {formatDate(voucher.created_at)}
                      </span>
                      {voucher.sent_at && (
                        <span className="truncate">
                          <span className="font-semibold text-foreground">Odesláno:</span> {formatDateTime(voucher.sent_at)}
                        </span>
                      )}
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Opravdu chcete smazat tento voucher?</AlertDialogTitle>
            <AlertDialogDescription>
              Tato akce je nevratná. Voucher bude trvale odstraněn z databáze.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Smazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DuplicateVoucherDialog
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
        onConfirm={handleDuplicateConfirm}
        loading={loading}
        originalTravelerCount={originalTravelerCount}
      />
    </PageShell>
  );
};

export default VouchersList;
