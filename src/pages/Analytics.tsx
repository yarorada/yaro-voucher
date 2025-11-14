import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AnalyticsOverview } from "@/components/AnalyticsOverview";
import { AnalyticsFilters, AnalyticsFilterState } from "@/components/AnalyticsFilters";
import { ClientAnalytics } from "@/components/ClientAnalytics";
import { DestinationAnalytics } from "@/components/DestinationAnalytics";
import { HotelAnalytics } from "@/components/HotelAnalytics";
import { ExportButton } from "@/components/ExportButton";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { toast } from "sonner";

export default function Analytics() {
  const currentYear = new Date().getFullYear();
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AnalyticsFilterState>({
    yearType: 'departure',
    year: currentYear,
    clientId: null,
    destinationId: null,
    status: 'all',
  });

  const [overview, setOverview] = useState({
    totalRevenue: 0,
    totalProfit: 0,
    averageMargin: 0,
    activeDeals: 0,
  });

  const [timeSeriesData, setTimeSeriesData] = useState<any[]>([]);
  const [clientStats, setClientStats] = useState<any[]>([]);
  const [destinationStats, setDestinationStats] = useState<any[]>([]);
  const [hotelStats, setHotelStats] = useState<any[]>([]);

  useEffect(() => {
    fetchAnalytics();
  }, [filters]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Build query based on filters
      let query = supabase
        .from('deal_profitability')
        .select(`
          *,
          deals!inner(
            status,
            destination_id,
            destinations(name, country_id, countries(name, iso_code)),
            deal_services(service_name, service_type)
          ),
          clients!lead_client_id(first_name, last_name)
        `);

      // Apply filters
      if (filters.status !== 'all') {
        query = query.eq('deals.status', filters.status as any);
      }

      if (filters.year) {
        const dateField = 
          filters.yearType === 'departure' ? 'start_date' :
          filters.yearType === 'created' ? 'created_at' : 'created_at';
        
        query = query.gte(dateField, `${filters.year}-01-01`)
                     .lte(dateField, `${filters.year}-12-31`);
      }

      if (filters.clientId) {
        query = query.eq('lead_client_id', filters.clientId);
      }

      const { data: profitData, error } = await query;

      if (error) throw error;

      // Calculate overview metrics
      const totalRevenue = profitData?.reduce((sum, d) => sum + (Number(d.revenue) || 0), 0) || 0;
      const totalProfit = profitData?.reduce((sum, d) => sum + (Number(d.profit) || 0), 0) || 0;
      const averageMargin = profitData && profitData.length > 0
        ? profitData.reduce((sum, d) => sum + (Number(d.profit_margin_percent) || 0), 0) / profitData.length
        : 0;
      const activeDeals = profitData?.filter(d => d.status === 'confirmed' || d.status === 'quote').length || 0;

      setOverview({ totalRevenue, totalProfit, averageMargin, activeDeals });

      // Process time series data (monthly aggregation)
      const monthlyData: any = {};
      profitData?.forEach((deal: any) => {
        const month = new Date(deal.start_date).toLocaleDateString('cs-CZ', { month: 'short', year: 'numeric' });
        if (!monthlyData[month]) {
          monthlyData[month] = { month, revenue: 0, profit: 0, count: 0 };
        }
        monthlyData[month].revenue += Number(deal.revenue) || 0;
        monthlyData[month].profit += Number(deal.profit) || 0;
        monthlyData[month].count += 1;
      });
      setTimeSeriesData(Object.values(monthlyData));

      // Process client stats
      const clientMap: any = {};
      profitData?.forEach((deal: any) => {
        if (!deal.clients) return;
        const clientId = deal.lead_client_id;
        const clientName = `${deal.clients.first_name} ${deal.clients.last_name}`;
        
        if (!clientMap[clientId]) {
          clientMap[clientId] = {
            clientId,
            clientName,
            totalSpent: 0,
            dealCount: 0,
            totalMargin: 0,
          };
        }
        clientMap[clientId].totalSpent += Number(deal.revenue) || 0;
        clientMap[clientId].dealCount += 1;
        clientMap[clientId].totalMargin += Number(deal.profit_margin_percent) || 0;
      });

      const clientStatsArray = Object.values(clientMap).map((c: any) => ({
        ...c,
        averageMargin: c.dealCount > 0 ? c.totalMargin / c.dealCount : 0,
      })).sort((a: any, b: any) => b.totalSpent - a.totalSpent).slice(0, 10);
      setClientStats(clientStatsArray);

      // Process destination stats
      const destMap: any = {};
      profitData?.forEach((deal: any) => {
        if (!deal.deals?.destinations) return;
        const destId = deal.deals.destination_id;
        const destName = deal.deals.destinations.name;
        const countryName = deal.deals.destinations.countries?.name || 'Neznámá země';
        const countryFlag = getCountryFlag(deal.deals.destinations.countries?.iso_code);
        
        if (!destMap[destId]) {
          destMap[destId] = {
            destinationId: destId,
            destinationName: destName,
            countryName,
            countryFlag,
            dealCount: 0,
            totalRevenue: 0,
          };
        }
        destMap[destId].dealCount += 1;
        destMap[destId].totalRevenue += Number(deal.revenue) || 0;
      });

      const destStatsArray = Object.values(destMap).map((d: any) => ({
        ...d,
        averagePrice: d.dealCount > 0 ? d.totalRevenue / d.dealCount : 0,
      })).sort((a: any, b: any) => b.totalRevenue - a.totalRevenue).slice(0, 10);
      setDestinationStats(destStatsArray);

      // Process hotel stats
      const hotelMap: any = {};
      profitData?.forEach((deal: any) => {
        deal.deals?.deal_services?.forEach((service: any) => {
          if (service.service_type === 'hotel') {
            const hotelName = service.service_name;
            if (!hotelMap[hotelName]) {
              hotelMap[hotelName] = {
                hotelName,
                reservationCount: 0,
                totalRevenue: 0,
                totalMargin: 0,
              };
            }
            hotelMap[hotelName].reservationCount += 1;
            hotelMap[hotelName].totalRevenue += Number(deal.revenue) || 0;
            hotelMap[hotelName].totalMargin += Number(deal.profit_margin_percent) || 0;
          }
        });
      });

      const hotelStatsArray = Object.values(hotelMap).map((h: any) => ({
        ...h,
        averageMargin: h.reservationCount > 0 ? h.totalMargin / h.reservationCount : 0,
      })).sort((a: any, b: any) => b.totalRevenue - a.totalRevenue).slice(0, 10);
      setHotelStats(hotelStatsArray);

    } catch (error: any) {
      console.error("Error fetching analytics:", error);
      toast.error("Chyba při načítání statistik");
    } finally {
      setLoading(false);
    }
  };

  const getCountryFlag = (isoCode?: string) => {
    if (!isoCode) return '🌍';
    const codePoints = isoCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-heading-1">Statistiky</h1>
        <ExportButton data={timeSeriesData} filename={`statistiky-${filters.year || 'vse'}`} />
      </div>

      <AnalyticsFilters filters={filters} onFiltersChange={setFilters} />

      <AnalyticsOverview
        totalRevenue={overview.totalRevenue}
        totalProfit={overview.totalProfit}
        averageMargin={overview.averageMargin}
        activeDeals={overview.activeDeals}
      />

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Vývoj obratu a zisku</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={timeSeriesData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(value: number) => `${value.toLocaleString('cs-CZ')} Kč`} />
            <Legend />
            <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" name="Obrat" strokeWidth={2} />
            <Line type="monotone" dataKey="profit" stroke="hsl(var(--success))" name="Zisk" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Počet dealů podle měsíce</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={timeSeriesData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" fill="hsl(var(--accent))" name="Počet dealů" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <ClientAnalytics clientStats={clientStats} />
      <DestinationAnalytics destinationStats={destinationStats} />
      <HotelAnalytics hotelStats={hotelStats} />
    </div>
  );
}
