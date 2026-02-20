import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Trash2, Wallet, CalendarIcon, Pencil, Mail } from "lucide-react";
import { format, isPast, startOfDay, addMonths } from "date-fns";
import { PaymentEmailMatchDialog } from "@/components/PaymentEmailMatchDialog";
import { cs } from "date-fns/locale";
import { cn, formatPrice } from "@/lib/utils";

interface Payment {
  id: string;
  payment_type: string;
  amount: number;
  due_date: string;
  paid: boolean;
  paid_at?: string | null;
  notes?: string;
}

interface ScheduleItem {
  enabled: boolean;
  amount: string;
  date: Date | undefined;
  type: "deposit" | "installment" | "final";
  label: string;
}

interface DealPaymentScheduleProps {
  dealId: string;
  totalPrice?: number;
  departureDate?: string;
  currency?: string;
}

export function DealPaymentSchedule({ dealId, totalPrice = 0, departureDate, currency = "CZK" }: DealPaymentScheduleProps) {
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [emailMatchOpen, setEmailMatchOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editSelectedDate, setEditSelectedDate] = useState<Date | undefined>(undefined);
  const [editPaidDate, setEditPaidDate] = useState<Date | undefined>(undefined);
  const [editFormData, setEditFormData] = useState({
    payment_type: "deposit",
    amount: "",
    notes: "",
  });

  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([
    { enabled: true, amount: "", date: undefined, type: "deposit", label: "1. záloha" },
    { enabled: false, amount: "", date: undefined, type: "deposit", label: "2. záloha" },
    { enabled: false, amount: "", date: undefined, type: "deposit", label: "3. záloha" },
    { enabled: true, amount: "", date: undefined, type: "final", label: "Doplatek" },
  ]);

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from("deal_payments")
        .select("*")
        .eq("deal_id", dealId)
        .order("due_date", { ascending: true });

      if (error) throw error;
      // Sort: deposits/installments first by due_date, then final last
      const sorted = (data || []).sort((a, b) => {
        const typeOrder = (t: string) => t === "final" ? 1 : 0;
        const orderDiff = typeOrder(a.payment_type) - typeOrder(b.payment_type);
        if (orderDiff !== 0) return orderDiff;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });
      setPayments(sorted);
    } catch (error) {
      console.error("Error fetching deal payments:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [dealId]);

  useEffect(() => {
    const depositsTotal = scheduleItems
      .filter(item => item.enabled && item.type !== "final")
      .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    
    const finalPayment = Math.max(0, totalPrice - depositsTotal);
    
    setScheduleItems(prev => prev.map(item => 
      item.type === "final" 
        ? { ...item, amount: finalPayment > 0 ? finalPayment.toString() : "0" }
        : item
    ));
  }, [scheduleItems.filter(i => i.type !== "final").map(i => `${i.enabled}-${i.amount}`).join(","), totalPrice]);

  const resetSchedule = () => {
    const today = new Date();
    const defaultFinalDate = departureDate 
      ? addMonths(new Date(departureDate), -1)
      : addMonths(today, 2);
    
    setScheduleItems([
      { enabled: true, amount: "", date: today, type: "deposit", label: "1. záloha" },
      { enabled: false, amount: "", date: undefined, type: "deposit", label: "2. záloha" },
      { enabled: false, amount: "", date: undefined, type: "deposit", label: "3. záloha" },
      { enabled: true, amount: totalPrice.toString(), date: defaultFinalDate, type: "final", label: "Doplatek" },
    ]);
  };

  const openEditDialog = (payment: Payment) => {
    setEditingPayment(payment);
    setEditFormData({
      payment_type: payment.payment_type,
      amount: payment.amount.toString(),
      notes: payment.notes || "",
    });
    setEditSelectedDate(new Date(payment.due_date));
    setEditPaidDate(payment.paid_at ? new Date(payment.paid_at) : undefined);
    setEditDialogOpen(true);
  };

  const handleSaveEditPayment = async () => {
    if (!editFormData.amount || !editSelectedDate || !editingPayment) {
      toast({ title: "Chyba", description: "Vyplňte částku a datum splatnosti", variant: "destructive" });
      return;
    }

    try {
      // Save the edited payment
      const { error } = await supabase
        .from("deal_payments")
        .update({
          payment_type: editFormData.payment_type,
          amount: parseFloat(editFormData.amount),
          due_date: format(editSelectedDate, "yyyy-MM-dd"),
          notes: editFormData.notes || null,
          paid: !!editPaidDate,
          paid_at: editPaidDate ? editPaidDate.toISOString() : null,
        })
        .eq("id", editingPayment.id);

      if (error) throw error;

      // Recalculate the final payment based on updated deposits
      const editedAmount = parseFloat(editFormData.amount);
      const otherDeposits = payments
        .filter(p => p.id !== editingPayment.id && p.payment_type !== "final")
        .reduce((sum, p) => sum + p.amount, 0);
      const currentEditedIsDeposit = editFormData.payment_type !== "final";
      const allDepositsTotal = currentEditedIsDeposit
        ? otherDeposits + editedAmount
        : payments.filter(p => p.payment_type !== "final").reduce((sum, p) => sum + p.amount, 0);
      
      const newFinalAmount = Math.max(0, totalPrice - allDepositsTotal);
      
      // Update the final payment if it exists
      const finalPayment = payments.find(p => p.payment_type === "final" && p.id !== editingPayment.id);
      if (finalPayment) {
        await supabase
          .from("deal_payments")
          .update({ amount: newFinalAmount })
          .eq("id", finalPayment.id);
      }

      toast({ title: "Uloženo", description: "Platba byla upravena a doplatek přepočítán" });
      setEditDialogOpen(false);
      setEditingPayment(null);
      fetchPayments();
    } catch (error) {
      console.error("Error saving payment:", error);
      toast({ title: "Chyba", description: "Nepodařilo se upravit platbu", variant: "destructive" });
    }
  };

  const handleSaveSchedule = async () => {
    const validItems = scheduleItems.filter(
      item => item.enabled && item.date && parseFloat(item.amount) > 0
    );

    if (validItems.length === 0) {
      toast({ title: "Chyba", description: "Přidejte alespoň jednu platbu s částkou a datem", variant: "destructive" });
      return;
    }

    try {
      const paymentsToInsert = validItems.map((item, index) => ({
        deal_id: dealId,
        payment_type: item.type === "final" ? "final" : (index === 0 ? "deposit" : "installment"),
        amount: parseFloat(item.amount),
        due_date: format(item.date!, "yyyy-MM-dd"),
        notes: item.label,
      }));

      const { error } = await supabase
        .from("deal_payments")
        .insert(paymentsToInsert);

      if (error) throw error;
      toast({ title: "Přidáno", description: `Přidáno ${validItems.length} plateb` });
      setScheduleDialogOpen(false);
      fetchPayments();
    } catch (error) {
      console.error("Error saving schedule:", error);
      toast({ title: "Chyba", description: "Nepodařilo se uložit platební kalendář", variant: "destructive" });
    }
  };

  const handleTogglePaid = async (paymentId: string, paid: boolean) => {
    try {
      const updateData = !paid 
        ? { paid: true, paid_at: new Date().toISOString() }
        : { paid: false, paid_at: null };
      
      const { error } = await supabase
        .from("deal_payments")
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
      const { error } = await supabase
        .from("deal_payments")
        .delete()
        .eq("id", paymentId);

      if (error) throw error;
      toast({ title: "Smazáno", description: "Platba byla odstraněna" });
      fetchPayments();
    } catch (error) {
      console.error("Error deleting payment:", error);
      toast({ title: "Chyba", description: "Nepodařilo se smazat platbu", variant: "destructive" });
    }
  };

  const getPaymentTypeLabel = (type: string) => {
    const labels: Record<string, string> = { deposit: "Záloha", installment: "Splátka", final: "Doplatek" };
    return labels[type] || type;
  };

  const updateScheduleItem = (index: number, updates: Partial<ScheduleItem>) => {
    setScheduleItems(prev => prev.map((item, i) => i === index ? { ...item, ...updates } : item));
  };

  const depositsSum = payments
    .filter((p) => p.payment_type === "deposit" || p.payment_type === "installment")
    .reduce((sum, p) => sum + p.amount, 0);
  const remainingPayment = Math.max(0, totalPrice - depositsSum);
  const paidAmount = payments.filter((p) => p.paid).reduce((sum, p) => sum + p.amount, 0);

  const scheduleDepositsTotal = scheduleItems
    .filter(item => item.enabled && item.type !== "final")
    .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const scheduleFinalAmount = parseFloat(scheduleItems.find(i => i.type === "final")?.amount || "0");
  const scheduleTotal = scheduleDepositsTotal + scheduleFinalAmount;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-5 w-5" />
            Platební kalendář
          </CardTitle>
          <div className="flex gap-2">
            <Button onClick={() => { resetSchedule(); setScheduleDialogOpen(true); }} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Přidat</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Načítání...</p>
          ) : payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Zatím nejsou přidány žádné platby</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Částka</TableHead>
                    <TableHead>Splatnost</TableHead>
                    <TableHead>Zaplaceno dne</TableHead>
                    <TableHead className="w-[70px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => {
                    const isOverdue = !payment.paid && isPast(startOfDay(new Date(payment.due_date)));
                    return (
                      <TableRow key={payment.id} className={cn(isOverdue && "bg-red-50 dark:bg-red-950/20")}>
                        <TableCell>
                          <Checkbox
                            checked={payment.paid}
                            onCheckedChange={() => handleTogglePaid(payment.id, payment.paid)}
                          />
                        </TableCell>
                        <TableCell className="text-sm">
                          {payment.notes || getPaymentTypeLabel(payment.payment_type)}
                        </TableCell>
                        <TableCell className="text-sm font-semibold">
                          {formatPrice(payment.amount, true, currency)}
                        </TableCell>
                        <TableCell className={cn("text-sm", isOverdue && "text-red-600 font-semibold")}>
                          {format(new Date(payment.due_date), "d.M.yyyy", { locale: cs })}
                          {isOverdue && <span className="ml-1 text-xs">⚠️</span>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {payment.paid && payment.paid_at
                            ? format(new Date(payment.paid_at), "d.M.yyyy", { locale: cs })
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditDialog(payment)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDeletePayment(payment.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="border-t pt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Celkem:</span>
                   <span className="font-semibold">{formatPrice(totalPrice, true, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Zbývá:</span>
                  <span className={cn("font-bold", remainingPayment > 0 ? "text-orange-600" : "text-green-600")}>
                     {formatPrice(remainingPayment, true, currency)}
                   </span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Zaplaceno:</span>
                  <span className="font-semibold">{formatPrice(paidAmount, true, currency)}</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Schedule Builder Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Rozpis plateb</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/50 p-3 rounded-lg">
              <div className="flex justify-between text-sm">
                <span>Celková cena:</span>
                <span className="font-semibold">{formatPrice(totalPrice, true, currency)}</span>
              </div>
            </div>

            <div className="space-y-3">
              {scheduleItems.filter(item => item.type !== "final").map((item, index) => (
                <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                  <Checkbox
                    checked={item.enabled}
                    onCheckedChange={(checked) => updateScheduleItem(index, { enabled: !!checked })}
                  />
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{item.label}</Label>
                      <Input
                        type="number"
                        value={item.amount}
                        onChange={(e) => updateScheduleItem(index, { amount: e.target.value })}
                        placeholder="Částka"
                        disabled={!item.enabled}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Splatnost</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            disabled={!item.enabled}
                            className={cn("w-full h-9 justify-start text-left font-normal", !item.date && "text-muted-foreground")}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {item.date ? format(item.date, "d.M.yyyy", { locale: cs }) : "Datum"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={item.date}
                            onSelect={(date) => updateScheduleItem(index, { date })}
                            initialFocus
                            locale={cs}
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
              ))}

              {/* Final payment */}
              {scheduleItems.filter(item => item.type === "final").map((item, i) => {
                const realIndex = scheduleItems.findIndex(si => si.type === "final");
                return (
                  <div key="final" className="p-3 border-2 border-primary/20 rounded-lg bg-primary/5">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">{item.label}</Label>
                        <Input
                          type="number"
                          value={item.amount}
                          disabled
                          className="h-9 bg-muted"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Splatnost</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn("w-full h-9 justify-start text-left font-normal", !item.date && "text-muted-foreground")}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {item.date ? format(item.date, "d.M.yyyy", { locale: cs }) : "Datum"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={item.date}
                              onSelect={(date) => updateScheduleItem(realIndex, { date })}
                              initialFocus
                              locale={cs}
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t pt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Zálohy celkem:</span>
                <span className="font-semibold">{formatPrice(scheduleDepositsTotal, true, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span>Doplatek:</span>
                <span className="font-semibold">{formatPrice(scheduleFinalAmount, true, currency)}</span>
              </div>
              <div className="flex justify-between font-medium border-t pt-1">
                <span>Celkem:</span>
                <span className={cn("font-bold", scheduleTotal !== totalPrice && "text-orange-600")}>
                  {formatPrice(scheduleTotal, true, currency)}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>Zrušit</Button>
              <Button onClick={handleSaveSchedule}>Uložit platby</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Payment Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upravit platbu</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Částka</Label>
              <Input
                type="number"
                value={editFormData.amount}
                onChange={(e) => setEditFormData(prev => ({ ...prev, amount: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Splatnost</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !editSelectedDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editSelectedDate ? format(editSelectedDate, "d.M.yyyy", { locale: cs }) : "Vyberte datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={editSelectedDate}
                    onSelect={setEditSelectedDate}
                    initialFocus
                    locale={cs}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Zaplaceno dne</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("flex-1 justify-start text-left font-normal", !editPaidDate && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editPaidDate ? format(editPaidDate, "d.M.yyyy", { locale: cs }) : "Nezaplaceno"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editPaidDate}
                      onSelect={setEditPaidDate}
                      initialFocus
                      locale={cs}
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                {editPaidDate && (
                  <Button variant="ghost" size="sm" onClick={() => setEditPaidDate(undefined)} className="text-destructive">
                    ✕
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Poznámka</Label>
              <Input
                value={editFormData.notes}
                onChange={(e) => setEditFormData(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Zrušit</Button>
              <Button onClick={handleSaveEditPayment}>Uložit</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PaymentEmailMatchDialog
        open={emailMatchOpen}
        onOpenChange={setEmailMatchOpen}
        onPaymentMatched={fetchPayments}
      />
    </>
  );
}
