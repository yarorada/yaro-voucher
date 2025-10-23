import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { SupplierCombobox } from "@/components/SupplierCombobox";
import { ClientCombobox } from "@/components/ClientCombobox";

interface Service {
  name: string;
  date: string;
  time: string;
  provider: string;
  price: string;
}

interface VoucherFormProps {
  voucherId?: string;
  initialData?: {
    clientId: string;
    otherTravelerIds: string[];
    expirationDate: string;
    services: Service[];
  };
}

export const VoucherForm = ({ voucherId, initialData }: VoucherFormProps) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [clientId, setClientId] = useState(initialData?.clientId || "");
  const [otherTravelerIds, setOtherTravelerIds] = useState<string[]>(initialData?.otherTravelerIds || []);
  const [expirationDate, setExpirationDate] = useState(initialData?.expirationDate || "");
  const [services, setServices] = useState<Service[]>(
    initialData?.services || [{ name: "", date: "", time: "", provider: "", price: "" }]
  );

  const addTraveler = () => {
    setOtherTravelerIds([...otherTravelerIds, ""]);
  };

  const removeTraveler = (index: number) => {
    setOtherTravelerIds(otherTravelerIds.filter((_, i) => i !== index));
  };

  const updateTraveler = (index: number, value: string) => {
    const updated = [...otherTravelerIds];
    updated[index] = value;
    setOtherTravelerIds(updated);
  };

  const addService = () => {
    setServices([
      ...services,
      { name: "", date: "", time: "", provider: "", price: "" },
    ]);
  };

  const removeService = (index: number) => {
    if (services.length > 1) {
      setServices(services.filter((_, i) => i !== index));
    }
  };

  const updateService = (index: number, field: keyof Service, value: string) => {
    const updated = [...services];
    updated[index][field] = value;
    setServices(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clientId) {
      toast.error("Prosím vyberte klienta");
      return;
    }

    if (services.some(s => !s.name.trim())) {
      toast.error("Prosím vyplňte všechny názvy služeb");
      return;
    }

    setLoading(true);

    try {
      if (voucherId) {
        // UPDATE MODE
        // Update voucher
        const { error: updateError } = await supabase
          .from('vouchers')
          .update({
            client_id: clientId,
            services: services as any,
            expiration_date: expirationDate || null,
          })
          .eq('id', voucherId);

        if (updateError) throw updateError;

        // Delete existing traveler relations
        await supabase
          .from('voucher_travelers')
          .delete()
          .eq('voucher_id', voucherId);

        // Insert main client relation
        await supabase.from('voucher_travelers').insert({
          voucher_id: voucherId,
          client_id: clientId,
          is_main_client: true,
        });

        // Insert other travelers
        const filteredTravelers = otherTravelerIds.filter(id => id !== "");
        if (filteredTravelers.length > 0) {
          await supabase.from('voucher_travelers').insert(
            filteredTravelers.map(id => ({
              voucher_id: voucherId,
              client_id: id,
              is_main_client: false,
            }))
          );
        }

        toast.success("Voucher úspěšně aktualizován!");
        navigate('/vouchers');
      } else {
        // CREATE MODE
        // Generate voucher code
        const { data: codeData, error: codeError } = await supabase
          .rpc('generate_voucher_code');

        if (codeError) throw codeError;

        // Get the voucher number from the code
        const voucherNumber = parseInt(codeData.split('-')[1]);

        // Insert voucher
        const { data: voucherData, error: insertError } = await supabase
          .from('vouchers')
          .insert({
            voucher_code: codeData,
            voucher_number: voucherNumber,
            client_id: clientId,
            client_name: "", // Keep for backwards compatibility, but will be derived from client_id
            services: services as any,
            expiration_date: expirationDate || null,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Insert main client relation
        await supabase.from('voucher_travelers').insert({
          voucher_id: voucherData.id,
          client_id: clientId,
          is_main_client: true,
        });

        // Insert other travelers
        const filteredTravelers = otherTravelerIds.filter(id => id !== "");
        if (filteredTravelers.length > 0) {
          await supabase.from('voucher_travelers').insert(
            filteredTravelers.map(id => ({
              voucher_id: voucherData.id,
              client_id: id,
              is_main_client: false,
            }))
          );
        }

        toast.success("Voucher úspěšně vytvořen!");
        navigate('/vouchers');
      }
    } catch (error) {
      console.error('Error saving voucher:', error);
      toast.error(voucherId ? "Nepodařilo se aktualizovat voucher" : "Nepodařilo se vytvořit voucher");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="p-6 shadow-[var(--shadow-medium)]">
        <h2 className="text-2xl font-bold mb-4 text-foreground">Informace o klientovi</h2>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="clientId">Hlavní klient *</Label>
            <ClientCombobox
              value={clientId}
              onChange={setClientId}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Další cestující (nepovinné)</Label>
              <Button type="button" onClick={addTraveler} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Přidat cestujícího
              </Button>
            </div>
            {otherTravelerIds.map((travelerId, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <ClientCombobox
                  value={travelerId}
                  onChange={(value) => updateTraveler(index, value)}
                />
                <Button
                  type="button"
                  onClick={() => removeTraveler(index)}
                  variant="outline"
                  size="icon"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div>
            <Label htmlFor="expirationDate">Datum expirace (nepovinné)</Label>
            <Input
              id="expirationDate"
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
            />
          </div>
        </div>
      </Card>

      <Card className="p-6 shadow-[var(--shadow-medium)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-foreground">Služby</h2>
          <Button type="button" onClick={addService} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" />
            Přidat službu
          </Button>
        </div>

        <div className="space-y-6">
          {services.map((service, index) => (
            <Card key={index} className="p-4 bg-muted">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold text-foreground">Služba {index + 1}</h3>
                {services.length > 1 && (
                  <Button
                    type="button"
                    onClick={() => removeService(index)}
                    variant="outline"
                    size="sm"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Název služby *</Label>
                  <Input
                    value={service.name}
                    onChange={(e) => updateService(index, "name", e.target.value)}
                    placeholder="např. Pobyt v hotelu, Golf Tee Time"
                    required
                  />
                </div>
                <div>
                  <Label>Dodavatel</Label>
                  <SupplierCombobox
                    value={service.provider}
                    onChange={(value) => updateService(index, "provider", value)}
                  />
                </div>
                <div>
                  <Label>Datum</Label>
                  <Input
                    type="date"
                    value={service.date}
                    onChange={(e) => updateService(index, "date", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Čas</Label>
                  <Input
                    type="time"
                    value={service.time}
                    onChange={(e) => updateService(index, "time", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Cena</Label>
                  <Input
                    value={service.price}
                    onChange={(e) => updateService(index, "price", e.target.value)}
                    placeholder="např. 500 Kč"
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Card>

      <Button 
        type="submit" 
        size="lg" 
        className="w-full bg-[var(--gradient-primary)] hover:opacity-90"
        disabled={loading}
      >
        {loading 
          ? (voucherId ? "Ukládám změny..." : "Vytvářím voucher...") 
          : (voucherId ? "Uložit změny" : "Vytvořit voucher")
        }
      </Button>
    </form>
  );
};
