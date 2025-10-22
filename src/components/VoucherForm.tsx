import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface Service {
  name: string;
  date: string;
  time: string;
  provider: string;
  price: string;
}

export const VoucherForm = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [clientName, setClientName] = useState("");
  const [otherTravelers, setOtherTravelers] = useState<string[]>([""]);
  const [expirationDate, setExpirationDate] = useState("");
  const [services, setServices] = useState<Service[]>([
    { name: "", date: "", time: "", provider: "", price: "" },
  ]);

  const addTraveler = () => {
    setOtherTravelers([...otherTravelers, ""]);
  };

  const removeTraveler = (index: number) => {
    setOtherTravelers(otherTravelers.filter((_, i) => i !== index));
  };

  const updateTraveler = (index: number, value: string) => {
    const updated = [...otherTravelers];
    updated[index] = value;
    setOtherTravelers(updated);
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
    
    if (!clientName.trim()) {
      toast.error("Please enter client name");
      return;
    }

    if (services.some(s => !s.name.trim())) {
      toast.error("Please fill in all service names");
      return;
    }

    setLoading(true);

    try {
      // Generate voucher code
      const { data: codeData, error: codeError } = await supabase
        .rpc('generate_voucher_code');

      if (codeError) throw codeError;

      // Get the voucher number from the code
      const voucherNumber = parseInt(codeData.split('-')[1]);

      // Filter out empty travelers
      const travelers = otherTravelers.filter(t => t.trim() !== "");

      // Insert voucher
      const { error: insertError } = await supabase
        .from('vouchers')
        .insert({
          voucher_code: codeData,
          voucher_number: voucherNumber,
          client_name: clientName.trim(),
          other_travelers: travelers.length > 0 ? travelers : null,
          services: services as any,
          expiration_date: expirationDate || null,
        });

      if (insertError) throw insertError;

      toast.success("Voucher created successfully!");
      navigate('/vouchers');
    } catch (error) {
      console.error('Error creating voucher:', error);
      toast.error("Failed to create voucher");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="p-6 shadow-[var(--shadow-medium)]">
        <h2 className="text-2xl font-bold mb-4 text-foreground">Client Information</h2>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="clientName">Main Client Name *</Label>
            <Input
              id="clientName"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Enter client name"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Other Travelers (Optional)</Label>
              <Button type="button" onClick={addTraveler} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Add Traveler
              </Button>
            </div>
            {otherTravelers.map((traveler, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <Input
                  value={traveler}
                  onChange={(e) => updateTraveler(index, e.target.value)}
                  placeholder="Traveler name"
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
            <Label htmlFor="expirationDate">Expiration Date (Optional)</Label>
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
          <h2 className="text-2xl font-bold text-foreground">Services</h2>
          <Button type="button" onClick={addService} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" />
            Add Service
          </Button>
        </div>

        <div className="space-y-6">
          {services.map((service, index) => (
            <Card key={index} className="p-4 bg-muted">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold text-foreground">Service {index + 1}</h3>
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
                  <Label>Service Name *</Label>
                  <Input
                    value={service.name}
                    onChange={(e) => updateService(index, "name", e.target.value)}
                    placeholder="e.g., Hotel Stay, Golf Tee Time"
                    required
                  />
                </div>
                <div>
                  <Label>Provider</Label>
                  <Input
                    value={service.provider}
                    onChange={(e) => updateService(index, "provider", e.target.value)}
                    placeholder="Provider name"
                  />
                </div>
                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={service.date}
                    onChange={(e) => updateService(index, "date", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={service.time}
                    onChange={(e) => updateService(index, "time", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Price</Label>
                  <Input
                    value={service.price}
                    onChange={(e) => updateService(index, "price", e.target.value)}
                    placeholder="e.g., $500"
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
        {loading ? "Creating Voucher..." : "Create Voucher"}
      </Button>
    </form>
  );
};
