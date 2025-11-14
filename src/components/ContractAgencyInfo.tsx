import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Building2, Save } from "lucide-react";

interface ContractAgencyInfoProps {
  contractId: string;
  agencyName?: string;
  agencyAddress?: string;
  agencyIco?: string;
  agencyContact?: string;
  onUpdate: () => void;
}

export function ContractAgencyInfo({
  contractId,
  agencyName = "YARO Travel s.r.o.",
  agencyAddress = "",
  agencyIco = "",
  agencyContact = "",
  onUpdate,
}: ContractAgencyInfoProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    agency_name: agencyName,
    agency_address: agencyAddress,
    agency_ico: agencyIco,
    agency_contact: agencyContact,
  });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      // @ts-ignore - Supabase types not updated after migration
      const { error } = await (supabase as any)
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-heading-2 flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Dodavatel služeb
        </CardTitle>
        {!isEditing && (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            Upravit
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {isEditing ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="agency_name">Název agentury</Label>
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
                  });
                }}
              >
                Zrušit
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-body font-semibold">{formData.agency_name}</p>
            </div>
            {formData.agency_address && (
              <div>
                <p className="text-sm text-muted-foreground">Adresa</p>
                <p className="text-body">{formData.agency_address}</p>
              </div>
            )}
            {formData.agency_ico && (
              <div>
                <p className="text-sm text-muted-foreground">IČO</p>
                <p className="text-body">{formData.agency_ico}</p>
              </div>
            )}
            {formData.agency_contact && (
              <div>
                <p className="text-sm text-muted-foreground">Kontakt</p>
                <p className="text-body">{formData.agency_contact}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
