import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, FileText, Search, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { parseDateSafe } from "@/lib/utils";
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

const Contracts = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
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
          deal:deals(deal_number, name, destination:destinations(name))
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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      draft: { variant: "secondary", label: "Koncept" },
      sent: { variant: "default", label: "Odesláno" },
      signed: { variant: "outline", label: "Podepsáno" },
      cancelled: { variant: "destructive", label: "Zrušeno" },
    };
    const config = variants[status] || variants.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const filteredContracts = contracts?.filter((contract) => {
    const searchLower = searchQuery.toLowerCase();
    const client = contract.client as any;
    const clientName = client 
      ? `${client.first_name || ''} ${client.last_name || ''}`.toLowerCase()
      : '';
    return (
      contract.contract_number.toLowerCase().includes(searchLower) ||
      clientName.includes(searchLower) ||
      (contract.deal?.deal_number || '').toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto py-8 px-4">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl md:text-heading-1 text-foreground">Cestovní smlouvy</h1>
            <p className="text-body text-muted-foreground mt-1">Správa cestovních smluv podle §2521 OZ</p>
          </div>
          <Button onClick={() => navigate("/contracts/new")} className="shrink-0">
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Nová smlouva</span>
            <span className="sm:hidden">Nová</span>
          </Button>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Hledat podle čísla smlouvy, klienta nebo obchodního případu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-body text-muted-foreground">Načítání smluv...</p>
          </div>
        ) : filteredContracts && filteredContracts.length > 0 ? (
          <div className="grid gap-4">
            {filteredContracts.map((contract) => (
              <Card
                key={contract.id}
                className="p-4 md:p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/contracts/${contract.id}`)}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-3 md:gap-4 flex-1">
                    <div className="p-2 md:p-3 rounded-lg bg-primary/10 shrink-0">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
                        <h3 className="text-lg md:text-xl font-bold text-foreground">
                          {contract.contract_number}
                        </h3>
                        {getStatusBadge(contract.status)}
                      </div>
                      <p className="text-sm md:text-base text-muted-foreground mb-2">
                        Klient: {(() => {
                          const client = contract.client as any;
                          if (!client) return '-';
                          return `${client.first_name} ${client.last_name}`;
                        })()}
                      </p>
                      {contract.deal?.destination?.name && (
                        <p className="text-sm text-muted-foreground">
                          Destinace: {contract.deal.destination.name}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 md:gap-4 mt-3 text-xs md:text-sm text-muted-foreground">
                        <span>Vytvořeno: {(() => { const d = parseDateSafe(contract.created_at); return d ? format(d, "d. M. yyyy", { locale: cs }) : ''; })()}</span>
                        {contract.signed_at && (
                          <span>Podepsáno: {(() => { const d = parseDateSafe(contract.signed_at); return d ? format(d, "d. M. yyyy", { locale: cs }) : ''; })()}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleDeleteClick(e, contract.id, contract.contract_number)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 self-end sm:self-start shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">Žádné smlouvy</h3>
            <p className="text-muted-foreground mb-6">
              {searchQuery ? "Nebyly nalezeny žádné smlouvy odpovídající vašemu hledání." : "Začněte vytvořením první cestovní smlouvy."}
            </p>
            {!searchQuery && (
              <Button onClick={() => navigate("/contracts/new")}>
                <Plus className="h-4 w-4 mr-2" />
                Vytvořit první smlouvu
              </Button>
            )}
          </Card>
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
