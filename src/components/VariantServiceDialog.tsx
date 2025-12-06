import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { DateInput } from "@/components/ui/date-input";
import { Plane, Sparkles, Loader2 } from "lucide-react";
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
import { AirportCombobox } from "./AirportCombobox";
import { AirlineCombobox } from "./AirlineCombobox";
import { ServiceCombobox } from "./ServiceCombobox";
import { formatPriceCurrency, formatDateForDB } from "@/lib/utils";

interface FlightDetails {
  outbound?: {
    departure: string;
    arrival: string;
    airline: string;
    airline_name: string;
    flight_number: string;
  };
  return?: {
    departure: string;
    arrival: string;
    airline: string;
    airline_name: string;
    flight_number: string;
  };
}

interface VariantServiceDialogProps {
  variantId: string;
  service: any;
  open: boolean;
  onClose: (success?: boolean) => void;
  variantStartDate?: string | null;
  variantEndDate?: string | null;
  preselectedServiceType?: "flight" | "hotel" | "golf" | "transfer" | "insurance" | "other";
  preselectedServiceName?: string;
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
}: VariantServiceDialogProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [serviceType, setServiceType] = useState<"flight" | "hotel" | "golf" | "transfer" | "insurance" | "other">("hotel");
  const [serviceName, setServiceName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [price, setPrice] = useState("");
  const [personCount, setPersonCount] = useState("1");
  const [supplierId, setSupplierId] = useState("");

  // Flight-specific fields
  const [outboundDeparture, setOutboundDeparture] = useState("");
  const [outboundArrival, setOutboundArrival] = useState("");
  const [outboundAirline, setOutboundAirline] = useState("");
  const [outboundAirlineName, setOutboundAirlineName] = useState("");
  const [outboundFlightNumber, setOutboundFlightNumber] = useState("");
  const [returnDeparture, setReturnDeparture] = useState("");
  const [returnArrival, setReturnArrival] = useState("");
  const [returnAirline, setReturnAirline] = useState("");
  const [returnAirlineName, setReturnAirlineName] = useState("");
  const [returnFlightNumber, setReturnFlightNumber] = useState("");
  const [isOneWay, setIsOneWay] = useState(false);

  // AI import state
  const [showAiImport, setShowAiImport] = useState(false);
  const [aiImportText, setAiImportText] = useState("");
  const [aiImportLoading, setAiImportLoading] = useState(false);

  useEffect(() => {
    if (service) {
      setServiceType(service.service_type);
      setServiceName(service.service_name);
      setDescription(service.description || "");
      setStartDate(service.start_date ? new Date(service.start_date) : undefined);
      setEndDate(service.end_date ? new Date(service.end_date) : undefined);
      setPrice(service.price?.toString() || "");
      setPersonCount(service.person_count?.toString() || "1");
      setSupplierId(service.supplier_id || "");

      // Load flight details if exists
      const details = service.details as FlightDetails | null;
      if (details?.outbound) {
        setOutboundDeparture(details.outbound.departure || "");
        setOutboundArrival(details.outbound.arrival || "");
        setOutboundAirline(details.outbound.airline || "");
        setOutboundAirlineName(details.outbound.airline_name || "");
        setOutboundFlightNumber(details.outbound.flight_number || "");
      }
      if (details?.return) {
        setReturnDeparture(details.return.departure || "");
        setReturnArrival(details.return.arrival || "");
        setReturnAirline(details.return.airline || "");
        setReturnAirlineName(details.return.airline_name || "");
        setReturnFlightNumber(details.return.flight_number || "");
        setIsOneWay(false);
      } else {
        setIsOneWay(service.service_type === "flight" && !details?.return);
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
    setPersonCount("1");
    setSupplierId("");
    // Reset flight fields
    setOutboundDeparture("");
    setOutboundArrival("");
    setOutboundAirline("");
    setOutboundAirlineName("");
    setOutboundFlightNumber("");
    setReturnDeparture("");
    setReturnArrival("");
    setReturnAirline("");
    setReturnAirlineName("");
    setReturnFlightNumber("");
    setIsOneWay(false);
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
        
        // Fill outbound flight data
        if (flightData.outbound) {
          setOutboundDeparture(flightData.outbound.departure_airport || "");
          setOutboundArrival(flightData.outbound.arrival_airport || "");
          setOutboundAirline(flightData.outbound.airline_code || "");
          setOutboundAirlineName(flightData.outbound.airline_name || "");
          setOutboundFlightNumber(flightData.outbound.flight_number || "");
          
          if (flightData.outbound.date) {
            setStartDate(new Date(flightData.outbound.date));
          }
        }

        // Fill return flight data
        if (flightData.return_flight && !flightData.is_one_way) {
          setReturnDeparture(flightData.return_flight.departure_airport || "");
          setReturnArrival(flightData.return_flight.arrival_airport || "");
          setReturnAirline(flightData.return_flight.airline_code || "");
          setReturnAirlineName(flightData.return_flight.airline_name || "");
          setReturnFlightNumber(flightData.return_flight.flight_number || "");
          setIsOneWay(false);
          
          if (flightData.return_flight.date) {
            setEndDate(new Date(flightData.return_flight.date));
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

  const handleSave = async () => {
    // For flight type, generate automatic service_name
    let finalServiceName = serviceName;
    let flightDetails: FlightDetails | null = null;

    if (serviceType === "flight") {
      // Require at least outbound airports
      if (!outboundDeparture || !outboundArrival) {
        toast({
          title: "Chyba",
          description: "Vyplňte prosím letiště odletu a příletu",
          variant: "destructive",
        });
        return;
      }

      // Generate automatic service name with return airport if exists
      const airlineName = outboundAirlineName || outboundAirline;
      const returnPart = !isOneWay && returnArrival ? ` - ${returnArrival}` : '';
      finalServiceName = `Letenka ${outboundDeparture} - ${outboundArrival}${returnPart}${airlineName ? ` se společností ${airlineName}` : ''}`;

      flightDetails = {
        outbound: {
          departure: outboundDeparture,
          arrival: outboundArrival,
          airline: outboundAirline,
          airline_name: outboundAirlineName,
          flight_number: outboundFlightNumber,
        },
        return: !isOneWay && returnDeparture ? {
          departure: returnDeparture,
          arrival: returnArrival,
          airline: returnAirline,
          airline_name: returnAirlineName,
          flight_number: returnFlightNumber,
        } : undefined,
      };
    } else if (!serviceName.trim()) {
      toast({
        title: "Chyba",
        description: "Vyplňte název služby",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (service) {
        // Update existing service
        const { error } = await supabase
          .from("deal_variant_services")
          .update({
            service_type: serviceType,
            service_name: finalServiceName,
            description: description || null,
            start_date: formatDateForDB(startDate),
            end_date: formatDateForDB(endDate),
            price: price ? parseFloat(price) : null,
            person_count: personCount ? parseInt(personCount) : 1,
            supplier_id: supplierId || null,
            details: flightDetails as any,
          })
          .eq("id", service.id);

        if (error) throw error;
      } else {
        // Create new service
        const { error } = await supabase
          .from("deal_variant_services")
          .insert({
            variant_id: variantId,
            service_type: serviceType,
            service_name: finalServiceName,
            description: description || null,
            start_date: formatDateForDB(startDate),
            end_date: formatDateForDB(endDate),
            price: price ? parseFloat(price) : null,
            person_count: personCount ? parseInt(personCount) : 1,
            supplier_id: supplierId || null,
            details: flightDetails as any,
          });

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
                <SelectItem value="other">Ostatní</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Flight-specific form */}
          {serviceType === "flight" ? (
            <>
              {/* AI Import Section */}
              <div className="space-y-3 p-4 border rounded-lg bg-primary/5 border-primary/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Inteligentní import
                  </div>
                  <Button
                    type="button"
                    variant={showAiImport ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setShowAiImport(!showAiImport)}
                  >
                    {showAiImport ? "Skrýt" : "Importovat z textu"}
                  </Button>
                </div>
                {showAiImport && (
                  <div className="space-y-3">
                    <Textarea
                      value={aiImportText}
                      onChange={(e) => setAiImportText(e.target.value)}
                      placeholder="Vložte text obsahující informace o letu, např.: 'Let z Prahy do Malagy s Czech Airlines OK 801 dne 15.6.2025, zpáteční let OK 802 dne 22.6.2025'"
                      rows={3}
                      className="text-sm"
                    />
                    <Button
                      type="button"
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
                          Extrahovat data
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* Outbound flight */}
              <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Plane className="h-4 w-4" />
                  Odletový let
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Odkud *</Label>
                    <AirportCombobox
                      value={outboundDeparture}
                      onSelect={(iata) => {
                        setOutboundDeparture(iata);
                        // Auto-fill return arrival
                        if (!returnArrival) setReturnArrival(iata);
                      }}
                      placeholder="Vyberte letiště..."
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Kam *</Label>
                    <AirportCombobox
                      value={outboundArrival}
                      onSelect={(iata) => {
                        setOutboundArrival(iata);
                        // Auto-fill return departure
                        if (!returnDeparture) setReturnDeparture(iata);
                      }}
                      placeholder="Vyberte letiště..."
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Letecká společnost</Label>
                    <AirlineCombobox
                      value={outboundAirline}
                      onSelect={(code, name) => {
                        setOutboundAirline(code);
                        setOutboundAirlineName(name);
                        // Auto-fill return airline
                        if (!returnAirline) {
                          setReturnAirline(code);
                          setReturnAirlineName(name);
                        }
                      }}
                      placeholder="Vyberte..."
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Číslo letu</Label>
                    <Input
                      value={outboundFlightNumber}
                      onChange={(e) => setOutboundFlightNumber(e.target.value)}
                      placeholder="OK123"
                    />
                  </div>
                </div>
              </div>

              {/* One-way flight checkbox */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_one_way"
                  checked={isOneWay}
                  onCheckedChange={(checked) => {
                    setIsOneWay(!!checked);
                    // Clear return fields when switching to one-way
                    if (checked) {
                      setReturnDeparture("");
                      setReturnArrival("");
                      setReturnAirline("");
                      setReturnAirlineName("");
                      setReturnFlightNumber("");
                    }
                  }}
                />
                <Label htmlFor="is_one_way" className="text-sm cursor-pointer">
                  Jednosměrná letenka (bez zpátečního letu)
                </Label>
              </div>

              {/* Return flight - only show if not one-way */}
              {!isOneWay && (
                <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Plane className="h-4 w-4 rotate-180" />
                    Zpáteční let
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Odkud</Label>
                      <AirportCombobox
                        value={returnDeparture}
                        onSelect={setReturnDeparture}
                        placeholder="Vyberte letiště..."
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Kam</Label>
                      <AirportCombobox
                        value={returnArrival}
                        onSelect={setReturnArrival}
                        placeholder="Vyberte letiště..."
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Letecká společnost</Label>
                      <AirlineCombobox
                        value={returnAirline}
                        onSelect={(code, name) => {
                          setReturnAirline(code);
                          setReturnAirlineName(name);
                        }}
                        placeholder="Vyberte..."
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Číslo letu</Label>
                      <Input
                        value={returnFlightNumber}
                        onChange={(e) => setReturnFlightNumber(e.target.value)}
                        placeholder="OK124"
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <Label htmlFor="service-name">Název služby *</Label>
                <ServiceCombobox
                  value={serviceName}
                  onChange={setServiceName}
                  serviceType={serviceType}
                />
              </div>

              <div>
                <Label htmlFor="description">Popis</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Podrobnosti o službě..."
                  rows={3}
                />
              </div>
            </>
          )}

          <div>
            <Label htmlFor="supplier">Dodavatel</Label>
            <SupplierCombobox
              value={supplierId}
              onChange={setSupplierId}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start-date">Datum od</Label>
              <DateInput
                value={startDate}
                onChange={setStartDate}
                placeholder="DD.MM.RR"
              />
            </div>
            <div>
              <Label htmlFor="end-date">Datum do</Label>
              <DateInput
                value={endDate}
                onChange={setEndDate}
                placeholder="DD.MM.RR"
                autoSetDate={() => startDate ? new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000) : undefined}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="person-count">Počet osob</Label>
              <Input
                id="person-count"
                type="number"
                min="1"
                value={personCount}
                onChange={(e) => setPersonCount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="price">Cena za osobu (Kč)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          {price && personCount && (
            <div className="bg-muted p-3 rounded-md">
              <p className="text-sm font-medium">
                Celková cena: {formatPriceCurrency(parseFloat(price) * parseInt(personCount))}
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