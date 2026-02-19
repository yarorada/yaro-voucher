import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DestinationCombobox } from "./DestinationCombobox";
import { VariantServiceDialog } from "./VariantServiceDialog";
import { Plus, Edit, Trash2, Plane, Hotel, Navigation, Car, Shield, FileText, ChevronDown, GripVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPriceCurrency, formatDateForDB } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface FlightSegment {
  departure: string;
  arrival: string;
  airline: string;
  flight_number: string;
  date: string;
  departure_time: string;
  arrival_time: string;
}

interface FlightDetails {
  outbound_segments?: FlightSegment[];
  return_segments?: FlightSegment[];
  one_way?: boolean;
  // Legacy fields
  departure_airport?: string;
  arrival_airport?: string;
  airline?: string;
  flight_number?: string;
  return_departure_airport?: string;
  return_arrival_airport?: string;
  return_airline?: string;
  return_flight_number?: string;
}

interface VariantService {
  id: string;
  service_type: "flight" | "hotel" | "golf" | "transfer" | "insurance" | "other";
  service_name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  price: number | null;
  cost_price: number | null;
  price_currency: string | null;
  cost_currency: string | null;
  person_count: number | null;
  quantity: number;
  supplier_id: string | null;
  order_index: number | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details?: any;
  suppliers?: {
    name: string;
  };
}

interface SortableServiceRowProps {
  service: VariantService;
  getServiceIcon: (type: VariantService["service_type"]) => React.ReactNode;
  getServiceTypeLabel: (type: VariantService["service_type"]) => string;
  formatDate: (d: string | null) => string;
  formatPrice: (p: number | null, currency?: string | null) => string;
  renderFlightSegments: (s: VariantService) => React.ReactNode;
  onEdit: (s: VariantService) => void;
  onDelete: (id: string) => void;
}

