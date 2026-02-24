import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { removeDiacritics } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, FileText, Search, Trash2, Filter, Download, ArrowUpDown, X } from "lucide-react";
import { usePageToolbar } from "@/hooks/usePageToolbar";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { parseDateSafe, formatPriceCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { DateRangeFilter, defaultDateRangeFilter, type DateRangeFilterValue } from "@/components/DateRangeFilter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type ContractStatus = "draft" | "sent" | "signed" | "cancelled";

const statusConfig: Record<ContractStatus, { label: string; className: string }> = {
  draft: { label: "Koncept", className: "bg-gray-500 hover:bg-gray-600 text-white border-transparent" },
  sent: { label: "Odesláno", className: "bg-blue-500 hover:bg-blue-600 text-white border-transparent" },
  signed: { label: "Podepsáno", className: "bg-emerald-600 hover:bg-emerald-700 text-white border-transparent" },
  cancelled: { label: "Zrušeno", className: "bg-destructive hover:bg-destructive/80 text-destructive-foreground border-transparent" },
};

const formatDateShort = (dateString: string | null | undefined): string => {
  if (!dateString) return "";
  const d = parseDateSafe(dateString);
  if (!d) return "";
  return format(d, "dd-MM-yy");
};

const Contracts = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("number_desc");
  const [dateFilter, setDateFilter] = useState<DateRangeFilterValue>(defaultDateRangeFilter);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<{ id: string; number: string } | null>(null);

  const { data: contracts, isLoading } = useQuery({
    queryKey: ["travel_contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("travel_contracts")
        .select(`
          *,
          client:clients(first_name, last_name, email),
          deal:deals(
            deal_number,
            name,
            start_date,
            end_date,
            destination:destinations(
              name,
              countries:country_id(iso_code)
            ),
            deal_services(service_name, service_type, price, cost_price)
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (contractId: string) => {
      const { error } = await supabase
        .from("travel_contracts")
        .delete()
        .eq("id", contractId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["travel_contracts"] });
      toast.success("Smlouva byla úspěšně smazána");
      setDeleteDialogOpen(false);
      setContractToDelete(null);
    },
    onError: (error) => {
      console.error("Error deleting contract:", error);
      toast.error("Nepodařilo se smazat smlouvu");
    },
  });

  const handleExportCSV = () => {
    if (!filteredContracts || filteredContracts.length === 0) {
      toast.error("Žádné smlouvy k exportu");
      return;
    }

    const headers = ["Číslo smlouvy", "Klient", "Destinace", "Datum odjezdu", "Datum návratu", "Prodejní cena", "Měna", "Nákupní cena", "Marže", "Status"];
    
    const rows = filteredContracts.map((contract) => {
      const client = contract.client as any;
      const clientName = client ? `${client.first_name} ${client.last_name}` : "";
      const destination = (contract.deal as any)?.destination?.name || "";
      const startDate = formatDateShort((contract.deal as any)?.start_date);
      const endDate = formatDateShort((contract.deal as any)?.end_date);
      const salesPrice = contract.total_price || 0;
      const currency = contract.currency || "CZK";
      const costPrice = ((contract.deal as any)?.deal_services || []).reduce(
        (sum: number, s: any) => sum + (s.cost_price || 0), 0
      );
      const margin = salesPrice - costPrice;
      const config = statusConfig[contract.status as ContractStatus] || statusConfig.draft;

      return [
        contract.contract_number,
        clientName,
        destination,
        startDate,
        endDate,
        salesPrice.toString(),
        currency,
        costPrice.toString(),
        margin.toString(),
        config.label,
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${(cell || "").replace(/"/g, '""')}"`).join(";"))
      .join("\n");

    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `smlouvy-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Export dokončen");
  };

  const handleDeleteClick = (e: React.MouseEvent, contractId: string, contractNumber: string) => {
    e.stopPropagation();
    setContractToDelete({ id: contractId, number: contractNumber });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (contractToDelete) {
      deleteMutation.mutate(contractToDelete.id);
    }
  };

  // Build display name: Jmeno Prijmeni ISO Hotel DD-MM-RR
  const buildDisplayName = (contract: any) => {
    const parts: string[] = [];
    const client = contract.client as any;
    if (client) {
      parts.push(`${client.first_name} ${client.last_name}`);
    }
    const iso = contract.deal?.destination?.countries?.iso_code;
    if (iso) parts.push(iso);
    const hotel = contract.deal?.deal_services?.find((s: any) => s.service_type === "hotel");
    if (hotel) parts.push(hotel.service_name);
    const depDate = contract.deal?.start_date;
    if (depDate) parts.push(formatDateShort(depDate));
    return parts.join(" • ");
  };

  const filteredContracts = contracts?.filter((contract) => {
    // Status filter
    if (statusFilter !== "all" && contract.status !== statusFilter) return false;

    // Date range filter
    if (dateFilter.preset !== "all" && (dateFilter.from || dateFilter.to)) {
      const dateValue = dateFilter.dateField === "departure"
        ? (contract.deal as any)?.start_date
        : (contract.deal as any)?.end_date;
      if (!dateValue) return false;
      if (dateFilter.from && dateValue < dateFilter.from) return false;
      if (dateFilter.to && dateValue > dateFilter.to) return false;
    }

    // Search
    const searchLower = removeDiacritics(searchQuery.toLowerCase());
    if (!searchLower) return true;
    const client = contract.client as any;
    const clientName = client
      ? removeDiacritics(`${client.first_name || ""} ${client.last_name || ""}`.toLowerCase())
      : "";
    return (
      removeDiacritics(contract.contract_number.toLowerCase()).includes(searchLower) ||
      clientName.includes(searchLower) ||
      removeDiacritics((contract.deal?.deal_number || "").toLowerCase()).includes(searchLower) ||
      removeDiacritics((contract.deal?.destination?.name || "").toLowerCase()).includes(searchLower)
    );
  })?.sort((a, b) => {
    switch (sortBy) {
      case "number_asc":
        return a.contract_number.localeCompare(b.contract_number, "cs", { numeric: true });
      case "number_desc":
        return b.contract_number.localeCompare(a.contract_number, "cs", { numeric: true });
      case "departure_asc": {
        const da = (a.deal as any)?.start_date || "";
        const db = (b.deal as any)?.start_date || "";
        return da.localeCompare(db) || b.contract_number.localeCompare(a.contract_number, "cs", { numeric: true });
      }
      case "departure_desc": {
        const da = (a.deal as any)?.start_date || "";
        const db = (b.deal as any)?.start_date || "";
        return db.localeCompare(da) || b.contract_number.localeCompare(a.contract_number, "cs", { numeric: true });
      }
      default:
        return 0;
    }
  });

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
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <Filter className="h-3 w-3 mr-1 text-muted-foreground" />
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Všechny statusy</SelectItem>
          <SelectItem value="draft">Koncept</SelectItem>
          <SelectItem value="sent">Odesláno</SelectItem>
          <SelectItem value="signed">Podepsáno</SelectItem>
          <SelectItem value="cancelled">Zrušeno</SelectItem>
        </SelectContent>
      </Select>
      <DateRangeFilter value={dateFilter} onChange={setDateFilter} />
      <Select value={sortBy} onValueChange={setSortBy}>
        <SelectTrigger className="w-[160px] h-8 text-xs">
          <ArrowUpDown className="h-3 w-3 mr-1 text-muted-foreground" />
          <SelectValue placeholder="Řazení" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="number_desc">Číslo ↓</SelectItem>
          <SelectItem value="number_asc">Číslo ↑</SelectItem>
          <SelectItem value="departure_desc">Odjezd ↓</SelectItem>
          <SelectItem value="departure_asc">Odjezd ↑</SelectItem>
        </SelectContent>
      </Select>
      <Button onClick={handleExportCSV} className={toolbarButtonClass + " gap-1"}>
        <Download className="h-3.5 w-3.5" />
        Export CSV
      </Button>
      <Button onClick={() => navigate("/contracts/new")} className={toolbarButtonClass + " gap-1"}>
        <Plus className="h-3.5 w-3.5" />
        Nová smlouva
      </Button>
    </>,
    [searchQuery, statusFilter, dateFilter, sortBy]
  );

  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)]">
      <div className="container max-w-6xl mx-auto py-8 px-4">
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Načítání smluv...</p>
          </div>
        ) : contracts && contracts.length === 0 ? (
          <Card className="p-12 text-center shadow-[var(--shadow-medium)]">
            <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Žádné smlouvy</h2>
            <p className="text-muted-foreground mb-6">Začněte vytvořením první cestovní smlouvy.</p>
            <Button onClick={() => navigate("/contracts/new")} variant="premium">
              <Plus className="h-4 w-4 mr-2" />
              Vytvořit první smlouvu
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <p className="text-sm text-muted-foreground">
                Celkem: <span className="font-semibold text-foreground">{contracts?.length || 0}</span>
                {filteredContracts && filteredContracts.length !== contracts?.length && (
                  <span className="ml-1">
                    (zobrazeno: <span className="font-semibold text-foreground">{filteredContracts.length}</span>)
                  </span>
                )}
              </p>
            </div>

            {filteredContracts && filteredContracts.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">Nebyly nalezeny žádné smlouvy odpovídající vašemu hledání.</p>
              </Card>
            ) : (
              filteredContracts?.map((contract) => {
                const client = contract.client as any;
                const config = statusConfig[contract.status as ContractStatus] || statusConfig.draft;
                const displayName = buildDisplayName(contract);

                return (
                  <Card
                    key={contract.id}
                    className="p-4 md:p-6 hover:shadow-[var(--shadow-medium)] transition-shadow cursor-pointer"
                    onClick={() => navigate(`/contracts/${contract.id}`)}
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Line 1: Status + Number + Name */}
                        <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
                          <Badge className={`text-xs shrink-0 ${config.className}`}>
                            {config.label}
                          </Badge>
                          <span className="font-bold text-foreground">{contract.contract_number}</span>
                          {displayName && (
                            <span className="text-foreground truncate">{displayName}</span>
                          )}
                        </div>
                        {/* Line 2: Details */}
                        <div className="flex flex-wrap gap-2 md:gap-4 text-xs md:text-sm text-muted-foreground">
                          {client && (
                            <span>
                              <span className="font-semibold text-foreground">Klient:</span> {client.first_name} {client.last_name}
                            </span>
                          )}
                          {contract.deal?.destination?.name && (
                            <span>
                              <span className="font-semibold text-foreground">Destinace:</span> {contract.deal.destination.name}
                            </span>
                          )}
                          {contract.deal?.start_date && (
                            <span>
                              <span className="font-semibold text-foreground">Datum:</span> {formatDateShort(contract.deal.start_date)}
                            </span>
                          )}
                          {contract.total_price && (
                            <span>
                              <span className="font-semibold text-foreground">Cena:</span> {formatPriceCurrency(contract.total_price, contract.currency || "CZK")}
                            </span>
                          )}
                          <span>
                            <span className="font-semibold text-foreground">Vytvořeno:</span> {formatDateShort(contract.created_at)}
                          </span>
                          {contract.signed_at && (
                            <span>
                              <span className="font-semibold text-foreground">Podepsáno:</span> {formatDateShort(contract.signed_at)}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleDeleteClick(e, contract.id, contract.contract_number)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 self-end md:self-start shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
              <AlertDialogTitle>Smazat smlouvu?</AlertDialogTitle>
              <AlertDialogDescription>
                Opravdu chcete smazat smlouvu {contractToDelete?.number}? Tato akce je nevratná.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Zrušit</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Smazat
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default Contracts;
