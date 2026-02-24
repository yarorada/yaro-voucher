import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Edit, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { removeDiacritics } from "@/lib/utils";
import { toast } from "sonner";
import { usePageToolbar } from "@/hooks/usePageToolbar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BulkSupplierUpload } from "@/components/BulkSupplierUpload";

interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
}

const Suppliers = () => {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [searchText, setSearchText] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    contact_person: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      toast.error("Chyba při načítání dodavatelů");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Název dodavatele je povinný");
      return;
    }

    try {
      if (editingSupplier) {
        const { error } = await supabase
          .from("suppliers")
          .update({
            name: formData.name.trim(),
            contact_person: formData.contact_person.trim() || null,
            email: formData.email.trim() || null,
            phone: formData.phone.trim() || null,
            address: formData.address.trim() || null,
            notes: formData.notes.trim() || null,
          })
          .eq("id", editingSupplier.id);

        if (error) throw error;
        toast.success("Dodavatel byl aktualizován");
      } else {
        const { error } = await supabase.from("suppliers").insert({
          name: formData.name.trim(),
          contact_person: formData.contact_person.trim() || null,
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          address: formData.address.trim() || null,
          notes: formData.notes.trim() || null,
        });

        if (error) throw error;
        toast.success("Dodavatel byl přidán");
      }

      setFormData({
        name: "",
        contact_person: "",
        email: "",
        phone: "",
        address: "",
        notes: "",
      });
      setEditingSupplier(null);
      setIsDialogOpen(false);
      fetchSuppliers();
    } catch (error: any) {
      if (error.code === "23505") {
        toast.error("Dodavatel s tímto názvem již existuje");
      } else {
        toast.error("Chyba při ukládání dodavatele");
      }
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contact_person: supplier.contact_person || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      address: supplier.address || "",
      notes: supplier.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Opravdu chcete smazat tohoto dodavatele?")) return;

    try {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);

      if (error) throw error;
      toast.success("Dodavatel byl smazán");
      fetchSuppliers();
    } catch (error) {
      toast.error("Chyba při mazání dodavatele");
    }
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingSupplier(null);
    setFormData({
      name: "",
      contact_person: "",
      email: "",
      phone: "",
      address: "",
      notes: "",
    });
  };

  const toolbarButtonClass = "h-8 text-xs bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20";

  const filteredSuppliers = suppliers.filter((s) => {
    if (!searchText.trim()) return true;
    const q = removeDiacritics(searchText.toLowerCase());
    return removeDiacritics(s.name.toLowerCase()).includes(q) || removeDiacritics((s.contact_person || "").toLowerCase()).includes(q) || removeDiacritics((s.email || "").toLowerCase()).includes(q);
  });

  usePageToolbar(
    <>
      <div className="relative w-48 md:w-64">
        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Hledat..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="pl-8 pr-7 h-8 text-xs"
        />
        {searchText && (
          <button onClick={() => setSearchText("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <BulkSupplierUpload onComplete={fetchSuppliers} />
      <Button className={toolbarButtonClass + " gap-1"} onClick={() => setIsDialogOpen(true)}>
        <Plus className="h-3.5 w-3.5" />
        Přidat
      </Button>
    </>,
    [searchText]
  );

  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)]">
      <div className="container max-w-6xl mx-auto py-8 px-4">
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) handleDialogClose();
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background">
                  <DialogHeader>
                    <DialogTitle>
                      {editingSupplier ? "Upravit dodavatele" : "Nový dodavatel"}
                    </DialogTitle>
                    <DialogDescription>
                      Zadejte informace o dodavateli
                    </DialogDescription>
                  </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      Název <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_person">Kontaktní osoba</Label>
                    <Input
                      id="contact_person"
                      value={formData.contact_person}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contact_person: e.target.value,
                        })
                      }
                    />
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
                      {editingSupplier ? "Uložit" : "Přidat"}
                    </Button>
                  </div>
                </form>
                </DialogContent>
        </Dialog>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Načítám dodavatele...</p>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <Card className="p-12 text-center shadow-[var(--shadow-medium)]">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {searchText ? "Žádní dodavatelé nenalezeni" : "Zatím žádní dodavatelé"}
            </h2>
            <p className="text-muted-foreground mb-6">
              {searchText ? "Zkuste změnit hledání" : "Přidejte prvního dodavatele"}
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSuppliers.map((supplier) => (
              <Card
                key={supplier.id}
                className="p-4 md:p-6 hover:shadow-[var(--shadow-medium)] transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg md:text-xl font-bold text-foreground break-words">
                    {supplier.name}
                  </h3>
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleEdit(supplier)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleDelete(supplier.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {supplier.contact_person && (
                    <p>
                      <span className="font-semibold text-foreground">
                        Kontakt:
                      </span>{" "}
                      {supplier.contact_person}
                    </p>
                  )}
                  {supplier.email && (
                    <p>
                      <span className="font-semibold text-foreground">
                        Email:
                      </span>{" "}
                      {supplier.email}
                    </p>
                  )}
                  {supplier.phone && (
                    <p>
                      <span className="font-semibold text-foreground">
                        Telefon:
                      </span>{" "}
                      {supplier.phone}
                    </p>
                  )}
                  {supplier.address && (
                    <p>
                      <span className="font-semibold text-foreground">
                        Adresa:
                      </span>{" "}
                      {supplier.address}
                    </p>
                  )}
                  {supplier.notes && (
                    <p>
                      <span className="font-semibold text-foreground">
                        Poznámky:
                      </span>{" "}
                      {supplier.notes}
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

export default Suppliers;
