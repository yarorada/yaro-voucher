import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, UserCheck } from "lucide-react";
import { Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LeadClientDeal {
  clientId: string;
  clientName: string;
  dealId: string;
  revenue: number;
  cost: number;
  year: number;
}

interface AllTravelerDeal {
  clientId: string;
  clientName: string;
  dealId: string;
  revenue: number;
  cost: number;
  year: number;
  isLead: boolean;
}

interface FlightCostPerDeal {
  deal_id: string;
  flightRevenue: number;
  flightCost: number;
}

interface StatsClientTableProps {
  excludeFlights: boolean;
  flightCosts: FlightCostPerDeal[];
}

type SortMetric = "revenue" | "profit";

export function StatsClientTable({ excludeFlights, flightCosts }: StatsClientTableProps) {
  const [loading, setLoading] = useState(true);
  const [leadDeals, setLeadDeals] = useState<LeadClientDeal[]>([]);
  const [allTravelerDeals, setAllTravelerDeals] = useState<AllTravelerDeal[]>([]);
  const [sortMetric, setSortMetric] = useState<SortMetric>("revenue");
  const [allSortMetric, setAllSortMetric] = useState<SortMetric>("revenue");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch profitability view
      const { data: profitData, error: profitError } = await supabase
        .from("deal_profitability")
        .select("deal_id, revenue, total_costs, start_date, status, lead_client_id");

      if (profitError) throw profitError;

      const profitMap = new Map<string, { revenue: number; cost: number; start_date: string | null; status: string | null }>();
      (profitData || []).forEach((d: any) => {
        profitMap.set(d.deal_id, {
          revenue: Number(d.revenue) || 0,
          cost: Number(d.total_costs) || 0,
          start_date: d.start_date,
          status: d.status,
        });
      });

      // Fetch ALL deal_travelers (not just lead)
      const { data: travelersData, error: travelersError } = await supabase
        .from("deal_travelers")
        .select("deal_id, client_id, is_lead_traveler, clients(id, first_name, last_name)");

      if (travelersError) throw travelersError;

      // Count travelers per deal
      const travelerCountMap = new Map<string, number>();
      (travelersData || []).forEach((dt: any) => {
        travelerCountMap.set(dt.deal_id, (travelerCountMap.get(dt.deal_id) || 0) + 1);
      });

      // Build all traveler-deal records with proportional share
      const allDeals: AllTravelerDeal[] = [];
      (travelersData || []).forEach((dt: any) => {
        if (!dt.clients) return;
        const prof = profitMap.get(dt.deal_id);
        if (!prof || prof.status === "cancelled" || !prof.start_date) return;
        const travelerCount = travelerCountMap.get(dt.deal_id) || 1;
        allDeals.push({
          clientId: dt.client_id,
          clientName: `${dt.clients.first_name} ${dt.clients.last_name}`,
          dealId: dt.deal_id,
          revenue: prof.revenue / travelerCount,
          cost: prof.cost / travelerCount,
          year: new Date(prof.start_date).getFullYear(),
          isLead: dt.is_lead_traveler,
        });
      });

      // Lead deals (for first table)
      const leadOnly: LeadClientDeal[] = allDeals
        .filter((d) => d.isLead)
        .map((d) => ({ ...d }));

      // Extract available years
      const years = new Set(allDeals.map((d) => d.year));
      const sortedYears = Array.from(years).sort((a, b) => b - a);
      setAvailableYears(sortedYears);

      const currentYear = new Date().getFullYear();
      if (sortedYears.includes(currentYear)) {
        setSelectedYear(currentYear.toString());
      } else if (sortedYears.length > 0) {
        setSelectedYear(sortedYears[0].toString());
      }

      setLeadDeals(leadOnly);
      setAllTravelerDeals(allDeals);
    } catch (error) {
      console.error("Error fetching client stats:", error);
    } finally {
      setLoading(false);
    }
  };

  // Helper: apply flight deduction to a deal's revenue/cost
  const applyFlightDeduction = (dealId: string, rev: number, cost: number) => {
    if (!excludeFlights) return { rev, cost };
    const fc = flightCosts.find((f) => f.deal_id === dealId);
    if (fc) return { rev: rev - fc.flightRevenue, cost: cost - fc.flightCost };
    return { rev, cost };
  };

  const sortedLeadStats = useMemo(() => {
    const filtered = selectedYear === "all"
      ? leadDeals
      : leadDeals.filter((d) => d.year === parseInt(selectedYear));

    const map = new Map<string, { clientId: string; clientName: string; dealCount: number; totalRevenue: number; totalCost: number; profit: number }>();
    filtered.forEach((d) => {
      const { rev, cost } = applyFlightDeduction(d.dealId, d.revenue, d.cost);
      const profit = rev - cost;
      const existing = map.get(d.clientId);
      if (existing) {
        existing.dealCount += 1;
        existing.totalRevenue += rev;
        existing.totalCost += cost;
        existing.profit += profit;
      } else {
        map.set(d.clientId, { clientId: d.clientId, clientName: d.clientName, dealCount: 1, totalRevenue: rev, totalCost: cost, profit });
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      sortMetric === "revenue" ? b.totalRevenue - a.totalRevenue : b.profit - a.profit
    );
  }, [leadDeals, sortMetric, selectedYear, excludeFlights, flightCosts]);

  const sortedAllTravelerStats = useMemo(() => {
    const filtered = selectedYear === "all"
      ? allTravelerDeals
      : allTravelerDeals.filter((d) => d.year === parseInt(selectedYear));

    const map = new Map<string, { clientId: string; clientName: string; dealCount: number; totalRevenue: number; totalCost: number; profit: number }>();
    filtered.forEach((d) => {
      const { rev, cost } = applyFlightDeduction(d.dealId, d.revenue, d.cost);
      const profit = rev - cost;
      const existing = map.get(d.clientId);
      if (existing) {
        existing.dealCount += 1;
        existing.totalRevenue += rev;
        existing.totalCost += cost;
        existing.profit += profit;
      } else {
        map.set(d.clientId, { clientId: d.clientId, clientName: d.clientName, dealCount: 1, totalRevenue: rev, totalCost: cost, profit });
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      allSortMetric === "revenue" ? b.totalRevenue - a.totalRevenue : b.profit - a.profit
    );
  }, [allTravelerDeals, allSortMetric, selectedYear, excludeFlights, flightCosts]);

  const yearFilter = (
    <Select value={selectedYear} onValueChange={setSelectedYear}>
      <SelectTrigger className="w-[110px] h-8 text-xs">
        <SelectValue placeholder="Rok" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Celkem</SelectItem>
        {availableYears.map((year) => (
          <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const clientTableBody = (
    stats: typeof sortedLeadStats,
    metric: SortMetric
  ) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[40px] text-center">#</TableHead>
          <TableHead>Klient</TableHead>
          <TableHead className="text-center">Cest</TableHead>
          <TableHead className="text-right">{metric === "revenue" ? "Obrat" : "Zisk"}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {stats.map((stat, index) => (
          <TableRow key={stat.clientId}>
            <TableCell className="text-center text-muted-foreground font-medium text-sm">{index + 1}.</TableCell>
            <TableCell className="text-body font-medium break-words">{stat.clientName}</TableCell>
            <TableCell className="text-center text-body">{stat.dealCount}</TableCell>
            <TableCell className="text-right text-body">
              {metric === "revenue" ? (
                <span>{stat.totalRevenue.toLocaleString("cs-CZ")} Kč</span>
              ) : (
                <span className={stat.profit > 0 ? "text-green-600 dark:text-green-400" : stat.profit < 0 ? "text-destructive" : ""}>
                  {stat.profit.toLocaleString("cs-CZ")} Kč
                </span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[0, 1].map((i) => (
          <Card key={i}>
            <CardContent className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Lead client stats */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-heading-2 flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Hlavní klienti
            </CardTitle>
            <div className="flex items-center gap-2">
              {yearFilter}
              <Tabs value={sortMetric} onValueChange={(v) => setSortMetric(v as SortMetric)}>
                <TabsList className="h-8">
                  <TabsTrigger value="revenue" className="text-xs px-3 h-7">Obrat</TabsTrigger>
                  <TabsTrigger value="profit" className="text-xs px-3 h-7">Zisk</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sortedLeadStats.length === 0 ? (
            <p className="text-body text-muted-foreground">Žádná data</p>
          ) : clientTableBody(sortedLeadStats, sortMetric)}
        </CardContent>
      </Card>

      {/* All travelers stats */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-heading-2 flex items-center gap-2">
              <Users className="h-5 w-5" />
              Všichni cestující
            </CardTitle>
            <div className="flex items-center gap-2">
              <Tabs value={allSortMetric} onValueChange={(v) => setAllSortMetric(v as SortMetric)}>
                <TabsList className="h-8">
                  <TabsTrigger value="revenue" className="text-xs px-3 h-7">Obrat</TabsTrigger>
                  <TabsTrigger value="profit" className="text-xs px-3 h-7">Zisk</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sortedAllTravelerStats.length === 0 ? (
            <p className="text-body text-muted-foreground">Žádná data</p>
          ) : clientTableBody(sortedAllTravelerStats, allSortMetric)}
        </CardContent>
      </Card>
    </div>
  );
}
