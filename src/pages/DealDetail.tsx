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
import { Save, Trash2, Plus, X, Plane, Hotel, Navigation, Car, Shield, FileText, FileSignature, Edit, ChevronDown, Utensils, HeadphonesIcon, GripVertical, Copy, Pencil, Check, Loader2, Undo2, Redo2, RefreshCw, CheckCircle2, MessageSquare, Download } from "lucide-react";
import { removeDiacritics, translateTitleToEnglish, formatDateDisplay } from "@/lib/utils";
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
import { getServiceTotal, getServiceMultiplier, getServiceCostTotal } from "@/lib/servicePrice";
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
import { HotelAiImport, type ParsedHotelData } from "@/components/HotelAiImport";
import { DealVariants } from "@/components/DealVariants";
import { DealPaymentSchedule } from "@/components/DealPaymentSchedule";
import { DealBulkTravelerImport } from "@/components/DealBulkTravelerImport";
import { DealTeeTimesEditor } from "@/components/DealTeeTimesEditor";
import { ShareOfferButton } from "@/components/ShareOfferButton";
import { CreateVouchersFromDeal } from "@/components/CreateVouchersFromDeal";
import { DealDocumentsSection } from "@/components/DealDocumentsSection";
import { DealSupplierInvoices } from "@/components/DealSupplierInvoices";
import { DealRoomingList } from "@/components/DealRoomingList";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { usePageToolbar } from "@/hooks/usePageToolbar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface DealTraveler {
  id: string;
  client_id: string;
  is_lead_traveler: boolean;
  sort_order?: number;
  order_index?: number;
  clients: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    date_of_birth: string | null;
    title: string | null;
  };
}

