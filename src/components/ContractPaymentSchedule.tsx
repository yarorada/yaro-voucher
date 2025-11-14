import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Wallet } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

interface Payment {
  id: string;
  payment_type: string;
  amount: number;
  due_date: string;
  paid: boolean;
  notes?: string;
}

interface ContractPaymentScheduleProps {
  contractId: string;
}

export function ContractPaymentSchedule({ contractId }: ContractPaymentScheduleProps) {
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    payment_type: "deposit",
    amount: "",
    due_date: "",
    notes: "",
  });

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from("contract_payments")
        .select("*")
        .eq("contract_id", contractId)
        .order("due_date", { ascending: true });

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error("Error fetching payments:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [contractId]);

  const handleAddPayment = async () => {
    if (!formData.amount || !formData.due_date) {
      toast({
        title: "Chyba",
        description: "Vyplňte částku a datum splatnosti",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("contract_payments").insert({
        contract_id: contractId,
        payment_type: formData.payment_type,
        amount: parseFloat(formData.amount),
        due_date: formData.due_date,
        notes: formData.notes || null,
      });

      if (error) throw error;

      toast({
        title: "Přidáno",
        description: "Platba byla přidána",
      });
      setShowForm(false);
      setFormData({ payment_type: "deposit", amount: "", due_date: "", notes: "" });
      fetchPayments();
    } catch (error) {
      console.error("Error adding payment:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se přidat platbu",
        variant: "destructive",
      });
    }
  };

  const handleTogglePaid = async (paymentId: string, paid: boolean) => {
    try {
      const { error } = await supabase
        .from("contract_payments")
        .update({ paid: !paid })
        .eq("id", paymentId);

      if (error) throw error;
      fetchPayments();
    } catch (error) {
      console.error("Error updating payment:", error);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    try {
      const { error } = await supabase
        .from("contract_payments")
        .delete()
        .eq("id", paymentId);

      if (error) throw error;

      toast({
        title: "Smazáno",
        description: "Platba byla odstraněna",
      });
      fetchPayments();
    } catch (error) {
      console.error("Error deleting payment:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se smazat platbu",
        variant: "destructive",
      });
    }
  };

  const getPaymentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      deposit: "Záloha",
      installment: "Splátka",
      final: "Doplatek",
    };
    return labels[type] || type;
  };

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const paidAmount = payments.filter((p) => p.paid).reduce((sum, p) => sum + p.amount, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-heading-2 flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Platební kalendář
        </CardTitle>
        <Button onClick={() => setShowForm(!showForm)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Přidat platbu
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="border rounded-lg p-4 space-y-4 bg-muted/50">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Typ platby</Label>
                <Select
                  value={formData.payment_type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, payment_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deposit">Záloha</SelectItem>
                    <SelectItem value="installment">Splátka</SelectItem>
                    <SelectItem value="final">Doplatek</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Částka (Kč)</Label>
                <Input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Datum splatnosti</Label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Poznámka</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Nepovinné"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddPayment}>Přidat</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Zrušit
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-body text-muted-foreground">Načítání...</p>
        ) : payments.length === 0 ? (
          <p className="text-body text-muted-foreground">
            Zatím nejsou přidány žádné platby
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Zaplaceno</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Částka</TableHead>
                  <TableHead>Splatnost</TableHead>
                  <TableHead>Poznámka</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <Checkbox
                        checked={payment.paid}
                        onCheckedChange={() =>
                          handleTogglePaid(payment.id, payment.paid)
                        }
                      />
                    </TableCell>
                    <TableCell className="text-body">
                      {getPaymentTypeLabel(payment.payment_type)}
                    </TableCell>
                    <TableCell className="text-body font-semibold">
                      {payment.amount.toLocaleString("cs-CZ")} Kč
                    </TableCell>
                    <TableCell className="text-body">
                      {format(new Date(payment.due_date), "d. M. yyyy", { locale: cs })}
                    </TableCell>
                    <TableCell className="text-body text-muted-foreground">
                      {payment.notes || "-"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeletePayment(payment.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-body">
                <span>Celkem k úhradě:</span>
                <span className="font-semibold">{totalAmount.toLocaleString("cs-CZ")} Kč</span>
              </div>
              <div className="flex justify-between text-body text-green-600">
                <span>Zaplaceno:</span>
                <span className="font-semibold">{paidAmount.toLocaleString("cs-CZ")} Kč</span>
              </div>
              <div className="flex justify-between text-body">
                <span>Zbývá zaplatit:</span>
                <span className="font-semibold">
                  {(totalAmount - paidAmount).toLocaleString("cs-CZ")} Kč
                </span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
