import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { PageShell } from "@/components/PageShell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDataScope } from "@/hooks/useDataScope";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { removeDiacritics } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  Check,
  FileText,
  PlaneLanding,
  PlaneTakeoff,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { usePageToolbar } from "@/hooks/usePageToolbar";
import { format } from "date-fns";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ContractStatusBadge } from "@/components/ContractStatusBadge";

type ContractStatus = "draft" | "sent" | "signed" | "cancelled";

const formatDateShort = (dateString: string | null | undefined): string => {
  if (!dateString) return "";
  const d = parseDateSafe(dateString);
  if (!d) return "";
  return format(d, "dd-MM-yy");
};

const Contracts = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { scope } = useDataScope();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("number_desc");
  const [dateFilter, setDateFilter] = useState<DateRangeFilterValue>(defaultDateRangeFilter);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<{ id: string; number: string } | null>(null);

  const { data: contracts, isLoading } = useQuery({
    queryKey: ["travel_contracts", scope, user?.id],
    queryFn: async () => {
      let query = supabase
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

      if (scope === "own" && user?.id) {
        query = query.eq("user_id", user.id);
      }

      const { data, error } = await query;
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
      case "arrival_asc": {
        const da = (a.deal as any)?.end_date || "";
        const db = (b.deal as any)?.end_date || "";
        return da.localeCompare(db) || b.contract_number.localeCompare(a.contract_number, "cs", { numeric: true });
      }
      case "arrival_desc": {
        const da = (a.deal as any)?.end_date || "";
        const db = (b.deal as any)?.end_date || "";
        return db.localeCompare(da) || b.contract_number.localeCompare(a.contract_number, "cs", { numeric: true });
      }
      default:
        return 0;
    }
  });

  const toolbarButtonClass = "h-8 text-xs bg-zinc-900 text-white hover:bg-zinc-700";
  const sortButtonClass = "h-8 w-[82px] text-xs shrink-0";
  const dateFieldClass = "h-8 w-[112px] text-xs shrink-0";
  const sortOptions = [
    { value: "number_desc", label: "Číslo ↓", Icon: FileText, DirectionIcon: ArrowDown },
    { value: "number_asc", label: "Číslo ↑", Icon: FileText, DirectionIcon: ArrowUp },
    { value: "departure_desc", label: "Odjezd ↓", Icon: PlaneTakeoff, DirectionIcon: ArrowDown },
    { value: "departure_asc", label: "Odjezd ↑", Icon: PlaneTakeoff, DirectionIcon: ArrowUp },
    { value: "arrival_desc", label: "Příjezd ↓", Icon: PlaneLanding, DirectionIcon: ArrowDown },
    { value: "arrival_asc", label: "Příjezd ↑", Icon: PlaneLanding, DirectionIcon: ArrowUp },
  ];
  const activeSortOption = sortOptions.find((option) => option.value === sortBy) || sortOptions[0];
  const ActiveSortIcon = activeSortOption.Icon;
  const ActiveSortDirectionIcon = activeSortOption.DirectionIcon;

  usePageToolbar(
    <div className="flex items-center gap-1.5 w-full min-w-0 flex-nowrap overflow-hidden">
      <div className="relative min-w-0 flex-1">
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
      <DateRangeFilter value={dateFilter} onChange={setDateFilter} triggerClassName={dateFieldClass} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`${sortButtonClass} justify-center font-normal`}
            title={activeSortOption.label}
            aria-label={`Řazení: ${activeSortOption.label}`}
          >
            <ActiveSortIcon className="h-3.5 w-3.5" />
            {ActiveSortDirectionIcon && <ActiveSortDirectionIcon className="h-3 w-3" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-0">
          {sortOptions.map(({ Icon, DirectionIcon, ...option }) => (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => setSortBy(option.value)}
              className="gap-1.5 px-2"
              title={option.label}
              aria-label={option.label}
            >
              <Check className={`h-4 w-4 ${sortBy === option.value ? "opacity-100" : "opacity-0"}`} />
              <Icon className="h-4 w-4 text-muted-foreground" />
              {DirectionIcon && <DirectionIcon className="h-3.5 w-3.5 text-muted-foreground" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button onClick={() => navigate("/contracts/new")} size="icon" className="h-8 w-8 shrink-0 sm:hidden">
        <Plus className="h-4 w-4" />
      </Button>
      <Button onClick={() => navigate("/contracts/new")} className={toolbarButtonClass + " w-[82px] gap-1 hidden sm:inline-flex shrink-0"}>
        <Plus className="h-3.5 w-3.5" />
        Přidat
      </Button>
    </div>,
    [searchQuery, dateFilter, sortBy]
  );

  return (
    <PageShell>
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Načítání smluv...</p>
          </div>
        ) : contracts && contracts.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-heading-2 text-foreground mb-2">Žádné smlouvy</h2>
            <p className="text-body text-muted-foreground mb-6">Začněte vytvořením první cestovní smlouvy.</p>
            <Button onClick={() => navigate("/contracts/new")} variant="premium">
              <Plus className="h-4 w-4 mr-2" />
              Vytvořit první smlouvu
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
                    { value: "draft", label: "Koncept" },
                    { value: "sent", label: "Odesláno" },
                    { value: "signed", label: "Podepsáno" },
                    { value: "cancelled", label: "Zrušeno" },
                  ] as const).map((tab) => {
                    const count = tab.value === "all" ? (contracts?.length || 0) : (contracts?.filter(c => c.status === tab.value).length || 0);
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
                  { value: "draft", label: "Koncept" },
                  { value: "sent", label: "Odesláno" },
                  { value: "signed", label: "Podepsáno" },
                  { value: "cancelled", label: "Zrušeno" },
                ] as const).map((tab) => {
                  const count = tab.value === "all" ? (contracts?.length || 0) : (contracts?.filter(c => c.status === tab.value).length || 0);
                  const isActive = statusFilter === tab.value;
                  return (
                    <button
                      key={tab.value}
                      onClick={() => setStatusFilter(tab.value)}
                      className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                        isActive
                          ? "border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50"
                          : "border-transparent text-zinc-400 hover:text-zinc-700 hover:border-zinc-300"
                      }`}
                    >
                      {tab.label}
                      {count > 0 && (
                        <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                          isActive ? "bg-zinc-100 text-zinc-900" : "bg-zinc-100 text-zinc-500"
                        }`}>{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {filteredContracts && filteredContracts.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">Nebyly nalezeny žádné smlouvy odpovídající vašemu hledání.</p>
              </Card>
            ) : (
              filteredContracts?.map((contract) => {
                const client = contract.client as any;
                const displayName = buildDisplayName(contract);

                return (
                  <Card
                    key={contract.id}
                    className="p-3 sm:p-4 md:p-6 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    onClick={() => navigate(`/contracts/${contract.id}`)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {/* Row 1: Status + Number + Name */}
                        <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
                          <ContractStatusBadge status={contract.status as ContractStatus} />
                          <span className="font-bold text-foreground">{contract.contract_number}</span>
                          {displayName && (
                            <span className="text-foreground">{displayName}</span>
                          )}
                        </div>
                        {/* Row 2: Metadata grid */}
                        <div className="grid grid-cols-1 xs:grid-cols-2 md:flex md:flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                          {client && (
                            <span className="truncate">
                              <span className="font-semibold text-foreground">Klient:</span> {client.first_name} {client.last_name}
                            </span>
                          )}
                          {contract.deal?.destination?.name && (
                            <span className="truncate">
                              <span className="font-semibold text-foreground">Destinace:</span> {contract.deal.destination.name}
                            </span>
                          )}
                          {contract.deal?.start_date && (
                            <span className="truncate">
                              <span className="font-semibold text-foreground">Datum:</span> {formatDateShort(contract.deal.start_date)}
                            </span>
                          )}
                          {contract.total_price && (
                            <span>
                              <span className="font-semibold text-foreground">Cena:</span> {formatPriceCurrency(contract.total_price, contract.currency || "CZK")}
                            </span>
                          )}
                          <span className="truncate">
                            <span className="font-semibold text-foreground">Vytvořeno:</span> {formatDateShort(contract.created_at)}
                          </span>
                          {contract.signed_at && (
                            <span className="truncate">
                              <span className="font-semibold text-foreground">Podepsáno:</span> {formatDateShort(contract.signed_at)}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleDeleteClick(e, contract.id, contract.contract_number)}
                        className="h-8 w-8 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
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
    </PageShell>
  );
};

export default Contracts;
