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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Wallet, CalendarIcon, Calculator } from "lucide-react";
import { format, subMonths } from "date-fns";
import { cs } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Payment {
  id: string;
  payment_type: string;
  amount: number;
  due_date: string;
  paid: boolean;
  paid_at?: string | null;
  notes?: string;
}

interface ContractPaymentScheduleProps {
  contractId: string;
  totalPrice?: number;
  departureDate?: string;
}

export function ContractPaymentSchedule({ contractId, totalPrice = 0, departureDate }: ContractPaymentScheduleProps) {
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [formData, setFormData] = useState({
    payment_type: "deposit",
    amount: "",
    notes: "",
  });

  const fetchPayments = async () => {
    try {
      // @ts-ignore - Supabase types not updated after migration
      const { data, error } = await (supabase as any)
        .from("contract_payments")
        .select("*")
        .eq("contract_id", contractId)
        .order("due_date", { ascending: true });

      if (error) throw error;
      // @ts-ignore - Supabase types not updated after migration
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
    if (!formData.amount || !selectedDate) {
      toast({
        title: "Chyba",
        description: "Vyplňte částku a datum splatnosti",
        variant: "destructive",
      });
      return;
    }

    try {
      // @ts-ignore - Supabase types not updated after migration
      const { error } = await (supabase as any).from("contract_payments").insert({
        contract_id: contractId,
        payment_type: formData.payment_type,
        amount: parseFloat(formData.amount),
        due_date: format(selectedDate, "yyyy-MM-dd"),
        notes: formData.notes || null,
      });

      if (error) throw error;

      toast({
        title: "Přidáno",
        description: "Platba byla přidána",
      });
      setDialogOpen(false);
      setFormData({ payment_type: "deposit", amount: "", notes: "" });
      setSelectedDate(undefined);
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
      const updateData = !paid 
        ? { paid: true, paid_at: new Date().toISOString() }
        : { paid: false, paid_at: null };
      
      // @ts-ignore - Supabase types not updated after migration
      const { error } = await (supabase as any)
        .from("contract_payments")
        .update(updateData)
        .eq("id", paymentId);

      if (error) throw error;
      fetchPayments();
    } catch (error) {
      console.error("Error updating payment:", error);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    try {
      // @ts-ignore - Supabase types not updated after migration
      const { error } = await (supabase as any)
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

  const depositsSum = payments
    .filter((p) => p.payment_type === "deposit" || p.payment_type === "installment")
    .reduce((sum, p) => sum + p.amount, 0);
  const remainingPayment = Math.max(0, totalPrice - depositsSum);
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const paidAmount = payments.filter((p) => p.paid).reduce((sum, p) => sum + p.amount, 0);

  const handleAddFinalPayment = async () => {
    if (!departureDate || remainingPayment <= 0) return;
    
    const dueDate = subMonths(new Date(departureDate), 1);
    
    try {
      // @ts-ignore - Supabase types not updated after migration
      const { error } = await (supabase as any).from("contract_payments").insert({
        contract_id: contractId,
        payment_type: "final",
        amount: remainingPayment,
        due_date: format(dueDate, "yyyy-MM-dd"),
        notes: "Doplatek měsíc před odjezdem",
      });

      if (error) throw error;

      toast({
        title: "Přidáno",
        description: "Doplatek byl přidán",
      });
      fetchPayments();
    } catch (error) {
      console.error("Error adding final payment:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se přidat doplatek",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-heading-2 flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Platební kalendář
          </CardTitle>
          <div className="flex gap-2">
            {remainingPayment > 0 && departureDate && (
              <Button onClick={handleAddFinalPayment} size="sm" variant="outline">
                <Calculator className="h-4 w-4 mr-2" />
                Doplatek {remainingPayment.toLocaleString("cs-CZ")} Kč
              </Button>
            )}
            <Button onClick={() => setDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Přidat platbu
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
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
                    <TableHead>Uhrazeno</TableHead>
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
                      <TableCell className="text-body text-green-600">
                        {payment.paid_at 
                          ? format(new Date(payment.paid_at), "d. M. yyyy", { locale: cs })
                          : "-"}
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
                  <span>Celková cena zájezdu:</span>
                  <span className="font-semibold">{totalPrice.toLocaleString("cs-CZ")} Kč</span>
                </div>
                <div className="flex justify-between text-body">
                  <span>Zálohy a splátky:</span>
                  <span className="font-semibold">{depositsSum.toLocaleString("cs-CZ")} Kč</span>
                </div>
                <div className="flex justify-between text-body font-medium">
                  <span>Zbývá k doplacení:</span>
                  <span className={cn("font-bold", remainingPayment > 0 ? "text-orange-600" : "text-green-600")}>
                    {remainingPayment.toLocaleString("cs-CZ")} Kč
                  </span>
                </div>
                <div className="border-t mt-2 pt-2">
                  <div className="flex justify-between text-body text-green-600">
                    <span>Zaplaceno:</span>
                    <span className="font-semibold">{paidAmount.toLocaleString("cs-CZ")} Kč</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Přidat platbu</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "d. M. yyyy", { locale: cs }) : "Vyberte datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    initialFocus
                    locale={cs}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Poznámka</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Nepovinné"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => {
                setDialogOpen(false);
                setFormData({ payment_type: "deposit", amount: "", notes: "" });
                setSelectedDate(undefined);
              }}>
                Zrušit
              </Button>
              <Button onClick={handleAddPayment}>Přidat platbu</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
