import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateInput } from "@/components/ui/date-input";
import { DocumentUpload } from "@/components/DocumentUpload";
import { DocumentsList } from "@/components/DocumentsList";
import { BulkClientUpload } from "@/components/BulkClientUpload";
import { DuplicateClientChecker } from "@/components/DuplicateClientChecker";
import { usePageToolbar } from "@/hooks/usePageToolbar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Edit, User, Users, CheckCircle2, Search, FileUp, ChevronDown, Eye, ExternalLink, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import yaroLogo from "@/assets/yaro-logo-wide.png";
import { formatDateForDB, parseDateSafe } from "@/lib/utils";
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
  document_urls: Array<{ url: string; type: string; uploadedAt: string }> | null;
}

const Clients = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkImportText, setBulkImportText] = useState("");
  const [bulkDocumentUploadOpen, setBulkDocumentUploadOpen] = useState(false);
  const [ocrFilledFields, setOcrFilledFields] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState("");
  const [documentPreviewClient, setDocumentPreviewClient] = useState<Client | null>(null);

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
  });

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("last_name", { ascending: true });

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

  const filteredClients = clients.filter((client) => {
    if (!searchText.trim()) return true;
    
    const normalizedSearch = removeDiacritics(searchText.toLowerCase());
    const normalizedFirstName = removeDiacritics(client.first_name.toLowerCase());
    const normalizedLastName = removeDiacritics(client.last_name.toLowerCase());
    const normalizedFullName = `${normalizedFirstName} ${normalizedLastName}`;
    const normalizedEmail = client.email ? removeDiacritics(client.email.toLowerCase()) : '';
    
    return normalizedFullName.includes(normalizedSearch) || 
           normalizedEmail.includes(normalizedSearch);
  });

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
          })
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
        });

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

  const toolbarButtonClass = "h-8 text-xs bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20";

  usePageToolbar(
    <>
      <div className="relative w-48 md:w-64">
        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Hledat..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="pl-8 h-8 text-xs"
        />
      </div>
      <DuplicateClientChecker onComplete={fetchClients} />
      <Button 
        className={toolbarButtonClass}
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
            console.error('Error assigning titles:', error);
            toast.error(`Chyba při přiřazování titulů: ${error.message}`);
          }
        }}
      >
        Tituly
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className={toolbarButtonClass + " gap-1"}>
            <Plus className="h-3.5 w-3.5" />
            Přidat
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-background">
          <DropdownMenuItem onClick={() => setIsDialogOpen(true)} className="cursor-pointer">
            <Plus className="h-4 w-4 mr-2" />
            Přidat individuálně
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setBulkImportOpen(true)} className="cursor-pointer">
            <Users className="h-4 w-4 mr-2" />
            Hromadný textový import
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setBulkDocumentUploadOpen(true)} className="cursor-pointer">
            <FileUp className="h-4 w-4 mr-2" />
            Nahrát dokumenty
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>,
    [searchText]
  );

  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)]">
      <div className="container max-w-6xl mx-auto py-8 px-4">

            {/* Dialogs */}
            <Dialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) handleDialogClose();
              }}
            >
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background">
                  <DialogHeader>
                    <DialogTitle>
                      {editingClient ? "Upravit klienta" : "Nový klient"}
                    </DialogTitle>
                    <DialogDescription>
                      Zadejte informace o klientovi
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Oslovení</Label>
                      <Select
                        value={formData.title}
                        onValueChange={(value) =>
                          setFormData({ ...formData, title: value })
                        }
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Vyberte oslovení" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          <SelectItem value="Pan">Pan</SelectItem>
                          <SelectItem value="Paní">Paní</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="first_name">
                          Jméno <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="first_name"
                          value={formData.first_name}
                          onChange={(e) =>
                            setFormData({ ...formData, first_name: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="last_name">
                          Příjmení <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="last_name"
                          value={formData.last_name}
                          onChange={(e) =>
                            setFormData({ ...formData, last_name: e.target.value })
                          }
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefon</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">Adresa</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) =>
                          setFormData({ ...formData, address: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Poznámky</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) =>
                          setFormData({ ...formData, notes: e.target.value })
                        }
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="date_of_birth">Datum narození</Label>
                      <DateInput
                        value={formData.date_of_birth}
                        onChange={(date) =>
                          setFormData({ ...formData, date_of_birth: date })
                        }
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="passport_number">Číslo cestovního pasu</Label>
                          {ocrFilledFields.has("passport_number") && (
                            <div className="flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Z OCR</span>
                            </div>
                          )}
                        </div>
                        <Input
                          id="passport_number"
                          value={formData.passport_number}
                          onChange={(e) =>
                            setFormData({ ...formData, passport_number: e.target.value })
                          }
                          className={ocrFilledFields.has("passport_number") ? "border-green-500 bg-green-50" : ""}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="passport_expiry">Platnost cestovního pasu</Label>
                          {ocrFilledFields.has("passport_expiry") && (
                            <div className="flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Z OCR</span>
                            </div>
                          )}
                        </div>
                        <DateInput
                          value={formData.passport_expiry}
                          onChange={(date) =>
                            setFormData({ ...formData, passport_expiry: date })
                          }
                          placeholder="DD.MM.RR"
                          className={ocrFilledFields.has("passport_expiry") ? "border-green-500 bg-green-50" : ""}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="id_card_number">Číslo občanského průkazu</Label>
                          {ocrFilledFields.has("id_card_number") && (
                            <div className="flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Z OCR</span>
                            </div>
                          )}
                        </div>
                        <Input
                          id="id_card_number"
                          value={formData.id_card_number}
                          onChange={(e) =>
                            setFormData({ ...formData, id_card_number: e.target.value })
                          }
                          className={ocrFilledFields.has("id_card_number") ? "border-green-500 bg-green-50" : ""}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="id_card_expiry">Platnost občanského průkazu</Label>
                          {ocrFilledFields.has("id_card_expiry") && (
                            <div className="flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Z OCR</span>
                            </div>
                          )}
                        </div>
                        <DateInput
                          value={formData.id_card_expiry}
                          onChange={(date) =>
                            setFormData({ ...formData, id_card_expiry: date })
                          }
                          placeholder="DD.MM.RR"
                          className={ocrFilledFields.has("id_card_expiry") ? "border-green-500 bg-green-50" : ""}
                        />
                      </div>
                    </div>

                    {editingClient && (
                      <div className="space-y-4 border-t pt-4">
                        <h4 className="font-semibold">Dokumenty</h4>
                        
                        {editingClient.document_urls && editingClient.document_urls.length > 0 && (
                          <DocumentsList
                            clientId={editingClient.id}
                            documents={editingClient.document_urls}
                            onDelete={() => fetchClients()}
                          />
                        )}

                        <div className="space-y-4">
                          <h5 className="text-sm font-medium">Nahrát nové dokumenty</h5>
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
                            if (data.passport_expiry || data.expiry_date) {
                              const dateStr = data.passport_expiry || data.expiry_date;
                              const parts = dateStr.split('.');
                              if (parts.length === 3) {
                                const day = parseInt(parts[0]);
                                const month = parseInt(parts[1]);
                                const year = 2000 + parseInt(parts[2]);
                                setFormData(prev => ({ ...prev, passport_expiry: new Date(year, month - 1, day) }));
                                newFilledFields.add("passport_expiry");
                              }
                            }
                            if (data.date_of_birth) {
                              const parts = data.date_of_birth.split('.');
                              if (parts.length === 3) {
                                const day = parseInt(parts[0]);
                                const month = parseInt(parts[1]);
                                let year = parseInt(parts[2]);
                                // For birth dates: 00-29 = 2000-2029, 30-99 = 1930-1999
                                year += year < 30 ? 2000 : 1900;
                                setFormData(prev => ({ ...prev, date_of_birth: new Date(year, month - 1, day) }));
                                newFilledFields.add("date_of_birth");
                              }
                            }
                            if (data.first_name && !formData.first_name) {
                              setFormData(prev => ({ ...prev, first_name: data.first_name }));
                            }
                            if (data.last_name && !formData.last_name) {
                              setFormData(prev => ({ ...prev, last_name: data.last_name }));
                            }
                            
                            setOcrFilledFields(newFilledFields);
                            
                            // Auto-clear the highlight after 5 seconds
                            setTimeout(() => {
                              setOcrFilledFields(new Set());
                            }, 5000);
                          }}
                          onUploadComplete={() => fetchClients()}
                        />
                        <DocumentUpload
                          clientId={editingClient.id}
                          documentType="id_card"
                          autoSaveToClient={true}
                          onDataExtracted={(data) => {
                            const newFilledFields = new Set(ocrFilledFields);
                            
                            if (data.id_card_number) {
                              setFormData(prev => ({ ...prev, id_card_number: data.id_card_number }));
                              newFilledFields.add("id_card_number");
                            }
                            if (data.id_card_expiry || data.expiry_date) {
                              const dateStr = data.id_card_expiry || data.expiry_date;
                              const parts = dateStr.split('.');
                              if (parts.length === 3) {
                                const day = parseInt(parts[0]);
                                const month = parseInt(parts[1]);
                                const year = 2000 + parseInt(parts[2]);
                                setFormData(prev => ({ ...prev, id_card_expiry: new Date(year, month - 1, day) }));
                                newFilledFields.add("id_card_expiry");
                              }
                            }
                            if (data.date_of_birth) {
                              const parts = data.date_of_birth.split('.');
                              if (parts.length === 3) {
                                const day = parseInt(parts[0]);
                                const month = parseInt(parts[1]);
                                let year = parseInt(parts[2]);
                                // For birth dates: 00-29 = 2000-2029, 30-99 = 1930-1999
                                year += year < 30 ? 2000 : 1900;
                                setFormData(prev => ({ ...prev, date_of_birth: new Date(year, month - 1, day) }));
                                newFilledFields.add("date_of_birth");
                              }
                            }
                            if (data.first_name && !formData.first_name) {
                              setFormData(prev => ({ ...prev, first_name: data.first_name }));
                            }
                            if (data.last_name && !formData.last_name) {
                              setFormData(prev => ({ ...prev, last_name: data.last_name }));
                            }
                            
                            setOcrFilledFields(newFilledFields);
                            
                            // Auto-clear the highlight after 5 seconds
                            setTimeout(() => {
                              setOcrFilledFields(new Set());
                            }, 5000);
                          }}
                          onUploadComplete={() => fetchClients()}
                        />
                        <DocumentUpload
                          clientId={editingClient.id}
                          documentType="other"
                          onUploadComplete={() => fetchClients()}
                        />
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleDialogClose}
                      >
                        Zrušit
                      </Button>
                      <Button type="submit">
                        {editingClient ? "Uložit" : "Přidat"}
                      </Button>
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
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Zatím žádní klienti
            </h2>
            <p className="text-muted-foreground mb-6">Přidejte prvního klienta</p>
          </Card>
        ) : filteredClients.length === 0 ? (
          <Card className="p-12 text-center shadow-[var(--shadow-medium)]">
            <User className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Žádné výsledky
            </h2>
            <p className="text-muted-foreground mb-6">
              Pro hledaný výraz "{searchText}" nebyl nalezen žádný klient
            </p>
            <Button variant="outline" onClick={() => setSearchText("")}>
              Zrušit filtr
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredClients.map((client) => (
              <Card
                key={client.id}
                className="p-6 hover:shadow-[var(--shadow-medium)] transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-xl font-bold text-foreground">
                    {client.first_name} {client.last_name}
                  </h3>
                  <div className="flex gap-2">
                    {client.document_urls && client.document_urls.length > 0 && (
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => setDocumentPreviewClient(client)}
                        title="Zobrazit dokumenty"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleEdit(client)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleDelete(client.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {client.email && (
                    <p>
                      <span className="font-semibold text-foreground">Email:</span>{" "}
                      {client.email}
                    </p>
                  )}
                  {client.phone && (
                    <p>
                      <span className="font-semibold text-foreground">Telefon:</span>{" "}
                      {client.phone}
                    </p>
                  )}
                  {client.address && (
                    <p>
                      <span className="font-semibold text-foreground">Adresa:</span>{" "}
                      {client.address}
                    </p>
                  )}
                  {client.notes && (
                    <p>
                      <span className="font-semibold text-foreground">Poznámky:</span>{" "}
                      {client.notes}
                    </p>
                  )}
                </div>
              </Card>
            ))}
          </div>
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
      </div>
    </div>
  );
};

export default Clients;
