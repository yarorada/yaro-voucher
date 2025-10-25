import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Users, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { SupplierCombobox } from "@/components/SupplierCombobox";
import { ClientCombobox } from "@/components/ClientCombobox";
import { ServiceCombobox } from "@/components/ServiceCombobox";
import { GolfClubCombobox } from "@/components/GolfClubCombobox";
import { AirportCombobox } from "@/components/AirportCombobox";
import { AirlineCombobox } from "@/components/AirlineCombobox";
import { Textarea } from "@/components/ui/textarea";
import { DateInput } from "@/components/ui/date-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { format } from "date-fns";

interface Service {
  name: string;
  pax: string;
  qty: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  isTextMode?: boolean;
}

interface TeeTime {
  date: Date | undefined;
  club: string;
  time: string;
  golfers: string;
  isTextMode?: boolean;
}

interface Flight {
  date: Date | undefined;
  airlineCode: string;
  airlineName: string;
  flightNumber: string;
  fromIata: string;
  fromCity?: string;
  toIata: string;
  toCity?: string;
  departureTime: string;
  arrivalTime: string;
  isVariant?: boolean;
  pax: string;
}

interface VoucherFormProps {
  voucherId?: string;
  initialData?: {
    clientId: string;
    supplierId: string;
    otherTravelerIds: string[];
    expirationDate: string;
    services: Service[];
    hotelName: string;
    teeTimes?: TeeTime[];
    flights?: Flight[];
  };
}

