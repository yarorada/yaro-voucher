import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Save, Trash2, Plus, X, Plane, Hotel, Navigation, Car, Shield, FileText, FileSignature, Edit, ChevronDown, Utensils, HeadphonesIcon, GripVertical, Copy, Pencil, Check, Loader2, Undo2, Redo2 } from "lucide-react";
import { CurrencySelect, getCurrencySymbol } from "@/components/CurrencySelect";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import yaroLogo from "@/assets/yaro-logo-wide.png";
import { formatPriceCurrency, formatDateForDB } from "@/lib/utils";
import { format, addDays, addMonths } from "date-fns";
import { DestinationCombobox } from "@/components/DestinationCombobox";
import { ClientCombobox } from "@/components/ClientCombobox";
import { SupplierCombobox } from "@/components/SupplierCombobox";
import { ServiceCombobox } from "@/components/ServiceCombobox";
import { HotelCombobox } from "@/components/HotelCombobox";
import { DealStatusBadge } from "@/components/DealStatusBadge";
import { AirportCombobox } from "@/components/AirportCombobox";
import { AirlineCombobox } from "@/components/AirlineCombobox";
import { FlightSegmentForm, emptySegment, type FlightSegment, type FlightFormData } from "@/components/FlightSegmentForm";
import { GolfAiImport, type ParsedTeeTime } from "@/components/GolfAiImport";
import { FlightAiImport } from "@/components/FlightAiImport";
import { DealVariants } from "@/components/DealVariants";
import { DealPaymentSchedule } from "@/components/DealPaymentSchedule";
import { DealBulkTravelerImport } from "@/components/DealBulkTravelerImport";
import { DealTeeTimesEditor } from "@/components/DealTeeTimesEditor";
import { DateInput } from "@/components/ui/date-input";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useAutoSaveOnLeave } from "@/hooks/useAutoSaveOnLeave";

