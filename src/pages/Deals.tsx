import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, LogOut, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import yaroLogo from "@/assets/yaro-logo-wide.png";
import { DealStatusBadge } from "@/components/DealStatusBadge";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

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
  const { signOut } = useAuth();
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

  const formatPrice = (price: number | null) => {
    if (!price) return "-";
    return new Intl.NumberFormat("cs-CZ", {
      style: "currency",
      currency: "CZK",
    }).format(price);
  };

  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)]">
      <div className="container max-w-7xl mx-auto py-8 px-4">
        <header className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              onClick={() => navigate("/")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Zpět
            </Button>
            <div className="flex items-center gap-4">
              <img src={yaroLogo} alt="YARO Travel" className="h-12" />
              <Button variant="outline" onClick={signOut} className="gap-2">
                <LogOut className="h-4 w-4" />
                Odhlásit
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-foreground">
                Obchodní případy
              </h1>
              <p className="text-muted-foreground mt-2">
                Správa všech obchodních příležitostí
              </p>
            </div>
            <Button onClick={() => navigate("/deals/new")} className="gap-2">
              <Plus className="h-4 w-4" />
              Nový případ
            </Button>
          </div>
        </header>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Načítání...</p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Hledat podle čísla případu, destinace nebo klienta..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {filteredDeals.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    {searchQuery
                      ? "Žádné případy nenalezeny."
                      : "Zatím nemáte žádné obchodní případy."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredDeals.map((deal) => (
                  <Card
                    key={deal.id}
                    className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => navigate(`/deals/${deal.id}`)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-xl mb-2">
                            {deal.deal_number}
                          </CardTitle>
                          <div className="flex gap-2 text-sm text-muted-foreground">
                            {deal.destinations && (
                              <span>📍 {deal.destinations.name}</span>
                            )}
                            {deal.start_date && (
                              <span>
                                🗓️ {formatDate(deal.start_date)}
                                {deal.end_date && ` - ${formatDate(deal.end_date)}`}
                              </span>
                            )}
                          </div>
                        </div>
                        <DealStatusBadge status={deal.status} />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div>
                          {deal.deal_travelers.length > 0 && (
                            <p className="text-sm">
                              <strong>Cestující:</strong>{" "}
                              {deal.deal_travelers
                                .map(
                                  (dt: any) =>
                                    `${dt.clients.first_name} ${dt.clients.last_name}`
                                )
                                .join(", ")}
                            </p>
                          )}
                        </div>
                        {deal.total_price && (
                          <p className="text-lg font-bold">
                            {formatPrice(deal.total_price)}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Deals;
