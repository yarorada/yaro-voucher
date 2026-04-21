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
import { Plus, Trash2, Wallet, CalendarIcon, Pencil, QrCode, Mail, RefreshCw, Loader2 } from "lucide-react";
import { format, isPast, startOfDay, addMonths } from "date-fns";
import { PaymentEmailMatchDialog } from "@/components/PaymentEmailMatchDialog";
import { cs } from "date-fns/locale";
import { cn, formatPrice } from "@/lib/utils";
import { generatePaymentQrDataUrl, bankAccountToIban, extractVariableSymbol } from "@/lib/spayd";

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

interface ContractPaymentScheduleProps {
  contractId: string;
  dealId?: string | null;
  totalPrice?: number;
  departureDate?: string;
  contractNumber?: string;
  bankAccount?: string;
  currency?: string;
  isPartl?: boolean;
  onPaymentsChange?: () => void;
}

export function ContractPaymentSchedule({ contractId, dealId, totalPrice = 0, departureDate, contractNumber = '', bankAccount = '227993932/0600', currency = 'CZK', isPartl = false, onPaymentsChange }: ContractPaymentScheduleProps) {
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [emailMatchOpen, setEmailMatchOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editSelectedDate, setEditSelectedDate] = useState<Date | undefined>(undefined);
  const [editFormData, setEditFormData] = useState({
    payment_type: "deposit",
    amount: "",
    notes: "",
  });

  // Schedule builder state
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([
    { enabled: true, amount: "", date: undefined, type: "deposit", label: "1. záloha" },
    { enabled: false, amount: "", date: undefined, type: "deposit", label: "2. záloha" },
    { enabled: false, amount: "", date: undefined, type: "deposit", label: "3. záloha" },
    { enabled: true, amount: "", date: undefined, type: "final", label: "Doplatek" },
  ]);

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from("contract_payments")
        .select("*")
        .eq("contract_id", contractId)
        .order("due_date", { ascending: true });

      if (error) throw error;
      setPayments(data || []);
      onPaymentsChange?.();
    } catch (error) {
      console.error("Error fetching payments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncFromDeal = async () => {
    if (!dealId) return;
    setSyncing(true);
    try {
      const { data: dealPayments, error: dpError } = await supabase
        .from("deal_payments")
        .select("*")
        .eq("deal_id", dealId)
        .order("due_date", { ascending: true });
      if (dpError) throw dpError;
      if (!dealPayments || dealPayments.length === 0) {
        toast({ title: "Žádné platby", description: "Obchodní případ nemá žádný platební kalendář." });
        return;
      }
      await supabase.from("contract_payments").delete().eq("contract_id", contractId);
      const inserts = dealPayments.map((dp: any) => ({
        contract_id: contractId,
        payment_type: dp.payment_type,
        amount: dp.amount,
        due_date: dp.due_date,
        notes: dp.notes,
        paid: dp.paid,
        paid_at: dp.paid_at,
      }));
      const { error: insErr } = await supabase.from("contract_payments").insert(inserts);
      if (insErr) throw insErr;
      toast({ title: "Synchronizováno", description: `Zkopírováno ${inserts.length} plateb z obchodního případu.` });
      fetchPayments();
    } catch (err) {
      console.error(err);
      toast({ title: "Chyba", description: "Nepodařilo se synchronizovat platby.", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [contractId]);

  // Auto-sync from deal if contract has no payments yet
  useEffect(() => {
    if (!loading && payments.length === 0 && dealId) {
      handleSyncFromDeal();
    }
  }, [loading, payments.length, dealId]);

  // Calculate final payment automatically
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
    setEditDialogOpen(true);
  };

  const handleSaveEditPayment = async () => {
    if (!editFormData.amount || !editSelectedDate || !editingPayment) {
      toast({
        title: "Chyba",
        description: "Vyplňte částku a datum splatnosti",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("contract_payments")
        .update({
          payment_type: editFormData.payment_type,
          amount: parseFloat(editFormData.amount),
          due_date: format(editSelectedDate, "yyyy-MM-dd"),
          notes: editFormData.notes || null,
        })
        .eq("id", editingPayment.id);

      if (error) throw error;

      toast({
        title: "Uloženo",
        description: "Platba byla upravena",
      });

      setEditDialogOpen(false);
      setEditingPayment(null);
      fetchPayments();
    } catch (error) {
      console.error("Error saving payment:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se upravit platbu",
        variant: "destructive",
      });
    }
  };

  const handleSaveSchedule = async () => {
    const validItems = scheduleItems.filter(
      item => item.enabled && item.date && parseFloat(item.amount) > 0
    );

    if (validItems.length === 0) {
      toast({
        title: "Chyba",
        description: "Přidejte alespoň jednu platbu s částkou a datem",
        variant: "destructive",
      });
      return;
    }

    try {
      const paymentsToInsert = validItems.map((item, index) => ({
        contract_id: contractId,
        payment_type: item.type === "final" ? "final" : (index === 0 ? "deposit" : "installment"),
        amount: parseFloat(item.amount),
        due_date: format(item.date!, "yyyy-MM-dd"),
        notes: item.label,
      }));

      const { error } = await supabase
        .from("contract_payments")
        .insert(paymentsToInsert);

      if (error) throw error;

      toast({
        title: "Přidáno",
        description: `Přidáno ${validItems.length} plateb`,
      });

      setScheduleDialogOpen(false);
      fetchPayments();
    } catch (error) {
      console.error("Error saving schedule:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se uložit platební kalendář",
        variant: "destructive",
      });
    }
  };

  const handleTogglePaid = async (paymentId: string, paid: boolean) => {
    try {
      const updateData = !paid 
        ? { paid: true, paid_at: new Date().toISOString() }
        : { paid: false, paid_at: null };
      
      const { error } = await supabase
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

  const updateScheduleItem = (index: number, updates: Partial<ScheduleItem>) => {
    setScheduleItems(prev => prev.map((item, i) => 
      i === index ? { ...item, ...updates } : item
    ));
  };

  const depositsSum = payments
    .filter((p) => p.payment_type === "deposit" || p.payment_type === "installment")
    .reduce((sum, p) => sum + p.amount, 0);
  const allPaymentsSum = payments.reduce((sum, p) => sum + p.amount, 0);
  const remainingPayment = Math.max(0, totalPrice - allPaymentsSum);
  const paidAmount = payments.filter((p) => p.paid).reduce((sum, p) => sum + p.amount, 0);
  const unpaidTotal = payments.filter((p) => !p.paid).reduce((sum, p) => sum + p.amount, 0);

  const iban = bankAccountToIban(bankAccount);
  const variableSymbol = extractVariableSymbol(contractNumber);

  const isCzk = (currency || 'CZK').toUpperCase() === 'CZK';

  // Generate QR code for unpaid total (only for CZK)
  useEffect(() => {
    if (isCzk && unpaidTotal > 0 && contractNumber) {
      generatePaymentQrDataUrl({
        amount: unpaidTotal,
        contractNumber,
        bankAccount,
      }).then(setQrDataUrl).catch(console.error);
    } else {
      setQrDataUrl("");
    }
  }, [unpaidTotal, contractNumber, bankAccount]);

  // Calculate schedule totals
  const scheduleDepositsTotal = scheduleItems
    .filter(item => item.enabled && item.type !== "final")
    .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const scheduleFinalAmount = parseFloat(scheduleItems.find(i => i.type === "final")?.amount || "0");
  const scheduleTotal = scheduleDepositsTotal + scheduleFinalAmount;

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 space-y-0 pb-4 px-3 md:px-6">
          <CardTitle className="text-heading-2 flex items-center gap-2 shrink-0">
            <Wallet className="h-5 w-5" />
            Platební kalendář
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            {dealId && (
              <Button variant="outline" size="sm" onClick={handleSyncFromDeal} disabled={syncing}>
                {syncing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                <span className="hidden sm:inline">Synchronizovat z OP</span>
                <span className="sm:hidden">Sync</span>
              </Button>
            )}
            <Button onClick={() => { resetSchedule(); setScheduleDialogOpen(true); }} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Přidat
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-3 md:px-6">
          {loading ? (
            <p className="text-body text-muted-foreground">Načítání...</p>
          ) : payments.length === 0 ? (
            <p className="text-body text-muted-foreground">
              Zatím nejsou přidány žádné platby
            </p>
          ) : (
            <>
              <div className="space-y-2">
                {payments.map((payment) => {
                  const isOverdue = !payment.paid && isPast(startOfDay(new Date(payment.due_date)));
                  return (
                    <div
                      key={payment.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border",
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
                          <span className="text-sm font-medium truncate">
                            {getPaymentTypeLabel(payment.payment_type)}
                          </span>
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
                              Uhrazeno: {format(new Date(payment.paid_at), "d.M.yyyy", { locale: cs })}
                            </span>
                          )}
                          {payment.notes && (
                            <span className="truncate">{payment.notes}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditDialog(payment)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDeletePayment(payment.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Souhrn a platební údaje */}
              <div className="border-t pt-4 grid md:grid-cols-[1fr,auto] gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-body">
                    <span>Celková cena zájezdu:</span>
                    <span className="font-semibold">{formatPrice(totalPrice, true, currency)}</span>
                  </div>
                  <div className="flex justify-between text-body">
                    <span>Naplánované platby celkem:</span>
                    <span className="font-semibold">{formatPrice(allPaymentsSum, true, currency)}</span>
                  </div>
                  <div className="flex justify-between text-body font-medium">
                    <span>Zbývá k doplacení:</span>
                    <span className={cn("font-bold", remainingPayment > 0 ? "text-orange-600" : "text-green-600")}>
                      {formatPrice(remainingPayment, true, currency)}
                    </span>
                  </div>
                  <div className="border-t mt-2 pt-2">
                    <div className="flex justify-between text-body text-green-600">
                      <span>Zaplaceno:</span>
                      <span className="font-semibold">{formatPrice(paidAmount, true, currency)}</span>
                    </div>
                  </div>

                  {/* Platební údaje – only relevant currency */}
                  {isCzk ? (
                    <div className="border-t mt-2 pt-3 space-y-1">
                      <p className="text-sm font-semibold flex items-center gap-1.5">
                        <QrCode className="h-4 w-4" />
                        Platební údaje
                      </p>
                      {isPartl && (
                        <p className="text-sm text-muted-foreground">
                          Banka: <span className="font-medium text-foreground">RaiffeisenBank</span>
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        Číslo účtu: <span className="font-medium text-foreground">{bankAccount}</span>
                      </p>
                      {!isPartl && (
                        <p className="text-sm text-muted-foreground">
                          IBAN: <span className="font-medium text-foreground">{iban}</span>
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        Variabilní symbol: <span className="font-medium text-foreground">{variableSymbol}</span>
                      </p>
                    </div>
                  ) : isPartl ? (
                    <div className="border-t mt-2 pt-3 space-y-1">
                      <p className="text-sm font-semibold flex items-center gap-1.5">
                        <Wallet className="h-4 w-4" />
                        Platební údaje
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Banka: <span className="font-medium text-foreground">RaiffeisenBank</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        IBAN: <span className="font-medium text-foreground">CZ3955000000006180898002</span> · SWIFT: <span className="font-medium text-foreground">RZBCCZPP</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Variabilní symbol: <span className="font-medium text-foreground">{variableSymbol}</span>
                      </p>
                    </div>
                  ) : (
                    <div className="border-t mt-2 pt-3 space-y-1">
                      <p className="text-sm font-semibold flex items-center gap-1.5">
                        <Wallet className="h-4 w-4" />
                        Platební údaje
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Příjemce: <span className="font-medium text-foreground">YARO s.r.o.</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        IBAN: <span className="font-medium text-foreground">DE89202208000051200891</span> · SWIFT: <span className="font-medium text-foreground">SXPYDEHH</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Banka: <span className="font-medium text-foreground">BANKING CIRCLE S.A.</span> <span className="text-xs">(Maximilanstr 54, München, 80538, Germany)</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Variabilní symbol: <span className="font-medium text-foreground">{variableSymbol}</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* QR kód */}
                {qrDataUrl && unpaidTotal > 0 && (
                  <div className="flex flex-col items-center justify-center">
                    <img src={qrDataUrl} alt="QR platba" className="w-[120px] h-[120px] rounded" />
                    <p className="text-xs text-muted-foreground mt-1">QR platba</p>
                    <p className="text-sm font-bold text-foreground">{formatPrice(unpaidTotal, true, currency)}</p>
                  </div>
                )}
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
                <span>Celková cena zájezdu:</span>
                <span className="font-semibold">{formatPrice(totalPrice, true, currency)}</span>
              </div>
            </div>

            <div className="space-y-3">
              {scheduleItems.filter(item => item.type !== "final").map((item, index) => (
                <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                  <Checkbox
                    checked={item.enabled}
                    onCheckedChange={(checked) => 
                      updateScheduleItem(index, { enabled: !!checked })
                    }
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
                            className={cn(
                              "w-full h-9 justify-start text-left font-normal",
                              !item.date && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {item.date ? format(item.date, "d. M. yyyy", { locale: cs }) : "Datum"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={item.date}
                            onSelect={(date) => updateScheduleItem(index, { date })}
                            initialFocus
                            locale={cs}
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
              ))}

              {/* Final Payment - always shown */}
              <div className="p-3 border-2 border-primary/20 rounded-lg bg-primary/5">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={scheduleItems[3].enabled}
                    onCheckedChange={(checked) => 
                      updateScheduleItem(3, { enabled: !!checked })
                    }
                  />
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Doplatek (automaticky)</Label>
                      <div className="h-9 px-3 flex items-center bg-muted rounded-md font-semibold">
                        {formatPrice(parseFloat(scheduleItems[3].amount || "0"), true, currency)}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Splatnost</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            disabled={!scheduleItems[3].enabled}
                            className={cn(
                              "w-full h-9 justify-start text-left font-normal",
                              !scheduleItems[3].date && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {scheduleItems[3].date 
                              ? format(scheduleItems[3].date, "d. M. yyyy", { locale: cs }) 
                              : "Datum"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={scheduleItems[3].date}
                            onSelect={(date) => updateScheduleItem(3, { date })}
                            initialFocus
                            locale={cs}
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-muted/50 p-3 rounded-lg space-y-1">
              <div className="flex justify-between text-sm">
                <span>Zálohy celkem:</span>
                <span className="font-medium">{formatPrice(scheduleDepositsTotal, true, currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Doplatek:</span>
                <span className="font-medium">{formatPrice(scheduleFinalAmount, true, currency)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold border-t pt-1">
                <span>Celkem:</span>
                <span className={cn(
                  scheduleTotal === totalPrice ? "text-green-600" : "text-orange-600"
                )}>
                  {formatPrice(scheduleTotal, true, currency)}
                  {scheduleTotal !== totalPrice && " ⚠️"}
                </span>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>
                Zrušit
              </Button>
              <Button onClick={handleSaveSchedule}>
                Uložit platby
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Single Payment Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => { 
        setEditDialogOpen(open); 
        if (!open) setEditingPayment(null); 
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upravit platbu</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Částka (Kč)</Label>
              <Input
                type="number"
                value={editFormData.amount}
                onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Datum splatnosti</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !editSelectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editSelectedDate ? format(editSelectedDate, "d. M. yyyy", { locale: cs }) : "Vyberte datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={editSelectedDate}
                    onSelect={setEditSelectedDate}
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
                value={editFormData.notes}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                placeholder="Nepovinné"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => {
                setEditDialogOpen(false);
                setEditingPayment(null);
              }}>
                Zrušit
              </Button>
              <Button onClick={handleSaveEditPayment}>
                Uložit změny
              </Button>
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
