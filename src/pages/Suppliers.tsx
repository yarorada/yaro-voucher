import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Edit, X } from "lucide-react";
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
import { SmartSearchInput } from "@/components/SmartSearchInput";

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
    <div className="flex items-center gap-2">
      <SmartSearchInput
        value={searchText}
        onChange={setSearchText}
        noResults={filteredSuppliers.length === 0 && !loading}
        addLabel={`dodavatele „{text}"`}
        onAddNew={(text) => {
          setFormData({ name: text, contact_person: "", email: "", phone: "", address: "", notes: "" });
          setEditingSupplier(null);
          setIsDialogOpen(true);
        }}
        placeholder="Hledat dodavatele..."
        className="w-48 md:w-64"
        inputClassName="h-8 text-xs"
      />
      <BulkSupplierUpload onComplete={fetchSuppliers} />
    </div>,
    [searchText, filteredSuppliers.length, loading]
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
            <h2 className="text-heading-2 text-foreground mb-2">
              {searchText ? "Žádní dodavatelé nenalezeni" : "Zatím žádní dodavatelé"}
            </h2>
            <p className="text-body text-muted-foreground mb-6">
              {searchText ? "Zkuste změnit hledání" : "Přidejte prvního dodavatele"}
            </p>
          </Card>
        ) : (
          <Card className="shadow-[var(--shadow-medium)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-primary">Název dodavatele</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Kontaktní osoba</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Telefon</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Adresa</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Akce</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.map((supplier) => (
                    <tr key={supplier.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">
                        {supplier.name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {supplier.contact_person || <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {supplier.email ? (
                          <a href={`mailto:${supplier.email}`} className="hover:text-primary transition-colors">
                            {supplier.email}
                          </a>
                        ) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {supplier.phone || <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {supplier.address || <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleEdit(supplier)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(supplier.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Suppliers;
