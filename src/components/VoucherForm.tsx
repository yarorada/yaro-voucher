import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Users, RotateCcw, Copy, GripVertical } from "lucide-react";
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
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Service {
  id: string;
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

// SortableServiceItem component outside main component to prevent losing focus
const SortableServiceItem = React.memo(({ 
  service, 
  index, 
  services,
  updateService,
  removeService,
  addService,
  handleServiceSelect,
  toggleServiceInputMode,
  copyService
}: { 
  service: Service; 
  index: number;
  services: Service[];
  updateService: (index: number, field: keyof Service, value: string | Date | undefined | boolean) => void;
  removeService: (index: number) => void;
  addService: () => void;
  handleServiceSelect: (index: number, serviceName: string) => void;
  toggleServiceInputMode: (index: number) => void;
  copyService: (index: number) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: service.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} className="p-4 bg-muted">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="cursor-grab active:cursor-grabbing touch-none p-1 hover:bg-accent rounded"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </button>
          <h3 className="font-semibold text-foreground">Služba {index + 1}</h3>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={() => copyService(index)}
            variant="outline"
            size="sm"
            title="Duplikovat službu"
          >
            <Copy className="h-4 w-4" />
          </Button>
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
            autoSetDate={() => service.dateFrom ? new Date(service.dateFrom.getTime() + 7 * 24 * 60 * 60 * 1000) : undefined}
          />
        </div>
      </div>
      
      {index === services.length - 1 && (
        <div className="mt-4 pt-4 border-t border-border">
          <Button type="button" onClick={addService} size="sm" variant="outline" className="w-full">
            <Plus className="h-4 w-4 mr-1" />
            Přidat službu
          </Button>
        </div>
      )}
    </Card>
  );
});

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
      id: crypto.randomUUID(),
      ...s,
      dateFrom: s.dateFrom ? new Date(s.dateFrom) : undefined,
      dateTo: s.dateTo ? new Date(s.dateTo) : undefined,
      isTextMode: !!s.name,
    })) || [{ id: crypto.randomUUID(), name: "", pax: "", qty: "", dateFrom: undefined, dateTo: undefined, isTextMode: false }]
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
  const [extractedClients, setExtractedClients] = useState<Array<{
    title: string;
    first_name: string;
    last_name: string;
    email: string;
    date_of_birth: string;
    passport_number: string;
    id_card_number: string;
  }>>([]);
  const [showPreview, setShowPreview] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  const removeDiacritics = (text: string): string => {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  const handleExtractData = async () => {
    if (!bulkImportText.trim()) {
      toast.error("Prosím zadejte data o cestujících");
      return;
    }

    setLoading(true);
    try {
      // Call AI edge function to parse bulk client data
      const { data: parseResult, error: parseError } = await supabase.functions.invoke(
        'parse-bulk-client-data',
        {
          body: { text: bulkImportText }
        }
      );

      if (parseError) {
        console.error('AI parsing error:', parseError);
        throw new Error('Nepodařilo se zpracovat data pomocí AI');
      }

      if (!parseResult?.success || !parseResult?.clients) {
        throw new Error('AI nevrátila platná data');
      }

      setExtractedClients(parseResult.clients);
      setShowPreview(true);
      toast.success(`Extrahováno ${parseResult.clients.length} cestujících`);
    } catch (error) {
      console.error('Error extracting data:', error);
      toast.error(error instanceof Error ? error.message : "Nepodařilo se extrahovat data");
    } finally {
      setLoading(false);
    }
  };

  const updateExtractedClient = (index: number, field: string, value: string) => {
    const updated = [...extractedClients];
    updated[index] = { ...updated[index], [field]: value };
    setExtractedClients(updated);
  };

  const removeExtractedClient = (index: number) => {
    setExtractedClients(extractedClients.filter((_, i) => i !== index));
  };

  const handleConfirmImport = async () => {
    setLoading(true);
    try {
      const newTravelerIds: string[] = [];
      let createdCount = 0;
      let existingCount = 0;
      const createdDetails: string[] = [];

      for (const clientData of extractedClients) {
        const firstName = removeDiacritics(clientData.first_name);
        const lastName = removeDiacritics(clientData.last_name);

        // Check if client exists by name
        const { data: existingClients } = await supabase
          .from('clients')
          .select('id')
          .ilike('first_name', firstName)
          .ilike('last_name', lastName);

        if (existingClients && existingClients.length > 0) {
          // Use existing client - only ID is added to voucher
          newTravelerIds.push(existingClients[0].id);
          existingCount++;
        } else {
          // Create new client with ALL AI-extracted data in database
          // Only client ID will be stored in voucher, full data remains in database
          const { data: newClient, error } = await supabase
            .from('clients')
            .insert({
              title: clientData.title?.trim() || null,
              first_name: firstName,
              last_name: lastName,
              email: clientData.email?.trim() || null,
              date_of_birth: clientData.date_of_birth || null,
              passport_number: clientData.passport_number?.trim() || null,
              id_card_number: clientData.id_card_number?.trim() || null,
            })
            .select('id, first_name, last_name, title, email, passport_number, id_card_number')
            .single();

          if (error) {
            console.error('Error creating client:', error);
            toast.error(`Nepodařilo se vytvořit klienta: ${firstName} ${lastName}`);
            continue;
          }
          
          if (newClient) {
            newTravelerIds.push(newClient.id);
            createdCount++;
            
            // Prepare detail info for toast
            const details = [
              newClient.title,
              newClient.first_name,
              newClient.last_name,
              newClient.email && `📧 ${newClient.email}`,
              newClient.passport_number && `🛂 ${newClient.passport_number}`,
              newClient.id_card_number && `🆔 ${newClient.id_card_number}`
            ].filter(Boolean).join(' ');
            
            createdDetails.push(details);
          }
        }
      }

      // Add only client IDs to voucher travelers list
      setOtherTravelerIds([...otherTravelerIds, ...newTravelerIds]);
      setBulkImportText("");
      setExtractedClients([]);
      setShowPreview(false);
      setBulkImportOpen(false);
      
      if (createdCount > 0) {
        toast.success(
          `✅ Vytvořeno ${createdCount} nových cestujících v databázi\n` +
          `Do voucheru přidáno pouze jméno, ostatní data uložena v databázi klientů`,
          { duration: 5000 }
        );
        console.log('Created clients with full data:', createdDetails);
      }
      if (existingCount > 0) {
        toast.success(`Použito ${existingCount} existujících cestujících z databáze`);
      }
    } catch (error) {
      console.error('Error bulk importing:', error);
      toast.error(error instanceof Error ? error.message : "Nepodařilo se importovat cestující");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelPreview = () => {
    setShowPreview(false);
    setExtractedClients([]);
  };

  const addService = () => {
    const lastService = services[services.length - 1];
    
    // Find earliest dateFrom and latest dateTo from all services
    let earliestDateFrom: Date | undefined = undefined;
    let latestDateTo: Date | undefined = undefined;
    
    services.forEach(service => {
      if (service.dateFrom) {
        if (!earliestDateFrom || service.dateFrom < earliestDateFrom) {
          earliestDateFrom = service.dateFrom;
        }
      }
      if (service.dateTo) {
        if (!latestDateTo || service.dateTo > latestDateTo) {
          latestDateTo = service.dateTo;
        }
      }
    });
    
    setServices([
      ...services,
      { 
        id: crypto.randomUUID(),
        name: "", 
        pax: lastService?.pax || "", 
        qty: lastService?.qty || "", 
        dateFrom: earliestDateFrom, 
        dateTo: latestDateTo,
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
    if (field === 'name' || field === 'pax' || field === 'qty' || field === 'id') {
      (updated[index] as any)[field] = value as string;
    } else if (field === 'dateFrom' || field === 'dateTo') {
      (updated[index] as any)[field] = value as Date | undefined;
    } else if (field === 'isTextMode') {
      (updated[index] as any)[field] = value as boolean;
    }
    setServices(updated);
  };

  const copyService = (index: number) => {
    const sourceService = services[index];
    
    // Vytvořit kopii služby se všemi stejnými hodnotami
    setServices([
      ...services,
      {
        id: crypto.randomUUID(),
        name: sourceService.name,
        pax: sourceService.pax,
        qty: sourceService.qty,
        dateFrom: sourceService.dateFrom,
        dateTo: sourceService.dateTo,
        isTextMode: sourceService.isTextMode
      }
    ]);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setServices((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);

        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const addTeeTime = () => {
    // Najít poslední tee time
    const lastTeeTime = teeTimes[teeTimes.length - 1];
    
    // Pokud existuje, přidat 1 den a zkopírovat počet golfistů
    let newDate: Date | undefined = undefined;
    let newGolfers = "";
    
    if (lastTeeTime) {
      if (lastTeeTime.date) {
        newDate = new Date(lastTeeTime.date);
        newDate.setDate(newDate.getDate() + 1);
      }
      newGolfers = lastTeeTime.golfers;
    }
    
    setTeeTimes([
      ...teeTimes, 
      { 
        date: newDate, 
        club: "", 
        time: "", 
        golfers: newGolfers, 
        isTextMode: false 
      }
    ]);
  };

  const copyTeeTime = (index: number) => {
    const sourceTeeTime = teeTimes[index];
    
    // Najít nejvyšší datum ze všech tee times
    const maxDate = teeTimes
      .map(t => t.date)
      .filter((date): date is Date => date !== undefined)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    
    // Přidat 1 den k nejvyššímu datu
    let newDate: Date | undefined = undefined;
    if (maxDate) {
      newDate = new Date(maxDate);
      newDate.setDate(newDate.getDate() + 1);
    } else if (sourceTeeTime.date) {
      // Pokud žádné jiné datum neexistuje, použít datum zdrojového + 1
      newDate = new Date(sourceTeeTime.date);
      newDate.setDate(newDate.getDate() + 1);
    }
    
    // Vytvořit kopii s novým datem
    setTeeTimes([
      ...teeTimes,
      {
        date: newDate,
        club: sourceTeeTime.club,
        time: sourceTeeTime.time,
        golfers: sourceTeeTime.golfers,
        isTextMode: sourceTeeTime.isTextMode
      }
    ]);
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
    // Find earliest and latest dates from services
    const serviceDates = services
      .flatMap(s => [s.dateFrom, s.dateTo])
      .filter((date): date is Date => date !== undefined)
      .sort((a, b) => a.getTime() - b.getTime());
    
    const earliestServiceDate = serviceDates[0];
    const latestServiceDate = serviceDates[serviceDates.length - 1];

    // Get previous flight to reverse airports and copy airline
    const previousFlight = flights[flights.length - 1];
    
    // Determine if this is "Let TAM" (odd position) or "Let ZPĚT" (even position)
    const flightCount = flights.length;
    const isOutbound = flightCount % 2 === 0; // Even index = Let TAM, Odd index = Let ZPĚT
    
    // For Let TAM: use earliest date and PAX from first service
    // For Let ZPĚT: use latest date and PAX from previous flight (which is Let TAM)
    const flightDate = isOutbound ? earliestServiceDate : latestServiceDate;
    const flightPax = isOutbound 
      ? (services[0]?.pax || "") 
      : (previousFlight?.pax || "");
    
    setFlights([...flights, { 
      date: flightDate || undefined,
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
      pax: flightPax
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
          pax: f.pax,
          isVariant: f.isVariant || false,
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
          pax: f.pax,
          isVariant: f.isVariant || false,
        }));

        // Insert voucher (voucher_code will be auto-generated by trigger)
        const { data: voucherData, error: insertError } = await supabase
          .from('vouchers')
          .insert({
            client_id: clientId,
            supplier_id: supplierId || null,
            client_name: "", // Keep for backwards compatibility, but will be derived from client_id
            hotel_name: hotelName.trim(),
            services: servicesData,
            tee_times: teeTimesData,
            flights: flightsData,
            expiration_date: expirationDateString,
            voucher_number: 0, // Temporary value
          } as any)
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
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Hromadný import cestujících</DialogTitle>
                      <DialogDescription>
                        {!showPreview ? (
                          "Zadejte informace o cestujících v libovolném formátu. AI automaticky extrahuje jména, příjmení, tituly a další údaje (email, datum narození, číslo pasu/OP)."
                        ) : (
                          "Zkontrolujte a upravte extrahovaná data před vytvořením klientů."
                        )}
                      </DialogDescription>
                    </DialogHeader>
                    
                    {!showPreview ? (
                      <>
                        <Textarea
                          placeholder="Příklad:&#10;Pan Jan Novák, narozen 15.5.1980, pas 12345678&#10;Paní Marie Svobodová, email: marie@email.cz&#10;Petr Dvořák, OP AB123456"
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
                            onClick={handleExtractData}
                            disabled={loading}
                          >
                            Extrahovat data
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-4">
                          {extractedClients.map((client, index) => (
                            <Card key={index} className="p-4 bg-muted">
                              <div className="flex justify-between items-start mb-3">
                                <h3 className="font-semibold text-foreground">Cestující {index + 1}</h3>
                                <Button
                                  type="button"
                                  onClick={() => removeExtractedClient(index)}
                                  variant="outline"
                                  size="sm"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <Label>Titul</Label>
                                  <Input
                                    value={client.title || ""}
                                    onChange={(e) => updateExtractedClient(index, 'title', e.target.value)}
                                    placeholder="např. Ing., Mgr."
                                  />
                                </div>
                                <div>
                                  <Label>Jméno *</Label>
                                  <Input
                                    value={client.first_name}
                                    onChange={(e) => updateExtractedClient(index, 'first_name', e.target.value)}
                                    required
                                  />
                                </div>
                                <div>
                                  <Label>Příjmení *</Label>
                                  <Input
                                    value={client.last_name}
                                    onChange={(e) => updateExtractedClient(index, 'last_name', e.target.value)}
                                    required
                                  />
                                </div>
                                <div>
                                  <Label>Email</Label>
                                  <Input
                                    type="email"
                                    value={client.email || ""}
                                    onChange={(e) => updateExtractedClient(index, 'email', e.target.value)}
                                    placeholder="email@example.com"
                                  />
                                </div>
                                <div>
                                  <Label>Datum narození</Label>
                                  <Input
                                    type="date"
                                    value={client.date_of_birth || ""}
                                    onChange={(e) => updateExtractedClient(index, 'date_of_birth', e.target.value)}
                                  />
                                </div>
                                <div>
                                  <Label>Číslo pasu</Label>
                                  <Input
                                    value={client.passport_number || ""}
                                    onChange={(e) => updateExtractedClient(index, 'passport_number', e.target.value)}
                                    placeholder="AB123456"
                                  />
                                </div>
                                <div>
                                  <Label>Číslo OP</Label>
                                  <Input
                                    value={client.id_card_number || ""}
                                    onChange={(e) => updateExtractedClient(index, 'id_card_number', e.target.value)}
                                    placeholder="123456789"
                                  />
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                        
                        <div className="flex justify-end gap-2 pt-4">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleCancelPreview}
                          >
                            Zpět
                          </Button>
                          <Button
                            type="button"
                            onClick={handleConfirmImport}
                            disabled={loading || extractedClients.length === 0}
                          >
                            Vytvořit cestující ({extractedClients.length})
                          </Button>
                        </div>
                      </>
                    )}
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

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={services.map(s => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-6">
              {services.map((service, index) => (
                <SortableServiceItem 
                  key={service.id} 
                  service={service} 
                  index={index}
                  services={services}
                  updateService={updateService}
                  removeService={removeService}
                  addService={addService}
                  handleServiceSelect={handleServiceSelect}
                  toggleServiceInputMode={toggleServiceInputMode}
                  copyService={copyService}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </Card>

      {/* Flight Details Section */}
      <Card className="p-6 shadow-[var(--shadow-medium)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-foreground">Detaily letů</h2>
          <div className="flex gap-2">
            <Button type="button" onClick={() => addFlight(false)} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Přidat let
            </Button>
            <Button type="button" onClick={() => addFlight(true)} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Varianta letu
            </Button>
          </div>
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
              
              return (
                <Card key={index} className={`p-4 ${flight.isVariant ? 'bg-card border-2 border-accent/50' : 'bg-muted'}`}>
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
              );
            })}
          </div>
        )}
      </Card>

      {/* Tee Time Section */}
      <Card className="p-6 shadow-[var(--shadow-medium)]">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-foreground">Tee Time</h2>
        </div>

        {teeTimes.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-4">Žádné tee time nebyly přidány</p>
            <Button type="button" onClick={addTeeTime} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Přidat Tee Time
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {teeTimes.map((teeTime, index) => (
              <Card key={index} className="p-4 bg-muted">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-foreground">Tee Time {index + 1}</h3>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => copyTeeTime(index)}
                      variant="outline"
                      size="sm"
                      title="Kopírovat na další den"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      onClick={() => removeTeeTime(index)}
                      variant="outline"
                      size="sm"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
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
                
                {index === teeTimes.length - 1 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <Button type="button" onClick={addTeeTime} size="sm" variant="outline" className="w-full">
                      <Plus className="h-4 w-4 mr-1" />
                      Přidat Tee Time
                    </Button>
                  </div>
                )}
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