interface DealTraveler {
  id: string;
  client_id: string;
  is_lead_traveler: boolean;
  clients: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

interface FlightDetails {
  outbound_segments?: import("@/components/FlightSegmentForm").FlightSegment[];
  return_segments?: import("@/components/FlightSegmentForm").FlightSegment[];
  outbound?: {
    departure: string;
    arrival: string;
    airline: string;
    airline_name: string;
    flight_number: string;
    departure_time?: string;
    arrival_time?: string;
  };
  return?: {
    departure: string;
    arrival: string;
    airline: string;
    airline_name: string;
    flight_number: string;
    departure_time?: string;
    arrival_time?: string;
  };
}

interface DealService {
  id: string;
  service_type: "flight" | "hotel" | "golf" | "transfer" | "insurance" | "other";
  service_name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  price: number | null;
  cost_price: number | null;
  cost_currency: string | null;
  cost_price_original: number | null;
  supplier_id: string | null;
  person_count: number | null;
  details?: FlightDetails | null;
  order_index?: number;
  suppliers?: {
    name: string;
  };
}

// Sortable row component for drag-and-drop
const SortableServiceRow = ({ 
  service, 
  onEdit, 
  onDelete,
  onDuplicate,
  getServiceIcon,
  getServiceTypeLabel
}: { 
  service: DealService;
  onEdit: (service: DealService) => void;
  onDelete: (id: string) => void;
  onDuplicate: (service: DealService) => void;
  getServiceIcon: (type: string) => React.ReactNode;
  getServiceTypeLabel: (type: string) => string;
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
    <TableRow ref={setNodeRef} style={style} className="hover:bg-muted/50">
      <TableCell className="w-8">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0">{getServiceIcon(service.service_type)}</div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{service.service_name}</p>
            <p className="text-xs text-muted-foreground">{getServiceTypeLabel(service.service_type)}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-xs whitespace-nowrap">
        {service.start_date && (() => { const p = service.start_date.split('-'); return p.length === 3 ? `${p[2]}.${p[1]}` : ''; })()}
      </TableCell>
      <TableCell className="text-center text-sm">
        {service.person_count}
      </TableCell>
      <TableCell className="text-xs truncate max-w-[100px]">
        {service.suppliers?.name || '-'}
      </TableCell>
      <TableCell className="text-right">
        <div className="text-sm font-medium">
        {service.price ? formatPriceCurrency(service.price * (service.person_count || 1)) : '-'}
        </div>
        {service.price && service.person_count && service.person_count > 1 && (
          <div className="text-xs text-muted-foreground">
            {formatPriceCurrency(service.price)} × {service.person_count}
          </div>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex gap-1 justify-end">
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-7 w-7 p-0" 
            onClick={() => onEdit(service)}
            title="Upravit"
          >
            <Edit className="h-3 w-3" />
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-7 w-7 p-0" 
            onClick={() => onDuplicate(service)}
            title="Duplikovat"
          >
            <Copy className="h-3 w-3" />
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-7 w-7 p-0 text-destructive hover:text-destructive" 
            onClick={() => onDelete(service.id)}
            title="Smazat"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

interface Deal {
  id: string;
  deal_number: string;
  name: string | null;
  status: "inquiry" | "quote" | "confirmed" | "cancelled" | "completed" | "dispatched";
  start_date: string | null;
  end_date: string | null;
  total_price: number | null;
  deposit_amount: number | null;
  deposit_paid: boolean;
  notes: string | null;
  destination_id: string | null;
  discount_amount: number | null;
  adjustment_amount: number | null;
  discount_note: string | null;
  adjustment_note: string | null;
  tee_times: any;
  destination?: {
    id: string;
    name: string;
  };
  deal_travelers: DealTraveler[];
}

const DealDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deal, setDeal] = useState<Deal | null>(null);
  const [services, setServices] = useState<DealService[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);

  // Dialog states
  const [travelerDialogOpen, setTravelerDialogOpen] = useState(false);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [newTravelerId, setNewTravelerId] = useState("");
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicatePersonCount, setDuplicatePersonCount] = useState("1");
  const [duplicating, setDuplicating] = useState(false);
  
  // Service form state
  const [serviceForm, setServiceForm] = useState({
    id: "",
    service_type: "hotel" as DealService["service_type"],
    service_name: "",
    description: "",
    start_date: undefined as Date | undefined,
    end_date: undefined as Date | undefined,
    price: "",
    cost_price: "",
    cost_currency: "CZK",
    cost_price_original: "",
    supplier_id: "",
    person_count: "1",
  });
  
  // Flight segments state (separate from form to avoid serialization issues)
  const [flightFormData, setFlightFormData] = useState<FlightFormData>({
    outbound_segments: [emptySegment()],
    return_segments: [emptySegment()],
    is_one_way: false,
  });
  
  // Undo/Redo history for service form
  const [serviceFormHistory, setServiceFormHistory] = useState<typeof serviceForm[]>([]);
  const [serviceFormFuture, setServiceFormFuture] = useState<typeof serviceForm[]>([]);
  const [lastDraftSave, setLastDraftSave] = useState<Date | null>(null);
  const draftSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const DRAFT_KEY = `deal_service_draft_${id}`;
  
  // Auto-save draft to localStorage
  const saveDraft = useCallback((form: typeof serviceForm) => {
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ data: form, timestamp: Date.now() }));
        setLastDraftSave(new Date());
      } catch (e) { console.error("Draft save error:", e); }
    }, 500);
  }, [DRAFT_KEY]);
  
  // Load draft on dialog open
  const loadDraft = useCallback(() => {
    try {
      const stored = localStorage.getItem(DRAFT_KEY);
      if (stored) {
        const { data, timestamp } = JSON.parse(stored);
        // Convert date strings back to Date objects
        if (data.start_date) data.start_date = new Date(data.start_date);
        if (data.end_date) data.end_date = new Date(data.end_date);
        setServiceForm(data);
        setLastDraftSave(new Date(timestamp));
        return true;
      }
    } catch (e) { console.error("Draft load error:", e); }
    return false;
  }, [DRAFT_KEY]);
  
  // Clear draft
  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
    setLastDraftSave(null);
  }, [DRAFT_KEY]);
  
  // Update service form with history tracking
  const updateServiceForm = useCallback((newForm: typeof serviceForm | ((prev: typeof serviceForm) => typeof serviceForm)) => {
    setServiceForm(prev => {
      const updated = typeof newForm === 'function' ? newForm(prev) : newForm;
      // Add to history only if different
      if (JSON.stringify(updated) !== JSON.stringify(prev)) {
        setServiceFormHistory(h => [...h.slice(-49), prev]);
        setServiceFormFuture([]);
        saveDraft(updated);
      }
      return updated;
    });
  }, [saveDraft]);
  
  // Undo service form
  const undoServiceForm = useCallback(() => {
    if (serviceFormHistory.length === 0) return;
    const prev = serviceFormHistory[serviceFormHistory.length - 1];
    setServiceFormHistory(h => h.slice(0, -1));
    setServiceFormFuture(f => [serviceForm, ...f]);
    setServiceForm(prev);
    saveDraft(prev);
  }, [serviceFormHistory, serviceForm, saveDraft]);
  
  // Redo service form
  const redoServiceForm = useCallback(() => {
    if (serviceFormFuture.length === 0) return;
    const next = serviceFormFuture[0];
    setServiceFormFuture(f => f.slice(1));
    setServiceFormHistory(h => [...h, serviceForm]);
    setServiceForm(next);
    saveDraft(next);
  }, [serviceFormFuture, serviceForm, saveDraft]);
  
  // Track form changes for undo history (debounced)
  const previousFormRef = useRef<string>('');
  const historyTimer = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (!serviceDialogOpen) return;
    
    const currentFormStr = JSON.stringify(serviceForm);
    // Skip if form is empty/initial
    if (!serviceForm.service_name && serviceForm.service_type === 'hotel' && !serviceForm.price) {
      previousFormRef.current = currentFormStr;
      return;
    }
    
    if (previousFormRef.current && previousFormRef.current !== currentFormStr) {
      // Debounce history capture
      if (historyTimer.current) clearTimeout(historyTimer.current);
      historyTimer.current = setTimeout(() => {
        try {
          const prevForm = JSON.parse(previousFormRef.current);
          setServiceFormHistory(h => [...h.slice(-49), prevForm]);
          setServiceFormFuture([]);
        } catch (e) {}
        previousFormRef.current = currentFormStr;
      }, 800);
    } else if (!previousFormRef.current) {
      previousFormRef.current = currentFormStr;
    }
  }, [serviceForm, serviceDialogOpen]);
  
  // Keyboard shortcuts for undo/redo in dialog
  useEffect(() => {
    if (!serviceDialogOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redoServiceForm();
        else undoServiceForm();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redoServiceForm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [serviceDialogOpen, undoServiceForm, redoServiceForm]);
  
  // Auto-save draft when dialog is open and form changes
  useEffect(() => {
    if (!serviceDialogOpen) return;
    // Only save if there's meaningful data
    if (serviceForm.service_name || serviceForm.price || flightFormData.outbound_segments[0]?.departure) {
      saveDraft(serviceForm);
    }
  }, [serviceForm, flightFormData, serviceDialogOpen, saveDraft]);
  
  // Currency conversion state
  const [convertingCurrency, setConvertingCurrency] = useState(false);
  
  // Store original flight details to preserve all segments
  const [originalFlightDetails, setOriginalFlightDetails] = useState<any>(null);

  // Form state
  const [status, setStatus] = useState<"inquiry" | "quote" | "confirmed" | "cancelled" | "completed" | "dispatched">("inquiry");
  const [destinationId, setDestinationId] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [totalPrice, setTotalPrice] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositPaid, setDepositPaid] = useState(false);
  const [notes, setNotes] = useState("");
  const [leadTravelerId, setLeadTravelerId] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [dealName, setDealName] = useState("");
  const [discountNote, setDiscountNote] = useState("");
  const [adjustmentNote, setAdjustmentNote] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const nameInputRef = React.useRef<HTMLInputElement>(null);

  // Track loaded deal state for auto-save change detection
  const loadedDealRef = useRef<{
    name: string; status: string; destinationId: string;
    startDate: string | null; endDate: string | null;
    depositAmount: string; depositPaid: boolean; notes: string;
    discountAmount: string; adjustmentAmount: string;
    discountNote: string; adjustmentNote: string;
  } | null>(null);

  const hasUnsavedChanges = useCallback(() => {
    if (!loadedDealRef.current || !deal) return false;
    const l = loadedDealRef.current;
    return (
      dealName !== l.name ||
      status !== l.status ||
      destinationId !== l.destinationId ||
      formatDateForDB(startDate) !== l.startDate ||
      formatDateForDB(endDate) !== l.endDate ||
      depositAmount !== l.depositAmount ||
      depositPaid !== l.depositPaid ||
      notes !== l.notes ||
      discountAmount !== l.discountAmount ||
      adjustmentAmount !== l.adjustmentAmount ||
      discountNote !== l.discountNote ||
      adjustmentNote !== l.adjustmentNote
    );
  }, [deal, dealName, status, destinationId, startDate, endDate, depositAmount, depositPaid, notes, discountAmount, adjustmentAmount, discountNote, adjustmentNote]);

  const silentSave = useCallback(async () => {
    if (!deal || saving) return;
    try {
      await supabase
        .from("deals")
        .update({
          name: dealName || null,
          status,
          destination_id: destinationId || null,
          start_date: formatDateForDB(startDate),
          end_date: formatDateForDB(endDate),
          total_price: totalPrice ? parseFloat(totalPrice) : null,
          deposit_amount: depositAmount ? parseFloat(depositAmount) : null,
          deposit_paid: depositPaid,
          notes: notes || null,
          discount_amount: discountAmount ? parseFloat(discountAmount) : 0,
          adjustment_amount: adjustmentAmount ? parseFloat(adjustmentAmount) : 0,
          discount_note: discountNote || null,
          adjustment_note: adjustmentNote || null,
        })
        .eq("id", deal.id);
      console.log("Auto-saved deal on leave");
    } catch (e) {
      console.error("Auto-save failed:", e);
    }
  }, [deal, saving, dealName, status, destinationId, startDate, endDate, totalPrice, depositAmount, depositPaid, notes, discountAmount, adjustmentAmount, discountNote, adjustmentNote]);

  useAutoSaveOnLeave({
    hasUnsavedChanges,
    onSave: silentSave,
    enabled: !!deal && !loading,
  });

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchDeal();
    fetchServices();
  }, [id]);

  // Recalculate total price when services or adjustments change
  useEffect(() => {
    if (services.length > 0 || discountAmount || adjustmentAmount) {
      calculateTotalPrice(
        services, 
        parseFloat(discountAmount) || 0, 
        parseFloat(adjustmentAmount) || 0
      );
    }
  }, [services, discountAmount, adjustmentAmount]);

  const fetchDeal = async () => {
    try {
      const { data, error } = await supabase
        .from("deals")
        .select(`
          *,
          destination:destinations(id, name),
          deal_travelers(
            id,
            client_id,
            is_lead_traveler,
            clients(id, first_name, last_name)
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;

      setDeal(data);
      setStatus(data.status);
      setDestinationId(data.destination_id || "");
      setStartDate(data.start_date ? new Date(data.start_date) : undefined);
      setEndDate(data.end_date ? new Date(data.end_date) : undefined);
      setTotalPrice(data.total_price?.toString() || "");
      setDepositAmount(data.deposit_amount?.toString() || "");
      setDepositPaid(data.deposit_paid || false);
      setNotes(data.notes || "");
      setDiscountAmount(data.discount_amount?.toString() || "");
      setAdjustmentAmount(data.adjustment_amount?.toString() || "");
      setDiscountNote(data.discount_note || "");
      setAdjustmentNote(data.adjustment_note || "");
      setDealName(data.name || "");
      
      // Store initial state for auto-save change detection
      loadedDealRef.current = {
        name: data.name || "",
        status: data.status,
        destinationId: data.destination_id || "",
        startDate: data.start_date || null,
        endDate: data.end_date || null,
        depositAmount: data.deposit_amount?.toString() || "",
        depositPaid: data.deposit_paid || false,
        notes: data.notes || "",
        discountAmount: data.discount_amount?.toString() || "",
        adjustmentAmount: data.adjustment_amount?.toString() || "",
        discountNote: data.discount_note || "",
        adjustmentNote: data.adjustment_note || "",
      };
      
      const leadTraveler = data.deal_travelers.find((t: any) => t.is_lead_traveler);
      if (leadTraveler) {
        setLeadTravelerId(leadTraveler.client_id);
      }
    } catch (error) {
      console.error("Error fetching deal:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se načíst detail obchodního případu",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalPrice = (servicesList: DealService[], discount: number, adjustment: number) => {
    const servicesTotal = servicesList.reduce((sum, service) => {
      const servicePrice = (service.price || 0) * (service.person_count || 1);
      return sum + servicePrice;
    }, 0);
    
    const finalTotal = servicesTotal - discount + adjustment;
    setTotalPrice(finalTotal.toString());
    return finalTotal;
  };

  // Calculate total cost price from services
  const totalCostPrice = services.reduce((sum, service) => {
    const serviceCost = (service.cost_price || 0) * (service.person_count || 1);
    return sum + serviceCost;
  }, 0);

  // Calculate profit
  const profit = (parseFloat(totalPrice) || 0) - totalCostPrice;

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from("deal_services")
        .select(`
          *,
          suppliers(name)
        `)
        .eq("deal_id", id)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;
      setServices((data || []).map(service => ({
        ...service,
        details: service.details as FlightDetails | null
      })));
    } catch (error) {
      console.error("Error fetching services:", error);
    } finally {
      setLoadingServices(false);
    }
  };

  const handleServiceDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;

    const oldIndex = services.findIndex((s) => s.id === active.id);
    const newIndex = services.findIndex((s) => s.id === over.id);

    const newServices = arrayMove(services, oldIndex, newIndex);
    setServices(newServices);

    // Save order to database
    try {
      const updates = newServices.map((service, index) => 
        supabase
          .from("deal_services")
          .update({ order_index: index })
          .eq("id", service.id)
      );
      await Promise.all(updates);
      
      toast({
        title: "Pořadí uloženo",
        description: "Pořadí služeb bylo uloženo",
      });
    } catch (error) {
      console.error("Error saving order:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se uložit pořadí",
        variant: "destructive",
      });
    }
  };

  const handleAddTraveler = async () => {
    if (!newTravelerId || !deal) return;

    // Check if already exists
    const exists = deal.deal_travelers.some(t => t.client_id === newTravelerId);
    if (exists) {
      toast({
        title: "Chyba",
        description: "Tento cestující už je v obchodním případu",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("deal_travelers")
        .insert({
          deal_id: deal.id,
          client_id: newTravelerId,
          is_lead_traveler: false,
        });

      if (error) throw error;

      toast({
        title: "Úspěch",
        description: "Cestující byl přidán",
      });

      setTravelerDialogOpen(false);
      setNewTravelerId("");
      fetchDeal();
    } catch (error) {
      console.error("Error adding traveler:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se přidat cestujícího",
        variant: "destructive",
      });
    }
  };

  const handleRemoveTraveler = async (travelerId: string, isLead: boolean) => {
    if (isLead) {
      toast({
        title: "Chyba",
        description: "Nelze odstranit hlavního cestujícího",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("deal_travelers")
        .delete()
        .eq("id", travelerId);

      if (error) throw error;

      toast({
        title: "Úspěch",
        description: "Cestující byl odebrán",
      });

      fetchDeal();
    } catch (error) {
      console.error("Error removing traveler:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se odebrat cestujícího",
        variant: "destructive",
      });
    }
  };

  const autoGeneratePayments = async (dealId: string, totalPrice: number) => {
    try {
      // Check if payments already exist
      const { data: existingPayments, error: checkError } = await supabase
        .from("deal_payments")
        .select("id")
        .eq("deal_id", dealId)
        .limit(1);
      
      if (checkError) throw checkError;
      
      // If payments already exist, just update them with new amounts
      if (existingPayments && existingPayments.length > 0) {
        // Delete existing auto-generated payments and recreate
        await supabase
          .from("deal_payments")
          .delete()
          .eq("deal_id", dealId);
      }
      
      const tomorrow = addDays(new Date(), 1);
      const depositAmount = Math.round(totalPrice * 0.5);
      const finalAmount = totalPrice - depositAmount;
      
      const paymentsToInsert: any[] = [
        {
          deal_id: dealId,
          payment_type: "deposit",
          amount: depositAmount,
          due_date: format(tomorrow, "yyyy-MM-dd"),
          notes: "1. záloha (50%)",
        },
      ];
      
      // Final payment 1 month before departure
      if (finalAmount > 0) {
        const departureDate = startDate;
        const finalDueDate = departureDate 
          ? addMonths(departureDate, -1) 
          : addMonths(new Date(), 2);
        
        paymentsToInsert.push({
          deal_id: dealId,
          payment_type: "final",
          amount: finalAmount,
          due_date: format(finalDueDate, "yyyy-MM-dd"),
          notes: "Doplatek",
        });
      }
      
      const { error } = await supabase
        .from("deal_payments")
        .insert(paymentsToInsert);
      
      if (error) throw error;
    } catch (error) {
      console.error("Error auto-generating payments:", error);
    }
  };

  const handleSaveService = async () => {
    if (!deal) return;
    
    // Convert currency if needed
    let costPriceCzk: number | null = null;
    const costPriceOriginal = serviceForm.cost_price_original ? parseFloat(serviceForm.cost_price_original) : null;
    
    // Check if we're editing and currency/amount hasn't changed - skip recalculation
    const existingService = services.find(s => s.id === serviceForm.id);
    const existingCostPrice = existingService?.cost_price;
    const existingCurrency = (existingService as any)?.cost_currency;
    const existingOriginal = (existingService as any)?.cost_price_original;
    
    const currencyUnchanged = serviceForm.id && 
      existingCurrency === serviceForm.cost_currency &&
      existingOriginal === costPriceOriginal;
    
    if (costPriceOriginal !== null && serviceForm.cost_currency !== "CZK") {
      if (currencyUnchanged && existingCostPrice !== null) {
        // Currency and original amount unchanged - keep existing converted price
        costPriceCzk = existingCostPrice;
      } else {
        // Need to convert - currency or amount changed
        setConvertingCurrency(true);
        try {
          const { data, error } = await supabase.functions.invoke("get-exchange-rate", {
            body: { currency: serviceForm.cost_currency, amount: costPriceOriginal },
          });
          
          if (error) throw error;
          costPriceCzk = data.convertedAmount;
        } catch (error) {
          console.error("Error converting currency:", error);
          toast({
            title: "Chyba",
            description: "Nepodařilo se přepočítat měnu. Zkuste to znovu.",
            variant: "destructive",
          });
          setConvertingCurrency(false);
          return;
        }
        setConvertingCurrency(false);
      }
    } else {
      costPriceCzk = costPriceOriginal;
    }
    
    // For flight type, generate automatic service_name
    let finalServiceName = serviceForm.service_name;
    let flightDetails: any = null;
    
    if (serviceForm.service_type === "flight") {
      const outSegs = flightFormData.outbound_segments;
      const retSegs = flightFormData.return_segments;
      // Require at least outbound airports
      if (!outSegs[0]?.departure || !outSegs[0]?.arrival) {
        toast({
          title: "Chyba",
          description: "Vyplňte prosím letiště odletu a příletu",
          variant: "destructive",
        });
        return;
      }
      
      // Generate automatic service name
      const firstDeparture = outSegs[0].departure;
      const lastOutboundArrival = outSegs[outSegs.length - 1].arrival;
      const airlineName = outSegs[0].airline_name || outSegs[0].airline;
      const lastReturnArrival = !flightFormData.is_one_way && retSegs.length > 0 ? retSegs[retSegs.length - 1].arrival : "";
      const returnPart = lastReturnArrival ? ` - ${lastReturnArrival}` : '';
      finalServiceName = `Letenka ${firstDeparture} - ${lastOutboundArrival}${returnPart}${airlineName ? ` se společností ${airlineName}` : ''}`;
      
      // Always save in multi-segment format
      flightDetails = {
        outbound_segments: outSegs.filter(s => s.departure && s.arrival),
        return_segments: !flightFormData.is_one_way ? retSegs.filter(s => s.departure && s.arrival) : undefined,
      };
    } else if (!serviceForm.service_name) {
      return;
    }

    try {
      if (serviceForm.id) {
        // Update existing service
        const { error } = await supabase
          .from("deal_services")
          .update({
            service_type: serviceForm.service_type,
            service_name: finalServiceName,
            description: serviceForm.description || null,
            start_date: formatDateForDB(serviceForm.start_date),
            end_date: formatDateForDB(serviceForm.end_date),
            price: serviceForm.price ? parseFloat(serviceForm.price) : null,
            cost_price: costPriceCzk,
            cost_currency: serviceForm.cost_currency,
            cost_price_original: costPriceOriginal,
            supplier_id: serviceForm.supplier_id || null,
            person_count: serviceForm.person_count ? parseInt(serviceForm.person_count) : 1,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            details: flightDetails as any,
          } as any)
          .eq("id", serviceForm.id);

        if (error) throw error;
      } else {
        // Create new service
        const { error } = await supabase
          .from("deal_services")
          .insert([{
            deal_id: deal.id,
            service_type: serviceForm.service_type,
            service_name: finalServiceName,
            description: serviceForm.description || null,
            start_date: formatDateForDB(serviceForm.start_date),
            end_date: formatDateForDB(serviceForm.end_date),
            price: serviceForm.price ? parseFloat(serviceForm.price) : null,
            cost_price: costPriceCzk,
            cost_currency: serviceForm.cost_currency,
            cost_price_original: costPriceOriginal,
            supplier_id: serviceForm.supplier_id || null,
            person_count: serviceForm.person_count ? parseInt(serviceForm.person_count) : 1,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            details: flightDetails as any,
          } as any]);

        if (error) throw error;
      }

      toast({
        title: "Úspěch",
        description: serviceForm.id ? "Služba byla aktualizována" : "Služba byla přidána",
      });

      setServiceDialogOpen(false);
      resetServiceForm();
      await fetchServices();
      
      // Recalculate total price
      const discount = parseFloat(discountAmount) || 0;
      const adjustment = parseFloat(adjustmentAmount) || 0;
      const newTotal = calculateTotalPrice(serviceForm.id 
        ? services.map(s => s.id === serviceForm.id ? { ...s, price: parseFloat(serviceForm.price) || null } : s)
        : [...services, { price: parseFloat(serviceForm.price) || 0 } as any], 
        discount, 
        adjustment
      );
      
      // Update in database
      if (deal?.id) {
        await supabase
          .from("deals")
          .update({ total_price: newTotal })
          .eq("id", deal.id);
        
        // Auto-generate payment schedule if no payments exist yet and total > 0
        if (newTotal > 0) {
          await autoGeneratePayments(deal.id, newTotal);
        }
      }
    } catch (error) {
      console.error("Error saving service:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se uložit službu",
        variant: "destructive",
      });
    }
  };

  const handleGolfAiImport = async (teeTimes: ParsedTeeTime[], supplierNameFromAi?: string) => {
    if (!deal || teeTimes.length === 0) return;

    try {
      // Look up supplier by name if provided
      let supplierId: string | null = null;
      if (supplierNameFromAi) {
        const { data: suppliers } = await supabase
          .from("suppliers")
          .select("id, name")
          .ilike("name", `%${supplierNameFromAi}%`)
          .limit(1);
        if (suppliers && suppliers.length > 0) {
          supplierId = suppliers[0].id;
        }
      }

      const servicesToInsert = teeTimes.map((tt) => ({
        deal_id: deal.id,
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
        supplier_id: supplierId,
        person_count: parseInt(tt.golfers) || deal.deal_travelers?.length || 1,
      }));

      // @ts-ignore
      const { error } = await supabase.from("deal_services").insert(servicesToInsert);
      if (error) throw error;

      // Save structured tee times to deal
      const structuredTeeTimes = teeTimes
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
        .map(tt => ({
          date: tt.date || null,
          club: tt.club || '',
          time: tt.time || '',
        }));

      // Merge with existing tee times on the deal
      const existingTeeTimes = deal.tee_times || [];
      const mergedTeeTimes = [...existingTeeTimes, ...structuredTeeTimes];

      // @ts-ignore
      const { error: dealError } = await supabase
        .from("deals")
        .update({ tee_times: mergedTeeTimes } as any)
        .eq("id", deal.id);
      if (dealError) console.error("Error saving tee times to deal:", dealError);

      toast({
        title: "Úspěch",
        description: `Vytvořeno ${teeTimes.length} Green Fee služeb`,
      });

      setServiceDialogOpen(false);
      resetServiceForm();
      await fetchServices();
      await fetchDeal();
    } catch (error) {
      console.error("Error importing golf tee times:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se importovat tee times",
        variant: "destructive",
      });
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm("Opravdu chcete smazat tuto službu?")) return;

    try {
      const { error } = await supabase
        .from("deal_services")
        .delete()
        .eq("id", serviceId);

      if (error) throw error;

      toast({
        title: "Úspěch",
        description: "Služba byla smazána",
      });

      await fetchServices();
      
      // Recalculate total price
      const discount = parseFloat(discountAmount) || 0;
      const adjustment = parseFloat(adjustmentAmount) || 0;
      const remainingServices = services.filter(s => s.id !== serviceId);
      const newTotal = calculateTotalPrice(remainingServices, discount, adjustment);
      
      // Update in database
      if (deal?.id) {
        await supabase
          .from("deals")
          .update({ total_price: newTotal })
          .eq("id", deal.id);
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

  const handleDuplicateService = async (service: DealService) => {
    if (!deal) return;

    try {
      const { error } = await supabase
        .from("deal_services")
        .insert([{
          deal_id: deal.id,
          service_type: service.service_type,
          service_name: service.service_name,
          description: service.description || null,
          start_date: service.start_date || null,
          end_date: service.end_date || null,
          price: service.price,
          cost_price: service.cost_price,
          supplier_id: service.supplier_id || null,
          person_count: service.person_count || 1,
          details: service.details as any,
          order_index: services.length,
        }]);

      if (error) throw error;

      toast({
        title: "Úspěch",
        description: "Služba byla duplikována",
      });

      await fetchServices();
      
      // Recalculate total price
      const discount = parseFloat(discountAmount) || 0;
      const adjustment = parseFloat(adjustmentAmount) || 0;
      const newTotal = calculateTotalPrice(
        [...services, { price: service.price, person_count: service.person_count } as any], 
        discount, 
        adjustment
      );
      
      // Update in database
      if (deal?.id) {
        await supabase
          .from("deals")
          .update({ total_price: newTotal })
          .eq("id", deal.id);
      }
    } catch (error) {
      console.error("Error duplicating service:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se duplikovat službu",
        variant: "destructive",
      });
    }
  };

  const resetFlightForm = () => {
    setFlightFormData({
      outbound_segments: [emptySegment()],
      return_segments: [emptySegment()],
      is_one_way: false,
    });
  };

  const createServiceFormData = (
    serviceType: DealService["service_type"],
    serviceName: string = "",
    overrides: Partial<typeof serviceForm> = {}
  ) => ({
    id: "",
    service_type: serviceType,
    service_name: serviceName,
    description: "",
    start_date: startDate,
    end_date: endDate,
    price: "",
    cost_price: "",
    cost_currency: "CZK",
    cost_price_original: "",
    supplier_id: "",
    person_count: (deal?.deal_travelers?.length || 1).toString(),
    ...overrides,
  });

  const resetServiceForm = () => {
    setServiceForm({
      id: "",
      service_type: "hotel",
      service_name: "",
      description: "",
      start_date: undefined,
      end_date: undefined,
      price: "",
      cost_price: "",
      cost_currency: "CZK",
      cost_price_original: "",
      supplier_id: "",
      person_count: "1",
    });
    resetFlightForm();
    setOriginalFlightDetails(null);
    // Clear draft and history
    clearDraft();
    setServiceFormHistory([]);
    setServiceFormFuture([]);
  };

  const openEditService = (service: DealService) => {
    const details = service.details as any;
    
    // Store original details to preserve all segments when saving
    setOriginalFlightDetails(details);
    
    // Load flight segments - support both legacy and new format
    if (service.service_type === "flight" && details) {
      let outSegs: FlightSegment[] = [emptySegment()];
      let retSegs: FlightSegment[] = [emptySegment()];
      let isOneWay = true;

      if (details.outbound_segments && details.outbound_segments.length > 0) {
        outSegs = details.outbound_segments.map((s: any) => ({
          departure: s.departure || "",
          arrival: s.arrival || "",
          airline: s.airline || "",
          airline_name: s.airline_name || "",
          flight_number: s.flight_number || "",
          date: s.date || "",
          departure_time: s.departure_time || "",
          arrival_time: s.arrival_time || "",
        }));
      } else if (details.outbound) {
        outSegs = [{
          departure: details.outbound.departure || "",
          arrival: details.outbound.arrival || "",
          airline: details.outbound.airline || "",
          airline_name: details.outbound.airline_name || "",
          flight_number: details.outbound.flight_number || "",
          departure_time: details.outbound.departure_time || "",
          arrival_time: details.outbound.arrival_time || "",
        }];
      }

      if (details.return_segments && details.return_segments.length > 0) {
        retSegs = details.return_segments.map((s: any) => ({
          departure: s.departure || "",
          arrival: s.arrival || "",
          airline: s.airline || "",
          airline_name: s.airline_name || "",
          flight_number: s.flight_number || "",
          date: s.date || "",
          departure_time: s.departure_time || "",
          arrival_time: s.arrival_time || "",
        }));
        isOneWay = false;
      } else if (details.return) {
        retSegs = [{
          departure: details.return.departure || "",
          arrival: details.return.arrival || "",
          airline: details.return.airline || "",
          airline_name: details.return.airline_name || "",
          flight_number: details.return.flight_number || "",
          departure_time: details.return.departure_time || "",
          arrival_time: details.return.arrival_time || "",
        }];
        isOneWay = false;
      }

      setFlightFormData({ outbound_segments: outSegs, return_segments: retSegs, is_one_way: isOneWay });
    } else {
      resetFlightForm();
    }
    
    const serviceAny = service as any;
    setServiceForm({
      id: service.id,
      service_type: service.service_type,
      service_name: service.service_name,
      description: service.description || "",
      start_date: service.start_date ? new Date(service.start_date) : undefined,
      end_date: service.end_date ? new Date(service.end_date) : undefined,
      price: service.price?.toString() || "",
      cost_price: service.cost_price?.toString() || "",
      cost_currency: serviceAny.cost_currency || "CZK",
      cost_price_original: serviceAny.cost_price_original?.toString() || "",
      supplier_id: service.supplier_id || "",
      person_count: service.person_count?.toString() || "1",
    });
    setServiceDialogOpen(true);
  };

  const getServiceIcon = (type: DealService["service_type"]) => {
    switch (type) {
      case "flight": return <Plane className="h-4 w-4" />;
      case "hotel": return <Hotel className="h-4 w-4" />;
      case "golf": return <Navigation className="h-4 w-4" />;
      case "transfer": return <Car className="h-4 w-4" />;
      case "insurance": return <Shield className="h-4 w-4" />;
      case "other": return <FileText className="h-4 w-4" />;
    }
  };

  const getServiceTypeLabel = (type: DealService["service_type"]) => {
    switch (type) {
      case "flight": return "Letenka";
      case "hotel": return "Ubytování";
      case "golf": return "Green Fee";
      case "transfer": return "Doprava";
      case "insurance": return "Pojištění";
      case "other": return "Ostatní";
    }
  };

  const handleSave = async () => {
    if (!deal) return;

    setSaving(true);
    try {
      // Update deal
      const { error: dealError } = await supabase
        .from("deals")
        .update({
          name: dealName || null,
          status,
          destination_id: destinationId || null,
          start_date: formatDateForDB(startDate),
          end_date: formatDateForDB(endDate),
          total_price: totalPrice ? parseFloat(totalPrice) : null,
          deposit_amount: depositAmount ? parseFloat(depositAmount) : null,
          deposit_paid: depositPaid,
          notes: notes || null,
          discount_amount: discountAmount ? parseFloat(discountAmount) : 0,
          adjustment_amount: adjustmentAmount ? parseFloat(adjustmentAmount) : 0,
          discount_note: discountNote || null,
          adjustment_note: adjustmentNote || null,
        })
        .eq("id", deal.id);

      if (dealError) throw dealError;

      // Update lead traveler if changed
      if (leadTravelerId) {
        // Remove old lead traveler status
        await supabase
          .from("deal_travelers")
          .update({ is_lead_traveler: false })
          .eq("deal_id", deal.id);

        // Set new lead traveler or create if doesn't exist
        const { data: existingTraveler } = await supabase
          .from("deal_travelers")
          .select()
          .eq("deal_id", deal.id)
          .eq("client_id", leadTravelerId)
          .maybeSingle();

        if (existingTraveler) {
          await supabase
            .from("deal_travelers")
            .update({ is_lead_traveler: true })
            .eq("deal_id", deal.id)
            .eq("client_id", leadTravelerId);
        } else {
          await supabase
            .from("deal_travelers")
            .insert({
              deal_id: deal.id,
              client_id: leadTravelerId,
              is_lead_traveler: true,
            });
        }
      }

      toast({
        title: "Úspěch",
        description: "Obchodní případ byl aktualizován",
      });

      fetchDeal();
    } catch (error) {
      console.error("Error updating deal:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se aktualizovat obchodní případ",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateContract = async () => {
    if (!deal) return;

    // Check if there's a lead traveler
    const leadTraveler = deal.deal_travelers.find(t => t.is_lead_traveler);
    if (!leadTraveler) {
      toast({
        title: "Chyba",
        description: "Obchodní případ musí mít hlavního cestujícího",
        variant: "destructive",
      });
      return;
    }

    try {
      // Use the deal's total_price, default to 0 if not set
      const contractTotalPrice = deal.total_price !== null && deal.total_price !== undefined 
        ? Number(deal.total_price) 
        : 0;

      // Use tee times stored directly on the deal
      const teeTimes = deal.tee_times?.length > 0 ? deal.tee_times : null;

      const { data: newContract, error } = await supabase
        .from("travel_contracts")
        .insert({
          deal_id: deal.id,
          client_id: leadTraveler.client_id,
          total_price: contractTotalPrice,
          deposit_amount: deal.deposit_amount || null,
          status: "draft",
          contract_number: "", // Will be auto-generated by trigger
          tee_times: teeTimes,
        } as any)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Úspěch",
        description: "Cestovní smlouva byla vytvořena",
      });

      navigate(`/contracts/${newContract.id}`);
    } catch (error) {
      console.error("Error creating contract:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se vytvořit cestovní smlouvu",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deal || !confirm("Opravdu chcete smazat tento obchodní případ?")) return;

    try {
      const { error } = await supabase
        .from("deals")
        .delete()
        .eq("id", deal.id);

      if (error) throw error;

      toast({
        title: "Úspěch",
        description: "Obchodní případ byl smazán",
      });

      navigate("/deals");
    } catch (error) {
      console.error("Error deleting deal:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se smazat obchodní případ",
        variant: "destructive",
      });
    }
  };

  const handleDuplicateDeal = async () => {
    if (!deal) return;
    
    const personCount = parseInt(duplicatePersonCount) || 1;
    setDuplicating(true);
    
    try {
      // Generate new deal number
      const { data: newDealNumber, error: dealNumberError } = await supabase
        .rpc("generate_deal_number");
      
      if (dealNumberError) throw dealNumberError;
      
      // Create new deal
      const { data: newDeal, error: dealError } = await supabase
        .from("deals")
        .insert({
          deal_number: newDealNumber,
          name: deal.name ? `${deal.name} (kopie)` : null,
          status: "inquiry",
          destination_id: deal.destination_id,
          start_date: deal.start_date,
          end_date: deal.end_date,
          notes: deal.notes,
          discount_amount: deal.discount_amount,
          adjustment_amount: deal.adjustment_amount,
          discount_note: deal.discount_note,
          adjustment_note: deal.adjustment_note,
        })
        .select()
        .single();
      
      if (dealError) throw dealError;
      
      // Copy services with updated person count
      if (services.length > 0) {
        const newServices = services.map((service, index) => ({
          deal_id: newDeal.id,
          service_type: service.service_type,
          service_name: service.service_name,
          description: service.description,
          start_date: service.start_date,
          end_date: service.end_date,
          price: service.price,
          cost_price: service.cost_price,
          cost_currency: service.cost_currency,
          cost_price_original: service.cost_price_original,
          supplier_id: service.supplier_id,
          person_count: personCount,
          details: service.details as any,
          order_index: index,
        }));
        const { error: servicesError } = await supabase
          .from("deal_services")
          .insert(newServices);
        
        if (servicesError) throw servicesError;
      }
      
      // Calculate and update total price
      const servicesTotal = services.reduce((sum, service) => {
        const servicePrice = (service.price || 0) * personCount;
        return sum + servicePrice;
      }, 0);
      const finalTotal = servicesTotal - (deal.discount_amount || 0) + (deal.adjustment_amount || 0);
      
      await supabase
        .from("deals")
        .update({ total_price: finalTotal })
        .eq("id", newDeal.id);
      
      toast({
        title: "Úspěch",
        description: "Obchodní případ byl zduplikován",
      });
      
      setDuplicateDialogOpen(false);
      navigate(`/deals/${newDeal.id}`);
    } catch (error) {
      console.error("Error duplicating deal:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se zduplikovat obchodní případ",
        variant: "destructive",
      });
    } finally {
      setDuplicating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--gradient-subtle)] flex items-center justify-center">
        <p className="text-muted-foreground">Načítání...</p>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="min-h-screen bg-[var(--gradient-subtle)] flex items-center justify-center">
        <p className="text-muted-foreground">Obchodní případ nenalezen</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)]">
      <div className="container max-w-5xl mx-auto py-8 px-4">
        <header className="mb-8">
          <div className="flex flex-wrap items-center justify-end gap-2 md:gap-4 mb-4">
            <Button variant="outline" size="sm" onClick={handleSave} disabled={saving} className="gap-2 md:size-default">
              <Save className="h-4 w-4" />
              <span className="hidden sm:inline">{saving ? "Ukládám..." : "Uložit"}</span>
            </Button>
            <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2 md:size-default"
                  onClick={() => setDuplicatePersonCount((deal.deal_travelers?.length || 1).toString())}
                >
                  <Copy className="h-4 w-4" />
                  <span className="hidden sm:inline">Duplikovat</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-background">
                <DialogHeader>
                  <DialogTitle>Duplikovat obchodní případ</DialogTitle>
                  <DialogDescription>
                    Zadejte počet osob pro nový obchodní případ. Počet osob bude nastaven u všech služeb.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Počet osob</Label>
                    <Input
                      type="number"
                      min="1"
                      value={duplicatePersonCount}
                      onChange={(e) => setDuplicatePersonCount(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setDuplicateDialogOpen(false)}>
                      Zrušit
                    </Button>
                    <Button onClick={handleDuplicateDeal} disabled={duplicating}>
                      {duplicating ? "Duplikuji..." : "Duplikovat"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="sm" onClick={handleCreateContract} className="gap-2 md:size-default">
              <FileSignature className="h-4 w-4" />
              <span className="hidden sm:inline">Vytvořit smlouvu</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              className="gap-2 hover:bg-destructive hover:text-destructive-foreground md:size-default"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Smazat</span>
            </Button>
          </div>
          
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <DealStatusBadge status={deal.status} />
              {isEditingName ? (
                <>
                  <Input
                    ref={nameInputRef}
                    value={dealName}
                    onChange={(e) => setDealName(e.target.value)}
                    placeholder="Název obchodního případu..."
                    className="text-xl md:text-2xl font-bold h-auto py-1 px-2 max-w-md flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setIsEditingName(false);
                      }
                      if (e.key === "Escape") {
                        setIsEditingName(false);
                      }
                    }}
                    onBlur={() => setIsEditingName(false)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setIsEditingName(false)}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <h1 className="text-xl md:text-2xl font-bold text-foreground">
                    {dealName || deal.destination?.name || deal.deal_number}
                  </h1>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setIsEditingName(true);
                      setTimeout(() => nameInputRef.current?.focus(), 0);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </header>

        <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Základní informace</CardTitle>
            <CardDescription>Upravte základní údaje obchodního případu</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-6">
              {/* Left side - form fields */}
              <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Stav</Label>
                  <Select value={status} onValueChange={(value) => setStatus(value as any)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inquiry">Poptávka</SelectItem>
                      <SelectItem value="quote">Nabídka odeslána</SelectItem>
                      <SelectItem value="confirmed">Potvrzeno</SelectItem>
                      <SelectItem value="dispatched">Odbaveno</SelectItem>
                      <SelectItem value="cancelled">Zrušeno</SelectItem>
                      <SelectItem value="completed">Dokončeno</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Hlavní cestující</Label>
                  <ClientCombobox
                    value={leadTravelerId}
                    onChange={setLeadTravelerId}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Destinace</Label>
                  <DestinationCombobox
                    value={destinationId}
                    onValueChange={setDestinationId}
                  />
                </div>

                <div className="space-y-1 col-span-2 md:col-span-3">
                  <Label className="text-xs text-muted-foreground">Datum</Label>
                  <DateRangePicker
                    dateFrom={startDate}
                    dateTo={endDate}
                    onDateFromChange={setStartDate}
                    onDateToChange={setEndDate}
                  />
                </div>

                <div className="space-y-1 col-span-2 md:col-span-3">
                  <Label className="text-xs text-muted-foreground">Poznámky</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Interní poznámky..."
                    rows={2}
                    className="resize-none"
                  />
                </div>
              </div>

              {/* Right side - price summary */}
              <div className="md:w-48 border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-6 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Prodejní cena</Label>
                  <div className="text-lg font-bold text-primary">
                    {formatPriceCurrency(parseFloat(totalPrice) || 0)}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Nákupní cena</Label>
                  <div className="text-lg font-semibold text-muted-foreground">
                    {formatPriceCurrency(totalCostPrice)}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Zisk</Label>
                  <div className={`text-lg font-bold ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatPriceCurrency(profit)}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Cestující</CardTitle>
                  <CardDescription>Správa cestujících v obchodním případu</CardDescription>
                </div>
                <div className="flex gap-2">
                  <DealBulkTravelerImport
                    dealId={deal.id}
                    existingTravelerIds={deal.deal_travelers.map(t => t.client_id)}
                    onComplete={fetchDeal}
                  />
                  <Dialog open={travelerDialogOpen} onOpenChange={setTravelerDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" onClick={() => setNewTravelerId("")}>
                        <Plus className="h-4 w-4 mr-1" />
                        <span className="hidden sm:inline">Přidat</span>
                      </Button>
                    </DialogTrigger>
                  <DialogContent className="bg-background">
                    <DialogHeader>
                      <DialogTitle>Přidat cestujícího</DialogTitle>
                      <DialogDescription>
                        Vyberte klienta ze seznamu
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Klient</Label>
                        <ClientCombobox
                          value={newTravelerId}
                          onChange={setNewTravelerId}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setTravelerDialogOpen(false)}>
                          Zrušit
                        </Button>
                        <Button onClick={handleAddTraveler} disabled={!newTravelerId}>
                          Přidat
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50%]">Jméno</TableHead>
                    <TableHead className="w-[35%]">Role</TableHead>
                    <TableHead className="w-[15%] text-right">Akce</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deal.deal_travelers.map((traveler) => (
                    <TableRow key={traveler.id}>
                      <TableCell className="font-medium text-sm">
                        {traveler.clients.first_name} {traveler.clients.last_name}
                      </TableCell>
                      <TableCell className="text-sm">
                        {traveler.is_lead_traveler && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                            Hlavní cestující
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!traveler.is_lead_traveler && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => handleRemoveTraveler(traveler.id, traveler.is_lead_traveler)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <DealPaymentSchedule 
            dealId={deal.id} 
            totalPrice={deal.total_price || 0}
            departureDate={deal.start_date || undefined}
          />
        </div>

        <Card>
          <CardContent className="pt-6">
            <DealVariants dealId={deal.id} onVariantSelected={() => { fetchDeal(); fetchServices(); }} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Služby</CardTitle>
                <CardDescription>Správa služeb v obchodním případu</CardDescription>
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
                    setServiceForm(createServiceFormData("flight"));
                    setServiceDialogOpen(true);
                  }}>
                    <Plane className="h-4 w-4 mr-2" />
                    Letenka
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    setServiceForm(createServiceFormData("hotel"));
                    setServiceDialogOpen(true);
                  }}>
                    <Hotel className="h-4 w-4 mr-2" />
                    Ubytování
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    setServiceForm(createServiceFormData("golf"));
                    setServiceDialogOpen(true);
                  }}>
                    <Navigation className="h-4 w-4 mr-2" />
                    Green fee
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    setServiceForm(createServiceFormData("transfer"));
                    setServiceDialogOpen(true);
                  }}>
                    <Car className="h-4 w-4 mr-2" />
                    Transfery
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    setServiceForm(createServiceFormData("other", "Rent-a-car"));
                    setServiceDialogOpen(true);
                  }}>
                    <Car className="h-4 w-4 mr-2" />
                    Rent-a-car
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    setServiceForm(createServiceFormData("other", "Strava"));
                    setServiceDialogOpen(true);
                  }}>
                    <Utensils className="h-4 w-4 mr-2" />
                    Strava
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    setServiceForm(createServiceFormData("other", "Asistence"));
                    setServiceDialogOpen(true);
                  }}>
                    <HeadphonesIcon className="h-4 w-4 mr-2" />
                    Asistence
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    setServiceForm(createServiceFormData("insurance"));
                    setServiceDialogOpen(true);
                  }}>
                    <Shield className="h-4 w-4 mr-2" />
                    Pojištění
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    setServiceForm(createServiceFormData("other"));
                    setServiceDialogOpen(true);
                  }}>
                    <FileText className="h-4 w-4 mr-2" />
                    Ostatní
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Dialog open={serviceDialogOpen} onOpenChange={(open) => {
                setServiceDialogOpen(open);
                if (!open) {
                  resetServiceForm();
                  setServiceFormHistory([]);
                  setServiceFormFuture([]);
                }
              }}>
                <DialogContent className="bg-background max-w-2xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <DialogTitle>{serviceForm.id ? "Upravit službu" : "Přidat službu"}</DialogTitle>
                        <DialogDescription>
                          Zadejte informace o službě
                        </DialogDescription>
                      </div>
                      <div className="flex items-center gap-1 mr-6">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={undoServiceForm}
                          disabled={serviceFormHistory.length === 0}
                          title="Zpět (Ctrl+Z)"
                          className="h-8 w-8"
                        >
                          <Undo2 className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={redoServiceForm}
                          disabled={serviceFormFuture.length === 0}
                          title="Vpřed (Ctrl+Shift+Z)"
                          className="h-8 w-8"
                        >
                          <Redo2 className="h-4 w-4" />
                        </Button>
                        {lastDraftSave && (
                          <span className="text-xs text-muted-foreground ml-1">
                            <Save className="h-3 w-3 inline mr-1" />
                            uloženo
                          </span>
                        )}
                      </div>
                    </div>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Typ služby</Label>
                      <Select
                        value={
                          serviceForm.service_type === 'other' 
                            ? (serviceForm.service_name === 'Rent-a-car' ? 'preset-rentacar' 
                              : serviceForm.service_name === 'Strava' ? 'preset-strava'
                              : serviceForm.service_name === 'Asistence' ? 'preset-asistence'
                              : 'other')
                            : serviceForm.service_type
                        }
                        onValueChange={(value: string) => {
                          if (value === 'preset-rentacar') {
                            setServiceForm({ ...serviceForm, service_type: 'other', service_name: 'Rent-a-car' });
                          } else if (value === 'preset-strava') {
                            setServiceForm({ ...serviceForm, service_type: 'other', service_name: 'Strava' });
                          } else if (value === 'preset-asistence') {
                            setServiceForm({ ...serviceForm, service_type: 'other', service_name: 'Asistence' });
                          } else {
                            setServiceForm({ ...serviceForm, service_type: value as any });
                          }
                        }}
                      >
                        <SelectTrigger className="bg-background z-50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          <SelectItem value="flight">
                            <span className="flex items-center gap-2"><Plane className="h-4 w-4" /> Letenka</span>
                          </SelectItem>
                          <SelectItem value="hotel">
                            <span className="flex items-center gap-2"><Hotel className="h-4 w-4" /> Ubytování</span>
                          </SelectItem>
                          <SelectItem value="golf">
                            <span className="flex items-center gap-2"><Navigation className="h-4 w-4" /> Green Fee</span>
                          </SelectItem>
                          <SelectItem value="transfer">
                            <span className="flex items-center gap-2"><Car className="h-4 w-4" /> Transfery</span>
                          </SelectItem>
                          <SelectItem value="preset-rentacar">
                            <span className="flex items-center gap-2"><Car className="h-4 w-4" /> Rent-a-car</span>
                          </SelectItem>
                          <SelectItem value="preset-strava">
                            <span className="flex items-center gap-2"><Utensils className="h-4 w-4" /> Strava</span>
                          </SelectItem>
                          <SelectItem value="preset-asistence">
                            <span className="flex items-center gap-2"><HeadphonesIcon className="h-4 w-4" /> Asistence</span>
                          </SelectItem>
                          <SelectItem value="insurance">
                            <span className="flex items-center gap-2"><Shield className="h-4 w-4" /> Pojištění</span>
                          </SelectItem>
                          <SelectItem value="other">
                            <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> Ostatní</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Flight-specific form */}
                    {serviceForm.service_type === "flight" ? (
                      <>
                        <FlightSegmentForm
                          data={flightFormData}
                          onChange={setFlightFormData}
                        />
                        <FlightAiImport onImport={(data, price, personCount) => {
                          setFlightFormData(data);
                          if (price) setServiceForm(prev => ({ ...prev, price: price.toString() }));
                          if (personCount) setServiceForm(prev => ({ ...prev, person_count: personCount.toString() }));
                        }} />
                      </>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label>{serviceForm.service_type === 'hotel' ? 'Název hotelu *' : 'Název služby *'}</Label>
                          {serviceForm.service_type === 'hotel' ? (
                            <HotelCombobox
                              value={serviceForm.service_name}
                              onChange={(value) => setServiceForm({ ...serviceForm, service_name: value })}
                            />
                          ) : (
                            <ServiceCombobox
                              value={serviceForm.service_name}
                              onChange={(value) => setServiceForm({ ...serviceForm, service_name: value })}
                              serviceType={serviceForm.service_type}
                            />
                          )}
                        </div>

                        {serviceForm.service_type === 'hotel' && (
                          <div className="space-y-2">
                            <Label>Název a Typ pokoje</Label>
                            <Input
                              value={serviceForm.description}
                              onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                              placeholder="např. Deluxe Double Room"
                            />
                          </div>
                        )}

                        {serviceForm.service_type !== 'hotel' && (
                          <div className="space-y-2">
                            <Label>Popis</Label>
                            <Textarea
                              value={serviceForm.description}
                              onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                              placeholder="Detaily služby..."
                              rows={3}
                            />
                          </div>
                        )}

                        {serviceForm.service_type === 'golf' && (
                          <GolfAiImport onImport={handleGolfAiImport} />
                        )}
                      </>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
                      <div className="space-y-2">
                        <Label>Datum</Label>
                        <DateRangePicker
                          dateFrom={serviceForm.start_date}
                          dateTo={serviceForm.end_date}
                          onDateFromChange={(date) => setServiceForm(prev => ({ ...prev, start_date: date }))}
                          onDateToChange={(date) => setServiceForm(prev => ({ ...prev, end_date: date }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Počet osob *</Label>
                        <Input
                          type="number"
                          min="1"
                          value={serviceForm.person_count}
                          onChange={(e) => setServiceForm({ ...serviceForm, person_count: e.target.value })}
                          placeholder="1"
                          className="w-20"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Dodavatel</Label>
                      <SupplierCombobox
                        value={serviceForm.supplier_id}
                        onChange={(value) => setServiceForm({ ...serviceForm, supplier_id: value })}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Prodejní cena (Kč)</Label>
                        <Input
                          type="number"
                          value={serviceForm.price}
                          onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Nákupní cena</Label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            value={serviceForm.cost_price_original || serviceForm.cost_price}
                            onChange={(e) => setServiceForm({ 
                              ...serviceForm, 
                              cost_price_original: e.target.value,
                              cost_price: serviceForm.cost_currency === "CZK" ? e.target.value : ""
                            })}
                            placeholder="0"
                            className="flex-1"
                          />
                          <CurrencySelect
                            value={serviceForm.cost_currency}
                            onChange={(value) => setServiceForm({ 
                              ...serviceForm, 
                              cost_currency: value,
                              cost_price: value === "CZK" ? serviceForm.cost_price_original : ""
                            })}
                            className="w-20 shrink-0"
                          />
                        </div>
                        {serviceForm.cost_currency !== "CZK" && serviceForm.cost_price && (
                          <p className="text-xs text-muted-foreground">
                            ≈ {formatPriceCurrency(parseFloat(serviceForm.cost_price))} (přepočteno)
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setServiceDialogOpen(false)}>
                        Zrušit
                      </Button>
                      <Button 
                        onClick={handleSaveService} 
                        disabled={convertingCurrency || (serviceForm.service_type === "flight" 
                          ? !flightFormData.outbound_segments[0]?.departure || !flightFormData.outbound_segments[0]?.arrival 
                          : !serviceForm.service_name)}
                      >
                        {convertingCurrency ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Přepočítávám...
                          </>
                        ) : serviceForm.id ? "Uložit" : "Přidat"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingServices ? (
              <p className="text-muted-foreground text-center py-8 text-sm">Načítání...</p>
            ) : services.length === 0 ? (
              <p className="text-muted-foreground text-center py-8 text-sm">Zatím nejsou přidány žádné služby</p>
            ) : (
              <div className="space-y-0">
                <div className="overflow-x-auto">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleServiceDragEnd}
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8"></TableHead>
                          <TableHead>Služba</TableHead>
                          <TableHead>Datum</TableHead>
                          <TableHead className="text-center">Osoby</TableHead>
                          <TableHead>Dodavatel</TableHead>
                          <TableHead className="text-right">Cena</TableHead>
                          <TableHead className="text-right">Akce</TableHead>
                        </TableRow>
                      </TableHeader>
                      <SortableContext
                        items={services.map((s) => s.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <TableBody>
                          {services.map((service) => (
                            <SortableServiceRow
                              key={service.id}
                              service={service}
                              onEdit={openEditService}
                              onDelete={handleDeleteService}
                              onDuplicate={handleDuplicateService}
                              getServiceIcon={getServiceIcon}
                              getServiceTypeLabel={getServiceTypeLabel}
                            />
                          ))}
                        </TableBody>
                      </SortableContext>
                    </Table>
                  </DndContext>
                </div>
                
                <div className="flex justify-between items-center p-4 border-t-2 border-primary/20 bg-muted/30">
                  <span className="font-semibold text-sm sm:text-base">Celková cena:</span>
                  <span className="font-bold text-base sm:text-lg text-primary">
                    {formatPriceCurrency(
                      services.reduce((sum, s) => sum + ((s.price || 0) * (s.person_count || 1)), 0)
                    )}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tee Times Editor - show when golf services exist */}
        {services.some(s => s.service_type === 'golf') && (
          <DealTeeTimesEditor
            dealId={deal.id}
            teeTimes={deal.tee_times || []}
            onUpdate={fetchDeal}
          />
        )}
        </div>
      </div>
    </div>
  );
};

export default DealDetail;