const SortableServiceRow = ({
  service,
  getServiceIcon,
  getServiceTypeLabel,
  formatDate,
  formatPrice,
  renderFlightSegments,
  onEdit,
  onDelete,
}: SortableServiceRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: service.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell className="w-[40px] cursor-grab" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {getServiceIcon(service.service_type)}
          <span className="text-sm">{getServiceTypeLabel(service.service_type)}</span>
        </div>
      </TableCell>
      <TableCell>
        <div>
          <div className="font-medium">{service.service_name}</div>
          {service.service_type === "flight" && renderFlightSegments(service)}
          {service.suppliers && (
            <div className="text-sm text-muted-foreground">{service.suppliers.name}</div>
          )}
        </div>
      </TableCell>
      <TableCell className="text-sm">
        {formatDate(service.start_date)}
        {service.end_date && ` - ${formatDate(service.end_date)}`}
      </TableCell>
      <TableCell>{service.person_count || 1}</TableCell>
      <TableCell className="font-medium">
        {formatPrice((service.price || 0) * (service.quantity || 1), service.price_currency)}
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button onClick={() => onEdit(service)} size="sm" variant="ghost">
            <Edit className="h-4 w-4" />
          </Button>
          <Button onClick={() => onDelete(service.id)} size="sm" variant="ghost" className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

interface VariantDetailDialogProps {
  dealId: string;
  variant: any;
  open: boolean;
  onClose: (success?: boolean) => void;
  dealStartDate?: string | null;
  dealEndDate?: string | null;
  defaultTravelerCount?: number;
}

export const VariantDetailDialog = ({
  dealId,
  variant,
  open,
  onClose,
  dealStartDate,
  dealEndDate,
  defaultTravelerCount = 1,
}: VariantDetailDialogProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [variantName, setVariantName] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState("");
  const [services, setServices] = useState<VariantService[]>([]);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<VariantService | null>(null);
  const [preselectedServiceType, setPreselectedServiceType] = useState<VariantService["service_type"]>("hotel");
  const [preselectedServiceName, setPreselectedServiceName] = useState<string>("");

  useEffect(() => {
    if (variant) {
      setVariantName(variant.variant_name || "");
      setDestinationId(variant.destination_id || "");
      setStartDate(variant.start_date ? new Date(variant.start_date) : undefined);
      setEndDate(variant.end_date ? new Date(variant.end_date) : undefined);
      setNotes(variant.notes || "");
      fetchServices(variant.id);
    } else {
      resetForm();
    }
  }, [variant]);

  const resetForm = () => {
    setVariantName("");
    setDestinationId("");
    setStartDate(dealStartDate ? new Date(dealStartDate) : undefined);
    setEndDate(dealEndDate ? new Date(dealEndDate) : undefined);
    setNotes("");
    setServices([]);
  };

  const fetchServices = async (variantId: string) => {
    try {
      const { data, error } = await supabase
        .from("deal_variant_services")
        .select(`
          *,
          suppliers(name)
        `)
        .eq("variant_id", variantId)
        .order("order_index", { ascending: true });

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error("Error fetching variant services:", error);
    }
  };

  const calculateTotalPrice = () => {
    return services.reduce((sum, service) => {
      const servicePrice = (service.price || 0) * (service.quantity || 1);
      return sum + servicePrice;
    }, 0);
  };

  const handleSave = async () => {
    if (!variantName.trim()) {
      toast({
        title: "Chyba",
        description: "Vyplňte název varianty",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const totalPrice = calculateTotalPrice();
      
      if (variant) {
        // Update existing variant
        const { error } = await supabase
          .from("deal_variants")
          .update({
            variant_name: variantName,
            destination_id: destinationId || null,
            start_date: formatDateForDB(startDate),
            end_date: formatDateForDB(endDate),
            total_price: totalPrice,
            notes: notes || null,
          })
          .eq("id", variant.id);

        if (error) throw error;
      } else {
        // Create new variant
        const { data, error } = await supabase
          .from("deal_variants")
          .insert({
            deal_id: dealId,
            variant_name: variantName,
            destination_id: destinationId || null,
            start_date: formatDateForDB(startDate),
            end_date: formatDateForDB(endDate),
            total_price: totalPrice,
            notes: notes || null,
            is_selected: false,
          })
          .select()
          .single();

        if (error) throw error;
        
        // Fetch services for the new variant (should be empty initially)
        if (data) {
          fetchServices(data.id);
        }
      }

      toast({
        title: "Úspěch",
        description: variant ? "Varianta byla aktualizována" : "Varianta byla vytvořena",
      });

      onClose(true);
      resetForm();
    } catch (error) {
      console.error("Error saving variant:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se uložit variantu",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const recalcDatesFromServices = async (variantId: string) => {
    try {
      const { data: svcData } = await supabase
        .from("deal_variant_services")
        .select("start_date, end_date, price, cost_price, quantity")
        .eq("variant_id", variantId);

      if (!svcData || svcData.length === 0) return;

      const startDates = svcData.map(s => s.start_date).filter(Boolean).sort();
      const endDates = svcData.map(s => s.end_date).filter(Boolean).sort();
      const newStart = startDates[0] || null;
      const newEnd = endDates[endDates.length - 1] || null;
      const totalPrice = svcData.reduce((sum, s) => sum + ((s.price || 0) * (s.quantity || 1)), 0);

      // Update variant dates and total_price in DB
      await supabase.from("deal_variants").update({
        start_date: newStart,
        end_date: newEnd,
        total_price: totalPrice,
      }).eq("id", variantId);

      // Update local state
      setStartDate(newStart ? new Date(newStart) : undefined);
      setEndDate(newEnd ? new Date(newEnd) : undefined);

      // If this variant is selected, propagate to deal
      if (variant?.is_selected) {
        const updateData: Record<string, any> = {};
        if (newStart) updateData.start_date = newStart;
        if (newEnd) updateData.end_date = newEnd;
        if (totalPrice > 0) updateData.total_price = totalPrice;
        if (Object.keys(updateData).length > 0) {
          await supabase.from("deals").update(updateData).eq("id", dealId);
        }
      }
    } catch (error) {
      console.error("Error recalculating dates:", error);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm("Opravdu chcete smazat tuto službu?")) return;

    try {
      const { error } = await supabase
        .from("deal_variant_services")
        .delete()
        .eq("id", serviceId);

      if (error) throw error;

      toast({
        title: "Úspěch",
        description: "Služba byla smazána",
      });

      if (variant) {
        await fetchServices(variant.id);
        await recalcDatesFromServices(variant.id);
      }
    } catch (error) {
      console.error("Error deleting service:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se smazat službu",
        variant: "destructive",
      });
    }
  };

  const handleServiceSaved = async () => {
    if (variant) {
      await fetchServices(variant.id);
      await recalcDatesFromServices(variant.id);
    }
  };

  const getServiceIcon = (type: VariantService["service_type"]) => {
    switch (type) {
      case "flight": return <Plane className="h-4 w-4" />;
      case "hotel": return <Hotel className="h-4 w-4" />;
      case "golf": return <Navigation className="h-4 w-4" />;
      case "transfer": return <Car className="h-4 w-4" />;
      case "insurance": return <Shield className="h-4 w-4" />;
      case "other": return <FileText className="h-4 w-4" />;
    }
  };

  const getServiceTypeLabel = (type: VariantService["service_type"]) => {
    switch (type) {
      case "flight": return "Letenka";
      case "hotel": return "Ubytování";
      case "golf": return "Green Fee";
      case "transfer": return "Doprava";
      case "insurance": return "Pojištění";
      case "other": return "Ostatní";
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("cs-CZ");
  };

  const formatPriceWithCurrency = (price: number | null, currency?: string | null) => formatPriceCurrency(price, currency || "CZK");

  const renderFlightSegments = (service: VariantService) => {
    const details = service.details as FlightDetails | null;
    if (!details) return null;

    const formatSegmentDate = (dateStr: string | null) => {
      if (!dateStr) return "";
      try {
        return new Date(dateStr).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" });
      } catch {
        return dateStr;
      }
    };

    const renderSegment = (segment: FlightSegment, index: number, isReturn: boolean) => (
      <div key={`${isReturn ? 'ret' : 'out'}-${index}`} className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium">{segment.departure}</span>
        <span>→</span>
        <span className="font-medium">{segment.arrival}</span>
        {segment.date && (
          <span className="text-muted-foreground/70">
            {formatSegmentDate(segment.date)}
          </span>
        )}
        {(segment.departure_time || segment.arrival_time) && (
          <span className="text-muted-foreground/70">
            {segment.departure_time || "?"} - {segment.arrival_time || "?"}
          </span>
        )}
        {segment.airline && (
          <span className="text-muted-foreground/70">
            ({segment.airline}{segment.flight_number ? ` ${segment.flight_number}` : ""})
          </span>
        )}
      </div>
    );

    // Handle new multi-segment format
    if (details.outbound_segments && details.outbound_segments.length > 0) {
      return (
        <div className="space-y-1 mt-1">
          {details.outbound_segments.map((seg, idx) => renderSegment(seg, idx, false))}
          {details.return_segments && details.return_segments.length > 0 && !details.one_way && (
            <>
              <div className="border-t border-border/50 my-1"></div>
              {details.return_segments.map((seg, idx) => renderSegment(seg, idx, true))}
            </>
          )}
        </div>
      );
    }

    // Handle legacy single-segment format
    if (details.departure_airport && details.arrival_airport) {
      return (
        <div className="space-y-1 mt-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium">{details.departure_airport}</span>
            <span>→</span>
            <span className="font-medium">{details.arrival_airport}</span>
            {details.airline && (
              <span className="text-muted-foreground/70">
                ({details.airline}{details.flight_number ? ` ${details.flight_number}` : ""})
              </span>
            )}
          </div>
          {!details.one_way && details.return_departure_airport && details.return_arrival_airport && (
            <>
              <div className="border-t border-border/50 my-1"></div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium">{details.return_departure_airport}</span>
                <span>→</span>
                <span className="font-medium">{details.return_arrival_airport}</span>
                {details.return_airline && (
                  <span className="text-muted-foreground/70">
                    ({details.return_airline}{details.return_flight_number ? ` ${details.return_flight_number}` : ""})
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      );
    }

    return null;
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = services.findIndex((s) => s.id === active.id);
    const newIndex = services.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(services, oldIndex, newIndex);
    setServices(reordered);

    // Persist new order
    const updates = reordered.map((s, i) => ({ id: s.id, order_index: i }));
    for (const u of updates) {
      await supabase
        .from("deal_variant_services")
        .update({ order_index: u.order_index })
        .eq("id", u.id);
    }
  }, [services]);

  return (
    <>
      <Dialog open={open} onOpenChange={() => onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {variant ? "Upravit variantu" : "Nová varianta"}
            </DialogTitle>
            <DialogDescription>
              Vytvořte variantu nabídky s různými destinacemi a službami
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="variant-name">Název varianty *</Label>
                <Input
                  id="variant-name"
                  value={variantName}
                  onChange={(e) => setVariantName(e.target.value)}
                  placeholder="např. Varianta A - Marrakech"
                />
              </div>

              <div>
                <Label htmlFor="destination">Destinace</Label>
                <DestinationCombobox
                  value={destinationId}
                  onValueChange={setDestinationId}
                />
              </div>

              <div className="space-y-2">
                <Label>Datum</Label>
                <DateRangePicker
                  dateFrom={startDate}
                  dateTo={endDate}
                  onDateFromChange={setStartDate}
                  onDateToChange={setEndDate}
                />
              </div>

              <div>
                <Label htmlFor="notes">Poznámky</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Poznámky k této variantě..."
                  rows={3}
                />
              </div>
            </div>

            {variant && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">Služby</h4>
                    <p className="text-sm text-muted-foreground">
                      Celková cena: {formatPriceWithCurrency(calculateTotalPrice(), services[0]?.price_currency)}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Přidat službu
                        <ChevronDown className="h-4 w-4 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-background w-48">
                      <DropdownMenuItem onClick={() => {
                        setEditingService(null);
                        setPreselectedServiceType("flight");
                        setPreselectedServiceName("");
                        setServiceDialogOpen(true);
                      }}>
                        <Plane className="h-4 w-4 mr-2" />
                        Letenka
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        setEditingService(null);
                        setPreselectedServiceType("hotel");
                        setPreselectedServiceName("");
                        setServiceDialogOpen(true);
                      }}>
                        <Hotel className="h-4 w-4 mr-2" />
                        Ubytování
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        setEditingService(null);
                        setPreselectedServiceType("golf");
                        setPreselectedServiceName("");
                        setServiceDialogOpen(true);
                      }}>
                        <Navigation className="h-4 w-4 mr-2" />
                        Green fee
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        setEditingService(null);
                        setPreselectedServiceType("transfer");
                        setPreselectedServiceName("");
                        setServiceDialogOpen(true);
                      }}>
                        <Car className="h-4 w-4 mr-2" />
                        Transfery
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        setEditingService(null);
                        setPreselectedServiceType("other");
                        setPreselectedServiceName("Rent-a-car");
                        setServiceDialogOpen(true);
                      }}>
                        <Car className="h-4 w-4 mr-2" />
                        Rent-a-car
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        setEditingService(null);
                        setPreselectedServiceType("other");
                        setPreselectedServiceName("Strava");
                        setServiceDialogOpen(true);
                      }}>
                        <FileText className="h-4 w-4 mr-2" />
                        Strava
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        setEditingService(null);
                        setPreselectedServiceType("other");
                        setPreselectedServiceName("Asistence");
                        setServiceDialogOpen(true);
                      }}>
                        <FileText className="h-4 w-4 mr-2" />
                        Asistence
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        setEditingService(null);
                        setPreselectedServiceType("insurance");
                        setPreselectedServiceName("");
                        setServiceDialogOpen(true);
                      }}>
                        <Shield className="h-4 w-4 mr-2" />
                        Pojištění
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        setEditingService(null);
                        setPreselectedServiceType("other");
                        setPreselectedServiceName("");
                        setServiceDialogOpen(true);
                      }}>
                        <FileText className="h-4 w-4 mr-2" />
                        Ostatní
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {services.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Zatím nejsou přidány žádné služby
                  </p>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40px]"></TableHead>
                          <TableHead>Typ</TableHead>
                          <TableHead>Název</TableHead>
                          <TableHead>Datum</TableHead>
                          <TableHead>Počet osob</TableHead>
                          <TableHead>Cena</TableHead>
                          <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <SortableContext items={services.map(s => s.id)} strategy={verticalListSortingStrategy}>
                          {services.map((service) => (
                            <SortableServiceRow
                              key={service.id}
                              service={service}
                              getServiceIcon={getServiceIcon}
                              getServiceTypeLabel={getServiceTypeLabel}
                              formatDate={formatDate}
                              formatPrice={formatPriceWithCurrency}
                              renderFlightSegments={renderFlightSegments}
                              onEdit={(s) => {
                                setEditingService(s);
                                setServiceDialogOpen(true);
                              }}
                              onDelete={handleDeleteService}
                            />
                          ))}
                        </SortableContext>
                      </TableBody>
                    </Table>
                  </DndContext>
                )}
              </div>
            )}

            {!variant && (
              <p className="text-sm text-muted-foreground">
                Po vytvoření varianty budete moci přidat služby
              </p>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => onClose()}>
                Zrušit
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Ukládám..." : variant ? "Uložit změny" : "Vytvořit variantu"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {variant && (
        <VariantServiceDialog
          variantId={variant.id}
          service={editingService}
          open={serviceDialogOpen}
          onClose={(success) => {
            setServiceDialogOpen(false);
            setEditingService(null);
            if (success) {
              handleServiceSaved();
            }
          }}
          variantStartDate={variant.start_date}
          variantEndDate={variant.end_date}
          preselectedServiceType={preselectedServiceType}
          preselectedServiceName={preselectedServiceName}
          defaultTravelerCount={defaultTravelerCount}
        />
      )}
    </>
  );
};
