import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Send, Loader2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import html2pdf from "html2pdf.js";

interface SendContractEmailProps {
  contract: any;
  pdfContentRef: React.RefObject<HTMLDivElement | null>;
  onSent: () => void;
}

export const SendContractEmail = ({ contract, pdfContentRef, onSent }: SendContractEmailProps) => {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [ccSupplier, setCcSupplier] = useState(false);
  const [supplierEmail, setSupplierEmail] = useState("");

  const clientEmail = contract?.client?.email;

  // Collect unique supplier emails from deal services
  const supplierEmails = (() => {
    const emails: { name: string; email: string }[] = [];
    const seen = new Set<string>();
    contract?.deal?.services?.forEach((s: any) => {
      if (s.supplier?.email && !seen.has(s.supplier.email)) {
        seen.add(s.supplier.email);
        emails.push({ name: s.supplier.name || s.supplier.email, email: s.supplier.email });
      }
    });
    return emails;
  })();

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setCcSupplier(false);
      setSupplierEmail(supplierEmails.length > 0 ? supplierEmails[0].email : "");
    }
    setOpen(isOpen);
  };

  const handleSend = async () => {
    if (!clientEmail) {
      toast.error("Klient nemá nastavenou e-mailovou adresu");
      return;
    }

    setSending(true);
    try {
      // Generate PDF
      let pdfPath: string | null = null;
      const element = pdfContentRef.current;

      if (element) {
        const opt = {
          margin: [10, 10, 10, 10] as [number, number, number, number],
          image: { type: 'jpeg' as const, quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            letterRendering: true,
            onclone: (clonedDoc: Document) => {
              clonedDoc.documentElement.classList.remove('dark');
              const clonedElement = clonedDoc.getElementById('contract-pdf-content');
              if (clonedElement) {
                clonedElement.style.backgroundColor = '#ffffff';
                clonedElement.style.color = '#000000';
                clonedElement.style.display = 'block';
                const logos = clonedElement.querySelectorAll('.logo-dark-mode');
                logos.forEach(el => { (el as HTMLElement).style.filter = 'none'; });
              }
            },
          },
          jsPDF: {
            unit: 'mm' as const,
            format: 'a4' as const,
            orientation: 'portrait' as const,
          },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'], avoid: ['[data-pdf-section]'] },
        };

        const pdfBlob = await html2pdf().set(opt).from(element).outputPdf('blob');
        const fileName = `contract-${contract.contract_number}-${Date.now()}.pdf`;

        const { error: uploadError } = await supabase.storage
          .from("voucher-pdfs")
          .upload(fileName, pdfBlob, { contentType: "application/pdf" });

        if (uploadError) {
          console.error("PDF upload error:", uploadError);
          toast.error("Chyba při nahrávání PDF");
          return;
        }

        pdfPath = fileName;
      }

      // Send email via edge function
      const { data, error } = await supabase.functions.invoke("send-contract-email", {
        body: {
          contractId: contract.id,
          pdfPath,
          ccSupplierEmail: ccSupplier && supplierEmail ? supplierEmail : null,
        },
      });

      if (error) throw error;

      if (data?.success) {
        const recipients = data.recipients?.join(", ") || clientEmail;
        toast.success(`Smlouva odeslána na: ${recipients}`);
        setOpen(false);
        onSent();
      } else {
        toast.error(data?.error || "Chyba při odesílání e-mailu");
      }
    } catch (err: any) {
      console.error("Error sending contract email:", err);
      toast.error("Chyba při odesílání smlouvy");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="md:size-default">
          <Send className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Odeslat</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md bg-background">
        <DialogHeader>
          <DialogTitle>Odeslat smlouvu e-mailem</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Client email */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Zákazník</Label>
            <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-foreground">
                {clientEmail || <span className="text-destructive">E-mail zákazníka není vyplněn</span>}
              </span>
            </div>
          </div>

          {/* CC Supplier */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="cc-supplier"
                checked={ccSupplier}
                onCheckedChange={(checked) => setCcSupplier(!!checked)}
              />
              <Label htmlFor="cc-supplier" className="text-sm font-medium cursor-pointer">
                Kopii odeslat dodavateli
              </Label>
            </div>

            {ccSupplier && (
              <div className="pl-6 space-y-2">
                {supplierEmails.length > 0 ? (
                  <div className="space-y-2">
                    {supplierEmails.map((s) => (
                      <label
                        key={s.email}
                        className={`flex items-center gap-2 p-2 rounded-md cursor-pointer border ${
                          supplierEmail === s.email ? "border-primary bg-primary/5" : "border-border"
                        }`}
                        onClick={() => setSupplierEmail(s.email)}
                      >
                        <input
                          type="radio"
                          name="supplier-email"
                          checked={supplierEmail === s.email}
                          onChange={() => setSupplierEmail(s.email)}
                          className="accent-primary"
                        />
                        <div className="text-sm">
                          <span className="font-medium">{s.name}</span>
                          <span className="text-muted-foreground ml-2">{s.email}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <Input
                    type="email"
                    placeholder="E-mail dodavatele"
                    value={supplierEmail}
                    onChange={(e) => setSupplierEmail(e.target.value)}
                  />
                )}
              </div>
            )}
          </div>

          {/* Info */}
          <p className="text-xs text-muted-foreground">
            Smlouva bude odeslána jako PDF příloha. Kopie se automaticky archivuje na zajezdy@yarotravel.cz.
          </p>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
            Zrušit
          </Button>
          <Button onClick={handleSend} disabled={sending || !clientEmail}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Odesílám...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Odeslat
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
