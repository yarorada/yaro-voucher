import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

interface Supplier {
  id: string;
  name: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  contact_person: string | null;
}

interface ContractAgencyInfoProps {
  contractId: string;
  agencyName?: string;
  agencyAddress?: string;
  agencyIco?: string;
  agencyContact?: string;
  agencyBankAccount?: string;
  onUpdate: () => void;
}

const YARO_DEFAULTS = {
  name: "YARO s.r.o.",
  address: "Bratranců Veverkových 680, Pardubice, 530 02",
  ico: "07849290",
  contact: "radek@yarotravel.cz, +420 602 102 108",
  bank_account: "227993932/0600",
};

export function ContractAgencyInfo({
  contractId,
  agencyName = YARO_DEFAULTS.name,
  agencyAddress = YARO_DEFAULTS.address,
  agencyIco = YARO_DEFAULTS.ico,
  agencyContact = YARO_DEFAULTS.contact,
  agencyBankAccount = YARO_DEFAULTS.bank_account,
  onUpdate,
}: ContractAgencyInfoProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    agency_name: agencyName,
    agency_address: agencyAddress,
    agency_ico: agencyIco,
    agency_contact: agencyContact,
    agency_bank_account: agencyBankAccount,
  });
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, address, email, phone, contact_person")
        .order("name", { ascending: true });

      if (error) throw error;
      setSuppliers(data || []);

      // Try to match current agency to a supplier
      if (data) {
        const match = data.find(
          (s) => s.name.toLowerCase() === agencyName.toLowerCase()
        );
        if (match) {
          setSelectedSupplierId(match.id);
        }
      }
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    }
  };

  const handleSupplierChange = (supplierId: string) => {
    setSelectedSupplierId(supplierId);
    const supplier = suppliers.find((s) => s.id === supplierId);
    if (supplier) {
      const contactParts = [
        supplier.contact_person,
        supplier.email,
        supplier.phone,
      ].filter(Boolean);

      setFormData({
        agency_name: supplier.name,
        agency_address: supplier.address || "",
        agency_ico: "", // IČO isn't stored in suppliers, keep manual
        agency_contact: contactParts.join(", "),
        agency_bank_account: formData.agency_bank_account, // keep current bank account
      });
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("travel_contracts")
        .update(formData)
        .eq("id", contractId);

      if (error) throw error;

      toast({
        title: "Uloženo",
        description: "Informace o dodavateli byly aktualizovány",
      });
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error("Error updating agency info:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se uložit informace",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-4 md:p-6">
      <div className="flex flex-row items-center justify-between mb-4">
        <h2 className="text-heading-2 text-foreground">
          Dodavatel
        </h2>
        {!isEditing && (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            Upravit
          </Button>
        )}
      </div>
      <div>
        {isEditing ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Vybrat dodavatele z databáze</Label>
              <Select
                value={selectedSupplierId}
                onValueChange={handleSupplierChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vyberte dodavatele..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border-t pt-4 space-y-4">
              <p className="text-xs text-muted-foreground">
                Údaje můžete dále upravit ručně:
              </p>
              <div className="space-y-2">
                <Label htmlFor="agency_name">Název</Label>
                <Input
                  id="agency_name"
                  value={formData.agency_name}
                  onChange={(e) =>
                    setFormData({ ...formData, agency_name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agency_address">Adresa</Label>
                <Input
                  id="agency_address"
                  value={formData.agency_address}
                  onChange={(e) =>
                    setFormData({ ...formData, agency_address: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agency_ico">IČO</Label>
                <Input
                  id="agency_ico"
                  value={formData.agency_ico}
                  onChange={(e) =>
                    setFormData({ ...formData, agency_ico: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agency_contact">Kontakt</Label>
                <Input
                  id="agency_contact"
                  value={formData.agency_contact}
                  onChange={(e) =>
                    setFormData({ ...formData, agency_contact: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                Uložit
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  setFormData({
                    agency_name: agencyName,
                    agency_address: agencyAddress,
                    agency_ico: agencyIco,
                    agency_contact: agencyContact,
                    agency_bank_account: agencyBankAccount,
                  });
                }}
              >
                Zrušit
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="font-semibold text-foreground">{formData.agency_name}</p>
            </div>
            {formData.agency_address && (
              <div>
                <p className="text-sm text-muted-foreground">Adresa</p>
                <p className="text-foreground">{formData.agency_address}</p>
              </div>
            )}
            {formData.agency_ico && (
              <div>
                <p className="text-sm text-muted-foreground">IČO</p>
                <p className="text-foreground">{formData.agency_ico}</p>
              </div>
            )}
            {formData.agency_contact && (
              <div>
                <p className="text-sm text-muted-foreground">Kontakt</p>
                <p className="text-foreground">{formData.agency_contact}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
