import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Save, Trash2, Plus, X, Plane, Hotel, Navigation, Car, Shield, FileText, FileSignature, Edit, ChevronDown, Utensils, HeadphonesIcon } from "lucide-react";
import yaroLogo from "@/assets/yaro-logo-wide.png";
import { DestinationCombobox } from "@/components/DestinationCombobox";
import { ClientCombobox } from "@/components/ClientCombobox";
import { SupplierCombobox } from "@/components/SupplierCombobox";
import { ServiceCombobox } from "@/components/ServiceCombobox";
import { DealStatusBadge } from "@/components/DealStatusBadge";
import { DealVariants } from "@/components/DealVariants";
import { DateInput } from "@/components/ui/date-input";
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

interface DealService {
  id: string;
  service_type: "flight" | "hotel" | "golf" | "transfer" | "insurance" | "other";
  service_name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  price: number | null;
  supplier_id: string | null;
  person_count: number | null;
  suppliers?: {
    name: string;
  };
}

interface Deal {
  id: string;
  deal_number: string;
  status: "inquiry" | "quote" | "confirmed" | "cancelled" | "completed";
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
  
  // Service form state
  const [serviceForm, setServiceForm] = useState({
    id: "",
    service_type: "hotel" as DealService["service_type"],
    service_name: "",
    description: "",
    start_date: undefined as Date | undefined,
    end_date: undefined as Date | undefined,
    price: "",
    supplier_id: "",
    person_count: "1",
  });

  // Form state
  const [status, setStatus] = useState<"inquiry" | "quote" | "confirmed" | "cancelled" | "completed">("inquiry");
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
  const [discountNote, setDiscountNote] = useState("");
  const [adjustmentNote, setAdjustmentNote] = useState("");

