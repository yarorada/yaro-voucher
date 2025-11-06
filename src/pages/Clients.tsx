import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, ArrowLeft, LogOut, Trash2, Edit, User, Users } from "lucide-react";
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

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
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
      setClients(data || []);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      toast.error("Jméno a příjmení jsou povinné");
      return;
    }

    try {
      if (editingClient) {
        const { error } = await supabase
          .from("clients")
          .update({
            first_name: removeDiacritics(formData.first_name.trim()),
            last_name: removeDiacritics(formData.last_name.trim()),
            email: formData.email.trim() || null,
            phone: formData.phone.trim() || null,
            address: formData.address.trim() || null,
            notes: formData.notes.trim() || null,
          })
          .eq("id", editingClient.id);

        if (error) throw error;
        toast.success("Klient byl aktualizován");
      } else {
        // Check for duplicate
        const { data: existingClient } = await supabase
          .from("clients")
          .select("id")
          .eq("first_name", removeDiacritics(formData.first_name.trim()))
          .eq("last_name", removeDiacritics(formData.last_name.trim()))
          .maybeSingle();

        if (existingClient) {
          toast.error("Klient s tímto jménem již existuje");
          return;
        }

        const { error } = await supabase.from("clients").insert({
          first_name: removeDiacritics(formData.first_name.trim()),
          last_name: removeDiacritics(formData.last_name.trim()),
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          address: formData.address.trim() || null,
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
    setFormData({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      address: "",
      notes: "",
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
        // Check for duplicate
        const { data: existingClient } = await supabase
          .from("clients")
          .select("id")
          .eq("first_name", removeDiacritics(first_name.trim()))
          .eq("last_name", removeDiacritics(last_name.trim()))
          .maybeSingle();

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
          // Insert new client
          const { error } = await supabase.from("clients").insert({
            first_name: removeDiacritics(first_name.trim()),
            last_name: removeDiacritics(last_name.trim()),
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
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {clients.map((client) => (
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
