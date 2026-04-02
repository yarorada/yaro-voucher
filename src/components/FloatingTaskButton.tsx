import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Plus, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { cn, formatDateForDB } from "@/lib/utils";
import { CalendarIcon, ClipboardList, Briefcase, Clock } from "lucide-react";
import { ClientCombobox } from "@/components/ClientCombobox";

export const FloatingTaskButton = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("task");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState<Date>(new Date());
  const [dueTime, setDueTime] = useState<string>("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  // Deal fields
  const [dealName, setDealName] = useState("");
  const [dealLeadTravelerId, setDealLeadTravelerId] = useState("");
  const [dealLeadMissingEmail, setDealLeadMissingEmail] = useState(false);
  const [dealStatus, setDealStatus] = useState<string>("inquiry");
  const [dealLoading, setDealLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Get all profiles for assignment
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, name")
        .order("email");
      if (error) throw error;
      return data;
    },
  });

  // Default to current user
  useEffect(() => {
    if (currentUser?.id && !assignedTo) {
      setAssignedTo(currentUser.id);
    }
  }, [currentUser?.id, assignedTo]);

  const addTaskMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tasks").insert({
        title,
        description: description.trim() || null,
        priority,
        due_date: format(dueDate, "yyyy-MM-dd"),
        due_time: dueTime || null,
        user_id: assignedTo || currentUser?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setTitle("");
      setDescription("");
      setPriority("medium");
      setDueDate(new Date());
      setDueTime("");
      setAssignedTo(currentUser?.id || "");
      setOpen(false);
      toast({ title: "Úkol vytvořen" });
    },
    onError: () => {
      toast({ title: "Chyba při vytváření úkolu", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!title.trim()) return;
    addTaskMutation.mutate();
  };

  const handleCreateDeal = async () => {
    if (!dealLeadTravelerId) {
      toast({ title: "Vyberte hlavního cestujícího", variant: "destructive" });
      return;
    }
    setDealLoading(true);
    try {
      const { data: deal, error: dealError } = await supabase
        .from("deals")
        .insert([{ deal_number: "", name: dealName || null, status: dealStatus as any, lead_client_id: dealLeadTravelerId }])
        .select()
        .single();
      if (dealError) throw dealError;

      const { error: travelerError } = await supabase
        .from("deal_travelers")
        .insert({ deal_id: deal.id, client_id: dealLeadTravelerId, is_lead_traveler: true });
      if (travelerError) throw travelerError;

      queryClient.invalidateQueries({ queryKey: ["recent-deals"] });
      setDealName("");
      setDealLeadTravelerId("");
      setDealStatus("inquiry");
      setOpen(false);
      toast({ title: "Obchodní případ vytvořen" });
      navigate(`/deals/${deal.id}`);
    } catch {
      toast({ title: "Chyba při vytváření", variant: "destructive" });
    } finally {
      setDealLoading(false);
    }
  };

  const profileLabel = (p: { email: string; name?: string | null }) => {
    return p.name || p.email.split("@")[0].charAt(0).toUpperCase() + p.email.split("@")[0].slice(1);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg print:hidden"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rychlé vytvoření</DialogTitle>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="pt-1">
          <TabsList className="w-full">
            <TabsTrigger value="task" className="flex-1 gap-1.5">
              <ClipboardList className="h-4 w-4" /> Úkol
            </TabsTrigger>
            <TabsTrigger value="deal" className="flex-1 gap-1.5">
              <Briefcase className="h-4 w-4" /> Obch. případ
            </TabsTrigger>
          </TabsList>

          <TabsContent value="task" className="space-y-4 pt-2">
            <Input
              placeholder="Název úkolu..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              autoFocus
            />
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Poznámky</label>
              <Textarea
                placeholder="Poznámky k úkolu..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Priorita</label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Nízká</SelectItem>
                    <SelectItem value="medium">Střední</SelectItem>
                    <SelectItem value="high">Vysoká</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Přiřazeno</label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger><SelectValue placeholder="Vyberte..." /></SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {profileLabel(p)}
                        {p.id === currentUser?.id && " (já)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Datum a čas splnění</label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("flex-1 justify-start text-left font-normal", !dueDate && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, "d. MMMM yyyy", { locale: cs }) : "Vyberte datum"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dueDate} onSelect={(d) => d && setDueDate(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
                <div className="flex items-center gap-1.5 border rounded-md px-2 bg-background">
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <input
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className="w-20 text-sm bg-transparent outline-none"
                  />
                </div>
              </div>
            </div>
            <Button className="w-full" onClick={handleSubmit} disabled={!title.trim() || addTaskMutation.isPending}>
              Vytvořit úkol
            </Button>
          </TabsContent>

          <TabsContent value="deal" className="space-y-4 pt-2">
            <Input
              placeholder="Název obchodního případu..."
              value={dealName}
              onChange={(e) => setDealName(e.target.value)}
            />
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Hlavní cestující *</label>
              <ClientCombobox value={dealLeadTravelerId} onChange={async (id) => {
                setDealLeadTravelerId(id);
                if (!id) { setDealLeadMissingEmail(false); return; }
                const { data } = await supabase.from("clients").select("email").eq("id", id).single();
                setDealLeadMissingEmail(!data?.email);
              }} />
              {dealLeadMissingEmail && (
                <Alert variant="destructive" className="mt-1">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Klient nemá zadaný e-mail. Doplňte ho v kartě klienta.
                  </AlertDescription>
                </Alert>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Status</label>
              <Select value={dealStatus} onValueChange={setDealStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="inquiry">Poptávka</SelectItem>
                  <SelectItem value="quote">Nabídka</SelectItem>
                  <SelectItem value="confirmed">Potvrzeno</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleCreateDeal} disabled={!dealLeadTravelerId || dealLoading}>
              {dealLoading ? "Vytváření..." : "Vytvořit případ"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};