  useEffect(() => {
    fetchDeal();
    fetchServices();
  }, [id]);

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

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from("deal_services")
        .select(`
          *,
          suppliers(name)
        `)
        .eq("deal_id", id);

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error("Error fetching services:", error);
    } finally {
      setLoadingServices(false);
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

  const handleSaveService = async () => {
    if (!serviceForm.service_name || !deal) return;

    try {
      if (serviceForm.id) {
        // Update existing service
        const { error } = await supabase
          .from("deal_services")
          .update({
            service_type: serviceForm.service_type,
            service_name: serviceForm.service_name,
            description: serviceForm.description || null,
            start_date: serviceForm.start_date?.toISOString() || null,
            end_date: serviceForm.end_date?.toISOString() || null,
            price: serviceForm.price ? parseFloat(serviceForm.price) : null,
            supplier_id: serviceForm.supplier_id || null,
            person_count: serviceForm.person_count ? parseInt(serviceForm.person_count) : 1,
          })
          .eq("id", serviceForm.id);

        if (error) throw error;
      } else {
        // Create new service
        const { error } = await supabase
          .from("deal_services")
          .insert({
            deal_id: deal.id,
            service_type: serviceForm.service_type,
            service_name: serviceForm.service_name,
            description: serviceForm.description || null,
            start_date: serviceForm.start_date?.toISOString() || null,
            end_date: serviceForm.end_date?.toISOString() || null,
            price: serviceForm.price ? parseFloat(serviceForm.price) : null,
            supplier_id: serviceForm.supplier_id || null,
            person_count: serviceForm.person_count ? parseInt(serviceForm.person_count) : 1,
          });

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

  const resetServiceForm = () => {
    setServiceForm({
      id: "",
      service_type: "hotel",
      service_name: "",
      description: "",
      start_date: undefined,
      end_date: undefined,
      price: "",
      supplier_id: "",
      person_count: "1",
    });
  };

  const openEditService = (service: DealService) => {
    setServiceForm({
      id: service.id,
      service_type: service.service_type,
      service_name: service.service_name,
      description: service.description || "",
      start_date: service.start_date ? new Date(service.start_date) : undefined,
      end_date: service.end_date ? new Date(service.end_date) : undefined,
      price: service.price?.toString() || "",
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
          status,
          destination_id: destinationId || null,
          start_date: startDate?.toISOString() || null,
          end_date: endDate?.toISOString() || null,
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

    if (!deal.total_price) {
      toast({
        title: "Chyba",
        description: "Obchodní případ musí mít celkovou cenu",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: newContract, error } = await supabase
        .from("travel_contracts")
        .insert({
          deal_id: deal.id,
          client_id: leadTraveler.client_id,
          total_price: deal.total_price,
          deposit_amount: deal.deposit_amount || null,
          status: "draft",
          contract_number: "", // Will be auto-generated by trigger
        })
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
          <div className="flex items-center justify-end gap-4 mb-4">
            <Button variant="outline" onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Ukládám..." : "Uložit"}
            </Button>
            <Button variant="outline" onClick={handleCreateContract} className="gap-2">
              <FileSignature className="h-4 w-4" />
              Vytvořit smlouvu
            </Button>
            <Button
              variant="outline"
              onClick={handleDelete}
              className="gap-2 hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="h-4 w-4" />
              Smazat
            </Button>
          </div>
          
          <div className="flex items-center gap-3">
            <DealStatusBadge status={deal.status} />
            <h1 className="text-4xl font-bold text-foreground">{deal.deal_number}</h1>
            {deal.destination?.name && (
              <span className="text-2xl text-muted-foreground">- {deal.destination.name}</span>
            )}
          </div>
        </header>

        <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Základní informace</CardTitle>
            <CardDescription>Upravte základní údaje obchodního případu</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Stav</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inquiry">Poptávka</SelectItem>
                    <SelectItem value="quote">Nabídka odeslána</SelectItem>
                    <SelectItem value="confirmed">Potvrzeno</SelectItem>
                    <SelectItem value="cancelled">Zrušeno</SelectItem>
                    <SelectItem value="completed">Dokončeno</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="leadTraveler">Hlavní cestující</Label>
                <ClientCombobox
                  value={leadTravelerId}
                  onChange={setLeadTravelerId}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="destination">Destinace</Label>
                <DestinationCombobox
                  value={destinationId}
                  onValueChange={setDestinationId}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Datum od</Label>
                    <DateInput
                      value={startDate}
                      onChange={setStartDate}
                      placeholder="DD.MM.RR"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endDate">Datum do</Label>
                    <DateInput
                      value={endDate}
                      onChange={setEndDate}
                      placeholder="DD.MM.RR"
                      autoSetDate={() => startDate ? new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000) : undefined}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="depositAmount">Záloha (Kč)</Label>
                <Input
                  id="depositAmount"
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0"
                />
              </div>

              <div className="flex items-center space-x-2 pt-7">
                <input
                  type="checkbox"
                  id="depositPaid"
                  checked={depositPaid}
                  onChange={(e) => setDepositPaid(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="depositPaid" className="cursor-pointer">
                  Záloha zaplacena
                </Label>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notes">Poznámky</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Interní poznámky..."
                  rows={4}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Cestující</CardTitle>
                <CardDescription>Správa cestujících v obchodním případu</CardDescription>
              </div>
              <Dialog open={travelerDialogOpen} onOpenChange={setTravelerDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" onClick={() => setNewTravelerId("")}>
                    <Plus className="h-4 w-4 mr-2" />
                    Přidat cestujícího
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
                    const travelerCount = deal?.deal_travelers?.length || 1;
                    setServiceForm({
                      id: "",
                      service_type: "flight",
                      service_name: "",
                      description: "",
                      start_date: startDate,
                      end_date: endDate,
                      price: "",
                      supplier_id: "",
                      person_count: travelerCount.toString(),
                    });
                    setServiceDialogOpen(true);
                  }}>
                    <Plane className="h-4 w-4 mr-2" />
                    Letenka
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    const travelerCount = deal?.deal_travelers?.length || 1;
                    setServiceForm({
                      id: "",
                      service_type: "hotel",
                      service_name: "",
                      description: "",
                      start_date: startDate,
                      end_date: endDate,
                      price: "",
                      supplier_id: "",
                      person_count: travelerCount.toString(),
                    });
                    setServiceDialogOpen(true);
                  }}>
                    <Hotel className="h-4 w-4 mr-2" />
                    Ubytování
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    const travelerCount = deal?.deal_travelers?.length || 1;
                    setServiceForm({
                      id: "",
                      service_type: "golf",
                      service_name: "",
                      description: "",
                      start_date: startDate,
                      end_date: endDate,
                      price: "",
                      supplier_id: "",
                      person_count: travelerCount.toString(),
                    });
                    setServiceDialogOpen(true);
                  }}>
                    <Navigation className="h-4 w-4 mr-2" />
                    Green fee
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    const travelerCount = deal?.deal_travelers?.length || 1;
                    setServiceForm({
                      id: "",
                      service_type: "transfer",
                      service_name: "",
                      description: "",
                      start_date: startDate,
                      end_date: endDate,
                      price: "",
                      supplier_id: "",
                      person_count: travelerCount.toString(),
                    });
                    setServiceDialogOpen(true);
                  }}>
                    <Car className="h-4 w-4 mr-2" />
                    Transfery
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    const travelerCount = deal?.deal_travelers?.length || 1;
                    setServiceForm({
                      id: "",
                      service_type: "other",
                      service_name: "Rent-a-car",
                      description: "",
                      start_date: startDate,
                      end_date: endDate,
                      price: "",
                      supplier_id: "",
                      person_count: travelerCount.toString(),
                    });
                    setServiceDialogOpen(true);
                  }}>
                    <Car className="h-4 w-4 mr-2" />
                    Rent-a-car
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    const travelerCount = deal?.deal_travelers?.length || 1;
                    setServiceForm({
                      id: "",
                      service_type: "other",
                      service_name: "Strava",
                      description: "",
                      start_date: startDate,
                      end_date: endDate,
                      price: "",
                      supplier_id: "",
                      person_count: travelerCount.toString(),
                    });
                    setServiceDialogOpen(true);
                  }}>
                    <Utensils className="h-4 w-4 mr-2" />
                    Strava
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    const travelerCount = deal?.deal_travelers?.length || 1;
                    setServiceForm({
                      id: "",
                      service_type: "other",
                      service_name: "Asistence",
                      description: "",
                      start_date: startDate,
                      end_date: endDate,
                      price: "",
                      supplier_id: "",
                      person_count: travelerCount.toString(),
                    });
                    setServiceDialogOpen(true);
                  }}>
                    <HeadphonesIcon className="h-4 w-4 mr-2" />
                    Asistence
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    const travelerCount = deal?.deal_travelers?.length || 1;
                    setServiceForm({
                      id: "",
                      service_type: "insurance",
                      service_name: "",
                      description: "",
                      start_date: startDate,
                      end_date: endDate,
                      price: "",
                      supplier_id: "",
                      person_count: travelerCount.toString(),
                    });
                    setServiceDialogOpen(true);
                  }}>
                    <Shield className="h-4 w-4 mr-2" />
                    Pojištění
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Dialog open={serviceDialogOpen} onOpenChange={(open) => {
                setServiceDialogOpen(open);
                if (!open) resetServiceForm();
              }}>
                <DialogContent className="bg-background max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{serviceForm.id ? "Upravit službu" : "Přidat službu"}</DialogTitle>
                    <DialogDescription>
                      Zadejte informace o službě
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Typ služby</Label>
                      <Select
                        value={serviceForm.service_type}
                        onValueChange={(value: any) => setServiceForm({ ...serviceForm, service_type: value })}
                      >
                        <SelectTrigger className="bg-background z-50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          <SelectItem value="hotel">Ubytování</SelectItem>
                          <SelectItem value="flight">Letenka</SelectItem>
                          <SelectItem value="golf">Green Fee</SelectItem>
                          <SelectItem value="transfer">Doprava</SelectItem>
                          <SelectItem value="insurance">Pojištění</SelectItem>
                          <SelectItem value="other">Ostatní</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Název služby *</Label>
                      <ServiceCombobox
                        value={serviceForm.service_name}
                        onChange={(value) => setServiceForm({ ...serviceForm, service_name: value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Popis</Label>
                      <Textarea
                        value={serviceForm.description}
                        onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                        placeholder="Detaily služby..."
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Datum od</Label>
                        <DateInput
                          value={serviceForm.start_date}
                          onChange={(date) => setServiceForm({ ...serviceForm, start_date: date })}
                          placeholder="DD.MM.RR"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Datum do</Label>
                        <DateInput
                          value={serviceForm.end_date}
                          onChange={(date) => setServiceForm({ ...serviceForm, end_date: date })}
                          placeholder="DD.MM.RR"
                          autoSetDate={() => serviceForm.start_date ? new Date(serviceForm.start_date.getTime() + 7 * 24 * 60 * 60 * 1000) : undefined}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Cena (Kč)</Label>
                        <Input
                          type="number"
                          value={serviceForm.price}
                          onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
                          placeholder="0"
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
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Dodavatel</Label>
                        <SupplierCombobox
                          value={serviceForm.supplier_id}
                          onChange={(value) => setServiceForm({ ...serviceForm, supplier_id: value })}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setServiceDialogOpen(false)}>
                        Zrušit
                      </Button>
                      <Button onClick={handleSaveService} disabled={!serviceForm.service_name}>
                        {serviceForm.id ? "Uložit" : "Přidat"}
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
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[25%]">Služba</TableHead>
                        <TableHead className="w-[15%] hidden sm:table-cell">Datum</TableHead>
                        <TableHead className="w-[10%] hidden md:table-cell text-center">Osoby</TableHead>
                        <TableHead className="w-[20%] hidden lg:table-cell">Dodavatel</TableHead>
                        <TableHead className="w-[15%] text-right">Cena</TableHead>
                        <TableHead className="w-[15%] text-right">Akce</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {services.map((service) => (
                        <TableRow key={service.id} className="hover:bg-muted/50">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex-shrink-0">{getServiceIcon(service.service_type)}</div>
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{service.service_name}</p>
                                <p className="text-xs text-muted-foreground">{getServiceTypeLabel(service.service_type)}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-xs">
                            {service.start_date && new Date(service.start_date).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit' })}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-center text-sm">
                            {service.person_count}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-xs truncate">
                            {service.suppliers?.name || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="text-sm font-medium">
                              {service.price ? new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK" }).format(service.price * (service.person_count || 1)) : '-'}
                            </div>
                            {service.price && service.person_count && service.person_count > 1 && (
                              <div className="text-xs text-muted-foreground">
                                {new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK" }).format(service.price)} × {service.person_count}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-7 w-7 p-0" 
                                onClick={() => openEditService(service)}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive" 
                                onClick={() => handleDeleteService(service.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                <div className="flex justify-between items-center p-4 border-t-2 border-primary/20 bg-muted/30">
                  <span className="font-semibold text-sm sm:text-base">Celková cena:</span>
                  <span className="font-bold text-base sm:text-lg text-primary">
                    {new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK" }).format(
                      services.reduce((sum, s) => sum + ((s.price || 0) * (s.person_count || 1)), 0)
                    )}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
};

export default DealDetail;
