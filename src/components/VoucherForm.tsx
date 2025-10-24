import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { SupplierCombobox } from "@/components/SupplierCombobox";
import { ClientCombobox } from "@/components/ClientCombobox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Service {
  name: string;
  pax: string;
  qty: string;
  dateFrom: string;
  dateTo: string;
}

interface VoucherFormProps {
  voucherId?: string;
  initialData?: {
    clientId: string;
    otherTravelerIds: string[];
    expirationDate: string;
    services: Service[];
    hotelName: string;
  };
}

export const VoucherForm = ({ voucherId, initialData }: VoucherFormProps) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [clientId, setClientId] = useState(initialData?.clientId || "");
  const [hotelName, setHotelName] = useState(initialData?.hotelName || "");
  const [otherTravelerIds, setOtherTravelerIds] = useState<string[]>(initialData?.otherTravelerIds || []);
  const [expirationDate, setExpirationDate] = useState(initialData?.expirationDate || "");
  const [services, setServices] = useState<Service[]>(
    initialData?.services || [{ name: "", pax: "", qty: "", dateFrom: "", dateTo: "" }]
  );
  const [bulkImportText, setBulkImportText] = useState("");
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

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

  const handleBulkImport = async () => {
    if (!bulkImportText.trim()) {
      toast.error("Prosím zadejte jména");
      return;
    }

    setLoading(true);
    try {
      const lines = bulkImportText.split('\n').filter(line => line.trim());
      const newTravelerIds: string[] = [];

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        const parts = trimmedLine.split(/\s+/);
        if (parts.length < 2) {
          toast.error(`Neplatný formát: "${trimmedLine}". Použijte formát "Jméno Příjmení"`);
          continue;
        }

        const firstName = parts[0];
        const lastName = parts.slice(1).join(' ');

        // Check if client exists
        const { data: existingClient } = await supabase
          .from('clients')
          .select('id')
          .eq('first_name', firstName)
          .eq('last_name', lastName)
          .maybeSingle();

        if (existingClient) {
          newTravelerIds.push(existingClient.id);
        } else {
          // Create new client
          const { data: newClient, error } = await supabase
            .from('clients')
            .insert({
              first_name: firstName,
              last_name: lastName,
            })
            .select('id')
            .single();

          if (error) throw error;
          if (newClient) {
            newTravelerIds.push(newClient.id);
          }
        }
      }

      setOtherTravelerIds([...otherTravelerIds, ...newTravelerIds]);
      setBulkImportText("");
      setBulkImportOpen(false);
      toast.success(`Přidáno ${newTravelerIds.length} cestujících`);
    } catch (error) {
      console.error('Error bulk importing:', error);
      toast.error("Nepodařilo se importovat cestující");
    } finally {
      setLoading(false);
    }
  };

  const addService = () => {
    setServices([
      ...services,
      { name: "", pax: "", qty: "", dateFrom: "", dateTo: "" },
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

    if (!hotelName.trim()) {
      toast.error("Prosím zadejte název hotelu");
      return;
    }

    if (services.some(s => !s.name.trim())) {
      toast.error("Prosím vyplňte všechny názvy služeb");
      return;
    }

    // Calculate expiration date as the latest dateTo from all services
    const calculatedExpirationDate = services
      .map(s => s.dateTo)
      .filter(date => date !== "")
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null;

    setLoading(true);

    try {
      if (voucherId) {
        // UPDATE MODE
        // Update voucher
        const { error: updateError } = await supabase
          .from('vouchers')
          .update({
            client_id: clientId,
            hotel_name: hotelName.trim(),
            services: services as any,
            expiration_date: calculatedExpirationDate,
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
            hotel_name: hotelName.trim(),
            services: services as any,
            expiration_date: calculatedExpirationDate,
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
            <Label htmlFor="hotelName">Název hotelu *</Label>
            <Input
              id="hotelName"
              value={hotelName}
              onChange={(e) => setHotelName(e.target.value)}
              placeholder="např. Hotel Paradise, Resort Sunshine"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Další cestující (nepovinné)</Label>
              <div className="flex gap-2">
                <Dialog open={bulkImportOpen} onOpenChange={setBulkImportOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" size="sm" variant="outline">
                      <Users className="h-4 w-4 mr-1" />
                      Hromadný import
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Hromadný import cestujících</DialogTitle>
                      <DialogDescription>
                        Zadejte jména a příjmení, každé na nový řádek ve formátu "Jméno Příjmení"
                      </DialogDescription>
                    </DialogHeader>
                    <Textarea
                      placeholder="Jan Novák&#10;Marie Svobodová&#10;Petr Dvořák"
                      value={bulkImportText}
                      onChange={(e) => setBulkImportText(e.target.value)}
                      rows={10}
                      className="font-mono"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setBulkImportOpen(false)}
                      >
                        Zrušit
                      </Button>
                      <Button
                        type="button"
                        onClick={handleBulkImport}
                        disabled={loading}
                      >
                        Importovat
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button type="button" onClick={addTraveler} size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  Přidat cestujícího
                </Button>
              </div>
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
            <Label htmlFor="expirationDate">Datum expirace</Label>
            <Input
              id="expirationDate"
              type="text"
              value="Automaticky ze služeb (nejzazší datum)"
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Datum expirace bude automaticky nastaveno na nejzazší datum ze všech služeb
            </p>
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
                <div className="md:col-span-2">
                  <Label>Název služby *</Label>
                  <Input
                    value={service.name}
                    onChange={(e) => updateService(index, "name", e.target.value)}
                    placeholder="např. Pobyt v hotelu, Golf Tee Time"
                    required
                  />
                </div>
                <div>
                  <Label>PAX</Label>
                  <Input
                    value={service.pax}
                    onChange={(e) => updateService(index, "pax", e.target.value)}
                    placeholder="např. 2 ADT"
                  />
                </div>
                <div>
                  <Label>Qtd.</Label>
                  <Input
                    value={service.qty}
                    onChange={(e) => updateService(index, "qty", e.target.value)}
                    placeholder="např. 1"
                  />
                </div>
                <div>
                  <Label>Datum od</Label>
                  <Input
                    type="date"
                    value={service.dateFrom}
                    onChange={(e) => updateService(index, "dateFrom", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Datum do</Label>
                  <Input
                    type="date"
                    value={service.dateTo}
                    onChange={(e) => updateService(index, "dateTo", e.target.value)}
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