interface FlightDetails {
  outbound_segments?: import("@/components/FlightSegmentForm").FlightSegment[];
  return_segments?: import("@/components/FlightSegmentForm").FlightSegment[];
  baggage?: {
    cabin_bag_kg?: number;
    hand_luggage_kg?: number;
    checked_luggage_kg?: number;
  };
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
  service_type: "flight" | "hotel" | "golf" | "transfer" | "insurance" | "meal" | "other";
  service_name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  price: number | null;
  price_currency: string | null;
  cost_price: number | null;
  cost_currency: string | null;
  cost_price_original: number | null;
  supplier_id: string | null;
  person_count: number | null;
  quantity: number | null;
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
            <p className="font-medium text-sm break-words">{service.service_name}</p>
            <p className="text-xs text-muted-foreground">
              {getServiceTypeLabel(service.service_type)}
              {service.service_type === 'hotel' && service.description && (
                <span> · {service.description}</span>
              )}
              {service.service_type === 'golf' && (service.details as any)?.tee_time && (
                <span> · {(service.details as any).tee_time}</span>
              )}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-xs whitespace-nowrap">
        {service.start_date && (() => { const p = service.start_date.split('-'); return p.length === 3 ? `${p[2]}.${p[1]}` : ''; })()}
      </TableCell>
      <TableCell className="text-center text-sm">
        {service.person_count || 1}
      </TableCell>
      <TableCell className="text-center text-sm">
        {service.quantity || 1}
      </TableCell>
      <TableCell className="text-xs truncate max-w-[100px]">
        {service.suppliers?.name || '-'}
      </TableCell>
      <TableCell className="text-right">
        <div className="text-sm font-medium">
        {service.price ? formatPriceCurrency(getServiceTotal(service), service.price_currency || "CZK") : '-'}
        </div>
        {service.price && getServiceMultiplier(service) > 1 && (
          <div className="text-xs text-muted-foreground">
            {formatPriceCurrency(service.price, service.price_currency || "CZK")} × {getServiceMultiplier(service)}
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
  status: "inquiry" | "quote" | "approved" | "confirmed" | "cancelled" | "completed" | "dispatched";
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
  currency: string | null;
  destination?: {
    id: string;
    name: string;
  };
  deal_travelers: DealTraveler[];
}

// Sortable traveler row component
const SortableTravelerRow = ({
  traveler,
  index,
  onRemove,
}: {
  traveler: DealTraveler;
  index: number;
  onRemove: (id: string, isLead: boolean) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: traveler.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const dob = traveler.clients.date_of_birth
    ? (() => { try { return format(new Date(traveler.clients.date_of_birth!), "dd.MM.yyyy"); } catch { return ""; } })()
    : null;

  return (
    <TableRow ref={setNodeRef} style={style} className="hover:bg-muted/50">
      <TableCell className="w-6 pr-0">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground w-6 text-center">{index + 1}.</TableCell>
      <TableCell className="font-medium text-sm">
        {traveler.clients.first_name} {traveler.clients.last_name}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {dob || <span className="text-muted-foreground/40">—</span>}
      </TableCell>
      <TableCell className="text-right">
        {!traveler.is_lead_traveler && (
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onRemove(traveler.id, traveler.is_lead_traveler)}>
            <X className="h-3 w-3" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
};



const ClientOfferResponseCard = ({ dealId }: { dealId: string }) => {
  const [response, setResponse] = useState<{
    client_name: string | null;
    comment: string | null;
    created_at: string;
  } | null>(null);

  useEffect(() => {
    const fetchResponse = async () => {
      const { data } = await supabase
        .from('offer_responses')
        .select('client_name, comment, created_at')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setResponse(data);
    };
    fetchResponse();
  }, [dealId]);

  if (!response) return null;

  return (
    <Card className="border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-5 w-5" />
          Odpověď klienta
        </CardTitle>
        <CardDescription>
          {response.client_name} · {format(new Date(response.created_at), "d.M.yyyy HH:mm")}
        </CardDescription>
      </CardHeader>
      {response.comment && (
        <CardContent className="pt-0">
          <div className="flex gap-2 items-start">
            <MessageSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm whitespace-pre-wrap">{response.comment}</p>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

const DealDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deal, setDeal] = useState<Deal | null>(null);
  const [services, setServices] = useState<DealService[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [paymentRefreshKey, setPaymentRefreshKey] = useState(0);
  const [dealVariants, setDealVariants] = useState<{ id: string; variant_name: string; is_selected: boolean }[]>([]);

  // Dialog states
  const [travelerDialogOpen, setTravelerDialogOpen] = useState(false);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [newTravelerId, setNewTravelerId] = useState("");
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [hotelConfirmOpen, setHotelConfirmOpen] = useState(false);
  const [hotelConfirmResolver, setHotelConfirmResolver] = useState<{ resolve: (v: boolean) => void } | null>(null);
  const [duplicatePersonCount, setDuplicatePersonCount] = useState("1");
  const [duplicating, setDuplicating] = useState(false);

  // Contract exists confirmation dialog
  const [contractExistsDialogOpen, setContractExistsDialogOpen] = useState(false);
  const [existingContractsForConfirm, setExistingContractsForConfirm] = useState<Array<{ id: string; contract_number: string; status: string }>>([]);

  // Contract sync dialog state
  const [contractSyncDialogOpen, setContractSyncDialogOpen] = useState(false);
  const [linkedContracts, setLinkedContracts] = useState<Array<{ id: string; contract_number: string; status: string }>>([]);
  const [syncingContract, setSyncingContract] = useState(false);

  // Voucher sync dialog state
  const [voucherSyncDialogOpen, setVoucherSyncDialogOpen] = useState(false);
  const [linkedVouchers, setLinkedVouchers] = useState<Array<{ id: string; voucher_code: string; client_name: string }>>([]);
  const [syncingVoucher, setSyncingVoucher] = useState(false);
  const [pendingVoucherSync, setPendingVoucherSync] = useState<Array<{ id: string; voucher_code: string; client_name: string }> | null>(null);
  
  // Service form state
   const [serviceForm, setServiceForm] = useState({
    id: "",
    service_type: "hotel" as DealService["service_type"],
    service_name: "",
    description: "",
    tee_time: "",
    start_date: undefined as Date | undefined,
    end_date: undefined as Date | undefined,
    price: "",
    price_currency: "CZK",
    cost_price: "",
    cost_currency: "CZK",
    cost_price_original: "",
    supplier_id: "",
    person_count: "1",
    person_count_unit: "",
    quantity: "1",
    price_mode: "per_person" as "per_person" | "per_service",
    price_manually_set: false,
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
  
  // Derive deal's selling currency from services (or fallback to deal.currency)
  const dealCurrency = services.find(s => s.price_currency && s.price_currency !== "CZK")?.price_currency
    || services.find(s => s.price_currency)?.price_currency
    || deal?.currency
    || "CZK";
  
  // Store original flight details to preserve all segments
  const [originalFlightDetails, setOriginalFlightDetails] = useState<any>(null);

  // Form state
  const handleSaveRef = useRef<() => Promise<void>>();
  const [status, setStatus] = useState<"inquiry" | "quote" | "approved" | "confirmed" | "cancelled" | "completed" | "dispatched">("inquiry");
  const [destinationId, setDestinationId] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [totalPrice, setTotalPrice] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositPaid, setDepositPaid] = useState(false);
  const [notes, setNotes] = useState("");
  const [leadTravelerId, setLeadTravelerId] = useState("");
  const [leadTravelerIsFirstPassenger, setLeadTravelerIsFirstPassenger] = useState(true);
  const [discountAmount, setDiscountAmount] = useState("");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [dealName, setDealName] = useState("");
  const [discountNote, setDiscountNote] = useState("");
  const [adjustmentNote, setAdjustmentNote] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
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

  // Listen for deal-updated events (e.g. from auto-send toggle)
  useEffect(() => {
    const handler = () => fetchDeal();
    window.addEventListener("deal-updated", handler);
    return () => window.removeEventListener("deal-updated", handler);
  }, []);

  // When contract sync dialog closes, open pending voucher sync dialog
  useEffect(() => {
    if (!contractSyncDialogOpen && pendingVoucherSync) {
      setLinkedVouchers(pendingVoucherSync);
      setVoucherSyncDialogOpen(true);
      setPendingVoucherSync(null);
    }
  }, [contractSyncDialogOpen, pendingVoucherSync]);

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

  // Auto-calculate quantity (days) for meal service when dates change
  useEffect(() => {
    if (serviceForm.service_type === 'meal' && serviceForm.start_date && serviceForm.end_date) {
      const diff = Math.round((serviceForm.end_date.getTime() - serviceForm.start_date.getTime()) / (1000 * 60 * 60 * 24));
      if (diff > 0) {
        setServiceForm(prev => ({ ...prev, quantity: diff.toString() }));
      }
    }
  }, [serviceForm.service_type, serviceForm.start_date, serviceForm.end_date]);

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
            order_index,
            clients(id, first_name, last_name, email, date_of_birth, title)
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;

      // Sort travelers by order_index
      data.deal_travelers.sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0));

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
      setShareToken((data as any).share_token || null);
      
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
        setLeadTravelerIsFirstPassenger(true);
      } else if ((data as any).lead_client_id) {
        // Orderer is set but not a traveler (checkbox was unchecked)
        setLeadTravelerId((data as any).lead_client_id);
        setLeadTravelerIsFirstPassenger(false);
      }

      // Fetch variant count
      const { data: variantsData } = await supabase
        .from("deal_variants")
        .select("id, variant_name, is_selected")
        .eq("deal_id", id)
        .order("created_at", { ascending: true });
      setDealVariants(variantsData || []);
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
      return sum + getServiceTotal(service);
    }, 0);
    
    const finalTotal = servicesTotal - discount + adjustment;
    setTotalPrice(finalTotal.toString());
    return finalTotal;
  };

  // Sync first/last service date and total price into deal basic info
  const syncDealDatesFromServices = async (servicesList: DealService[], newTotal: number) => {
    if (!deal?.id) return;
    
    const datesWithValues = servicesList
      .map(s => s.start_date)
      .filter((d): d is string => !!d)
      .sort();
    const endDatesWithValues = servicesList
      .map(s => s.end_date || s.start_date)
      .filter((d): d is string => !!d)
      .sort();

    const firstDate = datesWithValues[0] || null;
    const lastDate = endDatesWithValues[endDatesWithValues.length - 1] || null;

    if (firstDate) setStartDate(new Date(firstDate));
    if (lastDate) setEndDate(new Date(lastDate));

    await supabase
      .from("deals")
      .update({
        start_date: firstDate,
        end_date: lastDate,
        total_price: newTotal,
      })
      .eq("id", deal.id);
  };

  // Calculate total cost price from services (already in CZK)
  const totalCostPrice = services.reduce((sum, service) => {
    return sum + getServiceCostTotal(service);
  }, 0);

  // Derive CZK exchange rate from cost data for converting selling prices
  const derivedCzkRate = (() => {
    for (const s of services) {
      if (s.cost_price_original && s.cost_price_original > 0 && s.cost_currency && s.cost_currency !== "CZK") {
        return (s.cost_price || 0) / s.cost_price_original;
      }
    }
    return null;
  })();

  // Calculate total selling price in CZK
  const totalSellingPriceCzk = services.reduce((sum, service) => {
    const serviceTotal = getServiceTotal(service);
    const currency = service.price_currency || "CZK";
    if (currency === "CZK" || !derivedCzkRate) {
      return sum + serviceTotal;
    }
    return sum + serviceTotal * derivedCzkRate;
  }, 0);

  // Apply discount and adjustment in CZK
  const discountCzk = (() => {
    const d = parseFloat(discountAmount) || 0;
    const currency = services[0]?.price_currency || "CZK";
    if (currency === "CZK" || !derivedCzkRate) return d;
    return d * derivedCzkRate;
  })();
  const adjustmentCzk = (() => {
    const a = parseFloat(adjustmentAmount) || 0;
    const currency = services[0]?.price_currency || "CZK";
    if (currency === "CZK" || !derivedCzkRate) return a;
    return a * derivedCzkRate;
  })();

  const totalSellingPriceCzkFinal = totalSellingPriceCzk - discountCzk + adjustmentCzk;

  // Calculate profit in CZK
  const profit = totalSellingPriceCzkFinal - totalCostPrice;

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

  // Sync deal_services → selected variant's deal_variant_services
  const syncServicesToSelectedVariant = async () => {
    if (!id) return;
    try {
      // Find the selected variant for this deal
      const { data: selectedVariant } = await supabase
        .from("deal_variants")
        .select("id")
        .eq("deal_id", id)
        .eq("is_selected", true)
        .maybeSingle();

      if (!selectedVariant) return;

      // Get current deal services
      const { data: dealServices } = await supabase
        .from("deal_services")
        .select("*")
        .eq("deal_id", id)
        .order("order_index", { ascending: true });

      // Delete existing variant services
      await supabase
        .from("deal_variant_services")
        .delete()
        .eq("variant_id", selectedVariant.id);

      // Copy deal services to variant
      if (dealServices && dealServices.length > 0) {
        const variantServices = dealServices.map((ds) => ({
          variant_id: selectedVariant.id,
          service_type: ds.service_type,
          service_name: ds.service_name,
          description: ds.description,
          supplier_id: ds.supplier_id,
          start_date: ds.start_date,
          end_date: ds.end_date,
          person_count: ds.person_count,
          quantity: ds.quantity || 1,
          price: ds.price,
          price_currency: ds.price_currency || "CZK",
          cost_price: ds.cost_price,
          cost_currency: ds.cost_currency || "CZK",
          cost_price_original: ds.cost_price_original,
          details: ds.details,
          order_index: ds.order_index,
        }));

        await supabase.from("deal_variant_services").insert(variantServices as any);
      }
    } catch (error) {
      console.error("Error syncing services to selected variant:", error);
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
      
      // Sync to selected variant
      await syncServicesToSelectedVariant();
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

  const handleTravelerDragEnd = async (event: DragEndEvent) => {
    if (!deal) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = deal.deal_travelers.findIndex(t => t.id === active.id);
    const newIndex = deal.deal_travelers.findIndex(t => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(deal.deal_travelers, oldIndex, newIndex);
    setDeal({ ...deal, deal_travelers: reordered });
    // Save order to DB
    await Promise.all(
      reordered.map((t, idx) =>
        supabase.from("deal_travelers").update({ order_index: idx }).eq("id", t.id)
      )
    );
  };

  const handleExportTravelersPdf = () => {
    if (!deal) return;
    const travelers = deal.deal_travelers;
    const dealNum = deal.deal_number || "";
    
    const rows = travelers.map((t, idx) => {
      const title = translateTitleToEnglish(t.clients?.title || null);
      const firstName = removeDiacritics(t.clients?.first_name || "");
      const lastName = removeDiacritics(t.clients?.last_name || "");
      const dob = t.clients?.date_of_birth ? formatDateDisplay(t.clients.date_of_birth) : "-";
      return `
        <tr>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${idx + 1}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${title}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${firstName}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${lastName}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${dob}</td>
        </tr>`;
    }).join("");
    
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/><title>Passenger List - ${dealNum}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 40px; }
  h2 { font-size: 16px; margin-bottom: 4px; }
  p { margin: 0 0 16px; color: #555; font-size: 11px; }
  table { border-collapse: collapse; width: 100%; }
  th { background: #f4f4f4; padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 2px solid #ddd; }
</style>
</head><body>
<h2>Passenger List</h2>
<p>Deal: ${dealNum} &nbsp;|&nbsp; Total passengers: ${travelers.length}</p>
<table>
  <thead><tr><th>#</th><th>Title</th><th>First Name</th><th>Last Name</th><th>Date of Birth</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`;
    
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.print();
  };

  const handleExportAmadeus = () => {
    if (!deal) return;
    const travelers = deal.deal_travelers;
    const parts = travelers.map(t => {
      const title = translateTitleToEnglish(t.clients?.title || null);
      // Amadeus title code: MR / MRS / MISS / MSTR
      let titleCode = "MR";
      if (title === "Mrs." || title === "Ms.") titleCode = "MRS";
      const lastName = removeDiacritics((t.clients?.last_name || "").toUpperCase());
      const firstName = removeDiacritics((t.clients?.first_name || "").toUpperCase());
      return `NM1${lastName}/${firstName} ${titleCode}`;
    });
    const result = parts.join("1");
    
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"/><title>Amadeus NM - ${deal.deal_number}</title>
<style>
  body { font-family: monospace; font-size: 14px; color: #111; margin: 40px; }
  h2 { font-family: Arial, sans-serif; font-size: 16px; margin-bottom: 8px; }
  p { font-family: Arial, sans-serif; font-size: 11px; color: #555; margin: 0 0 16px; }
  .cmd { background: #f0f0f0; padding: 16px 20px; border-radius: 4px; white-space: pre-wrap; word-break: break-all; cursor: pointer; border: 1px solid #ddd; }
  .hint { font-family: Arial, sans-serif; font-size: 11px; color: #888; margin-top: 8px; }
</style>
</head><body>
<h2>Amadeus NM Command</h2>
<p>Deal: ${deal.deal_number} &nbsp;|&nbsp; Passengers: ${travelers.length}</p>
<div class="cmd" onclick="navigator.clipboard.writeText(this.innerText)">${result}</div>
<p class="hint">Click to copy to clipboard</p>
</body></html>`);
    win.document.close();
  };

  const autoGeneratePayments = async (dealId: string, totalPrice: number) => {
    try {
      // Fetch all existing payments for this deal
      const { data: existingPayments, error: checkError } = await supabase
        .from("deal_payments")
        .select("*")
        .eq("deal_id", dealId);
      
      if (checkError) throw checkError;
      
      // If no payments exist yet, create default schedule
      if (!existingPayments || existingPayments.length === 0) {
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
        return;
      }
      
      // Payments exist — recalculate all unpaid proportionally, keep paid locked
      const paidSum = existingPayments
        .filter(p => p.paid)
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      const unpaidPayments = existingPayments.filter(p => !p.paid);
      if (unpaidPayments.length === 0) return;

      const remaining = Math.max(0, totalPrice - paidSum);
      const unpaidTotal = unpaidPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

      const updates: PromiseLike<any>[] = [];
      if (unpaidTotal > 0) {
        let distributed = 0;
        unpaidPayments.forEach((p, idx) => {
          let newAmount: number;
          if (idx === unpaidPayments.length - 1) {
            newAmount = Math.max(0, remaining - distributed);
          } else {
            newAmount = Math.round((p.amount || 0) / unpaidTotal * remaining);
            distributed += newAmount;
          }
          if (Math.abs((p.amount || 0) - newAmount) > 0.01) {
            updates.push(
              supabase.from("deal_payments").update({ amount: newAmount }).eq("id", p.id).then()
            );
          }
        });
      } else {
        const last = unpaidPayments[unpaidPayments.length - 1];
        if (Math.abs((last.amount || 0) - remaining) > 0.01) {
          updates.push(
            supabase.from("deal_payments").update({ amount: remaining }).eq("id", last.id).then()
          );
        }
      }
      await Promise.all(updates);
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
        baggage: flightFormData.baggage || undefined,
      };
    } else if (!serviceForm.service_name) {
      return;
    }

    const golfTeeTimeDetails = serviceForm.service_type === 'golf' && serviceForm.tee_time
      ? { tee_time: serviceForm.tee_time }
      : {};

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
            price_currency: serviceForm.price_currency,
            cost_price: costPriceCzk,
            cost_currency: serviceForm.cost_currency,
            cost_price_original: costPriceOriginal,
            supplier_id: serviceForm.supplier_id || null,
            person_count: serviceForm.person_count ? parseInt(serviceForm.person_count) : 1,
            quantity: serviceForm.quantity ? parseInt(serviceForm.quantity) : 1,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            details: { ...(flightDetails || {}), ...golfTeeTimeDetails, person_count_unit: serviceForm.person_count_unit, price_mode: serviceForm.price_mode } as any,
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
            price_currency: serviceForm.price_currency,
            cost_price: costPriceCzk,
            cost_currency: serviceForm.cost_currency,
            cost_price_original: costPriceOriginal,
            supplier_id: serviceForm.supplier_id || null,
            person_count: serviceForm.person_count ? parseInt(serviceForm.person_count) : 1,
            quantity: serviceForm.quantity ? parseInt(serviceForm.quantity) : 1,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            details: { ...(flightDetails || {}), ...golfTeeTimeDetails, person_count_unit: serviceForm.person_count_unit, price_mode: serviceForm.price_mode } as any,
          } as any]);

        if (error) throw error;
      }

      // Auto-sync golf tee time to deal.tee_times
      if (serviceForm.service_type === 'golf') {
        const startDateStr = formatDateForDB(serviceForm.start_date);
        const golfers = serviceForm.person_count ? parseInt(serviceForm.person_count) : 1;
        
        const newTeeTime = {
          date: startDateStr,
          club: finalServiceName,
          time: serviceForm.tee_time || '',
          golfers: golfers.toString(),
        };

        const existingTeeTimes: any[] = deal.tee_times || [];
        
        // If editing existing service, replace the matching tee time entry; otherwise add
        let updatedTeeTimes: any[];
        if (serviceForm.id) {
          const existingService = services.find(s => s.id === serviceForm.id);
          const existingDate = existingService?.start_date;
          const existingClub = existingService?.service_name;
          // Replace matching entry or append
          const idx = existingTeeTimes.findIndex(t => t.club === existingClub && t.date === existingDate);
          if (idx >= 0) {
            updatedTeeTimes = [...existingTeeTimes];
            updatedTeeTimes[idx] = newTeeTime;
          } else {
            updatedTeeTimes = [...existingTeeTimes, newTeeTime];
          }
        } else {
          updatedTeeTimes = [...existingTeeTimes, newTeeTime];
        }

        // Sort by date
        updatedTeeTimes.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

        await supabase
          .from("deals")
          .update({ tee_times: updatedTeeTimes } as any)
          .eq("id", deal.id);
      }

      // Auto-create hotel template if adding a new hotel service
      if (!serviceForm.id && serviceForm.service_type === "hotel" && finalServiceName) {
        // Check if hotel_templates record already exists
        const { data: existingHotel } = await supabase
          .from("hotel_templates")
          .select("id")
          .ilike("name", finalServiceName)
          .maybeSingle();

        if (!existingHotel) {
          // Ask for confirmation before creating
          const confirmed = await new Promise<boolean>((resolve) => {
            setHotelConfirmResolver({ resolve });
            setHotelConfirmOpen(true);
          });

          if (confirmed) {
            const slug = finalServiceName.trim().toLowerCase()
              .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
              .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

            const { data: newHotel, error: hotelErr } = await supabase
              .from("hotel_templates")
              .insert({ name: finalServiceName.trim(), slug })
              .select("id")
              .single();

            if (!hotelErr && newHotel) {
              toast({ title: "Hotel vytvořen", description: `Šablona "${finalServiceName}" byla vytvořena v databázi hotelů` });

              // Trigger AI enrichment in the background (don't await)
              (async () => {
                try {
                  const { data: aiData, error: aiErr } = await supabase.functions.invoke("suggest-hotel-destination", {
                    body: { hotelName: finalServiceName },
                  });
                  if (aiErr || aiData?.error) {
                    console.error("AI enrichment error:", aiErr || aiData?.error);
                    return;
                  }

                  const updatePayload: Record<string, any> = {};
                  if (aiData.subtitle) updatePayload.subtitle = aiData.subtitle;
                  if (aiData.golf_courses) updatePayload.golf_courses = aiData.golf_courses;
                  if (aiData.golf_courses_data?.length > 0) updatePayload.golf_courses_data = aiData.golf_courses_data;
                  if (aiData.highlights?.length > 0) updatePayload.highlights = aiData.highlights;

                  if (aiData.destination) {
                    const { data: destinations } = await supabase
                      .from("destinations")
                      .select("id, name")
                      .ilike("name", aiData.destination);
                    const match = destinations?.find(
                      (d: any) => d.name.toLowerCase() === aiData.destination.toLowerCase()
                    );
                    if (match) {
                      updatePayload.destination_id = match.id;
                    }
                  }

                  if (Object.keys(updatePayload).length > 0) {
                    await supabase
                      .from("hotel_templates")
                      .update(updatePayload)
                      .eq("id", newHotel.id);
                    console.log("Hotel template enriched with AI data:", Object.keys(updatePayload));
                  }
                } catch (e) {
                  console.error("Background hotel enrichment failed:", e);
                }
              })();
            }
          }
        }
      }

      toast({
        title: "Úspěch",
        description: serviceForm.id ? "Služba byla aktualizována" : "Služba byla přidána",
      });

      setServiceDialogOpen(false);
      resetServiceForm();
      
      // Re-fetch services to get fresh data
      const { data: freshServices, error: fetchErr } = await supabase
        .from("deal_services")
        .select(`*, suppliers(name)`)
        .eq("deal_id", deal.id)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true });
      
      if (!fetchErr && freshServices) {
        setServices(freshServices.map(s => ({ ...s, details: s.details as FlightDetails | null })));
      }
      
      // Recalculate total price from fresh data
      const servicesForCalc = freshServices || services;
      const discount = parseFloat(discountAmount) || 0;
      const adjustment = parseFloat(adjustmentAmount) || 0;
      const servicesTotal = servicesForCalc.reduce((sum, s: any) => sum + getServiceTotal(s), 0);
      const newTotal = servicesTotal - discount + adjustment;
      setTotalPrice(newTotal.toString());
      
      // Update in database (including syncing dates from services)
      if (deal?.id) {
        const freshServicesList = (freshServices || services).map(s => ({ ...s, details: s.details as FlightDetails | null }));
        await syncDealDatesFromServices(freshServicesList, newTotal);
        
        // Auto-generate payment schedule and refresh
        if (newTotal > 0) {
          await autoGeneratePayments(deal.id, newTotal);
          setPaymentRefreshKey(k => k + 1);
        }
        
        // Re-fetch deal to sync all state
        fetchDeal();
        
        // Sync to selected variant
        await syncServicesToSelectedVariant();
        
        // Check for linked contracts and offer sync
        await checkAndOfferContractSync();
        // Check for linked vouchers and offer sync
        await checkAndOfferVoucherSync();
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
        price_currency: tt.currency || "CZK",
        cost_price: 0,
        cost_currency: tt.currency || "CZK",
        cost_price_original: null,
        supplier_id: supplierId,
        person_count: parseInt(tt.golfers) || deal.deal_travelers?.length || 1,
        quantity: 1,
        order_index: 0,
      }));

      const { error } = await supabase.from("deal_services").insert(servicesToInsert as any);
      if (error) throw error;

      // Save structured tee times to deal (with golfers count)
      const structuredTeeTimes = teeTimes
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
        .map(tt => ({
          date: tt.date || null,
          club: tt.club || '',
          time: tt.time || '',
          golfers: (parseInt(tt.golfers) || deal.deal_travelers?.length || 1).toString(),
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
      
      // Sync to selected variant
      await syncServicesToSelectedVariant();
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
      
      // Update in database (including syncing dates from remaining services)
      if (deal?.id) {
        await syncDealDatesFromServices(remainingServices, newTotal);
        
        if (newTotal > 0) {
          await autoGeneratePayments(deal.id, newTotal);
          setPaymentRefreshKey(k => k + 1);
        }
        fetchDeal();
        
        // Sync to selected variant
        await syncServicesToSelectedVariant();
        
        // Check for linked contracts and offer sync
        await checkAndOfferContractSync();
        // Check for linked vouchers and offer sync
        await checkAndOfferVoucherSync();
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
          price_currency: (service as any).price_currency || "CZK",
          cost_price: service.cost_price,
          cost_currency: (service as any).cost_currency || "CZK",
          cost_price_original: (service as any).cost_price_original ?? null,
          supplier_id: service.supplier_id || null,
          person_count: service.person_count || 1,
          quantity: service.quantity || 1,
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
        
        if (newTotal > 0) {
          await autoGeneratePayments(deal.id, newTotal);
          setPaymentRefreshKey(k => k + 1);
        }
        fetchDeal();
        
        // Sync to selected variant
        await syncServicesToSelectedVariant();
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
  ): typeof serviceForm => ({
    id: "",
    service_type: serviceType,
    service_name: serviceName,
    description: "",
    tee_time: "",
    start_date: startDate,
    end_date: endDate,
    price: "",
    price_currency: "CZK",
    cost_price: "",
    cost_currency: "CZK",
    cost_price_original: "",
    supplier_id: "",
    person_count: (deal?.deal_travelers?.length || 1).toString(),
    person_count_unit: "",
    quantity: "1",
    price_mode: "per_person" as "per_person" | "per_service",
    price_manually_set: false,
    ...overrides,
  });

  const resetServiceForm = () => {
    setServiceForm({
      id: "",
      service_type: "hotel",
      service_name: "",
      description: "",
      tee_time: "",
      start_date: undefined,
      end_date: undefined,
      price: "",
      price_currency: "CZK",
      cost_price: "",
      cost_currency: "CZK",
      cost_price_original: "",
      supplier_id: "",
      person_count: "1",
      person_count_unit: "",
      quantity: "1",
      price_mode: "per_person",
      price_manually_set: false,
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

      setFlightFormData({ outbound_segments: outSegs, return_segments: retSegs, is_one_way: isOneWay, baggage: details.baggage || undefined });
    } else {
      resetFlightForm();
    }
    
    const serviceAny = service as any;
    setServiceForm({
      id: service.id,
      service_type: service.service_type,
      service_name: service.service_name,
      description: service.description || "",
      tee_time: (service.details as any)?.tee_time || "",
      start_date: service.start_date ? new Date(service.start_date) : undefined,
      end_date: service.end_date ? new Date(service.end_date) : undefined,
      price: service.price?.toString() || "",
      price_currency: service.price_currency || "CZK",
      cost_price: service.cost_price?.toString() || "",
      cost_currency: serviceAny.cost_currency || "CZK",
      cost_price_original: serviceAny.cost_price_original?.toString() || "",
      supplier_id: service.supplier_id || "",
      person_count: service.person_count?.toString() || "1",
      person_count_unit: (service.details as any)?.person_count_unit?.toString() || "",
      quantity: (service.quantity || 1).toString(),
      price_mode: (service.details as any)?.price_mode || "per_person",
      price_manually_set: true, // Existing service - don't auto-calculate
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
      case "meal": return <Utensils className="h-4 w-4" />;
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
      case "meal": return "Strava";
      case "other": return "Ostatní";
    }
  };

  const handleSave = async () => {
    if (!deal) return;

    setSaving(true);
    try {
      // Build auto-generated deal name
      // Format: D-RRNNNN [první cestující] ISO Hotel DD-MM-YY (objednatel)
      const baseNumber = deal.deal_number.match(/^D-\d{6}/)?.[0] || "";
      let autoName = baseNumber;

      // First traveler (lowest order_index)
      const sortedTravelers = [...deal.deal_travelers].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
      const firstTraveler = sortedTravelers[0];

      // Find orderer: prefer traveler with is_lead_traveler, fallback to leadTravelerId
      const ordererFromTravelers = deal.deal_travelers.find(t => t.is_lead_traveler)
        || deal.deal_travelers.find(t => t.client_id === leadTravelerId);

      // If orderer is not among travelers, fetch their name from clients table
      let ordererName: string | null = null;
      if (ordererFromTravelers?.clients) {
        ordererName = `${ordererFromTravelers.clients.first_name} ${ordererFromTravelers.clients.last_name}`;
      } else if (leadTravelerId && !leadTravelerIsFirstPassenger) {
        const { data: ordererClient } = await supabase
          .from("clients")
          .select("first_name, last_name")
          .eq("id", leadTravelerId)
          .single();
        if (ordererClient) {
          ordererName = `${ordererClient.first_name} ${ordererClient.last_name}`;
        }
      }

      // First traveler name right after base number
      if (firstTraveler?.clients) {
        autoName += ` ${firstTraveler.clients.first_name} ${firstTraveler.clients.last_name}`;
      }

      // Country code from destination
      if (destinationId) {
        const { data: destData } = await supabase
          .from("destinations")
          .select("country_id, countries(iso_code)")
          .eq("id", destinationId)
          .single();
        if (destData?.countries) {
          const cc = (destData.countries as any).iso_code;
          if (cc) autoName += ` ${cc}`;
        }
      }

      // Hotel name from services
      const hotelService = services.find(s => s.service_type === "hotel");
      if (hotelService?.service_name) {
        autoName += ` ${hotelService.service_name}`;
      }

      // Start date in DD-MM-YY format
      if (startDate) {
        autoName += ` ${format(startDate, "dd-MM-yy")}`;
      }

      // Orderer in parentheses after date (only if different from first traveler)
      const ordererClientId = ordererFromTravelers?.client_id || leadTravelerId;
      const firstTravelerClientId = firstTraveler?.client_id;
      if (ordererName && ordererClientId !== firstTravelerClientId) {
        autoName += ` (${ordererName})`;
      }

      const finalName = autoName.trim() || dealName || null;
      setDealName(finalName || "");

      // Update deal
      const { error: dealError } = await supabase
        .from("deals")
        .update({
          name: finalName,
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
          lead_client_id: leadTravelerId || null,
        } as any)
        .eq("id", deal.id);

      if (dealError) throw dealError;

      // Update lead traveler if changed
      if (leadTravelerId) {
        // Remove old lead traveler status from ALL travelers
        await supabase
          .from("deal_travelers")
          .update({ is_lead_traveler: false })
          .eq("deal_id", deal.id);

        // Check if lead traveler already exists in travelers list
        const { data: existingTraveler } = await supabase
          .from("deal_travelers")
          .select()
          .eq("deal_id", deal.id)
          .eq("client_id", leadTravelerId)
          .maybeSingle();

        if (leadTravelerIsFirstPassenger) {
          // Add or update as lead traveler in the list
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
                order_index: 0,
              });
          }
        } else {
          // Not a traveler – remove from list if present
          if (existingTraveler) {
            await supabase
              .from("deal_travelers")
              .delete()
              .eq("deal_id", deal.id)
              .eq("client_id", leadTravelerId);
          }
        }
      }

      toast({
        title: "Úspěch",
        description: "Obchodní případ byl aktualizován",
      });

      fetchDeal();
      
      // Check for linked contracts and offer sync
      await checkAndOfferContractSync();
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

  const checkAndOfferVoucherSync = async () => {
    if (!deal) return;
    try {
      const { data: vouchers, error } = await supabase
        .from("vouchers")
        .select("id, voucher_code, client_name")
        .eq("deal_id", deal.id);
      if (error || !vouchers || vouchers.length === 0) return;
      setLinkedVouchers(vouchers);
      // If contract sync dialog is open, queue voucher sync for after it closes
      setPendingVoucherSync(vouchers);
      if (!contractSyncDialogOpen) {
        setVoucherSyncDialogOpen(true);
        setPendingVoucherSync(null);
      }
    } catch (e) {
      console.error("Error checking linked vouchers:", e);
    }
  };

  const handleSyncToVouchers = async () => {
    if (!deal || linkedVouchers.length === 0) return;
    setSyncingVoucher(true);
    try {
      // Build translated services list for vouchers - reuse existing voucher services structure
      // We'll just update tee_times and notify; full service re-translation is complex
      // For now: update tee_times on all linked vouchers
      for (const voucher of linkedVouchers) {
        await supabase
          .from("vouchers")
          .update({ tee_times: deal.tee_times || [] } as any)
          .eq("id", voucher.id);
      }
      toast({
        title: "Synchronizováno",
        description: `Tee times byly aktualizovány v ${linkedVouchers.length} voucherech`,
      });
    } catch (error) {
      console.error("Error syncing to vouchers:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se synchronizovat vouchery",
        variant: "destructive",
      });
    } finally {
      setSyncingVoucher(false);
      setVoucherSyncDialogOpen(false);
    }
  };

  // Keep ref updated so toolbar always calls latest version
  handleSaveRef.current = handleSave;

  const checkAndOfferContractSync = async () => {
    if (!deal) return;
    try {
      const { data: contracts, error } = await supabase
        .from("travel_contracts")
        .select("id, contract_number, status")
        .eq("deal_id", deal.id);
      
      if (error || !contracts || contracts.length === 0) return;
      
      // Only offer sync for non-cancelled contracts
      const activeContracts = contracts.filter(c => c.status !== "cancelled");
      if (activeContracts.length > 0) {
        setLinkedContracts(activeContracts);
        setContractSyncDialogOpen(true);
      }
    } catch (e) {
      console.error("Error checking linked contracts:", e);
    }
  };

  const handleSyncToContracts = async () => {
    if (!deal || linkedContracts.length === 0) return;
    setSyncingContract(true);
    
    try {
      for (const contract of linkedContracts) {
        // 1. Update contract total_price, deposit_amount, tee_times
        await supabase
          .from("travel_contracts")
          .update({
            total_price: totalPrice ? parseFloat(totalPrice) : 0,
            deposit_amount: depositAmount ? parseFloat(depositAmount) : null,
            tee_times: deal.tee_times || null,
            currency: dealCurrency,
          } as any)
          .eq("id", contract.id);

        // 2. Sync services: delete old contract_service_travelers and recreate
        // First get all travelers on the contract
        const { data: contractData } = await supabase
          .from("travel_contracts")
          .select("client_id")
          .eq("id", contract.id)
          .single();
        
        // Get all deal travelers
        const allTravelerIds = deal.deal_travelers.map(t => t.client_id);
        const travelerIds = allTravelerIds.length > 0 ? allTravelerIds : (contractData?.client_id ? [contractData.client_id] : []);
        
        // Delete existing service assignments
        await supabase
          .from("contract_service_travelers")
          .delete()
          .eq("contract_id", contract.id);
        
        // Create new assignments from current deal services
        if (services.length > 0 && travelerIds.length > 0) {
          const serviceAssignments = services.flatMap(service => 
            travelerIds.map(clientId => ({
              contract_id: contract.id,
              client_id: clientId,
              service_type: service.service_type,
              service_name: service.service_name,
              notes: service.description || null,
            }))
          );
          
          await supabase
            .from("contract_service_travelers")
            .insert(serviceAssignments);
        }

        // 3. Sync payments: delete old and recreate from deal_payments
        await supabase
          .from("contract_payments")
          .delete()
          .eq("contract_id", contract.id);
        
        const { data: dealPayments } = await supabase
          .from("deal_payments")
          .select("*")
          .eq("deal_id", deal.id);
        
        if (dealPayments && dealPayments.length > 0) {
          const contractPayments = dealPayments.map(dp => ({
            contract_id: contract.id,
            payment_type: dp.payment_type,
            amount: dp.amount,
            due_date: dp.due_date,
            notes: dp.notes,
            paid: dp.paid === true,
            paid_at: dp.paid === true ? (dp.paid_at || new Date().toISOString()) : null,
          }));
          
          await supabase
            .from("contract_payments")
            .insert(contractPayments);
        }
      }

      toast({
        title: "Synchronizováno",
        description: `Změny byly propagovány do ${linkedContracts.length} smluv${linkedContracts.length > 1 ? 'y' : ''}`,
      });
    } catch (error) {
      console.error("Error syncing to contracts:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se synchronizovat změny do smlouvy",
        variant: "destructive",
      });
    } finally {
      setSyncingContract(false);
      setContractSyncDialogOpen(false);
    }
  };

  const handleCreateContract = async () => {
    if (!deal) return;

    // Prefer lead_client_id (objednatel), fallback to is_lead_traveler in travelers
    const leadClientId = (deal as any).lead_client_id
      || deal.deal_travelers.find(t => t.is_lead_traveler)?.client_id;
    if (!leadClientId) {
      toast({
        title: "Chyba",
        description: "Obchodní případ musí mít hlavního cestujícího",
        variant: "destructive",
      });
      return;
    }

    // Check if contract(s) already exist for this deal
    const { data: existingContracts } = await supabase
      .from("travel_contracts")
      .select("id, contract_number, status")
      .eq("deal_id", deal.id);

    const activeExisting = (existingContracts || []).filter(c => c.status !== "cancelled");
    if (activeExisting.length > 0) {
      setExistingContractsForConfirm(activeExisting);
      setContractExistsDialogOpen(true);
      return;
    }

    await doCreateContract(leadClientId);
  };

  const doCreateContract = async (clientId: string) => {
    if (!deal) return;
    try {
      const contractTotalPrice = deal.total_price !== null && deal.total_price !== undefined 
        ? Number(deal.total_price) 
        : 0;
      const teeTimes = deal.tee_times?.length > 0 ? deal.tee_times : null;

      const { data: newContract, error } = await supabase
        .from("travel_contracts")
        .insert({
          deal_id: deal.id,
          client_id: clientId,
          total_price: contractTotalPrice,
          deposit_amount: deal.deposit_amount || null,
          status: "draft",
          contract_number: "",
          tee_times: teeTimes,
          currency: dealCurrency || "CZK",
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
          quantity: service.quantity || 1,
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
        return sum + getServiceTotal(service);
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

  const toolbarButtonClass = "h-8 text-xs bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20";

  usePageToolbar(
    deal ? (
      <>
        <Button variant="outline" size="sm" onClick={() => handleSaveRef.current?.()} disabled={saving} className={toolbarButtonClass}>
          <Save className="h-4 w-4" />
          <span className="hidden sm:inline">{saving ? "Ukládám..." : "Uložit"}</span>
        </Button>
        <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              className={toolbarButtonClass}
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
        <Button variant="outline" size="sm" onClick={handleCreateContract} className={toolbarButtonClass}>
          <FileSignature className="h-4 w-4" />
          <span className="hidden sm:inline">Smlouva</span>
        </Button>
        <CreateVouchersFromDeal
          dealId={deal.id}
          services={services}
          clientId={deal.deal_travelers.find(t => t.is_lead_traveler)?.client_id || null}
          clientName={(() => {
            const lead = deal.deal_travelers.find(t => t.is_lead_traveler);
            return lead ? `${lead.clients.first_name} ${lead.clients.last_name}` : "";
          })()}
          teeTimes={deal.tee_times as any}
          onComplete={fetchDeal}
        />
        <ShareOfferButton
          dealId={deal.id}
          shareToken={shareToken}
          onTokenGenerated={setShareToken}
          variants={dealVariants}
          key={`share-${dealVariants.length}`}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleDelete}
          className={`${toolbarButtonClass} hover:bg-destructive hover:text-destructive-foreground`}
        >
          <Trash2 className="h-4 w-4" />
          <span className="hidden sm:inline">Smazat</span>
        </Button>
      </>
    ) : null,
    [deal, saving, duplicateDialogOpen, duplicatePersonCount, duplicating, services, shareToken, dealVariants]
  );

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
                    className="text-heading-1 h-auto py-1 px-2 max-w-md flex-1"
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
                  <h1 className="text-heading-1 text-foreground">
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

        <Tabs defaultValue="info" className="mt-2">
          <TabsList className="mb-4">
            <TabsTrigger value="info">Základní info</TabsTrigger>
            <TabsTrigger value="travelers">Cestující</TabsTrigger>
            <TabsTrigger value="payments">Platební kalendář</TabsTrigger>
            <TabsTrigger value="services">Služby</TabsTrigger>
            <TabsTrigger value="documents">Dokumenty</TabsTrigger>
          </TabsList>

          {/* ── ZÁKLADNÍ INFO ── */}
          <TabsContent value="info" className="space-y-6">
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
                      <SelectItem value="approved">Schváleno</SelectItem>
                      <SelectItem value="confirmed">Potvrzeno</SelectItem>
                      <SelectItem value="dispatched">Odbaveno</SelectItem>
                      <SelectItem value="cancelled">Zrušeno</SelectItem>
                      <SelectItem value="completed">Dokončeno</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Objednatel</Label>
                  <ClientCombobox
                    value={leadTravelerId}
                    onChange={setLeadTravelerId}
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <Checkbox
                      id="lead-is-first"
                      checked={leadTravelerIsFirstPassenger}
                      onCheckedChange={(checked) => setLeadTravelerIsFirstPassenger(!!checked)}
                    />
                    <label htmlFor="lead-is-first" className="text-xs text-muted-foreground cursor-pointer select-none">
                      Je zároveň prvním cestujícím
                    </label>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Destinace</Label>
                  <DestinationCombobox
                    value={destinationId}
                    onValueChange={setDestinationId}
                  />
                </div>

                {/* Hotel & meal info from selected variant services */}
                {(() => {
                  const hotelServices = services.filter(s => s.service_type === 'hotel');
                  if (hotelServices.length === 0) return null;
                  return (
                    <div className={`space-y-1 col-span-2 md:col-span-3`}>
                      {hotelServices.map((hs, idx) => {
                        const details = hs.details as any;
                        const mealPlan = details?.meal_plan || hs.description || '';
                        return (
                          <div key={hs.id} className={`flex items-center gap-3 ${idx > 0 ? 'mt-1' : ''}`}>
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <Hotel className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                              <span className="text-sm font-medium truncate">{hs.service_name}</span>
                              {(hs.quantity || 1) > 1 && (
                                <span className="text-xs text-muted-foreground">({hs.quantity}×)</span>
                              )}
                            </div>
                            {mealPlan && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                                <Utensils className="h-3 w-3" />
                                <span>{mealPlan}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

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
                  />
                </div>
              </div>

              {/* Right side - price summary */}
              <div className="md:w-48 border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-6 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Prodejní cena</Label>
                  <div className="text-title font-bold text-primary">
                    {formatPriceCurrency(totalSellingPriceCzkFinal, "CZK")}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Nákupní cena</Label>
                  <div className="text-lg font-semibold text-muted-foreground">
                    {formatPriceCurrency(totalCostPrice, "CZK")}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Zisk</Label>
                  <div className={`text-title font-bold ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatPriceCurrency(profit, "CZK")}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <DealVariants dealId={deal.id} onVariantSelected={() => { fetchDeal(); fetchServices(); setPaymentRefreshKey(k => k + 1); }} />
          </CardContent>
        </Card>

        {/* Client Offer Response Card */}
        <ClientOfferResponseCard dealId={deal.id} />

          </TabsContent>

          {/* ── CESTUJÍCÍ ── */}
          <TabsContent value="travelers" className="space-y-6">
        <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Cestující ({deal.deal_travelers?.length || 0})</CardTitle>
                  <CardDescription>Správa cestujících v obchodním případu</CardDescription>
                </div>
                <div className="flex gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        <span className="hidden sm:inline">Přidat</span>
                        <ChevronDown className="h-4 w-4 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-background w-52">
                      <DropdownMenuItem onClick={() => { setNewTravelerId(""); setTravelerDialogOpen(true); }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Přidat cestujícího
                      </DropdownMenuItem>
                      <DealBulkTravelerImport
                        dealId={deal.id}
                        existingTravelerIds={deal.deal_travelers.map(t => t.client_id)}
                        onComplete={fetchDeal}
                        trigger={
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <FileText className="h-4 w-4 mr-2" />
                            AI Import
                          </DropdownMenuItem>
                        }
                      />
                      <DropdownMenuItem onClick={handleExportTravelersPdf} disabled={deal.deal_travelers.length === 0}>
                        <FileText className="h-4 w-4 mr-2" />
                        Export do PDF (EN)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleExportAmadeus} disabled={deal.deal_travelers.length === 0}>
                        <Download className="h-4 w-4 mr-2" />
                        Export Amadeus NM
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Dialog open={travelerDialogOpen} onOpenChange={setTravelerDialogOpen}>
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
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTravelerDragEnd}>
                <SortableContext items={deal.deal_travelers.map(t => t.id)} strategy={verticalListSortingStrategy}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-6"></TableHead>
                        <TableHead className="w-6">#</TableHead>
                        <TableHead>Jméno</TableHead>
                        <TableHead>Datum narození</TableHead>
                        <TableHead className="text-right">Akce</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deal.deal_travelers.map((traveler, idx) => (
                        <SortableTravelerRow
                          key={traveler.id}
                          index={idx}
                          traveler={traveler}
                          onRemove={handleRemoveTraveler}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </SortableContext>
              </DndContext>
            </CardContent>
          </Card>

        <DealRoomingList dealId={deal.id} travelers={deal.deal_travelers} />

          </TabsContent>

          {/* ── PLATEBNÍ KALENDÁŘ ── */}
          <TabsContent value="payments" className="space-y-6">
        <DealPaymentSchedule
          key={paymentRefreshKey}
          dealId={deal.id}
          totalPrice={parseFloat(totalPrice) || deal.total_price || 0}
          departureDate={deal.start_date || undefined}
          currency={dealCurrency}
        />



          </TabsContent>

          {/* ── SLUŽBY ── */}
          <TabsContent value="services" className="space-y-6">
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
                    setServiceForm(createServiceFormData("meal", "Strava"));
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
                    <div>
                      <Label>Typ služby *</Label>
                      <Select
                        value={
                          serviceForm.service_type === 'other' 
                            ? (serviceForm.service_name === 'Rent-a-car' ? 'preset-rentacar' 
                              : serviceForm.service_name === 'Asistence' ? 'preset-asistence'
                              : 'other')
                            : serviceForm.service_type
                        }
                        onValueChange={(value: string) => {
                          if (value === 'preset-rentacar') {
                            setServiceForm({ ...serviceForm, service_type: 'other', service_name: 'Rent-a-car' });
                          } else if (value === 'meal') {
                            setServiceForm({ ...serviceForm, service_type: 'meal', service_name: serviceForm.service_name || 'Strava' });
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
                          <SelectItem value="meal">
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
                        <FlightAiImport onImport={(data, price, personCount) => {
                          setFlightFormData(data);
                          if (price) setServiceForm(prev => ({ ...prev, price: price.toString() }));
                          if (personCount) setServiceForm(prev => ({ ...prev, person_count: personCount.toString() }));
                        }} />
                        <FlightSegmentForm
                          data={flightFormData}
                          onChange={setFlightFormData}
                        />
                      </>
                    ) : (
                      <>
                        {serviceForm.service_type === 'hotel' && (
                          <HotelAiImport
                            onImport={(data: ParsedHotelData) => {
                              if (data.hotel_name) setServiceForm(prev => ({ ...prev, service_name: data.hotel_name! }));
                              if (data.room_type) {
                                const desc = data.meal_plan ? `${data.room_type} (${data.meal_plan})` : data.room_type;
                                setServiceForm(prev => ({ ...prev, description: desc }));
                              } else if (data.meal_plan) {
                                setServiceForm(prev => ({ ...prev, description: data.meal_plan! }));
                              }
                              if (data.check_in) setServiceForm(prev => ({ ...prev, start_date: new Date(data.check_in!) }));
                              if (data.check_out) setServiceForm(prev => ({ ...prev, end_date: new Date(data.check_out!) }));
                              if (data.persons) setServiceForm(prev => ({ ...prev, person_count: data.persons!.toString(), quantity: data.persons!.toString() }));
                              if (data.total_price) {
                                if (data.currency && data.currency !== "CZK") {
                                  setServiceForm(prev => ({ ...prev, cost_currency: data.currency!, cost_price_original: data.total_price!.toString(), cost_price: data.total_price!.toString() }));
                                } else {
                                  setServiceForm(prev => ({ ...prev, cost_price: data.total_price!.toString(), cost_price_original: data.total_price!.toString() }));
                                }
                              }
                            }}
                          />
                        )}
                        {serviceForm.service_type === 'golf' && (
                          <GolfAiImport onImport={handleGolfAiImport} />
                        )}
                        <div>
                          <Label>{serviceForm.service_type === 'hotel' ? 'Název hotelu *' : 'Název služby *'}</Label>
                            {serviceForm.service_type === 'hotel' ? (
                            <HotelCombobox
                              value={serviceForm.service_name}
                              onChange={(value) => setServiceForm({ ...serviceForm, service_name: value })}
                              onSelect={() => {
                                setTimeout(() => document.getElementById('deal-service-description')?.focus(), 50);
                              }}
                            />
                          ) : (
                            <ServiceCombobox
                              value={serviceForm.service_name}
                              onChange={(value) => setServiceForm({ ...serviceForm, service_name: value })}
                              serviceType={serviceForm.service_type}
                              onSelect={() => {
                                setTimeout(() => document.getElementById('deal-service-description')?.focus(), 50);
                              }}
                            />
                          )}
                        </div>

                        {serviceForm.service_type === 'hotel' ? (
                          <div>
                            <Label>Název a Typ pokoje</Label>
                            <Input
                              id="deal-service-description"
                              value={serviceForm.description}
                              onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                              placeholder="např. Deluxe Double Room"
                            />
                          </div>
                        ) : serviceForm.service_type === 'golf' ? (
                          <div>
                            <Label>Čas tee time</Label>
                            <Input
                              id="deal-service-description"
                              value={serviceForm.tee_time}
                              onChange={(e) => setServiceForm({ ...serviceForm, tee_time: e.target.value })}
                              placeholder="09:30 - 14:00"
                            />
                          </div>
                        ) : (
                          <div>
                            <Label>Popis</Label>
                            <Textarea
                              id="deal-service-description"
                              value={serviceForm.description}
                              onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                              placeholder="Detaily služby..."
                              rows={3}
                            />
                          </div>
                        )}
                      </>
                    )}

                    <div>
                      <Label>Dodavatel</Label>
                      <SupplierCombobox
                        value={serviceForm.supplier_id}
                        onChange={(value) => setServiceForm({ ...serviceForm, supplier_id: value })}
                        onSelect={() => {
                          setTimeout(() => document.getElementById('deal-service-persons')?.focus(), 50);
                        }}
                      />
                    </div>

                    {/* Row 1: Date | Persons | Quantity */}
                    <div className="flex gap-2 items-end">
                      <div className="flex-1 space-y-2">
                        <Label>Datum</Label>
                        <DateRangePicker
                          dateFrom={serviceForm.start_date}
                          dateTo={serviceForm.end_date}
                          onDateFromChange={(date) => setServiceForm(prev => ({ ...prev, start_date: date }))}
                          onDateToChange={(date) => setServiceForm(prev => ({ ...prev, end_date: date }))}
                        />
                      </div>
                      <div className="w-16">
                        <Label>Osoby</Label>
                        <Input
                          id="deal-service-persons"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={serviceForm.person_count}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '') || '';
                            setServiceForm(prev => ({ ...prev, person_count: val }));
                          }}
                          placeholder="1"
                          className="text-center"
                        />
                      </div>
                      <div className="w-16">
                        <Label>Počet</Label>
                        <Input
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={serviceForm.quantity}
                          onChange={(e) => setServiceForm(prev => ({ ...prev, quantity: e.target.value.replace(/\D/g, '') || '' }))}
                          placeholder="1"
                          className="text-center"
                        />
                      </div>
                    </div>

                    {/* Row 2: Cost Price + Currency | Sale Price + Currency | Price Mode */}
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Label>Nákupní cena</Label>
                        <div className="flex gap-1">
                          <Input
                            type="number"
                            value={serviceForm.cost_price_original || serviceForm.cost_price}
                            onChange={(e) => {
                              const val = e.target.value;
                              const updates: any = {
                                cost_price_original: val,
                                cost_price: serviceForm.cost_currency === "CZK" ? val : "",
                              };
                              // Auto-margin 15%
                              if (val && !serviceForm.price_manually_set) {
                                updates.price = Math.round(parseFloat(val) * 1.15).toString();
                              }
                              setServiceForm(prev => ({ ...prev, ...updates }));
                            }}
                            placeholder="0"
                            className="flex-1"
                          />
                          <CurrencySelect
                            value={serviceForm.cost_currency}
                            onChange={(value) => setServiceForm(prev => ({ 
                              ...prev, 
                              cost_currency: value,
                              cost_price: value === "CZK" ? prev.cost_price_original : ""
                            }))}
                            className="w-24"
                          />
                        </div>
                      </div>
                      <div className="flex-1">
                        <Label>Prodejní cena</Label>
                        <div className="flex gap-1">
                          <Input
                            type="number"
                            value={serviceForm.price}
                            onChange={(e) => setServiceForm(prev => ({ ...prev, price: e.target.value, price_manually_set: true }))}
                            placeholder="0"
                            className="flex-1"
                          />
                          <CurrencySelect
                            value={serviceForm.price_currency}
                            onChange={(value) => setServiceForm(prev => ({ ...prev, price_currency: value }))}
                            className="w-24"
                          />
                        </div>
                      </div>
                      <div className="w-32">
                        <Label>Režim</Label>
                        <Select value={serviceForm.price_mode} onValueChange={(v: "per_person" | "per_service") => setServiceForm(prev => ({ ...prev, price_mode: v }))}>
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

                    {serviceForm.cost_currency !== "CZK" && serviceForm.cost_price && (
                      <p className="text-xs text-muted-foreground">
                        ≈ {formatPriceCurrency(parseFloat(serviceForm.cost_price))} (přepočteno do Kč)
                      </p>
                    )}

                    {serviceForm.price && (
                      <div className="bg-muted p-3 rounded-md">
                        <p className="text-sm font-medium">
                          Celková cena: {formatPriceCurrency(
                            parseFloat(serviceForm.price) * (serviceForm.price_mode === "per_person" 
                              ? parseInt(serviceForm.person_count || "1") 
                              : parseInt(serviceForm.quantity || "1")),
                            serviceForm.price_currency || "CZK"
                          )}
                        </p>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-4">
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
                        ) : serviceForm.id ? "Uložit změny" : "Přidat službu"}
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
                <div>
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
                          <TableHead className="text-center">Počet</TableHead>
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
                      services.reduce((sum, s) => sum + getServiceTotal(s), 0),
                      dealCurrency
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
            onUpdate={async () => {
              await fetchDeal();
              await checkAndOfferContractSync();
              await checkAndOfferVoucherSync();
            }}
          />
        )}

          </TabsContent>

          {/* ── DOKUMENTY ── */}
          <TabsContent value="documents" className="space-y-6">
        {/* Cestovní dokumenty section */}
        <DealDocumentsSection
          dealId={deal.id}
          clientEmail={(() => {
            const lead = deal.deal_travelers.find(t => t.is_lead_traveler);
            return lead?.clients?.email || null;
          })()}
          clientName={(() => {
            const lead = deal.deal_travelers.find(t => t.is_lead_traveler);
            return lead ? `${lead.clients.first_name} ${lead.clients.last_name}` : undefined;
          })()}
          startDate={deal.start_date}
          autoSendDocuments={(deal as any).auto_send_documents}
          documentsAutoSentAt={(deal as any).documents_auto_sent_at}
        />

        {/* Doklady dodavatelům */}
        <DealSupplierInvoices dealId={deal.id} />
          </TabsContent>

        </Tabs>
      </div>

      {/* Contract Sync Confirmation Dialog */}
      <Dialog open={contractSyncDialogOpen} onOpenChange={setContractSyncDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              Propagovat změny do smlouvy?
            </DialogTitle>
            <DialogDescription>
              Tento obchodní případ má {linkedContracts.length === 1 ? 'vystavenu cestovní smlouvu' : `${linkedContracts.length} vystavených smluv`}. 
              Chcete propagovat aktuální změny (služby, platební kalendář, celkovou cenu a tee times) do {linkedContracts.length === 1 ? 'smlouvy' : 'smluv'}?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {linkedContracts.map(c => (
              <div key={c.id} className="flex items-center gap-2 p-2 rounded bg-muted text-sm">
                <FileSignature className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{c.contract_number}</span>
                <span className="text-muted-foreground capitalize">({c.status === 'draft' ? 'koncept' : c.status === 'sent' ? 'odeslána' : c.status === 'signed' ? 'podepsána' : c.status})</span>
              </div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded p-3">
            ⚠️ Tato akce přepíše stávající služby a platby ve smlouvě. Změny nelze vrátit zpět.
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setContractSyncDialogOpen(false)} disabled={syncingContract}>
              Přeskočit
            </Button>
            <Button onClick={handleSyncToContracts} disabled={syncingContract}>
              {syncingContract ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Synchronizuji...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Akceptovat změny
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Voucher Sync Confirmation Dialog */}
      <Dialog open={voucherSyncDialogOpen} onOpenChange={setVoucherSyncDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              Propagovat změny do voucherů?
            </DialogTitle>
            <DialogDescription>
              Tento obchodní případ má {linkedVouchers.length === 1 ? 'vytvořen voucher' : `${linkedVouchers.length} vytvořené vouchery`}.
              Chcete propagovat aktuální tee times do {linkedVouchers.length === 1 ? 'voucheru' : 'voucherů'}?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {linkedVouchers.map(v => (
              <div key={v.id} className="flex items-center gap-2 p-2 rounded bg-muted text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{v.voucher_code}</span>
                <span className="text-muted-foreground">{v.client_name}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setVoucherSyncDialogOpen(false)} disabled={syncingVoucher}>
              Přeskočit
            </Button>
            <Button onClick={handleSyncToVouchers} disabled={syncingVoucher}>
              {syncingVoucher ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Synchronizuji...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Aktualizovat vouchery
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={hotelConfirmOpen} onOpenChange={(open) => {
        if (!open && hotelConfirmResolver) {
          hotelConfirmResolver.resolve(false);
          setHotelConfirmResolver(null);
        }
        setHotelConfirmOpen(open);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Požadovaný hotel nelze nalézt</AlertDialogTitle>
            <AlertDialogDescription>
              Hotel „{serviceForm.service_name}" není v databázi. Opravdu ho chcete vytvořit?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              hotelConfirmResolver?.resolve(false);
              setHotelConfirmResolver(null);
              setHotelConfirmOpen(false);
            }}>Zrušit</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              hotelConfirmResolver?.resolve(true);
              setHotelConfirmResolver(null);
              setHotelConfirmOpen(false);
            }}>Vytvořit hotel</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Contract already exists dialog */}
      <AlertDialog open={contractExistsDialogOpen} onOpenChange={setContractExistsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cestovní smlouva již existuje</AlertDialogTitle>
            <AlertDialogDescription>
              Tento obchodní případ již obsahuje {existingContractsForConfirm.length === 1 ? "cestovní smlouvu" : `${existingContractsForConfirm.length} cestovní smlouvy`}:
              {existingContractsForConfirm.map(c => (
                <span key={c.id} className="block font-medium mt-1">{c.contract_number} ({c.status})</span>
              ))}
              <br />
              Chcete přesto vytvořit novou smlouvu, nebo ponechat stávající?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setContractExistsDialogOpen(false)}>
              Ponechat stávající
            </AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              setContractExistsDialogOpen(false);
              const leadTraveler = deal?.deal_travelers.find(t => t.is_lead_traveler);
              if (leadTraveler) await doCreateContract(leadTraveler.client_id);
            }}>
              Vytvořit novou smlouvu
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DealDetail;
