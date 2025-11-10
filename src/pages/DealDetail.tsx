import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { DestinationCombobox } from "@/components/DestinationCombobox";
import { ClientCombobox } from "@/components/ClientCombobox";
import { DealStatusBadge } from "@/components/DealStatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Deal {
  id: string;
  deal_number: string;
  status: "inquiry" | "quote" | "confirmed" | "cancelled" | "completed";
  start_date: string | null;
  end_date: string | null;
  total_price: number | null;
  deposit_amount: number | null;
  deposit_paid: boolean;
  notes: string | null;
  destination_id: string | null;
  destination?: {
    id: string;
    name: string;
  };
  deal_travelers: Array<{
    client_id: string;
    is_lead_traveler: boolean;
    clients: {
      id: string;
      first_name: string;
      last_name: string;
    };
  }>;
}

const DealDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deal, setDeal] = useState<Deal | null>(null);

  // Form state
  const [status, setStatus] = useState<"inquiry" | "quote" | "confirmed" | "cancelled" | "completed">("inquiry");
  const [destinationId, setDestinationId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositPaid, setDepositPaid] = useState(false);
  const [notes, setNotes] = useState("");
  const [leadTravelerId, setLeadTravelerId] = useState("");

  useEffect(() => {
    fetchDeal();
  }, [id]);

  const fetchDeal = async () => {
    try {
      const { data, error } = await supabase
        .from("deals")
        .select(`
          *,
          destination:destinations(id, name),
          deal_travelers(
            client_id,
            is_lead_traveler,
            clients(id, first_name, last_name)
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;

      setDeal(data);
      setStatus(data.status);
      setDestinationId(data.destination_id || "");
      setStartDate(data.start_date || "");
      setEndDate(data.end_date || "");
      setTotalPrice(data.total_price?.toString() || "");
      setDepositAmount(data.deposit_amount?.toString() || "");
      setDepositPaid(data.deposit_paid || false);
      setNotes(data.notes || "");
      
      const leadTraveler = data.deal_travelers.find((t: any) => t.is_lead_traveler);
      if (leadTraveler) {
        setLeadTravelerId(leadTraveler.client_id);
      }
    } catch (error) {
      console.error("Error fetching deal:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se načíst detail obchodního případu",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!deal) return;

    setSaving(true);
    try {
      // Update deal
      const { error: dealError } = await supabase
        .from("deals")
        .update({
          status,
          destination_id: destinationId || null,
          start_date: startDate || null,
          end_date: endDate || null,
          total_price: totalPrice ? parseFloat(totalPrice) : null,
          deposit_amount: depositAmount ? parseFloat(depositAmount) : null,
          deposit_paid: depositPaid,
          notes: notes || null,
        })
        .eq("id", deal.id);

      if (dealError) throw dealError;

      // Update lead traveler if changed
      if (leadTravelerId) {
        // Remove old lead traveler status
        await supabase
          .from("deal_travelers")
          .update({ is_lead_traveler: false })
          .eq("deal_id", deal.id);

        // Set new lead traveler or create if doesn't exist
        const { data: existingTraveler } = await supabase
          .from("deal_travelers")
          .select()
          .eq("deal_id", deal.id)
          .eq("client_id", leadTravelerId)
          .single();

        if (existingTraveler) {
          await supabase
            .from("deal_travelers")
            .update({ is_lead_traveler: true })
            .eq("deal_id", deal.id)
            .eq("client_id", leadTravelerId);
        } else {
          await supabase
            .from("deal_travelers")
            .insert({
              deal_id: deal.id,
              client_id: leadTravelerId,
              is_lead_traveler: true,
            });
        }
      }

      toast({
        title: "Úspěch",
        description: "Obchodní případ byl aktualizován",
      });

      fetchDeal();
    } catch (error) {
      console.error("Error updating deal:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se aktualizovat obchodní případ",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deal || !confirm("Opravdu chcete smazat tento obchodní případ?")) return;

    try {
      const { error } = await supabase
        .from("deals")
        .delete()
        .eq("id", deal.id);

      if (error) throw error;

      toast({
        title: "Úspěch",
        description: "Obchodní případ byl smazán",
      });

      navigate("/deals");
    } catch (error) {
      console.error("Error deleting deal:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se smazat obchodní případ",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Načítání...</p>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Obchodní případ nenalezen</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/deals")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{deal.deal_number}</h1>
              <p className="text-muted-foreground">Detail obchodního případu</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Smazat
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Ukládám..." : "Uložit"}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Základní informace</CardTitle>
            <CardDescription>Upravte základní údaje obchodního případu</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="status">Stav</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inquiry">Poptávka</SelectItem>
                  <SelectItem value="quote">Nabídka odeslána</SelectItem>
                  <SelectItem value="confirmed">Potvrzeno</SelectItem>
                  <SelectItem value="cancelled">Zrušeno</SelectItem>
                  <SelectItem value="completed">Dokončeno</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="leadTraveler">Hlavní cestující</Label>
              <ClientCombobox
                value={leadTravelerId}
                onChange={setLeadTravelerId}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="destination">Destinace</Label>
              <DestinationCombobox
                value={destinationId}
                onValueChange={setDestinationId}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Datum zahájení</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Datum ukončení</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="totalPrice">Celková cena (Kč)</Label>
                <Input
                  id="totalPrice"
                  type="number"
                  value={totalPrice}
                  onChange={(e) => setTotalPrice(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="depositAmount">Záloha (Kč)</Label>
                <Input
                  id="depositAmount"
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="depositPaid"
                checked={depositPaid}
                onChange={(e) => setDepositPaid(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="depositPaid" className="cursor-pointer">
                Záloha zaplacena
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Poznámky</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Interní poznámky..."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cestující</CardTitle>
            <CardDescription>Seznam všech cestujících</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {deal.deal_travelers.map((traveler) => (
                <div
                  key={traveler.client_id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">
                      {traveler.clients.first_name} {traveler.clients.last_name}
                    </p>
                    {traveler.is_lead_traveler && (
                      <p className="text-sm text-muted-foreground">Hlavní cestující</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DealDetail;
