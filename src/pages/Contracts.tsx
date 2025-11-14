import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, FileText, Search } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

const Contracts = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: contracts, isLoading } = useQuery({
    queryKey: ["travel_contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("travel_contracts")
        .select(`
          *,
          client:clients(first_name, last_name, email),
          deal:deals(deal_number)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

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
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-heading-1 text-foreground">Cestovní smlouvy</h1>
            <p className="text-body text-muted-foreground mt-1">Správa cestovních smluv podle §2521 OZ</p>
          </div>
          <Button onClick={() => navigate("/contracts/new")}>
            <Plus className="h-4 w-4 mr-2" />
            Nová smlouva
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
                className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/contracts/${contract.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-foreground">
                          {contract.contract_number}
                        </h3>
                        {getStatusBadge(contract.status)}
                      </div>
                      <p className="text-muted-foreground mb-2">
                        Klient: {(() => {
                          const client = contract.client as any;
                          if (!client) return '-';
                          return `${client.first_name} ${client.last_name}`;
                        })()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Obchodní případ: {contract.deal?.deal_number}
                      </p>
                      <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
                        <span>Vytvořeno: {format(new Date(contract.created_at), "d. M. yyyy", { locale: cs })}</span>
                        {contract.signed_at && (
                          <span>Podepsáno: {format(new Date(contract.signed_at), "d. M. yyyy", { locale: cs })}</span>
                        )}
                      </div>
                    </div>
                  </div>
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
      </div>
    </div>
  );
};

export default Contracts;
