import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Wallet, CalendarIcon, Pencil, Users } from "lucide-react";
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

interface PaymentSplit {
  id: string;
  payment_id: string;
  client_id?: string | null;
  payer_name: string;
  amount: number;
  paid_at?: string | null;
  notes?: string | null;
  sort_order: number;
}

interface SplitDraft {
  id?: string;
  client_id?: string | null;
  payer_name: string;
  amount: string;
  paid_at?: Date | undefined;
  notes?: string;
}

interface PayerClient {
  id: string;
  first_name: string;
  last_name: string;
  is_traveler?: boolean;
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
  const [splits, setSplits] = useState<PaymentSplit[]>([]);
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [splitPayment, setSplitPayment] = useState<Payment | null>(null);
  const [splitDrafts, setSplitDrafts] = useState<SplitDraft[]>([]);
  const [splitDeleted, setSplitDeleted] = useState<string[]>([]);
  const [payerClients, setPayerClients] = useState<PayerClient[]>([]);
  const [openPayerIdx, setOpenPayerIdx] = useState<number | null>(null);

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
      await fetchSplits((sorted || []).map((p: Payment) => p.id));
    } catch (error) {
      console.error("Error fetching deal payments:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSplits = async (paymentIds: string[]) => {
    if (!paymentIds.length) {
      setSplits([]);
      return;
    }
    try {
      const { data, error } = await (supabase as any)
        .from("deal_payment_splits")
        .select("*")
        .in("payment_id", paymentIds)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      setSplits((data || []) as PaymentSplit[]);
    } catch (error) {
      console.error("Error fetching payment splits:", error);
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

      toast({ title: "Uloženo", description: "Platba byla upravena" });
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
      const nowPaid = !paid;
      const updateData = nowPaid 
        ? { paid: true, paid_at: new Date().toISOString() }
        : { paid: false, paid_at: null };
      
      const { error } = await supabase
        .from("deal_payments")
        .update(updateData)
        .eq("id", paymentId);

      if (error) throw error;

      // When marking a payment as paid, set deal status to 'confirmed'
      if (nowPaid) {
        await supabase
          .from("deals")
          .update({ status: "confirmed" })
          .eq("id", dealId)
          .in("status", ["inquiry", "quote", "approved"]);
      }

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

  const loadPayerClients = async () => {
    try {
      // Deal travelers first (top of the list, marked)
      const { data: travelersRes } = await (supabase as any)
        .from("deal_travelers")
        .select("client_id, clients(id, first_name, last_name)")
        .eq("deal_id", dealId);
      const travelerIds = new Set<string>();
      const travelers: PayerClient[] = (travelersRes || [])
        .map((t: any) => {
          if (!t.clients) return null;
          travelerIds.add(t.clients.id);
          return {
            id: t.clients.id,
            first_name: t.clients.first_name,
            last_name: t.clients.last_name,
            is_traveler: true,
          } as PayerClient;
        })
        .filter(Boolean) as PayerClient[];
      // All clients
      const { data: allRes } = await (supabase as any)
        .from("clients")
        .select("id, first_name, last_name")
        .order("last_name", { ascending: true });
      const others: PayerClient[] = (allRes || [])
        .filter((c: any) => !travelerIds.has(c.id))
        .map((c: any) => ({ id: c.id, first_name: c.first_name, last_name: c.last_name }));
      setPayerClients([...travelers, ...others]);
    } catch (error) {
      console.error("Error loading payer clients:", error);
    }
  };

  const openSplitDialog = (payment: Payment) => {
    setSplitPayment(payment);
    const existing = splits.filter((s) => s.payment_id === payment.id);
    setSplitDrafts(
      existing.length
        ? existing.map((s) => ({
            id: s.id,
            client_id: s.client_id || null,
            payer_name: s.payer_name,
            amount: String(s.amount),
            paid_at: s.paid_at ? new Date(s.paid_at) : undefined,
            notes: s.notes || "",
          }))
        : [
            { payer_name: "", amount: "", paid_at: undefined, notes: "" },
            { payer_name: "", amount: "", paid_at: undefined, notes: "" },
          ]
    );
    setSplitDeleted([]);
    setSplitDialogOpen(true);
    loadPayerClients();
  };

  const addSplitDraft = () => {
    setSplitDrafts((prev) => [...prev, { payer_name: "", amount: "", paid_at: undefined, notes: "" }]);
  };

  const updateSplitDraft = (index: number, updates: Partial<SplitDraft>) => {
    setSplitDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...updates } : d)));
  };

  const removeSplitDraft = (index: number) => {
    setSplitDrafts((prev) => {
      const d = prev[index];
      if (d?.id) setSplitDeleted((del) => [...del, d.id!]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSaveSplits = async () => {
    if (!splitPayment) return;
    const valid = splitDrafts.filter((d) => d.payer_name.trim() && parseFloat(d.amount) > 0);
    try {
      // Delete removed
      if (splitDeleted.length) {
        const { error } = await (supabase as any)
          .from("deal_payment_splits")
          .delete()
          .in("id", splitDeleted);
        if (error) throw error;
      }
      // Upsert remaining
      for (let i = 0; i < valid.length; i++) {
        const d = valid[i];
        const payload = {
          payment_id: splitPayment.id,
          client_id: d.client_id || null,
          payer_name: d.payer_name.trim(),
          amount: parseFloat(d.amount),
          paid_at: d.paid_at ? d.paid_at.toISOString() : null,
          notes: d.notes?.trim() || null,
          sort_order: i,
        };
        if (d.id) {
          const { error } = await (supabase as any)
            .from("deal_payment_splits")
            .update(payload)
            .eq("id", d.id);
          if (error) throw error;
        } else {
          const { error } = await (supabase as any)
            .from("deal_payment_splits")
            .insert(payload);
          if (error) throw error;
        }
      }
      toast({ title: "Uloženo", description: "Rozdělení platby bylo uloženo" });
      setSplitDialogOpen(false);
      setSplitPayment(null);
      setSplitDrafts([]);
      setSplitDeleted([]);
      fetchPayments();
    } catch (error) {
      console.error("Error saving splits:", error);
      toast({ title: "Chyba", description: "Nepodařilo se uložit rozdělení", variant: "destructive" });
    }
  };

  const splitsByPayment = splits.reduce<Record<string, PaymentSplit[]>>((acc, s) => {
    (acc[s.payment_id] ||= []).push(s);
    return acc;
  }, {});

  const allPaymentsSum = payments.reduce((sum, p) => sum + p.amount, 0);
  const remainingPayment = Math.max(0, totalPrice - allPaymentsSum);
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
              <div className="space-y-2">
                {payments.map((payment, index) => {
                  const isOverdue = !payment.paid && isPast(startOfDay(new Date(payment.due_date)));
                  // Calculate cumulative paid amount up to and including this payment
                  const paidUpToHere = payments
                    .slice(0, index + 1)
                    .filter(p => p.paid)
                    .reduce((sum, p) => sum + p.amount, 0);
                  const remainingAfterThis = Math.max(0, totalPrice - paidUpToHere);
                  // Show remaining only on paid payments or the last unpaid one
                  const isLastUnpaid = !payment.paid && payments.slice(index + 1).every(p => p.paid);
                  const showRemaining = payment.paid || isLastUnpaid;

                  return (
                    <div
                      key={payment.id}
                      className={cn(
                        "flex flex-wrap items-center gap-3 p-3 rounded-lg border",
                        isOverdue && "bg-red-50 dark:bg-red-950/20 border-destructive/30"
                      )}
                    >
                      <Checkbox
                        checked={payment.paid}
                        onCheckedChange={() => handleTogglePaid(payment.id, payment.paid)}
                        className="shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-medium truncate">
                              {payment.notes || getPaymentTypeLabel(payment.payment_type)}
                            </span>
                            {payment.paid && (
                              <span className="shrink-0 inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                                {payment.payment_type === "final" ? "Doplatek" : "Záloha"}
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-bold whitespace-nowrap">
                            {formatPrice(payment.amount, true, currency)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                          <span className={cn(isOverdue && "text-destructive font-semibold")}>
                            Splatnost: {format(new Date(payment.due_date), "d.M.yyyy", { locale: cs })}
                            {isOverdue && " ⚠️"}
                          </span>
                          {payment.paid && payment.paid_at && (
                            <span className="text-green-600">
                              Zaplaceno: {format(new Date(payment.paid_at), "d.M.yyyy", { locale: cs })}
                            </span>
                          )}
                          {showRemaining && (
                            <span className={cn("font-medium", remainingAfterThis > 0 ? "text-orange-600" : "text-green-600")}>
                              Zbývá: {formatPrice(remainingAfterThis, true, currency)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "h-7 w-7 p-0",
                            (splitsByPayment[payment.id]?.length ?? 0) > 0 && "text-primary"
                          )}
                          onClick={() => openSplitDialog(payment)}
                          title="Rozdělit platbu mezi plátce"
                        >
                          <Users className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditDialog(payment)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDeletePayment(payment.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      {(splitsByPayment[payment.id]?.length ?? 0) > 0 && (
                        <div className="basis-full mt-2 pl-7 border-l-2 border-primary/30 ml-1 space-y-1">
                          {(() => {
                            const rowSplits = splitsByPayment[payment.id] || [];
                            const splitSum = rowSplits.reduce((s, r) => s + Number(r.amount || 0), 0);
                            const diff = Number(payment.amount) - splitSum;
                            return (
                              <>
                                {rowSplits.map((s) => (
                                  <div key={s.id} className="flex items-center justify-between gap-2 text-xs">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="font-medium truncate">{s.payer_name}</span>
                                      {s.paid_at ? (
                                        <span className="text-green-600 whitespace-nowrap">
                                          ✓ {format(new Date(s.paid_at), "d.M.yyyy", { locale: cs })}
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground">nezaplaceno</span>
                                      )}
                                      {s.notes && <span className="text-muted-foreground truncate">• {s.notes}</span>}
                                    </div>
                                    <span className="font-semibold whitespace-nowrap">
                                      {formatPrice(Number(s.amount), true, currency)}
                                    </span>
                                  </div>
                                ))}
                                {Math.abs(diff) > 0.01 && (
                                  <div className={cn(
                                    "flex items-center justify-between gap-2 text-xs pt-1 border-t border-dashed",
                                    diff > 0 ? "text-orange-600" : "text-red-600"
                                  )}>
                                    <span>{diff > 0 ? "Nerozděleno" : "Rozděleno nad rámec"}</span>
                                    <span className="font-semibold">{formatPrice(Math.abs(diff), true, currency)}</span>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
                {remainingPayment > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const dueDate = departureDate
                          ? format(addMonths(new Date(departureDate), -1), "yyyy-MM-dd")
                          : format(addMonths(new Date(), 2), "yyyy-MM-dd");
                        const { error } = await supabase.from("deal_payments").insert({
                          deal_id: dealId,
                          payment_type: "final",
                          amount: remainingPayment,
                          due_date: dueDate,
                          notes: "Doplatek",
                        });
                        if (error) throw error;
                        toast({ title: "Doplatek přidán", description: `Přidána platba ${formatPrice(remainingPayment, true, currency)}` });
                        fetchPayments();
                      } catch {
                        toast({ title: "Chyba", description: "Nepodařilo se přidat doplatek", variant: "destructive" });
                      }
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-dashed border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-950/10 hover:bg-orange-100/60 dark:hover:bg-orange-950/20 transition-colors cursor-pointer text-left"
                  >
                    <Plus className="h-4 w-4 text-orange-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-orange-700 dark:text-orange-400">Přidat doplatek</span>
                          <span className="shrink-0 inline-flex items-center rounded-full bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 text-xs font-medium text-orange-700 dark:text-orange-400">
                            Zbývá doplatit
                          </span>
                        </div>
                        <span className="text-sm font-bold text-orange-600 whitespace-nowrap">
                          {formatPrice(remainingPayment, true, currency)}
                        </span>
                      </div>
                    </div>
                  </button>
                )}
              </div>
              <div className="border-t pt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Celkem:</span>
                   <span className="font-semibold">{formatPrice(totalPrice, true, currency)}</span>
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

      {/* Split Payment Dialog */}
      <Dialog open={splitDialogOpen} onOpenChange={setSplitDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rozdělit platbu mezi plátce</DialogTitle>
          </DialogHeader>
          {splitPayment && (
            <div className="space-y-4">
              <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-1">
                <div className="flex justify-between">
                  <span>
                    {splitPayment.notes || getPaymentTypeLabel(splitPayment.payment_type)}
                    {" · "}
                    Splatnost: {format(new Date(splitPayment.due_date), "d.M.yyyy", { locale: cs })}
                  </span>
                  <span className="font-semibold">
                    {formatPrice(splitPayment.amount, true, currency)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Rozpis je pouze pro vlastní evidenci — nepřenáší se do cestovní smlouvy.
                </p>
              </div>

              <div className="space-y-2">
                {splitDrafts.map((d, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_120px_160px_auto] gap-2 items-start p-2 border rounded-lg">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Jméno plátce</Label>
                      <Popover open={openPayerIdx === idx} onOpenChange={(o) => setOpenPayerIdx(o ? idx : null)}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "w-full h-9 justify-start text-left font-normal truncate",
                              !d.payer_name && "text-muted-foreground"
                            )}
                          >
                            {d.payer_name || "Vybrat klienta…"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[260px]" align="start">
                          <Command>
                            <CommandInput placeholder="Hledat klienta nebo napsat jméno…" />
                            <CommandList>
                              <CommandEmpty>
                                <button
                                  type="button"
                                  className="w-full text-left text-sm px-2 py-1.5 hover:bg-accent rounded"
                                  onClick={() => {
                                    const el = document.querySelector<HTMLInputElement>("[cmdk-input]");
                                    const v = el?.value?.trim() || "";
                                    if (v) {
                                      updateSplitDraft(idx, { payer_name: v, client_id: null });
                                      setOpenPayerIdx(null);
                                    }
                                  }}
                                >
                                  Použít volný text (ENTER)
                                </button>
                              </CommandEmpty>
                              {payerClients.some((c) => c.is_traveler) && (
                                <CommandGroup heading="Cestující v OP">
                                  {payerClients
                                    .filter((c) => c.is_traveler)
                                    .map((c) => (
                                      <CommandItem
                                        key={c.id}
                                        value={`${c.first_name} ${c.last_name}`}
                                        onSelect={() => {
                                          updateSplitDraft(idx, {
                                            payer_name: `${c.first_name} ${c.last_name}`.trim(),
                                            client_id: c.id,
                                          });
                                          setOpenPayerIdx(null);
                                        }}
                                      >
                                        {c.first_name} {c.last_name}
                                      </CommandItem>
                                    ))}
                                </CommandGroup>
                              )}
                              <CommandGroup heading="Ostatní klienti">
                                {payerClients
                                  .filter((c) => !c.is_traveler)
                                  .map((c) => (
                                    <CommandItem
                                      key={c.id}
                                      value={`${c.first_name} ${c.last_name}`}
                                      onSelect={() => {
                                        updateSplitDraft(idx, {
                                          payer_name: `${c.first_name} ${c.last_name}`.trim(),
                                          client_id: c.id,
                                        });
                                        setOpenPayerIdx(null);
                                      }}
                                    >
                                      {c.first_name} {c.last_name}
                                    </CommandItem>
                                  ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Částka</Label>
                      <Input
                        type="number"
                        value={d.amount}
                        onChange={(e) => updateSplitDraft(idx, { amount: e.target.value })}
                        placeholder="0"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Zaplaceno dne</Label>
                      <div className="flex gap-1">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "flex-1 h-9 justify-start text-left font-normal",
                                !d.paid_at && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {d.paid_at ? format(d.paid_at, "d.M.yyyy", { locale: cs }) : "Nezaplaceno"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={d.paid_at}
                              onSelect={(date) => updateSplitDraft(idx, { paid_at: date })}
                              initialFocus
                              locale={cs}
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                        {d.paid_at && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 p-0 text-destructive"
                            onClick={() => updateSplitDraft(idx, { paid_at: undefined })}
                          >
                            ✕
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex sm:flex-col items-end gap-1 sm:pt-5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0 text-destructive"
                        onClick={() => removeSplitDraft(idx)}
                        title="Odstranit"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addSplitDraft} className="w-full">
                  <Plus className="h-4 w-4 mr-1" />
                  Přidat plátce
                </Button>
              </div>

              {(() => {
                const sum = splitDrafts.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
                const diff = Number(splitPayment.amount) - sum;
                return (
                  <div className="border-t pt-3 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Rozděleno:</span>
                      <span className="font-semibold">{formatPrice(sum, true, currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Celá platba:</span>
                      <span className="font-semibold">{formatPrice(splitPayment.amount, true, currency)}</span>
                    </div>
                    <div className={cn(
                      "flex justify-between font-medium border-t pt-1",
                      Math.abs(diff) > 0.01 ? (diff > 0 ? "text-orange-600" : "text-red-600") : "text-green-600"
                    )}>
                      <span>{diff > 0 ? "Nerozděleno:" : diff < 0 ? "Přes rámec:" : "Sedí:"}</span>
                      <span className="font-bold">{formatPrice(Math.abs(diff), true, currency)}</span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSplitDialogOpen(false)}>Zrušit</Button>
                <Button onClick={handleSaveSplits}>Uložit rozdělení</Button>
              </div>
            </div>
          )}
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
