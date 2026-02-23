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

interface LeadClientStat {
  clientId: string;
  clientName: string;
  dealCount: number;
  totalRevenue: number;
  totalCost: number;
  profit: number;
}

interface TravelerServiceStat {
  clientId: string;
  clientName: string;
  serviceCount: number;
  serviceTypes: Record<string, number>;
}

type SortMetric = "revenue" | "profit";

export function StatsClientTable() {
  const [loading, setLoading] = useState(true);
  const [leadStats, setLeadStats] = useState<LeadClientStat[]>([]);
  const [travelerStats, setTravelerStats] = useState<TravelerServiceStat[]>([]);
  const [sortMetric, setSortMetric] = useState<SortMetric>("revenue");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch lead travelers with deal info
      const { data: leadData, error: leadError } = await supabase
        .from("deal_travelers")
        .select(`
          client_id,
          deal_id,
          is_lead_traveler,
          clients(id, first_name, last_name),
          deals(id, total_price, status)
        `)
        .eq("is_lead_traveler", true);

      if (leadError) throw leadError;

      // Get all deal IDs from lead data
      const dealIds = (leadData || [])
        .filter((dt: any) => dt.deals && dt.deals.status !== "cancelled")
        .map((dt: any) => dt.deal_id);

      // Fetch deal services for cost calculation
      let dealServicesMap = new Map<string, number>();
      if (dealIds.length > 0) {
        const { data: servicesData } = await supabase
          .from("deal_services")
          .select("deal_id, cost_price, quantity")
          .in("deal_id", dealIds);

        (servicesData || []).forEach((s: any) => {
          const cost = (s.cost_price || 0) * (s.quantity || 1);
          dealServicesMap.set(s.deal_id, (dealServicesMap.get(s.deal_id) || 0) + cost);
        });
      }

      // Aggregate by client
      const leadMap = new Map<string, LeadClientStat>();
      (leadData || []).forEach((dt: any) => {
        if (!dt.clients || !dt.deals) return;
        if (dt.deals.status === "cancelled") return;
        const key = dt.client_id;
        const revenue = dt.deals.total_price || 0;
        const cost = dealServicesMap.get(dt.deal_id) || 0;
        const existing = leadMap.get(key);
        if (existing) {
          existing.dealCount += 1;
          existing.totalRevenue += revenue;
          existing.totalCost += cost;
          existing.profit += revenue - cost;
        } else {
          leadMap.set(key, {
            clientId: dt.client_id,
            clientName: `${dt.clients.first_name} ${dt.clients.last_name}`,
            dealCount: 1,
            totalRevenue: revenue,
            totalCost: cost,
            profit: revenue - cost,
          });
        }
      });

      setLeadStats(Array.from(leadMap.values()));

      // Fetch service assignments
      const { data: serviceData, error: serviceError } = await supabase
        .from("contract_service_travelers")
        .select(`
          client_id,
          service_type,
          service_name,
          clients(id, first_name, last_name)
        `);

      if (serviceError) throw serviceError;

      // Aggregate by traveler
      const travelerMap = new Map<string, TravelerServiceStat>();
      (serviceData || []).forEach((cst: any) => {
        if (!cst.clients) return;
        const key = cst.client_id;
        const existing = travelerMap.get(key);
        if (existing) {
          existing.serviceCount += 1;
          existing.serviceTypes[cst.service_type] =
            (existing.serviceTypes[cst.service_type] || 0) + 1;
        } else {
          travelerMap.set(key, {
            clientId: cst.client_id,
            clientName: `${cst.clients.first_name} ${cst.clients.last_name}`,
            serviceCount: 1,
            serviceTypes: { [cst.service_type]: 1 },
          });
        }
      });

      setTravelerStats(
        Array.from(travelerMap.values()).sort(
          (a, b) => b.serviceCount - a.serviceCount
        )
      );
    } catch (error) {
      console.error("Error fetching client stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const sortedLeadStats = useMemo(() => {
    return [...leadStats].sort((a, b) => {
      if (sortMetric === "revenue") return b.totalRevenue - a.totalRevenue;
      return b.profit - a.profit;
    });
  }, [leadStats, sortMetric]);

  const serviceTypeLabels: Record<string, string> = {
    hotel: "Hotel",
    flight: "Let",
    golf: "Golf",
    transfer: "Transfer",
    insurance: "Pojištění",
    other: "Ostatní",
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
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
            <Tabs value={sortMetric} onValueChange={(v) => setSortMetric(v as SortMetric)}>
              <TabsList className="h-8">
                <TabsTrigger value="revenue" className="text-xs px-3 h-7">Obrat</TabsTrigger>
                <TabsTrigger value="profit" className="text-xs px-3 h-7">Zisk</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {sortedLeadStats.length === 0 ? (
            <p className="text-body text-muted-foreground">Žádná data</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Klient</TableHead>
                  <TableHead className="text-center">Cest</TableHead>
                  <TableHead className="text-right">
                    {sortMetric === "revenue" ? "Obrat" : "Zisk"}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedLeadStats.map((stat) => (
                  <TableRow key={stat.clientId}>
                    <TableCell className="text-body font-medium break-words">
                      {stat.clientName}
                    </TableCell>
                    <TableCell className="text-center text-body">
                      {stat.dealCount}
                    </TableCell>
                    <TableCell className="text-right text-body">
                      {sortMetric === "revenue" ? (
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
          )}
        </CardContent>
      </Card>

      {/* Traveler service assignment stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-heading-2 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Cestující – přiřazení ke službám
          </CardTitle>
        </CardHeader>
        <CardContent>
          {travelerStats.length === 0 ? (
            <p className="text-body text-muted-foreground">Žádná data</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cestující</TableHead>
                  <TableHead className="text-center">Služeb</TableHead>
                  <TableHead>Rozložení</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {travelerStats.map((stat) => (
                  <TableRow key={stat.clientId}>
                    <TableCell className="text-body font-medium break-words">
                      {stat.clientName}
                    </TableCell>
                    <TableCell className="text-center text-body">
                      {stat.serviceCount}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(stat.serviceTypes).map(
                          ([type, count]) => (
                            <span
                              key={type}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary"
                            >
                              {serviceTypeLabels[type] || type}: {count}
                            </span>
                          )
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
