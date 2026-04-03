import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { FileText, Loader2, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
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

interface ExistingVoucher {
  id: string;
  voucher_code: string;
  supplier_id: string | null;
}

interface CreateVouchersFromDealProps {
  dealId: string;
  services: DealService[];
  clientId: string | null;
  clientName: string;
  teeTimes?: TeeTimeData[];
  onComplete?: () => void;
  triggerClassName?: string;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

// ---- helpers ---------------------------------------------------------------

function buildFlightsFromServices(svcList: DealService[]) {
  const flights: any[] = [];
  for (const s of svcList) {
    if (s.service_type !== "flight") continue;
    const details = s.details;
    if (!details) continue;
    const outSegs = details.outbound_segments || [];
    const retSegs = details.return_segments || [];
    for (const seg of outSegs) {
      if (!seg.departure && !seg.arrival) continue;
      flights.push({
        fromIata: seg.departure || "",
        toIata: seg.arrival || "",
        airlineCode: seg.airline || "",
        airlineName: seg.airline_name || "",
        flightNumber: seg.flight_number || "",
        departureTime: seg.departure_time || "",
        arrivalTime: seg.arrival_time || "",
        date: seg.departure_date || s.start_date || "",
        pax: `${s.person_count || 1} ADT`,
      });
    }
    for (const seg of retSegs) {
      if (!seg.departure && !seg.arrival) continue;
      flights.push({
        fromIata: seg.departure || "",
        toIata: seg.arrival || "",
        airlineCode: seg.airline || "",
        airlineName: seg.airline_name || "",
        flightNumber: seg.flight_number || "",
        departureTime: seg.departure_time || "",
        arrivalTime: seg.arrival_time || "",
        date: seg.departure_date || s.end_date || s.start_date || "",
        pax: `${s.person_count || 1} ADT`,
      });
    }
  }
  return flights.length > 0 ? flights : null;
}

async function translateServicesForGroup(
  group: SupplierGroup,
  supabaseClient: typeof supabase
) {
  const servicesForTranslation = group.services
    .filter((s) => s.service_type !== "flight")
    .map((s) => {
      let serviceName = s.service_name;
      if (s.service_type === "hotel" && s.description) {
        serviceName = `Accommodation in ${s.description} in ${s.service_name}`;
      }
      return {
        czech_name: serviceName,
        pax: String(s.person_count ?? s.quantity ?? 1),
        qty: String(s.quantity ?? s.person_count ?? 1),
        dateFrom: s.start_date || "",
        dateTo: s.end_date || s.start_date || "",
        is_hotel: s.service_type === "hotel",
      };
    });

  const translatedServices = [];
  for (const s of servicesForTranslation) {
    let translatedName = s.czech_name;
    if (!s.is_hotel) {
      try {
        const { data: trData, error: trError } =
          await supabaseClient.functions.invoke("translate-service-name", {
            body: { czechName: s.czech_name },
          });
        if (!trError && trData?.englishName) translatedName = trData.englishName;
      } catch {
        /* use original */
      }
    }
    translatedServices.push({
      name: translatedName,
      pax: s.pax,
      qty: s.qty,
      dateFrom: s.dateFrom,
      dateTo: s.dateTo,
    });
  }
  return translatedServices;
}

function latestEndDateForGroup(group: SupplierGroup): string | null {
  let latest: string | null = null;
  for (const s of group.services) {
    const d = s.end_date || s.start_date;
    if (d && (!latest || d > latest)) latest = d;
  }
  return latest;
}

// ---- component -------------------------------------------------------------

export function CreateVouchersFromDeal({
  dealId,
  services,
  clientId,
  clientName,
  teeTimes,
  onComplete,
  triggerClassName,
  externalOpen,
  onExternalOpenChange,
}: CreateVouchersFromDealProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = onExternalOpenChange || setInternalOpen;
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [results, setResults] = useState<
    { supplierName: string; success: boolean; voucherId?: string; isYaro?: boolean }[]
  >([]);
  const [existingVouchersDialogOpen, setExistingVouchersDialogOpen] = useState(false);
  const [existingVouchers, setExistingVouchers] = useState<ExistingVoucher[]>([]);

  // Group services by supplier
  const supplierGroups: SupplierGroup[] = (() => {
    const groups = new Map<string, SupplierGroup>();
    for (const service of services) {
      const key = service.supplier_id || "__none__";
      const supplierName = service.suppliers?.name || "Bez dodavatele";
      const isYaro = supplierName.toLowerCase().includes("yaro");
      if (!groups.has(key)) {
        groups.set(key, { supplierId: service.supplier_id, supplierName, services: [], isYaro });
      }
      groups.get(key)!.services.push(service);
    }
    return Array.from(groups.values());
  })();

  const yaroGroups = supplierGroups.filter((g) => g.isYaro);
  const nonYaroGroups = supplierGroups.filter((g) => !g.isYaro);

  // ---- shared traveler helpers ----
  async function fetchTravelerData() {
    const { data: dealTravelers } = await supabase
      .from("deal_travelers")
      .select("client_id, is_lead_traveler, order_index, clients(id, first_name, last_name)")
      .eq("deal_id", dealId)
      .order("order_index", { ascending: true });

    const sortedTravelers = dealTravelers || [];
    const firstTraveler = sortedTravelers[0] || null;
    const orderer = sortedTravelers.find((t: any) => t.is_lead_traveler) || null;
    const secondaryClientId =
      orderer && firstTraveler && orderer.client_id !== firstTraveler.client_id
        ? orderer.client_id
        : null;

    const otherTravelerNames = sortedTravelers
      .filter((t: any) => {
        if (!t.clients) return false;
        if (firstTraveler && t.client_id === firstTraveler.client_id) return false;
        if (secondaryClientId && t.client_id === secondaryClientId) return false;
        return true;
      })
      .map((t: any) => `${t.clients.first_name} ${t.clients.last_name}`);

    const mainClientId = firstTraveler?.client_id || clientId;
    const mainClientName = firstTraveler?.clients
      ? `${(firstTraveler.clients as any).first_name} ${(firstTraveler.clients as any).last_name}`
      : clientName;

    return {
      sortedTravelers,
      firstTraveler,
      orderer,
      secondaryClientId,
      otherTravelerNames,
      mainClientId,
      mainClientName,
    };
  }

  async function upsertVoucherTravelers(
    voucherId: string,
    sortedTravelers: any[],
    firstTraveler: any,
    secondaryClientId: string | null,
    orderer: any
  ) {
    await supabase.from("voucher_travelers").delete().eq("voucher_id", voucherId);

    const inserts: { voucher_id: string; client_id: string; is_main_client: boolean }[] = [];

    if (firstTraveler?.clients) {
      inserts.push({ voucher_id: voucherId, client_id: firstTraveler.client_id, is_main_client: true });
    }
    if (secondaryClientId && orderer?.clients) {
      inserts.push({ voucher_id: voucherId, client_id: secondaryClientId, is_main_client: false });
    }
    sortedTravelers
      .filter((t: any) => {
        if (!t.clients) return false;
        if (firstTraveler && t.client_id === firstTraveler.client_id) return false;
        if (secondaryClientId && t.client_id === secondaryClientId) return false;
        return true;
      })
      .forEach((t: any) => {
        inserts.push({ voucher_id: voucherId, client_id: t.client_id, is_main_client: false });
      });

    if (inserts.length > 0) {
      await supabase.from("voucher_travelers").insert(inserts);
    }
  }

  // ---- create vouchers ----
  const handleCreateVouchers = async () => {
    setLoading(true);
    setResults([]);
    const newResults: typeof results = [];

    try {
      const {
        sortedTravelers,
        firstTraveler,
        orderer,
        secondaryClientId,
        otherTravelerNames,
        mainClientId,
        mainClientName,
      } = await fetchTravelerData();

      const allFlightServices = services.filter((s) => s.service_type === "flight");
      const voucherFlights = buildFlightsFromServices(allFlightServices);

      for (const group of nonYaroGroups) {
        try {
          const translatedServices = await translateServicesForGroup(group, supabase);

          const { data: voucher, error: voucherError } = await supabase
            .from("vouchers")
            .insert({
              deal_id: dealId,
              client_id: mainClientId,
              client_name: mainClientName,
              supplier_id: group.supplierId,
              services: translatedServices,
              issue_date: new Date().toISOString().split("T")[0],
              expiration_date: latestEndDateForGroup(group),
              other_travelers: otherTravelerNames.length > 0 ? otherTravelerNames : null,
              voucher_number: Math.floor(Math.random() * 10000),
              tee_times:
                teeTimes && teeTimes.length > 0
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

          await upsertVoucherTravelers(
            voucher.id,
            sortedTravelers,
            firstTraveler,
            secondaryClientId,
            orderer
          );

          newResults.push({ supplierName: group.supplierName, success: true, voucherId: voucher.id });
        } catch (err) {
          console.error(`Error creating voucher for ${group.supplierName}:`, err);
          newResults.push({ supplierName: group.supplierName, success: false });
        }
      }

      for (const group of yaroGroups) {
        newResults.push({ supplierName: group.supplierName, success: true, isYaro: true });
      }

      setResults(newResults);
      const successCount = newResults.filter((r) => r.success && !r.isYaro).length;
      if (successCount > 0) {
        toast({
          title: "Vouchery vytvořeny",
          description: `Vytvořeno ${successCount} voucher${successCount > 1 ? "ů" : ""} pro externích dodavatelů.${yaroGroups.length > 0 ? " Pro služby YARO vložte cestovní dokumenty níže." : ""}`,
        });
      }
      onComplete?.();
    } catch (error) {
      console.error("Error creating vouchers:", error);
      toast({ title: "Chyba", description: "Nepodařilo se vytvořit vouchery", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ---- sync existing vouchers ----
  const handleSyncVouchers = async () => {
    setSyncing(true);
    const newResults: typeof results = [];

    try {
      const {
        sortedTravelers,
        firstTraveler,
        orderer,
        secondaryClientId,
        otherTravelerNames,
        mainClientId,
        mainClientName,
      } = await fetchTravelerData();

      const allFlightServices = services.filter((s) => s.service_type === "flight");
      const voucherFlights = buildFlightsFromServices(allFlightServices);

      for (const v of existingVouchers) {
        try {
          // Find the matching supplier group for this voucher
          const group = nonYaroGroups.find((g) => g.supplierId === v.supplier_id);
          if (!group) {
            // Try null-supplier group
            const nullGroup = nonYaroGroups.find((g) => g.supplierId === null);
            if (!nullGroup) {
              newResults.push({ supplierName: v.voucher_code, success: false });
              continue;
            }
          }
          const targetGroup = group || nonYaroGroups.find((g) => g.supplierId === null)!;

          const translatedServices = await translateServicesForGroup(targetGroup, supabase);

          const { error: updateError } = await supabase
            .from("vouchers")
            .update({
              client_id: mainClientId,
              client_name: mainClientName,
              services: translatedServices,
              expiration_date: latestEndDateForGroup(targetGroup),
              other_travelers: otherTravelerNames.length > 0 ? otherTravelerNames : null,
              tee_times:
                teeTimes && teeTimes.length > 0
                  ? teeTimes.map((tt: any) => ({
                      ...tt,
                      golfers: tt.golfers || tt.players || String(sortedTravelers.length || 1),
                    }))
                  : null,
              flights: voucherFlights,
            } as any)
            .eq("id", v.id);

          if (updateError) throw updateError;

          await upsertVoucherTravelers(v.id, sortedTravelers, firstTraveler, secondaryClientId, orderer);

          newResults.push({ supplierName: v.voucher_code, success: true, voucherId: v.id });
        } catch (err) {
          console.error(`Error syncing voucher ${v.voucher_code}:`, err);
          newResults.push({ supplierName: v.voucher_code, success: false });
        }
      }

      setExistingVouchersDialogOpen(false);
      setResults(newResults);
      setOpen(true);

      const successCount = newResults.filter((r) => r.success).length;
      toast({
        title: "Vouchery synchronizovány",
        description: `Aktualizováno ${successCount} z ${existingVouchers.length} voucherů.`,
      });
      onComplete?.();
    } catch (error) {
      console.error("Error syncing vouchers:", error);
      toast({ title: "Chyba", description: "Nepodařilo se synchronizovat vouchery", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenDialog = async () => {
    const { data: existing } = await supabase
      .from("vouchers")
      .select("id, voucher_code, supplier_id")
      .eq("deal_id", dealId);
    if (existing && existing.length > 0) {
      setExistingVouchers(existing as ExistingVoucher[]);
      setExistingVouchersDialogOpen(true);
      return;
    }
    setOpen(true);
    setResults([]);
  };

  // Handle external open trigger (mobile menu)
  useEffect(() => {
    if (externalOpen) {
      handleOpenDialog();
      onExternalOpenChange?.(false);
    }
  }, [externalOpen]);

  if (services.length === 0) return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpenDialog}
        className={triggerClassName || "gap-2 md:size-default"}
      >
        <FileText className="h-4 w-4" />
        <span className="hidden sm:inline">Vytvořit vouchery</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {results.length > 0 ? "Výsledky" : "Vytvořit vouchery ze služeb"}
            </DialogTitle>
            <DialogDescription>
              {results.length === 0
                ? "Systém vytvoří voucher pro každého externího dodavatele s přeloženými službami."
                : null}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Supplier groups preview */}
            {results.length === 0 && (
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
                  <div
                    key={`yaro-${i}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm"
                  >
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
            )}

            {/* Results */}
            {results.length > 0 && (
              <div className="space-y-2">
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

      {/* Existing vouchers confirmation */}
      <AlertDialog open={existingVouchersDialogOpen} onOpenChange={setExistingVouchersDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vouchery již existují</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <span>
                  Tento obchodní případ již obsahuje{" "}
                  {existingVouchers.length === 1 ? "voucher" : `${existingVouchers.length} vouchery`}:
                </span>
                {existingVouchers.map((v) => (
                  <span key={v.id} className="block font-medium mt-1">
                    {v.voucher_code}
                  </span>
                ))}
                <span className="block mt-3 text-sm">
                  Chcete <strong>synchronizovat</strong> stávající vouchery s aktuálními údaji obchodního případu, nebo vytvořit nové?
                </span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={syncing} onClick={() => setExistingVouchersDialogOpen(false)}>
              Ponechat beze změny
            </AlertDialogCancel>
            <Button
              variant="outline"
              disabled={syncing}
              onClick={handleSyncVouchers}
              className="gap-2"
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Synchronizovat vouchery
            </Button>
            <Button
              disabled={syncing}
              onClick={() => {
                setExistingVouchersDialogOpen(false);
                setOpen(true);
                setResults([]);
              }}
            >
              Vytvořit nové vouchery
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
