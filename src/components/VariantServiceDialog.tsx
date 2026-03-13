import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Sparkles, Loader2, X } from "lucide-react";
import { FlightSegmentForm, emptySegment, type FlightSegment, type FlightFormData } from "./FlightSegmentForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SupplierCombobox } from "./SupplierCombobox";
import { ServiceCombobox } from "./ServiceCombobox";
import { HotelCombobox } from "./HotelCombobox";
import { CurrencySelect } from "./CurrencySelect";
import { HotelAiImport, type ParsedHotelData } from "./HotelAiImport";
import { GolfAiImport, type ParsedTeeTime } from "./GolfAiImport";
import { formatPriceCurrency, formatDateForDB } from "@/lib/utils";

interface FlightDetails {
  outbound_segments?: FlightSegment[];
  return_segments?: FlightSegment[];
  baggage?: {
    cabin_bag?: { included: boolean; kg?: number };
    hand_luggage?: { included: boolean; kg?: number };
    checked_luggage?: { included: boolean; kg?: number };
    golf_bag?: { included: boolean; kg?: number };
  };
}
interface VariantServiceDialogProps {
  variantId: string;
  service: any;
  open: boolean;
  onClose: (success?: boolean) => void;
  variantStartDate?: string | null;
  variantEndDate?: string | null;
  preselectedServiceType?: "flight" | "hotel" | "golf" | "transfer" | "insurance" | "meal" | "other";
  preselectedServiceName?: string;
  defaultTravelerCount?: number;
}