export const VoucherForm = ({ voucherId, initialData }: VoucherFormProps) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [clientId, setClientId] = useState(initialData?.clientId || "");
  const [supplierId, setSupplierId] = useState(initialData?.supplierId || "");
  const [hotelName, setHotelName] = useState(initialData?.hotelName || "");
  const [otherTravelerIds, setOtherTravelerIds] = useState<string[]>(initialData?.otherTravelerIds || []);
  const [expirationDate, setExpirationDate] = useState(initialData?.expirationDate || "");
  const [services, setServices] = useState<Service[]>(
    initialData?.services?.map(s => ({
      ...s,
      dateFrom: s.dateFrom ? new Date(s.dateFrom) : undefined,
      dateTo: s.dateTo ? new Date(s.dateTo) : undefined,
      isTextMode: !!s.name,
    })) || [{ name: "", pax: "", qty: "", dateFrom: undefined, dateTo: undefined, isTextMode: false }]
  );
  const [teeTimes, setTeeTimes] = useState<TeeTime[]>(
    initialData?.teeTimes?.map(t => ({
      ...t,
      date: t.date ? new Date(t.date) : undefined,
      isTextMode: !!t.club,
    })) || []
  );
  const [flights, setFlights] = useState<Flight[]>(
    initialData?.flights?.map(f => ({
      ...f,
      date: f.date ? new Date(f.date) : undefined,
      airlineCode: f.airlineCode || "",
      airlineName: f.airlineName || "",
      pax: f.pax || "",
      flightNumber: f.flightNumber || "",
      departureTime: f.departureTime || "",
      arrivalTime: f.arrivalTime || "",
    })) || []
  );
  const [bulkImportText, setBulkImportText] = useState("");
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

  const addTraveler = () => {
    setOtherTravelerIds([...otherTravelerIds, ""]);
  };

  const removeTraveler = (index: number) => {
    setOtherTravelerIds(otherTravelerIds.filter((_, i) => i !== index));
  };

  const updateTraveler = (index: number, value: string) => {
    const updated = [...otherTravelerIds];
    updated[index] = value;
    setOtherTravelerIds(updated);
  };

  const handleBulkImport = async () => {
    if (!bulkImportText.trim()) {
      toast.error("Prosím zadejte jména");
      return;
    }

    setLoading(true);
    try {
      const lines = bulkImportText.split('\n').filter(line => line.trim());
      const newTravelerIds: string[] = [];

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        const parts = trimmedLine.split(/\s+/);
        if (parts.length < 2) {
          toast.error(`Neplatný formát: "${trimmedLine}". Použijte formát "Jméno Příjmení"`);
          continue;
        }

        const firstName = parts[0];
        const lastName = parts.slice(1).join(' ');

        // Check if client exists
        const { data: existingClient } = await supabase
          .from('clients')
          .select('id')
          .eq('first_name', firstName)
          .eq('last_name', lastName)
          .maybeSingle();

        if (existingClient) {
          newTravelerIds.push(existingClient.id);
        } else {
          // Create new client
          const { data: newClient, error } = await supabase
            .from('clients')
            .insert({
              first_name: firstName,
              last_name: lastName,
            })
            .select('id')
            .single();

          if (error) throw error;
          if (newClient) {
            newTravelerIds.push(newClient.id);
          }
        }
      }

      setOtherTravelerIds([...otherTravelerIds, ...newTravelerIds]);
      setBulkImportText("");
      setBulkImportOpen(false);
      toast.success(`Přidáno ${newTravelerIds.length} cestujících`);
    } catch (error) {
      console.error('Error bulk importing:', error);
      toast.error("Nepodařilo se importovat cestující");
    } finally {
      setLoading(false);
    }
  };

  const addService = () => {
    const lastService = services[services.length - 1];
    setServices([
      ...services,
      { 
        name: "", 
        pax: "", 
        qty: "", 
        dateFrom: lastService?.dateFrom, 
        dateTo: lastService?.dateTo,
        isTextMode: false
      },
    ]);
  };

  const handleServiceSelect = (index: number, serviceName: string) => {
    const updated = [...services];
    updated[index].name = serviceName;
    updated[index].isTextMode = true;
    setServices(updated);
  };

  const toggleServiceInputMode = (index: number) => {
    const updated = [...services];
    updated[index].isTextMode = !updated[index].isTextMode;
    setServices(updated);
  };

  const removeService = (index: number) => {
    if (services.length > 1) {
      setServices(services.filter((_, i) => i !== index));
    }
  };

  const updateService = (index: number, field: keyof Service, value: string | Date | undefined | boolean) => {
    const updated = [...services];
    if (field === 'name' || field === 'pax' || field === 'qty') {
      (updated[index] as any)[field] = value as string;
    } else if (field === 'dateFrom' || field === 'dateTo') {
      (updated[index] as any)[field] = value as Date | undefined;
    } else if (field === 'isTextMode') {
      (updated[index] as any)[field] = value as boolean;
    }
    setServices(updated);
  };

  const addTeeTime = () => {
    setTeeTimes([...teeTimes, { date: undefined, club: "", time: "", golfers: "", isTextMode: false }]);
  };

  const handleGolfClubSelect = (index: number, clubName: string) => {
    const updated = [...teeTimes];
    updated[index].club = clubName;
    updated[index].isTextMode = true;
    setTeeTimes(updated);
  };

  const toggleGolfClubInputMode = (index: number) => {
    const updated = [...teeTimes];
    updated[index].isTextMode = !updated[index].isTextMode;
    setTeeTimes(updated);
  };

  const addFlight = (isVariant = false) => {
    // Find latest date from services
    const latestServiceDate = services
      .map(s => s.dateTo)
      .filter((date): date is Date => date !== undefined)
      .sort((a, b) => b.getTime() - a.getTime())[0];

    // Get previous flight to reverse airports and copy airline
    const previousFlight = flights[flights.length - 1];
    
    setFlights([...flights, { 
      date: latestServiceDate || undefined,
      airlineCode: previousFlight ? previousFlight.airlineCode : "",
      airlineName: previousFlight ? previousFlight.airlineName : "",
      flightNumber: "",
      fromIata: previousFlight ? previousFlight.toIata : "", 
      fromCity: previousFlight ? previousFlight.toCity : "", 
      toIata: previousFlight ? previousFlight.fromIata : "", 
      toCity: previousFlight ? previousFlight.fromCity : "",
      departureTime: "",
      arrivalTime: "",
      isVariant,
      pax: ""
    }]);
  };

  const removeFlight = (index: number) => {
    setFlights(flights.filter((_, i) => i !== index));
  };

  const updateFlight = (index: number, field: keyof Flight, value: string | Date | undefined | boolean) => {
    const updated = [...flights];
    if (field === 'fromIata' || field === 'fromCity' || field === 'toIata' || field === 'toCity' || 
        field === 'airlineCode' || field === 'airlineName' || field === 'flightNumber' || 
        field === 'departureTime' || field === 'arrivalTime' || field === 'pax') {
      (updated[index] as any)[field] = value as string;
    } else if (field === 'date') {
      (updated[index] as any)[field] = value as Date | undefined;
    } else if (field === 'isVariant') {
      (updated[index] as any)[field] = value as boolean;
    }
    setFlights(updated);
  };

  const handleAirlineSelect = (index: number, code: string, name: string) => {
    const updated = [...flights];
    updated[index].airlineCode = code;
    updated[index].airlineName = name;
    setFlights(updated);
  };

  const removeTeeTime = (index: number) => {
    setTeeTimes(teeTimes.filter((_, i) => i !== index));
  };

  const updateTeeTime = (index: number, field: keyof TeeTime, value: string | Date | undefined | boolean) => {
    const updated = [...teeTimes];
    if (field === 'club' || field === 'time' || field === 'golfers') {
      (updated[index] as any)[field] = value as string;
    } else if (field === 'date') {
      (updated[index] as any)[field] = value as Date | undefined;
    } else if (field === 'isTextMode') {
      (updated[index] as any)[field] = value as boolean;
    }
    setTeeTimes(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clientId) {
      toast.error("Prosím vyberte klienta");
      return;
    }

    if (!hotelName.trim()) {
      toast.error("Prosím zadejte název hotelu");
      return;
    }

    // Validate all service fields are filled
    for (let i = 0; i < services.length; i++) {
      const service = services[i];
      
      if (!service.name.trim()) {
        toast.error(`Služba ${i + 1}: Vyplňte název služby`);
        return;
      }
      
      if (!service.pax.trim()) {
        toast.error(`Služba ${i + 1}: Vyplňte PAX`);
        return;
      }
      
      if (!service.qty.trim()) {
        toast.error(`Služba ${i + 1}: Vyplňte Qtd.`);
        return;
      }
      
      if (!service.dateFrom) {
        toast.error(`Služba ${i + 1}: Vyplňte datum od`);
        return;
      }
      
      if (!service.dateTo) {
        toast.error(`Služba ${i + 1}: Vyplňte datum do`);
        return;
      }
      
      if (service.dateFrom > service.dateTo) {
        toast.error(`Služba ${i + 1}: Datum od musí být před datem do`);
        return;
      }
    }

    // Calculate expiration date as the latest dateTo from all services
    const calculatedExpirationDate = services
      .map(s => s.dateTo)
      .filter((date): date is Date => date !== undefined)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    
    const expirationDateString = calculatedExpirationDate 
      ? format(calculatedExpirationDate, 'yyyy-MM-dd')
      : null;

    setLoading(true);

    try {
      if (voucherId) {
        // UPDATE MODE
        // Update voucher
        const servicesData = services.map(s => ({
          name: s.name,
          pax: s.pax,
          qty: s.qty,
          dateFrom: s.dateFrom ? format(s.dateFrom, 'yyyy-MM-dd') : '',
          dateTo: s.dateTo ? format(s.dateTo, 'yyyy-MM-dd') : '',
        }));

        const teeTimesData = teeTimes.map(t => ({
          date: t.date ? format(t.date, 'yyyy-MM-dd') : '',
          club: t.club,
          time: t.time,
          golfers: t.golfers,
        }));

        const flightsData = flights.map(f => ({
          date: f.date ? format(f.date, 'yyyy-MM-dd') : '',
          airlineCode: f.airlineCode,
          airlineName: f.airlineName,
          flightNumber: f.flightNumber,
          fromIata: f.fromIata,
          fromCity: f.fromCity || '',
          toIata: f.toIata,
          toCity: f.toCity || '',
          departureTime: f.departureTime,
          arrivalTime: f.arrivalTime,
        }));

        const { error: updateError } = await supabase
          .from('vouchers')
          .update({
            client_id: clientId,
            supplier_id: supplierId || null,
            hotel_name: hotelName.trim(),
            services: servicesData as any,
            tee_times: teeTimesData as any,
            flights: flightsData as any,
            expiration_date: expirationDateString,
          })
          .eq('id', voucherId);

        if (updateError) throw updateError;

        // Delete existing traveler relations
        await supabase
          .from('voucher_travelers')
          .delete()
          .eq('voucher_id', voucherId);

        // Insert main client relation
        await supabase.from('voucher_travelers').insert({
          voucher_id: voucherId,
          client_id: clientId,
          is_main_client: true,
        });

        // Insert other travelers
        const filteredTravelers = otherTravelerIds.filter(id => id !== "");
        if (filteredTravelers.length > 0) {
          await supabase.from('voucher_travelers').insert(
            filteredTravelers.map(id => ({
              voucher_id: voucherId,
              client_id: id,
              is_main_client: false,
            }))
          );
        }

        toast.success("Voucher úspěšně aktualizován!");
        navigate('/vouchers');
      } else {
        // CREATE MODE
        // Generate voucher code
        const { data: codeData, error: codeError } = await supabase
          .rpc('generate_voucher_code');

        if (codeError) throw codeError;

        // Get the voucher number from the code
        const voucherNumber = parseInt(codeData.split('-')[1]);

        // Prepare services data
        const servicesData = services.map(s => ({
          name: s.name,
          pax: s.pax,
          qty: s.qty,
          dateFrom: s.dateFrom ? format(s.dateFrom, 'yyyy-MM-dd') : '',
          dateTo: s.dateTo ? format(s.dateTo, 'yyyy-MM-dd') : '',
        }));

        const teeTimesData = teeTimes.map(t => ({
          date: t.date ? format(t.date, 'yyyy-MM-dd') : '',
          club: t.club,
          time: t.time,
          golfers: t.golfers,
        }));

        const flightsData = flights.map(f => ({
          date: f.date ? format(f.date, 'yyyy-MM-dd') : '',
          airlineCode: f.airlineCode,
          airlineName: f.airlineName,
          flightNumber: f.flightNumber,
          fromIata: f.fromIata,
          fromCity: f.fromCity || '',
          toIata: f.toIata,
          toCity: f.toCity || '',
          departureTime: f.departureTime,
          arrivalTime: f.arrivalTime,
        }));

        // Insert voucher
        const { data: voucherData, error: insertError } = await supabase
          .from('vouchers')
          .insert({
            voucher_code: codeData,
            voucher_number: voucherNumber,
            client_id: clientId,
            supplier_id: supplierId || null,
            client_name: "", // Keep for backwards compatibility, but will be derived from client_id
            hotel_name: hotelName.trim(),
            services: servicesData as any,
            tee_times: teeTimesData as any,
            flights: flightsData as any,
            expiration_date: expirationDateString,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Insert main client relation
        await supabase.from('voucher_travelers').insert({
          voucher_id: voucherData.id,
          client_id: clientId,
          is_main_client: true,
        });

        // Insert other travelers
        const filteredTravelers = otherTravelerIds.filter(id => id !== "");
        if (filteredTravelers.length > 0) {
          await supabase.from('voucher_travelers').insert(
            filteredTravelers.map(id => ({
              voucher_id: voucherData.id,
              client_id: id,
              is_main_client: false,
            }))
          );
        }

        toast.success("Voucher úspěšně vytvořen!");
        navigate('/vouchers');
      }
    } catch (error) {
      console.error('Error saving voucher:', error);
      toast.error(voucherId ? "Nepodařilo se aktualizovat voucher" : "Nepodařilo se vytvořit voucher");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="p-6 shadow-[var(--shadow-medium)]">
        <h2 className="text-2xl font-bold mb-4 text-foreground">Informace o klientovi</h2>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="clientId">Hlavní klient *</Label>
            <ClientCombobox
              value={clientId}
              onChange={setClientId}
            />
          </div>

          <div>
            <Label htmlFor="supplierId">Dodavatel služeb</Label>
            <SupplierCombobox
              value={supplierId}
              onChange={setSupplierId}
            />
          </div>

          <div>
            <Label htmlFor="hotelName">Název hotelu *</Label>
            <Input
              id="hotelName"
              value={hotelName}
              onChange={(e) => setHotelName(e.target.value)}
              placeholder="např. Hotel Paradise, Resort Sunshine"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Další cestující (nepovinné)</Label>
              <div className="flex gap-2">
                <Dialog open={bulkImportOpen} onOpenChange={setBulkImportOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" size="sm" variant="outline" className="md:px-3">
                      <Users className="h-4 w-4 md:mr-1" />
                      <span className="hidden md:inline">Hromadný import</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Hromadný import cestujících</DialogTitle>
                      <DialogDescription>
                        Zadejte jména a příjmení, každé na nový řádek ve formátu "Jméno Příjmení"
                      </DialogDescription>
                    </DialogHeader>
                    <Textarea
                      placeholder="Jan Novák&#10;Marie Svobodová&#10;Petr Dvořák"
                      value={bulkImportText}
                      onChange={(e) => setBulkImportText(e.target.value)}
                      rows={10}
                      className="font-mono"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setBulkImportOpen(false)}
                      >
                        Zrušit
                      </Button>
                      <Button
                        type="button"
                        onClick={handleBulkImport}
                        disabled={loading}
                      >
                        Importovat
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button type="button" onClick={addTraveler} size="sm" variant="outline" className="md:px-3">
                  <Plus className="h-4 w-4 md:mr-1" />
                  <span className="hidden md:inline">Přidat cestujícího</span>
                </Button>
              </div>
            </div>
            {otherTravelerIds.map((travelerId, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <ClientCombobox
                  value={travelerId}
                  onChange={(value) => updateTraveler(index, value)}
                />
                <Button
                  type="button"
                  onClick={() => removeTraveler(index)}
                  variant="outline"
                  size="icon"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div>
            <Label htmlFor="expirationDate">Datum expirace</Label>
            <Input
              id="expirationDate"
              type="text"
              value="Automaticky ze sluzeb (nejzazsi datum)"
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Datum expirace bude automaticky nastaveno na nejzazsi datum ze vsech sluzeb
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6 shadow-[var(--shadow-medium)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-foreground">Služby</h2>
          <Button type="button" onClick={addService} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" />
            Přidat službu
          </Button>
        </div>

        <div className="space-y-6">
          {services.map((service, index) => (
            <Card key={index} className="p-4 bg-muted">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold text-foreground">Služba {index + 1}</h3>
                {services.length > 1 && (
                  <Button
                    type="button"
                    onClick={() => removeService(index)}
                    variant="outline"
                    size="sm"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <Label>Název služby *</Label>
                  {service.isTextMode ? (
                    <div className="flex gap-2">
                      <Input
                        value={service.name}
                        onChange={(e) => updateService(index, "name", e.target.value)}
                        placeholder="Název služby"
                        required
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => toggleServiceInputMode(index)}
                        title="Vybrat z šablony"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <ServiceCombobox
                      value={service.name}
                      onChange={(value) => updateService(index, "name", value)}
                      onSelect={(value) => handleServiceSelect(index, value)}
                    />
                  )}
                </div>
                <div>
                  <Label>PAX *</Label>
                  <Input
                    value={service.pax}
                    onChange={(e) => updateService(index, "pax", e.target.value)}
                    placeholder="např. 2 ADT"
                    required
                    maxLength={50}
                  />
                </div>
                <div>
                  <Label>Qtd. *</Label>
                  <Input
                    value={service.qty}
                    onChange={(e) => updateService(index, "qty", e.target.value)}
                    placeholder="např. 1"
                    required
                    maxLength={20}
                  />
                </div>
                <div>
                  <Label>Datum od *</Label>
                  <DateInput
                    value={service.dateFrom}
                    onChange={(date) => updateService(index, "dateFrom", date)}
                    placeholder="DD.MM.RR"
                  />
                </div>
                <div>
                  <Label>Datum do *</Label>
                  <DateInput
                    value={service.dateTo}
                    onChange={(date) => updateService(index, "dateTo", date)}
                    placeholder="DD.MM.RR"
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Card>

      {/* Flight Details Section */}
      <Card className="p-6 shadow-[var(--shadow-medium)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-foreground">Detaily letů</h2>
          <Button type="button" onClick={() => addFlight(false)} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" />
            Přidat let
          </Button>
        </div>

        {flights.length === 0 ? (
          <p className="text-sm text-muted-foreground">Žádné lety nebyly přidány</p>
        ) : (
          <div className="space-y-4">
            {flights.map((flight, index) => {
              // For main flights (not variants), calculate position among main flights
              const mainFlights = flights.filter(f => !f.isVariant);
              const variantFlights = flights.filter(f => f.isVariant);
              
              let flightNumber: number;
              if (flight.isVariant) {
                // For variants, count position among variants
                flightNumber = variantFlights.findIndex(f => f === flight) + 1;
              } else {
                // For main flights, count position among main flights
                flightNumber = mainFlights.findIndex(f => f === flight) + 1;
              }
              
              const flightLabel = flightNumber === 1 ? "Let TAM" : flightNumber === 2 ? "Let ZPĚT" : `Let ${flightNumber}`;
              
              // Check if this is a "Let ZPĚT" variant (every even variant flight)
              const isVariantZpet = flight.isVariant && flightLabel === "Let ZPĚT";
              
              return (
                <React.Fragment key={index}>
                  <Card className={`p-4 ${flight.isVariant ? 'bg-card border-2 border-accent/50' : 'bg-muted'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-foreground">
                          {flightLabel}
                          {flight.isVariant && <span className="ml-2 text-xs text-accent">(Varianta)</span>}
                        </h3>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          onClick={() => removeFlight(index)}
                          variant="outline"
                          size="sm"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label>Datum *</Label>
                        <DateInput
                          value={flight.date}
                          onChange={(date) => updateFlight(index, "date", date)}
                          placeholder="DD.MM.RR"
                        />
                      </div>
                      <div>
                        <Label>Počet cestujících (PAX) *</Label>
                        <Input
                          value={flight.pax}
                          onChange={(e) => updateFlight(index, "pax", e.target.value)}
                          placeholder="např. 2"
                          maxLength={10}
                        />
                      </div>
                      <div>
                        <Label>Kód dopravce *</Label>
                        <AirlineCombobox
                          value={flight.airlineCode}
                          onSelect={(code, name) => handleAirlineSelect(index, code, name)}
                          placeholder="Vyberte dopravce"
                        />
                      </div>
                      <div>
                        <Label>Letecká společnost</Label>
                        <Input
                          value={flight.airlineName}
                          onChange={(e) => updateFlight(index, "airlineName", e.target.value)}
                          placeholder="Automaticky z našeptávače"
                          disabled
                          className="bg-muted"
                        />
                      </div>
                      <div>
                        <Label>Číslo letu *</Label>
                        <Input
                          value={flight.flightNumber}
                          onChange={(e) => updateFlight(index, "flightNumber", e.target.value)}
                          placeholder="např. 123"
                          maxLength={10}
                        />
                      </div>
                      <div>
                        <Label>Odkud *</Label>
                        <AirportCombobox
                          value={flight.fromIata}
                          onSelect={(iata, city) => {
                            updateFlight(index, "fromIata", iata);
                            if (city) updateFlight(index, "fromCity", city);
                          }}
                          placeholder="Vyberte letiště"
                        />
                      </div>
                      <div>
                        <Label>Kam *</Label>
                        <AirportCombobox
                          value={flight.toIata}
                          onSelect={(iata, city) => {
                            updateFlight(index, "toIata", iata);
                            if (city) updateFlight(index, "toCity", city);
                          }}
                          placeholder="Vyberte letiště"
                        />
                      </div>
                      <div>
                        <Label>Čas odletu *</Label>
                        <Input
                          value={flight.departureTime}
                          onChange={(e) => updateFlight(index, "departureTime", e.target.value)}
                          placeholder="např. 10:30"
                          maxLength={10}
                        />
                      </div>
                      <div>
                        <Label>Čas příletu *</Label>
                        <Input
                          value={flight.arrivalTime}
                          onChange={(e) => updateFlight(index, "arrivalTime", e.target.value)}
                          placeholder="např. 13:45"
                          maxLength={10}
                        />
                      </div>
                    </div>
                  </Card>
                  
                  {isVariantZpet && (
                    <div className="flex justify-center">
                      <Button type="button" onClick={() => addFlight(true)} size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-1" />
                        Varianta letu
                      </Button>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </Card>

      {/* Tee Time Section */}
      <Card className="p-6 shadow-[var(--shadow-medium)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-foreground">Tee Time</h2>
          <Button type="button" onClick={addTeeTime} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" />
            Přidat Tee Time
          </Button>
        </div>

        {teeTimes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Žádné tee time nebyly přidány</p>
        ) : (
          <div className="space-y-4">
            {teeTimes.map((teeTime, index) => (
              <Card key={index} className="p-4 bg-muted">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-foreground">Tee Time {index + 1}</h3>
                  <Button
                    type="button"
                    onClick={() => removeTeeTime(index)}
                    variant="outline"
                    size="sm"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Datum</Label>
                    <DateInput
                      value={teeTime.date}
                      onChange={(date) => updateTeeTime(index, "date", date)}
                      placeholder="DD.MM.RR"
                    />
                  </div>
                  <div>
                    <Label>Golfový klub</Label>
                    {teeTime.isTextMode ? (
                      <div className="flex gap-2">
                        <Input
                          value={teeTime.club}
                          onChange={(e) => updateTeeTime(index, "club", e.target.value)}
                          placeholder="Název golfového klubu"
                          maxLength={100}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => toggleGolfClubInputMode(index)}
                          title="Vybrat z šablony"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <GolfClubCombobox
                        value={teeTime.club}
                        onChange={(value) => updateTeeTime(index, "club", value)}
                        onSelect={(value) => handleGolfClubSelect(index, value)}
                      />
                    )}
                  </div>
                  <div>
                    <Label>Čas</Label>
                    <Input
                      value={teeTime.time}
                      onChange={(e) => updateTeeTime(index, "time", e.target.value)}
                      placeholder="např. 13:45h"
                      maxLength={20}
                    />
                  </div>
                  <div>
                    <Label>Počet golfistů</Label>
                    <Input
                      value={teeTime.golfers}
                      onChange={(e) => updateTeeTime(index, "golfers", e.target.value)}
                      placeholder="např. 7 golfers"
                      maxLength={50}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      <Button
        type="submit" 
        size="lg" 
        className="w-full"
        disabled={loading}
      >
        {loading 
          ? (voucherId ? "Ukládám změny..." : "Vytvářím voucher...") 
          : (voucherId ? "Uložit změny" : "Vytvořit voucher")
        }
      </Button>
    </form>
  );
};
