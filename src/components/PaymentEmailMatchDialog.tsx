import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Mail, Check, Loader2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { formatPrice } from "@/lib/utils";

interface ParsedPayment {
  amount: number;
  date?: string;
  variable_symbol?: string;
  sender_name?: string;
  sender_account?: string;
  note?: string;
}

interface PaymentMatch {
  table: string;
  payment_id: string;
  payment_type: string;
  payment_notes?: string;
  amount: number;
  due_date: string;
  contract_number?: string;
  contract_id?: string;
  deal_id?: string;
}

interface PaymentEmailMatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context?: {
    contract_id?: string;
    deal_id?: string;
  };
  onPaymentMatched: () => void;
}

const paymentTypeLabels: Record<string, string> = {
  deposit: "Záloha",
  installment: "Splátka",
  final: "Doplatek",
};

export function PaymentEmailMatchDialog({
  open,
  onOpenChange,
  context,
  onPaymentMatched,
}: PaymentEmailMatchDialogProps) {
  const { toast } = useToast();
  const [emailText, setEmailText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [parsed, setParsed] = useState<ParsedPayment | null>(null);
  const [matches, setMatches] = useState<PaymentMatch[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setEmailText("");
    setParsed(null);
    setMatches([]);
    setError(null);
  };

  const handleParse = async () => {
    if (!emailText.trim()) return;
    setParsing(true);
    setError(null);
    setParsed(null);
    setMatches([]);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("parse-payment-email", {
        body: { emailText, context },
      });

      if (fnError) throw fnError;

      if (data.error) {
        setError(data.error);
      } else {
        setParsed(data.parsed);
        setMatches(data.matches || []);
        if (data.matches?.length === 0) {
          setError(data.message || "Nenalezena žádná odpovídající platba");
        }
      }
    } catch (err: any) {
      console.error("Parse error:", err);
      setError(err.message || "Chyba při zpracování emailu");
    } finally {
      setParsing(false);
    }
  };

  const handleConfirm = async (match: PaymentMatch) => {
    setConfirming(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("confirm-payment-match", {
        body: {
          payment_id: match.payment_id,
          paid_at: parsed?.date ? new Date(parsed.date).toISOString() : new Date().toISOString(),
          table: match.table,
        },
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      toast({
        title: "Platba spárována",
        description: `${paymentTypeLabels[match.payment_type] || match.payment_type} ${formatPrice(match.amount)} byla označena jako zaplacená`,
      });

      onPaymentMatched();
      onOpenChange(false);
      reset();
    } catch (err: any) {
      console.error("Confirm error:", err);
      toast({
        title: "Chyba",
        description: err.message || "Nepodařilo se potvrdit platbu",
        variant: "destructive",
      });
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Spárovat platbu z emailu
          </DialogTitle>
          <DialogDescription>
            Vložte text emailové notifikace z banky a systém automaticky najde odpovídající platbu.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Email text input */}
          {!parsed && (
            <>
              <Textarea
                value={emailText}
                onChange={(e) => setEmailText(e.target.value)}
                placeholder="Vložte sem text emailové notifikace z banky (Ctrl+V)..."
                rows={6}
                className="font-mono text-xs"
              />
              <Button
                onClick={handleParse}
                disabled={parsing || !emailText.trim()}
                className="w-full"
              >
                {parsing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzuji email...
                  </>
                ) : (
                  "Analyzovat email"
                )}
              </Button>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Parsed data preview */}
          {parsed && (
            <div className="p-3 rounded-lg bg-muted/50 space-y-1.5 text-sm">
              <p className="font-semibold text-base">Rozpoznáno z emailu:</p>
              <div className="grid grid-cols-2 gap-1">
                <span className="text-muted-foreground">Částka:</span>
                <span className="font-semibold">{formatPrice(parsed.amount)}</span>
                {parsed.date && (
                  <>
                    <span className="text-muted-foreground">Datum:</span>
                    <span>{format(new Date(parsed.date), "d. M. yyyy", { locale: cs })}</span>
                  </>
                )}
                {parsed.variable_symbol && (
                  <>
                    <span className="text-muted-foreground">VS:</span>
                    <span>{parsed.variable_symbol}</span>
                  </>
                )}
                {parsed.sender_name && (
                  <>
                    <span className="text-muted-foreground">Odesílatel:</span>
                    <span>{parsed.sender_name}</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Matches */}
          {matches.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">
                Nalezené platby ({matches.length}):
              </p>
              {matches.map((match) => (
                <div
                  key={match.payment_id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-background"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">
                      {paymentTypeLabels[match.payment_type] || match.payment_type}
                      {match.payment_notes ? ` — ${match.payment_notes}` : ""}
                    </p>
                    <p className="text-sm">
                      <span className="font-semibold">{formatPrice(match.amount)}</span>
                      {" · splatnost "}
                      {format(new Date(match.due_date), "d. M. yyyy", { locale: cs })}
                    </p>
                    {match.contract_number && (
                      <p className="text-xs text-muted-foreground">
                        Smlouva: {match.contract_number}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleConfirm(match)}
                    disabled={confirming}
                  >
                    {confirming ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Potvrdit
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Try again button */}
          {parsed && (
            <Button variant="outline" onClick={reset} className="w-full">
              Zkusit jiný email
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
