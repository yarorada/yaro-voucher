import { useEffect, useState, useRef } from "react";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { useDataScope } from "@/hooks/useDataScope";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateInput } from "@/components/ui/date-input";
import { DocumentUpload } from "@/components/DocumentUpload";
import { DocumentsList } from "@/components/DocumentsList";
import { BulkClientUpload } from "@/components/BulkClientUpload";
import { DuplicateClientChecker } from "@/components/DuplicateClientChecker";
import { DiacriticsChecker } from "@/components/DiacriticsChecker";
import { usePageToolbar } from "@/hooks/usePageToolbar";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useGlobalHistory } from "@/hooks/useGlobalHistory";
import { Check, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Edit, User, Users, FileUp, ChevronDown, Eye, ExternalLink, FileText } from "lucide-react";
import { SmartSearchInput } from "@/components/SmartSearchInput";
import { ClientFilterBar, FilterCondition, applyClientFilters } from "@/components/ClientFilterBar";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import yaroLogo from "@/assets/yaro-logo-wide.png";
import { formatDateForDB, parseDateSafe } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Client {
  id: string;
  title: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  date_of_birth: string | null;
  passport_number: string | null;
  passport_expiry: string | null;
  id_card_number: string | null;
  id_card_expiry: string | null;
  company_name: string | null;
  ico: string | null;
  company_as_orderer: boolean;
  document_urls: Array<{ url: string; type: string; uploadedAt: string }> | null;
}

type ExpiryStatus = 'expired' | 'critical' | 'warning' | 'notice' | 'ok' | null;

function getExpiryStatus(dateStr: string | null): ExpiryStatus {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(dateStr);
  expiry.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'expired';
  if (diffDays <= 30) return 'critical';
  if (diffDays <= 90) return 'warning';
  if (diffDays <= 180) return 'notice';
  return 'ok';
}

function getExpiryBadgeClass(status: ExpiryStatus): string {
  switch (status) {
    case 'expired':
    case 'critical': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
    case 'warning': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
    case 'notice': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300';
    case 'ok': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
    default: return 'bg-muted text-muted-foreground';
  }
}

