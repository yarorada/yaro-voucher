import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { FileText, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const YARO_SUPPLIER_NAME = "YARO s.r.o.";

interface FlightSegment {
  departure: string;
  arrival: string;
  airline?: string;
  airline_name?: string;
  flight_number?: string;
  departure_time?: string;
  arrival_time?: string;
  departure_date?: string;
}

interface DealService {
  id: string;
  service_type: string;
  service_name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  price: number | null;
  person_count: number | null;
  quantity: number | null;
  supplier_id: string | null;
  details?: {
    outbound_segments?: FlightSegment[];
    return_segments?: FlightSegment[];
    price_mode?: string;
  } | null;
  suppliers?: { name: string } | null;
}

interface SupplierGroup {
  supplierId: string | null;
  supplierName: string;
  services: DealService[];
  isYaro: boolean;
}

interface TeeTimeData {
  date: string | null;
  club: string;
  time: string;
  golfers?: string;
}

interface CreateVouchersFromDealProps {
  dealId: string;
  services: DealService[];
  clientId: string | null;
  clientName: string;
  teeTimes?: TeeTimeData[];
  onComplete?: () => void;
}

export function CreateVouchersFromDeal({
  dealId,
  services,
  clientId,
  clientName,
  teeTimes,
  onComplete,
}: CreateVouchersFromDealProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ supplierName: string; success: boolean; voucherId?: string; isYaro?: boolean }[]>([]);

  // Group services by supplier
  const supplierGroups: SupplierGroup[] = (() => {
    const groups = new Map<string, SupplierGroup>();
    
    for (const service of services) {
      const key = service.supplier_id || "__none__";
      const supplierName = service.suppliers?.name || "Bez dodavatele";
      const isYaro = supplierName.toLowerCase().includes("yaro");
      
      if (!groups.has(key)) {
        groups.set(key, {
          supplierId: service.supplier_id,
          supplierName,
          services: [],
          isYaro,
        });
      }
      groups.get(key)!.services.push(service);
    }
    
    return Array.from(groups.values());
  })();

  const yaroGroups = supplierGroups.filter(g => g.isYaro);
  const nonYaroGroups = supplierGroups.filter(g => !g.isYaro);

  const handleCreateVouchers = async () => {
    setLoading(true);
    setResults([]);
    const newResults: typeof results = [];

    try {
      // Fetch all travelers for this deal (lead first)
      const { data: dealTravelers } = await supabase
        .from("deal_travelers")
        .select("client_id, is_lead_traveler, clients(id, first_name, last_name)")
        .eq("deal_id", dealId)
        .order("is_lead_traveler", { ascending: false });

      const sortedTravelers = dealTravelers || [];
      const otherTravelerNames = sortedTravelers
        .filter((t: any) => !t.is_lead_traveler && t.clients)
        .map((t: any) => `${t.clients.first_name} ${t.clients.last_name}`);

      // Build flights array from all flight services across all groups
      const buildFlightsFromServices = (svcList: DealService[]) => {
        const flights: any[] = [];
        for (const s of svcList) {
          if (s.service_type !== 'flight') continue;
          const details = s.details;
          if (!details) continue;
          const outSegs = details.outbound_segments || [];
          const retSegs = details.return_segments || [];
          for (const seg of outSegs) {
            if (!seg.departure && !seg.arrival) continue;
            flights.push({
              fromIata: seg.departure || '',
              toIata: seg.arrival || '',
              airlineCode: seg.airline || '',
              airlineName: seg.airline_name || '',
              flightNumber: seg.flight_number || '',
              departureTime: seg.departure_time || '',
              arrivalTime: seg.arrival_time || '',
              date: seg.departure_date || s.start_date || '',
              pax: `${s.person_count || 1} ADT`,
            });
          }
          for (const seg of retSegs) {
            if (!seg.departure && !seg.arrival) continue;
            flights.push({
              fromIata: seg.departure || '',
              toIata: seg.arrival || '',
              airlineCode: seg.airline || '',
              airlineName: seg.airline_name || '',
              flightNumber: seg.flight_number || '',
              departureTime: seg.departure_time || '',
              arrivalTime: seg.arrival_time || '',
              date: seg.departure_date || s.end_date || s.start_date || '',
              pax: `${s.person_count || 1} ADT`,
            });
          }
        }
        return flights.length > 0 ? flights : null;
      };

      // All flight services (regardless of supplier grouping – flights go into every voucher)
      const allFlightServices = services.filter(s => s.service_type === 'flight');
      const voucherFlights = buildFlightsFromServices(allFlightServices);

      for (const group of nonYaroGroups) {
        try {
          // Prepare services for translation (exclude flight services – they go into flights field)
          const servicesForTranslation = group.services.filter(s => s.service_type !== 'flight').map(s => {
            // For hotel services, format as "Accommodation in [room type] in [hotel]"
            let serviceName = s.service_name;
            if (s.service_type === 'hotel' && s.description) {
              serviceName = `Accommodation in ${s.description} in ${s.service_name}`;
            }
            return {
              czech_name: serviceName,
              pax: String(s.person_count || 1),
              qty: String(s.quantity || 1),
              dateFrom: s.start_date || "",
              dateTo: s.end_date || s.start_date || "",
              is_hotel: s.service_type === 'hotel',
            };
          });

          // Translate each service name
          const translatedServices = [];
          for (const s of servicesForTranslation) {
            let translatedName = s.czech_name;
            // Skip translation for hotel services – name is already in English
            if (!s.is_hotel) {
              try {
                const { data: trData, error: trError } = await supabase.functions.invoke(
                  "translate-service-name",
                  { body: { czechName: s.czech_name } }
                );
                if (!trError && trData?.englishName) {
                  translatedName = trData.englishName;
                }
              } catch { /* use original */ }
            }
            
            translatedServices.push({
              name: translatedName,
              pax: s.pax,
              qty: s.qty,
              dateFrom: s.dateFrom,
              dateTo: s.dateTo,
            });
          }

          // Compute expiration_date as the latest service end_date in this group
          let latestEndDate: string | null = null;
          for (const s of group.services) {
            const endDate = s.end_date || s.start_date;
            if (endDate && (!latestEndDate || endDate > latestEndDate)) {
              latestEndDate = endDate;
            }
          }

          // Create voucher
          const { data: voucher, error: voucherError } = await supabase
            .from("vouchers")
            .insert({
              deal_id: dealId,
              client_id: clientId,
              client_name: clientName,
              supplier_id: group.supplierId,
              services: translatedServices,
              issue_date: new Date().toISOString().split("T")[0],
              expiration_date: latestEndDate,
              other_travelers: otherTravelerNames.length > 0 ? otherTravelerNames : null,
              voucher_number: Math.floor(Math.random() * 10000),
              tee_times: teeTimes && teeTimes.length > 0
                ? teeTimes.map((tt: any) => ({
                    ...tt,
                    golfers: tt.golfers || tt.players || String(sortedTravelers.length || 1),
                  }))
                : null,
              flights: voucherFlights,
            } as any)
            .select()
            .single();

          if (voucherError) throw voucherError;

          // Insert voucher_travelers – lead first, then others
          if (sortedTravelers.length > 0) {
            const travelerInserts = sortedTravelers
              .filter((t: any) => t.clients)
              .map((t: any) => ({
                voucher_id: voucher.id,
                client_id: t.client_id,
                is_main_client: t.is_lead_traveler,
              }));

            if (travelerInserts.length > 0) {
              await supabase.from("voucher_travelers").insert(travelerInserts);
            }
          }

          newResults.push({
            supplierName: group.supplierName,
            success: true,
            voucherId: voucher.id,
          });
        } catch (err) {
          console.error(`Error creating voucher for ${group.supplierName}:`, err);
          newResults.push({
            supplierName: group.supplierName,
            success: false,
          });
        }
      }

      // For YARO groups, just note that documents are expected
      for (const group of yaroGroups) {
        newResults.push({
          supplierName: group.supplierName,
          success: true,
          isYaro: true,
        });
      }

      setResults(newResults);

      const successCount = newResults.filter(r => r.success && !r.isYaro).length;
      if (successCount > 0) {
        toast({
          title: "Vouchery vytvořeny",
          description: `Vytvořeno ${successCount} voucher${successCount > 1 ? "ů" : ""} pro externích dodavatelů.${yaroGroups.length > 0 ? " Pro služby YARO vložte cestovní dokumenty níže." : ""}`,
        });
      }

      onComplete?.();
    } catch (error) {
      console.error("Error creating vouchers:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se vytvořit vouchery",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (services.length === 0) return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => { setOpen(true); setResults([]); }}
        className="gap-2 md:size-default"
      >
        <FileText className="h-4 w-4" />
        <span className="hidden sm:inline">Vytvořit vouchery</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Vytvořit vouchery ze služeb</DialogTitle>
            <DialogDescription>
              Systém vytvoří voucher pro každého externího dodavatele s přeloženými službami.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Supplier groups preview */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Skupiny podle dodavatelů:</p>
              {nonYaroGroups.map((group, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted text-sm">
                  <div>
                    <p className="font-medium">{group.supplierName}</p>
                    <p className="text-xs text-muted-foreground">
                      {group.services.length} služb{group.services.length === 1 ? "a" : group.services.length < 5 ? "y" : ""}
                    </p>
                  </div>
                  <Badge variant="outline">Voucher</Badge>
                </div>
              ))}
              {yaroGroups.map((group, i) => (
                <div key={`yaro-${i}`} className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm">
                  <div>
                    <p className="font-medium">{group.supplierName}</p>
                    <p className="text-xs text-muted-foreground">
                      {group.services.length} služb{group.services.length === 1 ? "a" : group.services.length < 5 ? "y" : ""} — vložte cestovní dokumenty
                    </p>
                  </div>
                  <Badge variant="secondary" className="bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Dokumenty
                  </Badge>
                </div>
              ))}
            </div>

            {/* Results */}
            {results.length > 0 && (
              <div className="space-y-2 border-t pt-4">
                <p className="text-sm font-medium">Výsledky:</p>
                {results.map((result, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    {result.isYaro ? (
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    ) : result.success ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span>{result.supplierName}</span>
                    {result.isYaro && (
                      <span className="text-xs text-muted-foreground">— vyžaduje cestovní dokumenty</span>
                    )}
                    {result.voucherId && (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs"
                        onClick={() => navigate(`/vouchers/${result.voucherId}`)}
                      >
                        Otevřít
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                {results.length > 0 ? "Zavřít" : "Zrušit"}
              </Button>
              {results.length === 0 && (
                <Button onClick={handleCreateVouchers} disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Vytvořit vouchery ({nonYaroGroups.length})
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
