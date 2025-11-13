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
import { Plus, ArrowLeft, LogOut, Trash2, Edit, User, Users, CheckCircle2, Search, FileUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import yaroLogo from "@/assets/yaro-logo-wide.png";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Client {
  id: string;
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
  const { signOut } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkImportText, setBulkImportText] = useState("");
  const [bulkDocumentUploadOpen, setBulkDocumentUploadOpen] = useState(false);
  const [ocrFilledFields, setOcrFilledFields] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState("");

  const [formData, setFormData] = useState({
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
            first_name: formData.first_name.trim(),
            last_name: formData.last_name.trim(),
            email: formData.email.trim() || null,
            phone: formData.phone.trim() || null,
            address: formData.address.trim() || null,
            notes: formData.notes.trim() || null,
            date_of_birth: formData.date_of_birth?.toISOString().split('T')[0] || null,
            passport_number: formData.passport_number.trim() || null,
            passport_expiry: formData.passport_expiry?.toISOString().split('T')[0] || null,
            id_card_number: formData.id_card_number.trim() || null,
            id_card_expiry: formData.id_card_expiry?.toISOString().split('T')[0] || null,
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
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          address: formData.address.trim() || null,
          date_of_birth: formData.date_of_birth?.toISOString().split('T')[0] || null,
          passport_number: formData.passport_number.trim() || null,
          passport_expiry: formData.passport_expiry?.toISOString().split('T')[0] || null,
          id_card_number: formData.id_card_number.trim() || null,
          id_card_expiry: formData.id_card_expiry?.toISOString().split('T')[0] || null,
          notes: formData.notes.trim() || null,
        });

        if (error) throw error;
        toast.success("Klient byl přidán");
      }

      setFormData({
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
      first_name: client.first_name,
      last_name: client.last_name,
      email: client.email || "",
      phone: client.phone || "",
      address: client.address || "",
      notes: client.notes || "",
      date_of_birth: client.date_of_birth ? new Date(client.date_of_birth) : undefined,
      passport_number: client.passport_number || "",
      passport_expiry: client.passport_expiry ? new Date(client.passport_expiry) : undefined,
      id_card_number: client.id_card_number || "",
      id_card_expiry: client.id_card_expiry ? new Date(client.id_card_expiry) : undefined,
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

  const handleCleanupDiacritics = async () => {
    if (!confirm("Tato operace odstraní diakritiku ze všech klientů a sloučí duplicity. Pokračovat?")) {
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('cleanup-clients-diacritics');

      if (error) throw error;

      if (data?.success) {
        toast.success(`Úspěšně zpracováno: ${data.updated} aktualizováno, ${data.merged} sloučeno`);
        fetchClients();
      } else {
        throw new Error(data?.error || 'Unknown error');
      }
    } catch (error: any) {
      console.error('Error cleaning up diacritics:', error);
      toast.error(`Chyba při čištění diakritiky: ${error.message}`);
    }
  };

  const handleBulkImport = async () => {
    const lines = bulkImportText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      toast.error("Vložte alespoň jednoho klienta");
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    let updatedCount = 0;

    // Fetch all clients once for comparison
    const { data: allClients } = await supabase
      .from("clients")
      .select("id, first_name, last_name");

    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length < 2) {
        errorCount++;
        continue;
      }

      const first_name = parts[0];
      const last_name = parts.length >= 3 ? parts[1] : parts.slice(1).join(" ");
      const email = parts.length >= 3 ? parts[2] : null;

      try {
        const normalizedFirstName = removeDiacritics(first_name.trim().toLowerCase());
        const normalizedLastName = removeDiacritics(last_name.trim().toLowerCase());

        // Check for duplicate using normalized comparison
        const existingClient = allClients?.find(client => 
          removeDiacritics(client.first_name.toLowerCase()) === normalizedFirstName &&
          removeDiacritics(client.last_name.toLowerCase()) === normalizedLastName
        );

        if (existingClient) {
          // Update existing client
          const { error } = await supabase
            .from("clients")
            .update({
              email: email ? email.trim() : null,
            })
            .eq("id", existingClient.id);

          if (error) throw error;
          updatedCount++;
        } else {
          // Insert new client with diacritics preserved
          const { error } = await supabase.from("clients").insert({
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            email: email ? email.trim() : null,
          });

          if (error) throw error;
          successCount++;
        }
      } catch (error) {
        console.error("Error processing client:", error);
        errorCount++;
      }
    }

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
  };

  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)]">
      <div className="container max-w-6xl mx-auto py-8 px-4">
        <header className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              onClick={() => navigate("/")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Domů
            </Button>
            <div className="flex items-center gap-4">
              <img src={yaroLogo} alt="YARO Travel" className="h-12" />
              <Button variant="outline" onClick={signOut} className="gap-2">
                <LogOut className="h-4 w-4" />
                Odhlásit
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h1 className="text-4xl font-bold text-foreground">Klienti</h1>
                <p className="text-muted-foreground mt-2">
                  Správa klientů a cestujících
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="gap-2 shrink-0"
                  onClick={handleCleanupDiacritics}
                >
                  Odstranit diakritiku
                </Button>
                <Dialog open={bulkDocumentUploadOpen} onOpenChange={setBulkDocumentUploadOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2 shrink-0">
                      <FileUp className="h-4 w-4" />
                      Nahrát dokumenty
                    </Button>
                  </DialogTrigger>
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
                <Dialog open={bulkImportOpen} onOpenChange={setBulkImportOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2 shrink-0">
                      <Users className="h-4 w-4" />
                      Hromadný import
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl bg-background">
                    <DialogHeader>
                      <DialogTitle>Hromadný import klientů</DialogTitle>
                      <DialogDescription>
                        Vložte jména a příjmení klientů, každý na nový řádek ve
                        formátu "Jméno Příjmení" nebo "Jméno Příjmení Email"
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Textarea
                        value={bulkImportText}
                        onChange={(e) => setBulkImportText(e.target.value)}
                        placeholder="Jan Novák jan.novak@email.cz&#10;Petr Dvořák&#10;Marie Svobodová marie@email.cz"
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
                        <Button onClick={handleBulkImport}>Importovat</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog
                  open={isDialogOpen}
                  onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) handleDialogClose();
                  }}
                >
                  <DialogTrigger asChild>
                    <Button variant="default" className="gap-2 shrink-0">
                      <Plus className="h-4 w-4" />
                      Přidat klienta
                    </Button>
                  </DialogTrigger>
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
                            if (data.expiry_date) {
                              const parts = data.expiry_date.split('.');
                              if (parts.length === 3) {
                                const day = parseInt(parts[0]);
                                const month = parseInt(parts[1]);
                                const year = 2000 + parseInt(parts[2]);
                                setFormData(prev => ({ ...prev, passport_expiry: new Date(Date.UTC(year, month - 1, day)) }));
                                newFilledFields.add("passport_expiry");
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
                            if (data.expiry_date) {
                              const parts = data.expiry_date.split('.');
                              if (parts.length === 3) {
                                const day = parseInt(parts[0]);
                                const month = parseInt(parts[1]);
                                const year = 2000 + parseInt(parts[2]);
                                setFormData(prev => ({ ...prev, id_card_expiry: new Date(Date.UTC(year, month - 1, day)) }));
                                newFilledFields.add("id_card_expiry");
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
              </div>
            </div>
          </div>
        </header>

        {/* Search Bar */}
        {!loading && clients.length > 0 && (
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Hledat klienta podle jména nebo emailu..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        )}

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
      </div>
    </div>
  );
};

export default Clients;