const Clients = () => {
  const { user } = useAuth();
  const { scope } = useDataScope();
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkImportText, setBulkImportText] = useState("");
  const [bulkDocumentUploadOpen, setBulkDocumentUploadOpen] = useState(false);
  const [ocrFilledFields, setOcrFilledFields] = useState<Set<string>>(new Set());
  const [filterConditions, setFilterConditions] = useState<FilterCondition[]>([]);
  const [quickSearch, setQuickSearch] = useState("");
  const [documentPreviewClient, setDocumentPreviewClient] = useState<Client | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const { setIsSaving, setLastSaved } = useGlobalHistory();

  const [formData, setFormData] = useState({
    title: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
    date_of_birth: undefined as Date | undefined,
    passport_number: "",
    passport_expiry: undefined as Date | undefined,
    id_card_number: "",
    id_card_expiry: undefined as Date | undefined,
    company_name: "",
    ico: "",
    dic: "",
    company_as_orderer: false,
  });

  // Auto-save for editing existing client
  useAutoSave({
    data: editingClient && isDialogOpen ? formData : null,
    saveFn: async (data) => {
      if (!editingClient || !data) return;
      setIsSaving(true);
      setAutoSaveStatus('saving');
      try {
        await supabase
          .from("clients")
          .update({
            title: data.title || null,
            first_name: data.first_name.trim(),
            last_name: data.last_name.trim(),
            email: data.email.trim() || null,
            phone: data.phone.trim() || null,
            address: data.address.trim() || null,
            notes: data.notes.trim() || null,
            date_of_birth: formatDateForDB(data.date_of_birth),
            passport_number: data.passport_number.trim() || null,
            passport_expiry: formatDateForDB(data.passport_expiry),
            id_card_number: data.id_card_number.trim() || null,
            id_card_expiry: formatDateForDB(data.id_card_expiry),
            company_name: data.company_name.trim() || null,
            ico: data.ico.trim() || null,
            dic: data.dic.trim() || null,
            company_as_orderer: data.company_as_orderer,
          } as any)
          .eq("id", editingClient.id);
        setLastSaved(new Date());
        setAutoSaveStatus('saved');
        fetchClients();
      } catch (e) {
        console.error("Auto-save client error:", e);
        setAutoSaveStatus('idle');
      } finally {
        setIsSaving(false);
      }
    },
    debounceMs: 1500,
    enabled: !!editingClient && isDialogOpen,
  });

  useEffect(() => {
    fetchClients();
  }, [scope, user?.id]);

  const fetchClients = async () => {
    try {
      let query = supabase
        .from("clients")
        .select("*")
        .order("last_name", { ascending: true });

      if (scope === "own" && user?.id) {
        query = query.eq("user_id", user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setClients((data as unknown as Client[]) || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
      toast.error("Chyba při načítání klientů");
    } finally {
      setLoading(false);
    }
  };

  const removeDiacritics = (text: string): string => {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  const filteredClients = applyClientFilters(clients, filterConditions, quickSearch);

  const handleAddNewFromSearch = (text: string) => {
    const parts = text.trim().split(/\s+/);
    setFormData((prev) => ({
      ...prev,
      first_name: parts[0] || "",
      last_name: parts.slice(1).join(" ") || "",
    }));
    setEditingClient(null);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      toast.error("Jméno a příjmení jsou povinné");
      return;
    }

    try {
      const normalizedFirstName = removeDiacritics(formData.first_name.trim().toLowerCase());
      const normalizedLastName = removeDiacritics(formData.last_name.trim().toLowerCase());

      if (editingClient) {
        // Check for duplicate (excluding current client)
        const { data: allClients } = await supabase
          .from("clients")
          .select("id, first_name, last_name")
          .neq("id", editingClient.id);

        const duplicate = allClients?.find(client => 
          removeDiacritics(client.first_name.toLowerCase()) === normalizedFirstName &&
          removeDiacritics(client.last_name.toLowerCase()) === normalizedLastName
        );

        if (duplicate) {
          toast.error("Klient s tímto jménem již existuje");
          return;
        }

        const { error } = await supabase
          .from("clients")
          .update({
            title: formData.title || null,
            first_name: formData.first_name.trim(),
            last_name: formData.last_name.trim(),
            email: formData.email.trim() || null,
            phone: formData.phone.trim() || null,
            address: formData.address.trim() || null,
            notes: formData.notes.trim() || null,
            date_of_birth: formatDateForDB(formData.date_of_birth),
            passport_number: formData.passport_number.trim() || null,
            passport_expiry: formatDateForDB(formData.passport_expiry),
            id_card_number: formData.id_card_number.trim() || null,
            id_card_expiry: formatDateForDB(formData.id_card_expiry),
            company_name: formData.company_name.trim() || null,
            ico: formData.ico.trim() || null,
            dic: formData.dic.trim() || null,
            company_as_orderer: formData.company_as_orderer,
          } as any)
          .eq("id", editingClient.id);

        if (error) throw error;
        toast.success("Klient byl aktualizován");
      } else {
        // Check for duplicate
        const { data: allClients } = await supabase
          .from("clients")
          .select("id, first_name, last_name");

        const duplicate = allClients?.find(client => 
          removeDiacritics(client.first_name.toLowerCase()) === normalizedFirstName &&
          removeDiacritics(client.last_name.toLowerCase()) === normalizedLastName
        );

        if (duplicate) {
          toast.error("Klient s tímto jménem již existuje");
          return;
        }

        const { error } = await supabase.from("clients").insert({
          title: formData.title || null,
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          address: formData.address.trim() || null,
          date_of_birth: formatDateForDB(formData.date_of_birth),
          passport_number: formData.passport_number.trim() || null,
          passport_expiry: formatDateForDB(formData.passport_expiry),
          id_card_number: formData.id_card_number.trim() || null,
          id_card_expiry: formatDateForDB(formData.id_card_expiry),
          notes: formData.notes.trim() || null,
          company_name: formData.company_name.trim() || null,
          ico: formData.ico.trim() || null,
          dic: formData.dic.trim() || null,
          company_as_orderer: formData.company_as_orderer,
        } as any);

        if (error) throw error;
        toast.success("Klient byl přidán");
      }

      setFormData({
        title: "",
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        address: "",
        notes: "",
        date_of_birth: undefined,
        passport_number: "",
        passport_expiry: undefined,
        id_card_number: "",
        id_card_expiry: undefined,
        company_name: "",
        ico: "",
        dic: "",
        company_as_orderer: false,
      });
      setEditingClient(null);
      setIsDialogOpen(false);
      fetchClients();
    } catch (error: any) {
      toast.error("Chyba při ukládání klienta");
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      title: client.title || "",
      first_name: client.first_name,
      last_name: client.last_name,
      email: client.email || "",
      phone: client.phone || "",
      address: client.address || "",
      notes: client.notes || "",
      date_of_birth: client.date_of_birth ? parseDateSafe(client.date_of_birth) || undefined : undefined,
      passport_number: client.passport_number || "",
      passport_expiry: client.passport_expiry ? parseDateSafe(client.passport_expiry) || undefined : undefined,
      id_card_number: client.id_card_number || "",
      id_card_expiry: client.id_card_expiry ? parseDateSafe(client.id_card_expiry) || undefined : undefined,
      company_name: client.company_name || "",
      ico: (client as any).ico || "",
      dic: (client as any).dic || "",
      company_as_orderer: client.company_as_orderer || false,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Opravdu chcete smazat tohoto klienta?")) return;

    try {
      // Check if client is used in vouchers
      const { data: voucherCheck } = await supabase
        .from("vouchers")
        .select("id")
        .eq("client_id", id)
        .limit(1)
        .maybeSingle();

      if (voucherCheck) {
        toast.error("Nelze smazat klienta, který je použit ve voucherech");
        return;
      }

      // Check if client is used in voucher_travelers
      const { data: travelerCheck } = await supabase
        .from("voucher_travelers")
        .select("id")
        .eq("client_id", id)
        .limit(1)
        .maybeSingle();

      if (travelerCheck) {
        toast.error("Nelze smazat klienta, který je použit jako cestující");
        return;
      }

      const { error } = await supabase.from("clients").delete().eq("id", id);

      if (error) throw error;
      toast.success("Klient byl smazán");
      fetchClients();
    } catch (error) {
      console.error("Error deleting client:", error);
      toast.error("Chyba při mazání klienta");
    }
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingClient(null);
    setOcrFilledFields(new Set());
    setFormData({
      title: "",
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      address: "",
      notes: "",
      date_of_birth: undefined,
      passport_number: "",
      passport_expiry: undefined,
      id_card_number: "",
      id_card_expiry: undefined,
      company_name: "",
      ico: "",
      dic: "",
      company_as_orderer: false,
    });
  };


  const handleBulkImport = async () => {
    if (!bulkImportText.trim()) {
      toast.error("Vložte alespoň jednoho klienta");
      return;
    }

    try {
      // Zavolat AI edge funkci pro parsování dat
      const { data: parseResult, error: parseError } = await supabase.functions.invoke(
        'parse-bulk-client-data',
        { body: { text: bulkImportText } }
      );

      if (parseError) throw parseError;
      if (!parseResult?.success || !parseResult?.clients) {
        throw new Error("Nepodařilo se zpracovat data");
      }

      const extractedClients = parseResult.clients;
      
      let successCount = 0;
      let errorCount = 0;
      let updatedCount = 0;

      // Načíst existující klienty pro kontrolu duplicit
      const { data: allClients } = await supabase
        .from("clients")
        .select("id, first_name, last_name, email, passport_number, id_card_number");

      for (const clientData of extractedClients) {
        try {
          const normalizedFirstName = removeDiacritics(clientData.first_name.trim().toLowerCase());
          const normalizedLastName = removeDiacritics(clientData.last_name.trim().toLowerCase());

          // Kontrola duplicit (podle jména nebo čísla dokladu)
          const existingClient = allClients?.find(client => {
            const nameMatch = 
              removeDiacritics(client.first_name.toLowerCase()) === normalizedFirstName &&
              removeDiacritics(client.last_name.toLowerCase()) === normalizedLastName;
            
            const passportMatch = clientData.passport_number && 
              client.passport_number === clientData.passport_number;
            
            const idCardMatch = clientData.id_card_number && 
              client.id_card_number === clientData.id_card_number;
            
            return nameMatch || passportMatch || idCardMatch;
          });

          // Připravit data pro uložení
          const clientRecord: any = {
            title: clientData.title,
            first_name: clientData.first_name.trim(),
            last_name: clientData.last_name.trim(),
          };

          if (clientData.email) clientRecord.email = clientData.email.trim();
          if (clientData.date_of_birth) clientRecord.date_of_birth = clientData.date_of_birth;
          if (clientData.passport_number) clientRecord.passport_number = clientData.passport_number;
          if (clientData.passport_expiry) clientRecord.passport_expiry = clientData.passport_expiry;
          if (clientData.id_card_number) clientRecord.id_card_number = clientData.id_card_number;
          if (clientData.id_card_expiry) clientRecord.id_card_expiry = clientData.id_card_expiry;

          if (existingClient) {
            // Aktualizovat existujícího klienta
            const { error } = await supabase
              .from("clients")
              .update(clientRecord)
              .eq("id", existingClient.id);

            if (error) throw error;
            updatedCount++;
          } else {
            // Vytvořit nového klienta
            const { error } = await supabase
              .from("clients")
              .insert(clientRecord);

            if (error) throw error;
            successCount++;
          }
        } catch (error) {
          console.error("Error processing client:", error);
          errorCount++;
        }
      }

      // Zobrazit výsledky
      if (successCount > 0) {
        toast.success(`Přidáno ${successCount} nových klientů`);
      }
      if (updatedCount > 0) {
        toast.success(`Aktualizováno ${updatedCount} existujících klientů`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} klientů se nepodařilo zpracovat`);
      }
      
      fetchClients();
      setBulkImportText("");
      setBulkImportOpen(false);
    } catch (error: any) {
      console.error("Bulk import error:", error);
      if (error.message?.includes("Překročen limit") || error.message?.includes("429")) {
        toast.error("Překročen limit požadavků na AI. Zkuste to prosím za chvíli.");
      } else if (error.message?.includes("Nedostatek kreditů") || error.message?.includes("402")) {
        toast.error("Nedostatek kreditů pro AI. Doplňte prosím kredity v nastavení.");
      } else {
        toast.error("Chyba při importu klientů: " + error.message);
      }
    }
  };

  usePageToolbar(
    <div className="flex flex-wrap items-center gap-2">
      <ClientFilterBar
          conditions={filterConditions}
          onChange={setFilterConditions}
          quickSearch={quickSearch}
          onQuickSearchChange={setQuickSearch}
          noResults={clients.length > 0 && filteredClients.length === 0}
          onAddNew={handleAddNewFromSearch}
        />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
            <ChevronDown className="h-3 w-3" />
            Hromadné operace
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-background p-1">
          <DropdownMenuItem asChild>
            <Button variant="ghost" className="w-full justify-start text-sm px-2 py-1.5 h-auto font-normal" onClick={() => setBulkDocumentUploadOpen(true)}>
              <FileUp className="h-4 w-4 mr-2" />
              Skenovat doklad
            </Button>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Button variant="ghost" className="w-full justify-start text-sm px-2 py-1.5 h-auto font-normal" onClick={() => setBulkImportOpen(true)}>
              <FileText className="h-4 w-4 mr-2" />
              Import z textu
            </Button>
          </DropdownMenuItem>
          <DuplicateClientChecker onComplete={fetchClients} />
          <Button
            variant="ghost"
            className="w-full justify-start text-sm px-2 py-1.5 h-auto font-normal"
            onClick={async () => {
              if (!confirm("Automaticky přiřadit tituly podle jména?")) return;
              try {
                const { data, error } = await supabase.functions.invoke('assign-client-titles');
                if (error) throw error;
                if (data?.success) {
                  toast.success(`Úspěšně přiřazeno: ${data.updated} klientů`);
                  if (data.errors > 0) toast.warning(`${data.errors} klientů se nepodařilo zpracovat`);
                  fetchClients();
                } else {
                  throw new Error(data?.error || 'Unknown error');
                }
              } catch (error: any) {
                toast.error(`Chyba při přiřazování titulů: ${error.message}`);
              }
            }}
          >
            <User className="h-4 w-4 mr-2" />
            Přiřadit tituly
          </Button>
          <DiacriticsChecker onComplete={fetchClients} />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>,
    [filterConditions, quickSearch, filteredClients.length, loading]
  );

  // Extract city from address
  const extractCity = (address: string | null): string => {
    if (!address) return "–";
    // Try to get the last part (usually city) or return the whole address
    const parts = address.split(",").map(p => p.trim());
    return parts[parts.length - 1] || address;
  };

  // Check if client has passport
  const hasPassport = (client: Client) => !!client.passport_number;

  return (
    <PageShell>

            {/* Dialogs */}
            <Dialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) handleDialogClose();
              }}
            >
                <DialogContent
                  className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background"
                  onFocusOutside={(e) => e.preventDefault()}
                  onInteractOutside={(e) => e.preventDefault()}
                >
                  <DialogHeader>
                    <DialogTitle>
                      {editingClient ? "Upravit klienta" : "Nový klient"}
                    </DialogTitle>
                    <DialogDescription>
                      Zadejte informace o klientovi
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-3">
                    {/* Row 1: Titul + Jméno + Příjmení */}
                    <div className="grid grid-cols-[100px_1fr_1fr] gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="title">Titul</Label>
                        <Select
                          value={formData.title}
                          onValueChange={(value) =>
                            setFormData({ ...formData, title: value })
                          }
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            <SelectItem value="Pan">Pan</SelectItem>
                            <SelectItem value="Paní">Paní</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="first_name">Jméno <span className="text-destructive">*</span></Label>
                        <Input
                          id="first_name"
                          value={formData.first_name}
                          onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="last_name">Příjmení <span className="text-destructive">*</span></Label>
                        <Input
                          id="last_name"
                          value={formData.last_name}
                          onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    {/* Row 2: Email + Telefon + Datum narození */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="phone">Telefon</Label>
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="date_of_birth">Datum narození {ocrFilledFields.has("date_of_birth") && <span className="text-green-600 text-xs ml-1">✓ OCR</span>}</Label>
                        <DateInput
                          value={formData.date_of_birth}
                          onChange={(date) => setFormData({ ...formData, date_of_birth: date })}
                          className={ocrFilledFields.has("date_of_birth") ? "border-green-500 bg-green-500/10" : ""}
                        />
                      </div>
                    </div>

                    {/* Row 3: Adresa */}
                    <div className="space-y-1">
                      <Label htmlFor="address">Adresa</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      />
                    </div>

                    {/* Row 3b: Společnost + IČO + DIČ */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="company_name">Společnost</Label>
                        <Input
                          id="company_name"
                          value={formData.company_name}
                          onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                          placeholder="Název společnosti"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="ico">IČO</Label>
                        <Input
                          id="ico"
                          value={formData.ico}
                          onChange={(e) => setFormData({ ...formData, ico: e.target.value })}
                          placeholder="12345678"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="dic">DIČ</Label>
                        <Input
                          id="dic"
                          value={formData.dic}
                          onChange={(e) => setFormData({ ...formData, dic: e.target.value })}
                          placeholder="CZ12345678"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="company_as_orderer"
                        checked={formData.company_as_orderer}
                        onCheckedChange={(checked) => setFormData({ ...formData, company_as_orderer: !!checked })}
                      />
                      <Label htmlFor="company_as_orderer" className="text-sm cursor-pointer">
                        Zobrazit jako objednatel (použít název společnosti a IČO)
                      </Label>
                    </div>

                    {/* Row 4: Poznámky */}
                    <div className="space-y-1">
                      <Label htmlFor="notes">Poznámky</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={2}
                      />
                    </div>

                    {/* Row 5: Doklady */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Cestovní pas {ocrFilledFields.has("passport_number") && <span className="text-green-600 text-xs ml-1">✓ OCR</span>}</Label>
                        <Input
                          placeholder="Číslo pasu"
                          value={formData.passport_number}
                          onChange={(e) => setFormData({ ...formData, passport_number: e.target.value })}
                          className={ocrFilledFields.has("passport_number") ? "border-green-500 bg-green-500/10" : ""}
                        />
                        <DateInput
                          value={formData.passport_expiry}
                          onChange={(date) => setFormData({ ...formData, passport_expiry: date })}
                          placeholder="Platnost do"
                          className={ocrFilledFields.has("passport_expiry") ? "border-green-500 bg-green-500/10" : ""}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Občanský průkaz {ocrFilledFields.has("id_card_number") && <span className="text-green-600 text-xs ml-1">✓ OCR</span>}</Label>
                        <Input
                          placeholder="Číslo OP"
                          value={formData.id_card_number}
                          onChange={(e) => setFormData({ ...formData, id_card_number: e.target.value })}
                          className={ocrFilledFields.has("id_card_number") ? "border-green-500 bg-green-500/10" : ""}
                        />
                        <DateInput
                          value={formData.id_card_expiry}
                          onChange={(date) => setFormData({ ...formData, id_card_expiry: date })}
                          placeholder="Platnost do"
                          className={ocrFilledFields.has("id_card_expiry") ? "border-green-500 bg-green-500/10" : ""}
                        />
                      </div>
                    </div>

                    {editingClient && (
                      <div className="space-y-3 border-t pt-3">
                        <h4 className="text-sm font-semibold">Dokumenty</h4>
                        
                        {editingClient.document_urls && editingClient.document_urls.length > 0 && (
                          <DocumentsList
                            clientId={editingClient.id}
                            documents={editingClient.document_urls}
                            onDelete={() => fetchClients()}
                          />
                        )}

                        <DocumentUpload
                          clientId={editingClient.id}
                          documentType="passport"
                          autoSaveToClient={true}
                          onDataExtracted={(data) => {
                            const newFilledFields = new Set(ocrFilledFields);
                            
                            if (data.passport_number) {
                              setFormData(prev => ({ ...prev, passport_number: data.passport_number }));
                              newFilledFields.add("passport_number");
                            }
                            if (data.passport_expiry || (data.expiry_date && data.passport_number)) {
                              const dateStr = data.passport_expiry || data.expiry_date;
                              const parts = dateStr?.split('.');
                              if (parts?.length === 3) {
                                setFormData(prev => ({ ...prev, passport_expiry: new Date(2000 + parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])) }));
                                newFilledFields.add("passport_expiry");
                              }
                            }
                            if (data.id_card_number) {
                              setFormData(prev => ({ ...prev, id_card_number: data.id_card_number }));
                              newFilledFields.add("id_card_number");
                            }
                            if (data.id_card_expiry || (data.expiry_date && data.id_card_number)) {
                              const dateStr = data.id_card_expiry || data.expiry_date;
                              const parts = dateStr?.split('.');
                              if (parts?.length === 3) {
                                setFormData(prev => ({ ...prev, id_card_expiry: new Date(2000 + parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])) }));
                                newFilledFields.add("id_card_expiry");
                              }
                            }
                            if (data.date_of_birth) {
                              const parts = data.date_of_birth.split('.');
                              if (parts.length === 3) {
                                let year = parseInt(parts[2]);
                                year += year < 30 ? 2000 : 1900;
                                setFormData(prev => ({ ...prev, date_of_birth: new Date(year, parseInt(parts[1]) - 1, parseInt(parts[0])) }));
                                newFilledFields.add("date_of_birth");
                              }
                            }
                            if (data.first_name && !formData.first_name) setFormData(prev => ({ ...prev, first_name: data.first_name }));
                            if (data.last_name && !formData.last_name) setFormData(prev => ({ ...prev, last_name: data.last_name }));
                            
                            setOcrFilledFields(newFilledFields);
                            setTimeout(() => setOcrFilledFields(new Set()), 5000);
                          }}
                          onUploadComplete={() => fetchClients()}
                        />
                      </div>
                    )}

                    <div className="flex gap-2 justify-end items-center">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleDialogClose}
                      >
                        {editingClient ? "Zavřít" : "Zrušit"}
                      </Button>
                      {editingClient ? (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          {autoSaveStatus === 'saving' ? (
                            <><Loader2 className="h-3 w-3 animate-spin" />Ukládám…</>
                          ) : autoSaveStatus === 'saved' ? (
                            <><Check className="h-3 w-3 text-emerald-500" />Uloženo</>
                          ) : null}
                        </span>
                      ) : (
                        <Button type="submit">Přidat</Button>
                      )}
                    </div>
                  </form>
                </DialogContent>
              </Dialog>

              {/* Hromadný import dialog */}
              <Dialog open={bulkImportOpen} onOpenChange={setBulkImportOpen}>
                <DialogContent className="max-w-2xl bg-background">
                  <DialogHeader>
                    <DialogTitle>Hromadný import klientů s AI</DialogTitle>
                    <DialogDescription>
                      Vložte informace o klientech v jakémkoli formátu. AI automaticky extrahuje jméno, příjmení, email, datum narození, čísla dokladů a přiřadí tituly Pan/Paní.
                      <br /><br />
                      <strong>Příklady formátů:</strong>
                      <br />• Jan Novák, jan@email.cz, 15.3.1990, pas: 123456789
                      <br />• Marie Svobodová, narozena 5.5.1985, email: marie@email.cz
                      <br />• Petr Dvořák (1.1.1995), petr.dvorak@gmail.com, OP 987654321
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Textarea
                      value={bulkImportText}
                      onChange={(e) => setBulkImportText(e.target.value)}
                      placeholder="Jan Novák, jan.novak@email.cz, narozen 15.3.1990&#10;Marie Svobodová (5.5.1985), email: marie@email.cz, pas: AB123456&#10;Petr Dvořák, 1.1.1995, petr.dvorak@gmail.com, OP: 987654321"
                      rows={10}
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setBulkImportOpen(false);
                          setBulkImportText("");
                        }}
                      >
                        Zrušit
                      </Button>
                      <Button onClick={handleBulkImport}>Importovat s AI</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Hromadné nahrání dokumentů dialog */}
              <Dialog open={bulkDocumentUploadOpen} onOpenChange={setBulkDocumentUploadOpen}>
                <DialogContent className="max-w-2xl bg-background">
                  <DialogHeader>
                    <DialogTitle>Hromadné nahrání dokumentů</DialogTitle>
                    <DialogDescription>
                      Nahrajte cestovní pasy nebo občanské průkazy. Z každého dokumentu
                      automaticky extrahujeme údaje a vytvoříme nového klienta.
                    </DialogDescription>
                  </DialogHeader>
                  <BulkClientUpload 
                    onComplete={() => {
                      setBulkDocumentUploadOpen(false);
                      fetchClients();
                    }} 
                  />
                </DialogContent>
              </Dialog>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Načítám klienty...</p>
          </div>
        ) : clients.length === 0 ? (
          <Card className="p-12 text-center shadow-[var(--shadow-medium)]">
            <User className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-heading-2 text-foreground mb-2">Zatím žádní klienti</h2>
            <p className="text-muted-foreground mb-6">Přidejte prvního klienta</p>
          </Card>
        ) : filteredClients.length === 0 ? (
          <Card className="p-8 text-center shadow-[var(--shadow-medium)]">
            <p className="text-muted-foreground">Žádný klient nevyhovuje nastaveným filtrům</p>
            <Button variant="outline" className="mt-3" onClick={() => setFilterConditions([])}>Zrušit filtry</Button>
          </Card>
        ) : (
          <>
          <div className="sm:hidden space-y-2">
            {filteredClients.map((client) => (
              <Card key={client.id} className="shadow-[var(--shadow-medium)] p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-medium text-sm">{client.first_name} {client.last_name}</p>
                      {client.passport_number && (() => {
                        const status = getExpiryStatus(client.passport_expiry);
                        return (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${getExpiryBadgeClass(status)}`}>PAS</span>
                        );
                      })()}
                      {client.id_card_number && (() => {
                        const status = getExpiryStatus(client.id_card_expiry);
                        return (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${getExpiryBadgeClass(status)}`}>OP</span>
                        );
                      })()}
                      {client.document_urls && client.document_urls.length > 0 && (
                        <button onClick={() => setDocumentPreviewClient(client)} className="text-muted-foreground hover:text-foreground">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {client.email && <p className="text-xs text-muted-foreground truncate">{client.email}</p>}
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      {client.phone && <span>{client.phone}</span>}
                      {client.date_of_birth && <span>{(() => { const d = parseDateSafe(client.date_of_birth); return d ? `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}` : "–"; })()}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => handleEdit(client)} className="text-primary hover:text-primary/70 transition-colors" title="Upravit">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(client.id)} className="text-destructive hover:text-destructive/70 transition-colors" title="Smazat">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop table view */}
          <Card className="shadow-[var(--shadow-medium)] overflow-hidden hidden sm:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-primary cursor-pointer select-none">Jméno ↑</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Telefon</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Datum narození</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Akce</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => (
                    <tr key={client.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          {client.first_name} {client.last_name}
                          {client.passport_number && (() => {
                            const status = getExpiryStatus(client.passport_expiry);
                            return (
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${getExpiryBadgeClass(status)}`} title={client.passport_expiry || undefined}>
                                PAS
                              </span>
                            );
                          })()}
                          {client.id_card_number && (() => {
                            const status = getExpiryStatus(client.id_card_expiry);
                            return (
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${getExpiryBadgeClass(status)}`} title={client.id_card_expiry || undefined}>
                                OP
                              </span>
                            );
                          })()}
                          {client.document_urls && client.document_urls.length > 0 && (
                            <button
                              onClick={() => setDocumentPreviewClient(client)}
                              className="text-muted-foreground hover:text-foreground"
                              title="Zobrazit dokumenty"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{client.email || ""}</td>
                      <td className="px-4 py-3 text-muted-foreground">{client.phone || ""}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {client.date_of_birth ? (() => { const d = parseDateSafe(client.date_of_birth); return d ? `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}` : "–"; })() : "–"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(client)}
                            className="text-primary hover:text-primary/70 transition-colors"
                            title="Upravit"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(client.id)}
                            className="text-destructive hover:text-destructive/70 transition-colors"
                            title="Smazat"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Document Preview Dialog */}
        <Dialog open={!!documentPreviewClient} onOpenChange={(open) => !open && setDocumentPreviewClient(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] bg-background">
            <DialogHeader>
              <DialogTitle>
                Dokumenty - {documentPreviewClient?.first_name} {documentPreviewClient?.last_name}
              </DialogTitle>
              <DialogDescription>
                Nahrané dokumenty klienta (pas, OP, ostatní)
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto max-h-[70vh]">
              {documentPreviewClient?.document_urls && documentPreviewClient.document_urls.length > 0 ? (
                <div className="grid gap-4">
                  {documentPreviewClient.document_urls.map((doc, index) => {
                    const isPdf = doc.url.toLowerCase().includes('.pdf');
                    return (
                      <Card key={index} className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <span className="font-medium">
                              {doc.type === 'passport' ? 'Cestovní pas' : 
                               doc.type === 'id_card' ? 'Občanský průkaz' : 'Ostatní'}
                            </span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => window.open(doc.url, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                            Nové okno
                          </Button>
                        </div>
                        {isPdf ? (
                          <div className="bg-muted/50 rounded-lg p-8 text-center">
                            <FileText className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground mb-3">PDF dokument</p>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => window.open(doc.url, '_blank')}
                            >
                              Otevřít PDF
                            </Button>
                          </div>
                        ) : (
                          <div className="relative">
                            <img 
                              src={doc.url} 
                              alt={`Dokument ${index + 1}`}
                              className="max-w-full max-h-[400px] object-contain mx-auto rounded border"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const fallback = target.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                            <div 
                              className="hidden flex-col items-center justify-center bg-muted/50 rounded-lg p-8"
                              style={{ display: 'none' }}
                            >
                              <FileText className="h-12 w-12 mb-2 text-muted-foreground" />
                              <p className="text-sm text-muted-foreground mb-3">Náhled nelze zobrazit</p>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => window.open(doc.url, '_blank')}
                              >
                                Otevřít dokument
                              </Button>
                            </div>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Žádné dokumenty nebyly nahrány
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
    </PageShell>
  );
};

export default Clients;