export const VariantServiceDialog = ({
  variantId,
  service,
  open,
  onClose,
  variantStartDate,
  variantEndDate,
  preselectedServiceType = "hotel",
  preselectedServiceName = "",
  defaultTravelerCount = 1,
}: VariantServiceDialogProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [convertingCurrency, setConvertingCurrency] = useState(false);
  const [serviceType, setServiceType] = useState<"flight" | "hotel" | "golf" | "transfer" | "insurance" | "meal" | "other">("hotel");
  const [serviceName, setServiceName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [price, setPrice] = useState("");
  const [priceCurrency, setPriceCurrency] = useState("CZK");
  const [costPrice, setCostPrice] = useState("");
  const [costCurrency, setCostCurrency] = useState("CZK");
  const [costPriceOriginal, setCostPriceOriginal] = useState("");
  const [personCount, setPersonCount] = useState("1");
  const [personCountUnit, setPersonCountUnit] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [supplierId, setSupplierId] = useState("");
  const [priceMode, setPriceMode] = useState<"per_person" | "per_service">("per_person");
  const [priceManuallySet, setPriceManuallySet] = useState(false);
  type RoomTypeEntry = { name: string; rooms: number; persons_per_room: number; price: number };
  const [roomTypes, setRoomTypes] = useState<RoomTypeEntry[]>([]);
  // Exchange rate info for display
  const [costExchangeRate, setCostExchangeRate] = useState<number | null>(null);
  const [costCzkValue, setCostCzkValue] = useState<number | null>(null);
  const [priceExchangeRate, setPriceExchangeRate] = useState<number | null>(null);
  const [priceCzkValue, setPriceCzkValue] = useState<number | null>(null);

  // Flight-specific fields - multi-segment support
  const [outboundSegments, setOutboundSegments] = useState<FlightSegment[]>([emptySegment()]);
  const [returnSegments, setReturnSegments] = useState<FlightSegment[]>([emptySegment()]);
  const [isOneWay, setIsOneWay] = useState(false);
  const [baggage, setBaggage] = useState<FlightFormData['baggage']>(undefined);

  // AI import state
  const [showAiImport, setShowAiImport] = useState(false);
  const [aiImportText, setAiImportText] = useState("");
  const [aiImportLoading, setAiImportLoading] = useState(false);

  // Auto-calculate quantity (days) for meal service when dates change
  useEffect(() => {
    if (serviceType === 'meal' && startDate && endDate) {
      const diff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diff > 0) {
        setQuantity(diff.toString());
      }
    }
  }, [serviceType, startDate, endDate]);

  useEffect(() => {
    if (service) {
      setServiceType(service.service_type);
      setServiceName(service.service_name);
      setDescription(service.description || "");
      setStartDate(service.start_date ? new Date(service.start_date) : undefined);
      setEndDate(service.end_date ? new Date(service.end_date) : undefined);
      setPrice(service.price?.toString() || "");
      setPriceCurrency((service as any).price_currency || "CZK");
      const svcCostCurrency = (service as any).cost_currency || "CZK";
      setCostCurrency(svcCostCurrency);
      setCostPriceOriginal((service as any).cost_price_original?.toString() || "");
      // Show original-currency value in the input when not CZK
      if (svcCostCurrency !== "CZK" && (service as any).cost_price_original != null) {
        setCostPrice((service as any).cost_price_original.toString());
      } else {
        setCostPrice(service.cost_price?.toString() || "");
      }
      setPersonCount(service.person_count?.toString() || "1");
      setPersonCountUnit((service.details as any)?.person_count_unit?.toString() || "");
      setQuantity((service as any).quantity?.toString() || "1");
      setSupplierId(service.supplier_id || "");
      setPriceMode((service.details as any)?.price_mode || "per_person");
      setPriceManuallySet(true); // Existing service - don't auto-calculate

      // Load flight details if exists
      const details = service.details as FlightDetails | null;
      if ((details as any)?.baggage) {
        setBaggage((details as any).baggage);
      } else {
        setBaggage(undefined);
      }

      if (details?.outbound_segments && details.outbound_segments.length > 0) {
        setOutboundSegments(details.outbound_segments);
      } else if ((details as any)?.outbound) {
        // Legacy support
        const legacy = details as any;
        setOutboundSegments([{
          departure: legacy.outbound.departure || "",
          arrival: legacy.outbound.arrival || "",
          airline: legacy.outbound.airline || "",
          airline_name: legacy.outbound.airline_name || "",
          flight_number: legacy.outbound.flight_number || "",
          departure_time: "",
          arrival_time: "",
        }]);
      }
      
      if (details?.return_segments && details.return_segments.length > 0) {
        setReturnSegments(details.return_segments);
        setIsOneWay(false);
      } else if ((details as any)?.return) {
        // Legacy support
        const legacy = details as any;
        setReturnSegments([{
          departure: legacy.return.departure || "",
          arrival: legacy.return.arrival || "",
          airline: legacy.return.airline || "",
          airline_name: legacy.return.airline_name || "",
          flight_number: legacy.return.flight_number || "",
          departure_time: "",
          arrival_time: "",
        }]);
        setIsOneWay(false);
      } else {
        setIsOneWay(service.service_type === "flight");
      }
    } else {
      resetForm();
    }
  }, [service, open]);

  const resetForm = () => {
    setServiceType(preselectedServiceType);
    setServiceName(preselectedServiceName);
    setDescription("");
    setStartDate(variantStartDate ? new Date(variantStartDate) : undefined);
    setEndDate(variantEndDate ? new Date(variantEndDate) : undefined);
    setPrice("");
    setPriceCurrency("CZK");
    setCostPrice("");
    setCostCurrency("CZK");
    setCostPriceOriginal("");
    setPersonCount(defaultTravelerCount.toString());
    setPersonCountUnit("");
    setQuantity("1");
    setSupplierId("");
    setPriceMode("per_person");
    setPriceManuallySet(false);
    setCostExchangeRate(null);
    setCostCzkValue(null);
    setPriceExchangeRate(null);
    setPriceCzkValue(null);
    setOutboundSegments([emptySegment()]);
    setReturnSegments([emptySegment()]);
    setIsOneWay(false);
    setBaggage(undefined);
    setShowAiImport(false);
    setAiImportText("");
  };

  const handleAiImport = async () => {
    if (!aiImportText.trim()) {
      toast({
        title: "Chyba",
        description: "Zadejte text k importu",
        variant: "destructive",
      });
      return;
    }

    setAiImportLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-flight-data", {
        body: { text: aiImportText },
      });

      if (error) throw error;

      if (data?.flightData) {
        const flightData = data.flightData;
        
        // Fill outbound segments
        if (flightData.outbound_segments && flightData.outbound_segments.length > 0) {
          const segments: FlightSegment[] = flightData.outbound_segments.map((seg: any) => ({
            departure: seg.departure_airport || "",
            arrival: seg.arrival_airport || "",
            airline: seg.airline_code || "",
            airline_name: seg.airline_name || "",
            flight_number: seg.flight_number || "",
            date: seg.date || "",
            departure_time: seg.departure_time || "",
            arrival_time: seg.arrival_time || "",
          }));
          setOutboundSegments(segments);
          
          // Set start date from first outbound segment
          if (flightData.outbound_segments[0]?.date) {
            setStartDate(new Date(flightData.outbound_segments[0].date));
          }
        }

        // Fill return segments
        if (flightData.return_segments && flightData.return_segments.length > 0) {
          const segments: FlightSegment[] = flightData.return_segments.map((seg: any) => ({
            departure: seg.departure_airport || "",
            arrival: seg.arrival_airport || "",
            airline: seg.airline_code || "",
            airline_name: seg.airline_name || "",
            flight_number: seg.flight_number || "",
            date: seg.date || "",
            departure_time: seg.departure_time || "",
            arrival_time: seg.arrival_time || "",
          }));
          setReturnSegments(segments);
          setIsOneWay(false);
          
          // Set end date from last return segment
          const lastReturnSeg = flightData.return_segments[flightData.return_segments.length - 1];
          if (lastReturnSeg?.date) {
            setEndDate(new Date(lastReturnSeg.date));
          }
        } else if (flightData.is_one_way) {
          setIsOneWay(true);
        }

        // Fill price and person count if available
        if (flightData.price) {
          setPrice(flightData.price.toString());
        }
        if (flightData.person_count) {
          setPersonCount(flightData.person_count.toString());
        }

        toast({
          title: "Úspěch",
          description: "Data byla úspěšně importována",
        });
        setShowAiImport(false);
        setAiImportText("");
      }
    } catch (error) {
      console.error("Error parsing flight data:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se zpracovat data",
        variant: "destructive",
      });
    } finally {
      setAiImportLoading(false);
    }
  };

  // Segment update/add/remove functions now handled by FlightSegmentForm component

  const handleSave = async () => {
    let finalServiceName = serviceName;
    let flightDetails: FlightDetails | null = null;

    // Convert currency if needed
    let costPriceCzk: number | null = null;
    const costPriceOrig = costPriceOriginal ? parseFloat(costPriceOriginal) : null;
    
    // Check if we're editing and currency/amount hasn't changed - skip recalculation
    const existingCostPrice = service?.cost_price;
    const existingCurrency = (service as any)?.cost_currency;
    const existingOriginal = (service as any)?.cost_price_original;
    
    const currencyUnchanged = service && 
      existingCurrency === costCurrency &&
      existingOriginal === costPriceOrig;
    
    if (costPriceOrig !== null && costCurrency !== "CZK") {
      if (currencyUnchanged && existingCostPrice !== null && existingCostPrice !== undefined) {
        // Currency and original amount unchanged - keep existing converted price
        costPriceCzk = existingCostPrice;
      } else {
        // Need to convert - currency or amount changed
        setConvertingCurrency(true);
        try {
          const { data, error } = await supabase.functions.invoke("get-exchange-rate", {
            body: { currency: costCurrency, amount: costPriceOrig },
          });
          if (error) throw error;
          costPriceCzk = data.convertedAmount;
        } catch (error) {
          console.error("Error converting currency:", error);
          toast({ title: "Chyba", description: "Nepodařilo se přepočítat měnu", variant: "destructive" });
          setConvertingCurrency(false);
          return;
        }
        setConvertingCurrency(false);
      }
    } else {
      costPriceCzk = costPriceOrig;
    }

    if (serviceType === "flight") {
      if (!outboundSegments[0]?.departure || !outboundSegments[0]?.arrival) {
        toast({ title: "Chyba", description: "Vyplňte prosím letiště odletu a příletu", variant: "destructive" });
        return;
      }
      const firstDeparture = outboundSegments[0].departure;
      const lastOutboundArrival = outboundSegments[outboundSegments.length - 1].arrival;
      const lastReturnArrival = !isOneWay && returnSegments.length > 0 ? returnSegments[returnSegments.length - 1].arrival : "";
      const airlineName = outboundSegments[0].airline_name || outboundSegments[0].airline;
      const returnPart = lastReturnArrival ? ` - ${lastReturnArrival}` : '';
      finalServiceName = `Letenka ${firstDeparture} - ${lastOutboundArrival}${returnPart}${airlineName ? ` se společností ${airlineName}` : ''}`;
      flightDetails = {
        outbound_segments: outboundSegments.filter(s => s.departure && s.arrival),
        return_segments: !isOneWay ? returnSegments.filter(s => s.departure && s.arrival) : undefined,
        baggage: baggage || undefined,
      };
    } else if (!serviceName.trim()) {
      toast({ title: "Chyba", description: "Vyplňte název služby", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const serviceData = {
        service_type: serviceType,
        service_name: finalServiceName,
        description: description || null,
        start_date: formatDateForDB(startDate),
        end_date: formatDateForDB(endDate),
        price: price ? parseFloat(price) : null,
        price_currency: priceCurrency,
        cost_price: costPriceCzk,
        cost_currency: costCurrency,
        cost_price_original: costPriceOrig,
        person_count: personCount ? parseInt(personCount) : 1,
        quantity: quantity ? parseInt(quantity) : 1,
        supplier_id: supplierId || null,
        details: { ...(flightDetails || {}), person_count_unit: personCountUnit, price_mode: priceMode } as any,
      };

      if (service) {
        const { error } = await supabase.from("deal_variant_services").update(serviceData as any).eq("id", service.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("deal_variant_services").insert({ variant_id: variantId, ...serviceData } as any);
        if (error) throw error;
      }

      toast({
        title: "Úspěch",
        description: service ? "Služba byla aktualizována" : "Služba byla přidána",
      });

      onClose(true);
      resetForm();
    } catch (error) {
      console.error("Error saving service:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se uložit službu",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // No longer needed - using shared FlightSegmentForm component

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {service ? "Upravit službu" : "Přidat službu"}
          </DialogTitle>
          <DialogDescription>
            Zadejte informace o službě pro tuto variantu
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="service-type">Typ služby *</Label>
            <Select value={serviceType} onValueChange={(value: any) => setServiceType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flight">Letenka</SelectItem>
                <SelectItem value="hotel">Ubytování</SelectItem>
                <SelectItem value="golf">Green Fee</SelectItem>
                <SelectItem value="transfer">Doprava</SelectItem>
                <SelectItem value="insurance">Pojištění</SelectItem>
                <SelectItem value="meal">Strava</SelectItem>
                <SelectItem value="other">Ostatní</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {serviceType === "flight" ? (
            <>
              {/* AI Import Section - always visible at top */}
              <div className="space-y-3 p-4 border rounded-lg bg-primary/5 border-primary/20">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="h-4 w-4 text-primary" />
                  AI Import letů
                </div>
                <Textarea
                  value={aiImportText}
                  onChange={(e) => setAiImportText(e.target.value)}
                  placeholder="Vložte text z rezervačního systému, např.:
3 QR 292 K 20DEC PRGDOH 1455 2240
4 QR 834 K 21DEC DOHBKK 0140 1215
5 QR 835 Q 28DEC BKKDOH 1855 2220
6 QR 289 Q 29DEC DOHPRG 0210 0620"
                  rows={3}
                  className="text-sm font-mono"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAiImport}
                  disabled={aiImportLoading || !aiImportText.trim()}
                  className="w-full"
                >
                  {aiImportLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Zpracovávám...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Rozparsovat pomocí AI
                    </>
                  )}
                </Button>
              </div>

              <FlightSegmentForm
                data={{
                  outbound_segments: outboundSegments,
                  return_segments: returnSegments,
                  is_one_way: isOneWay,
                  baggage: baggage,
                }}
                onChange={(data) => {
                  setOutboundSegments(data.outbound_segments);
                  setReturnSegments(data.return_segments);
                  setIsOneWay(data.is_one_way);
                  setBaggage(data.baggage);
                }}
              />
            </>
          ) : (
            <>
              {serviceType === 'hotel' && (
                <HotelAiImport
                  onImport={(data: ParsedHotelData) => {
                    if (data.hotel_name) setServiceName(data.hotel_name);
                    if (data.room_type) setDescription(data.room_type);
                    if (data.check_in) setStartDate(new Date(data.check_in));
                    if (data.check_out) setEndDate(new Date(data.check_out));
                    if (data.persons) setPersonCount(data.persons.toString());
                    if (data.total_price) {
                      if (data.currency && data.currency !== "CZK") {
                        setCostCurrency(data.currency);
                        setCostPriceOriginal(data.total_price.toString());
                        setCostPrice(data.total_price.toString());
                      } else {
                        setCostPrice(data.total_price.toString());
                        setCostPriceOriginal(data.total_price.toString());
                      }
                    }
                    if (data.meal_plan && data.room_type) {
                      setDescription(`${data.room_type} (${data.meal_plan})`);
                    } else if (data.meal_plan) {
                      setDescription(data.meal_plan);
                    }
                  }}
                />
              )}
              {serviceType === 'golf' && (
                <GolfAiImport
                  onImport={async (teeTimes: ParsedTeeTime[], supplierNameFromAi?: string) => {
                    if (teeTimes.length === 0) return;

                    try {
                      // Look up supplier by name if provided
                      let foundSupplierId: string | null = null;
                      if (supplierNameFromAi) {
                        const { data: suppliers } = await supabase
                          .from("suppliers")
                          .select("id, name")
                          .ilike("name", `%${supplierNameFromAi}%`)
                          .limit(1);
                        if (suppliers && suppliers.length > 0) {
                          foundSupplierId = suppliers[0].id;
                        }
                      }

                      const servicesToInsert = teeTimes.map((tt, idx) => ({
                        variant_id: variantId,
                        service_type: "golf" as const,
                        service_name: tt.club || "Green Fee",
                        description: [tt.time && `Čas: ${tt.time}`, tt.golfers && `Golfisté: ${tt.golfers}`]
                          .filter(Boolean)
                          .join(", ") || null,
                        start_date: tt.date || null,
                        end_date: tt.date || null,
                        price: tt.price_per_person || null,
                        cost_price: null,
                        cost_currency: tt.currency || "CZK",
                        cost_price_original: null,
                        supplier_id: foundSupplierId,
                        person_count: parseInt(tt.golfers) || parseInt(personCount) || 1,
                        quantity: 1,
                        order_index: idx,
                      }));

                      const { error } = await supabase
                        .from("deal_variant_services")
                        .insert(servicesToInsert as any);
                      if (error) throw error;

                      toast({
                        title: "Úspěch",
                        description: `Vytvořeno ${teeTimes.length} Green Fee služeb`,
                      });

                      onClose(true);
                      resetForm();
                    } catch (error) {
                      console.error("Error importing golf tee times:", error);
                      toast({
                        title: "Chyba",
                        description: "Nepodařilo se importovat tee times",
                        variant: "destructive",
                      });
                    }
                  }}
                />
              )}
              <div>
                <Label htmlFor="service-name">{serviceType === 'hotel' ? 'Název hotelu *' : 'Název služby *'}</Label>
                {serviceType === 'hotel' ? (
                  <HotelCombobox
                    value={serviceName}
                    onChange={setServiceName}
                    onSelect={() => {
                      setTimeout(() => document.getElementById('description')?.focus(), 50);
                    }}
                  />
                ) : (
                  <ServiceCombobox
                    value={serviceName}
                    onChange={setServiceName}
                    serviceType={serviceType}
                    onSelect={() => {
                      setTimeout(() => document.getElementById('description')?.focus(), 50);
                    }}
                  />
                )}
              </div>
              {serviceType === 'hotel' ? (
                <>
                  {/* Room Types Editor */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Typy pokojů</Label>
                      <button
                        type="button"
                        className="text-xs border rounded px-2 py-1 hover:bg-muted"
                        onClick={() => setRoomTypes(prev => [...prev, { name: "Double", rooms: 1, persons_per_room: 2, price: 0 }])}
                      >
                        + Přidat typ pokoje
                      </button>
                    </div>
                    {roomTypes.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Klikněte na "Přidat typ pokoje" pro zadání cen dle typu pokoje</p>
                    ) : (
                      <div className="space-y-2">
                        <div className="grid grid-cols-[1fr_55px_55px_90px_70px_28px] gap-1 text-xs text-muted-foreground px-1">
                          <span>Typ pokoje</span><span className="text-center">Pokojů</span><span className="text-center">Os./pok.</span><span className="text-right">Cena/pokoj</span><span className="text-right">Celkem</span><span></span>
                        </div>
                        {roomTypes.map((rt, idx) => (
                          <div key={idx} className="grid grid-cols-[1fr_55px_55px_90px_70px_28px] gap-1 items-center">
                            <Input value={rt.name} onChange={(e) => setRoomTypes(prev => prev.map((r, i) => i === idx ? { ...r, name: e.target.value } : r))} placeholder="Double" className="h-8 text-xs" />
                            <Input type="number" min={1} value={rt.rooms} onChange={(e) => setRoomTypes(prev => prev.map((r, i) => i === idx ? { ...r, rooms: parseInt(e.target.value) || 1 } : r))} className="h-8 text-xs text-center" />
                            <Input type="number" min={1} value={rt.persons_per_room} onChange={(e) => setRoomTypes(prev => prev.map((r, i) => i === idx ? { ...r, persons_per_room: parseInt(e.target.value) || 1 } : r))} className="h-8 text-xs text-center" />
                            <Input type="number" min={0} value={rt.price || ""} onChange={(e) => setRoomTypes(prev => prev.map((r, i) => i === idx ? { ...r, price: parseFloat(e.target.value) || 0 } : r))} placeholder="0" className="h-8 text-xs text-right" />
                            <div className="text-xs text-right text-muted-foreground font-medium pr-1">{(rt.price * rt.rooms).toLocaleString("cs-CZ")}</div>
                            <button type="button" className="h-7 w-7 flex items-center justify-center hover:bg-muted rounded" onClick={() => setRoomTypes(prev => prev.filter((_, i) => i !== idx))}>
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        <div className="flex justify-between text-xs font-semibold border-t pt-2 px-1">
                          <span className="text-muted-foreground">Celkem osob: {roomTypes.reduce((s, r) => s + r.rooms * r.persons_per_room, 0)}</span>
                          <span className="text-primary">Celkem: {roomTypes.reduce((s, r) => s + r.price * r.rooms, 0).toLocaleString("cs-CZ")} {priceCurrency}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="description">Popis / Stravování</Label>
                    <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="např. All Inclusive, HB..." />
                  </div>
                </>
              ) : (
                <div>
                  <Label htmlFor="description">Název a Typ pokoje</Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="např. Deluxe Double Room"
                  />
                </div>
              )}
            </>
          )}

          <div>
            <Label htmlFor="supplier">Dodavatel</Label>
            <SupplierCombobox
              value={supplierId}
              onChange={setSupplierId}
              onSelect={() => {
                setTimeout(() => document.getElementById('persons')?.focus(), 50);
              }}
            />
          </div>

          {/* Row 1: Date | Persons | Quantity */}
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-2">
              <Label>Datum</Label>
              <DateRangePicker
                dateFrom={startDate}
                dateTo={endDate}
                onDateFromChange={setStartDate}
                onDateToChange={setEndDate}
              />
            </div>
            <div className="w-16">
              <Label htmlFor="persons">Osoby</Label>
              <Input
                id="persons"
                inputMode="numeric"
                pattern="[0-9]*"
                value={personCount}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '') || '';
                  setPersonCount(val);
                  setQuantity(val);
                }}
                placeholder="1"
                className="text-center"
              />
            </div>
            <div className="w-16">
              <Label htmlFor="quantity">Počet</Label>
              <Input
                id="quantity"
                inputMode="numeric"
                pattern="[0-9]*"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value.replace(/\D/g, '') || '')}
                className="text-center"
              />
            </div>
          </div>

          {/* Row 2: Cost Price + Currency | Sale Price + Currency | Price Mode */}
          <div className="flex gap-2 items-start">
            <div className="flex-1">
              <Label>Nákupní cena</Label>
              <div className="flex gap-1">
                <Input
                  type="number"
                  value={costPriceOriginal || costPrice}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCostPriceOriginal(val);
                    if (costCurrency === "CZK") {
                      setCostPrice(val);
                      setCostCzkValue(val ? parseFloat(val) : null);
                    }
                  }}
                  placeholder="0"
                  className="flex-1"
                />
                <CurrencySelect
                  value={costCurrency}
                  onChange={async (v) => {
                    setCostCurrency(v);
                    setCostExchangeRate(null);
                    setCostCzkValue(null);
                    if (v === "CZK") {
                      setCostPrice(costPriceOriginal);
                      const orig = costPriceOriginal;
                      if (orig) {
                        setCostCzkValue(parseFloat(orig));
                        if (!priceManuallySet) setPrice(Math.round(parseFloat(orig) * 1.15).toString());
                      }
                    } else if (costPriceOriginal) {
                      try {
                        const { data } = await supabase.functions.invoke("get-exchange-rate", {
                          body: { currency: v, amount: parseFloat(costPriceOriginal) },
                        });
                        if (data?.rate && data?.convertedAmount) {
                          setCostExchangeRate(data.rate);
                          setCostCzkValue(data.convertedAmount);
                          if (!priceManuallySet) {
                            setPrice(Math.round(data.convertedAmount * 1.15).toString());
                            setPriceCurrency("CZK");
                          }
                        }
                      } catch {}
                    }
                  }}
                  className="w-24"
                />
              </div>
              {costCurrency !== "CZK" && costCzkValue != null && costExchangeRate != null && (
                <p className="text-xs text-muted-foreground mt-1">
                  ≈ {Math.round(costCzkValue).toLocaleString("cs-CZ")} Kč (kurz {costExchangeRate.toFixed(3)} Kč/{costCurrency})
                </p>
              )}
              {costCurrency === "CZK" && costPrice && (
                <p className="text-xs text-muted-foreground mt-1">
                  Prodejní s 15% marží: {Math.round(parseFloat(costPrice) * 1.15).toLocaleString("cs-CZ")} Kč
                </p>
              )}
            </div>
            <div className="flex-1">
              <Label>Prodejní cena</Label>
              <div className="flex gap-1">
                <Input
                  id="price"
                  type="number"
                  value={price}
                  onChange={async (e) => {
                    const val = e.target.value;
                    setPrice(val);
                    setPriceManuallySet(true);
                    if (priceCurrency === "CZK") {
                      setPriceCzkValue(val ? parseFloat(val) : null);
                    } else if (val) {
                      try {
                        const { data } = await supabase.functions.invoke("get-exchange-rate", {
                          body: { currency: priceCurrency, amount: parseFloat(val) },
                        });
                        if (data?.rate && data?.convertedAmount) {
                          setPriceExchangeRate(data.rate);
                          setPriceCzkValue(data.convertedAmount);
                        }
                      } catch {}
                    }
                  }}
                  placeholder="0"
                  className="flex-1"
                />
                <CurrencySelect
                  value={priceCurrency}
                  onChange={async (v) => {
                    setPriceCurrency(v);
                    setPriceExchangeRate(null);
                    setPriceCzkValue(v === "CZK" && price ? parseFloat(price) : null);
                    if (v !== "CZK" && price) {
                      try {
                        const { data } = await supabase.functions.invoke("get-exchange-rate", {
                          body: { currency: v, amount: parseFloat(price) },
                        });
                        if (data?.rate && data?.convertedAmount) {
                          setPriceExchangeRate(data.rate);
                          setPriceCzkValue(data.convertedAmount);
                        }
                      } catch {}
                    }
                  }}
                  className="w-24"
                />
              </div>
              {priceCurrency !== "CZK" && priceCzkValue != null && priceExchangeRate != null && (
                <p className="text-xs text-muted-foreground mt-1">
                  ≈ {Math.round(priceCzkValue).toLocaleString("cs-CZ")} Kč (kurz {priceExchangeRate.toFixed(3)} Kč/{priceCurrency})
                </p>
              )}
            </div>
            <div className="w-32">
              <Label>Režim</Label>
              <Select value={priceMode} onValueChange={(v: "per_person" | "per_service") => setPriceMode(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_person">za osobu</SelectItem>
                  <SelectItem value="per_service">za službu</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {price && (
            <div className="bg-muted p-3 rounded-md">
              <p className="text-sm font-medium">
                Celková cena: {formatPriceCurrency(
                  parseFloat(price) * (priceMode === "per_person" 
                    ? parseInt(personCount || "1") 
                    : parseInt(quantity || "1"))
                )}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onClose()}>
              Zrušit
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Ukládám..." : service ? "Uložit změny" : "Přidat službu"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
