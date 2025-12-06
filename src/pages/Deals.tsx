import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import yaroLogo from "@/assets/yaro-logo-wide.png";
import { DealStatusBadge } from "@/components/DealStatusBadge";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { formatPriceCurrency } from "@/lib/utils";

interface Deal {
  id: string;
  deal_number: string;
  status: "inquiry" | "quote" | "confirmed" | "completed" | "cancelled";
  start_date: string | null;
  end_date: string | null;
  total_price: number | null;
  destinations: { name: string } | null;
  deal_travelers: { clients: { first_name: string; last_name: string } }[];
  created_at: string;
}

const Deals = () => {
  const navigate = useNavigate();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [filteredDeals, setFilteredDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchDeals();
  }, []);

  useEffect(() => {
    filterDeals();
  }, [searchQuery, deals]);

  const fetchDeals = async () => {
    try {
      const { data, error } = await supabase
        .from("deals")
        .select(`
          id,
          deal_number,
          status,
          start_date,
          end_date,
          total_price,
          created_at,
          destinations:destination_id (name),
          deal_travelers (
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
    if (!searchQuery.trim()) {
      setFilteredDeals(deals);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = deals.filter(
      (deal) =>
        deal.deal_number.toLowerCase().includes(query) ||
        deal.destinations?.name.toLowerCase().includes(query) ||
        deal.deal_travelers.some((dt: any) =>
          `${dt.clients.first_name} ${dt.clients.last_name}`
            .toLowerCase()
            .includes(query)
        )
    );
    setFilteredDeals(filtered);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return format(new Date(dateString), "dd.MM.yyyy", { locale: cs });
  };

  const formatPrice = (price: number | null) => formatPriceCurrency(price);

  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)]">
      <div className="container max-w-6xl mx-auto py-8 px-4">
        <header className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-foreground">Obchodní případy</h1>
              <p className="text-muted-foreground mt-2">Správa všech obchodních příležitostí</p>
            </div>
            <Button onClick={() => navigate("/deals/new")} variant="premium" className="gap-2">
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
              <p className="text-sm text-muted-foreground">
                Celkem případů: <span className="font-semibold text-foreground">{deals.length}</span>
                {searchQuery && filteredDeals.length !== deals.length && (
                  <span className="ml-2">
                    (zobrazeno: <span className="font-semibold text-foreground">{filteredDeals.length}</span>)
                  </span>
                )}
              </p>
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
                const mainTravelers = deal.deal_travelers
                  .map((dt: any) => `${dt.clients.first_name} ${dt.clients.last_name}`)
                  .join(", ");
                const title = deal.destinations?.name
                  ? `${deal.deal_number} - ${deal.destinations.name}`
                  : deal.deal_number;

                return (
                  <Card key={deal.id} className="p-6 hover:shadow-[var(--shadow-medium)] transition-shadow cursor-pointer" onClick={() => navigate(`/deals/${deal.id}`)}>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <DealStatusBadge status={deal.status} />
                          <h3 className="text-xl font-bold text-foreground">{title}</h3>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          {mainTravelers && (
                            <span>
                              <span className="font-semibold text-foreground">Cestující:</span> {mainTravelers}
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
                          <span>
                            <span className="font-semibold text-foreground">Vytvořeno:</span> {formatDate(deal.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Deals;
