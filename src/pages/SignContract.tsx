import { useState, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { SignatureCanvas } from "@/components/SignatureCanvas";
import { ContractPdfTemplate } from "@/components/ContractPdfTemplate";
import { CheckCircle2, FileSignature, Loader2, AlertCircle } from "lucide-react";
import yaroLogo from "@/assets/yaro-logo-wide.png";
import html2pdf from "html2pdf.js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const formatDate = (d: string | null) => {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });
};

const formatPrice = (amount: number | null, currency = "CZK") => {
  if (!amount) return "—";
  return new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(amount) + ` ${currency}`;
};

const SignContract = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [signerName, setSignerName] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [signed, setSigned] = useState(false);
  const [sendingPdf, setSendingPdf] = useState(false);
  const [pdfSent, setPdfSent] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["sign-contract", token],
    queryFn: async () => {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/sign-contract?token=${token}`,
        { headers: { apikey: SUPABASE_KEY } }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Smlouva nenalezena");
      }
      return res.json();
    },
    enabled: !!token,
  });

  const contract = data?.contract;

  const generateAndSendPdf = useCallback(async (contractData: any, signatureUrl: string) => {
    setSendingPdf(true);
    try {
      // Wait a bit for the PDF template to render with the signature
      await new Promise(r => setTimeout(r, 1500));
      
      const element = pdfRef.current;
      if (!element) {
        console.error("PDF element not found");
        return;
      }

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
            const clonedElement = clonedDoc.getElementById('signed-contract-pdf');
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

      const pdfBlob: Blob = await html2pdf().set(opt).from(element).outputPdf('blob');
      
      // Convert blob to base64
      const arrayBuffer = await pdfBlob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const chunkSize = 8192;
      let binary = "";
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
        for (let j = 0; j < chunk.length; j++) {
          binary += String.fromCharCode(chunk[j]);
        }
      }
      const pdfBase64 = btoa(binary);

      // Send to edge function
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/send-signed-contract`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
          body: JSON.stringify({ contractId: contractData.id, pdfBase64 }),
        }
      );

      if (res.ok) {
        setPdfSent(true);
        console.log("Signed PDF sent successfully");
      } else {
        const err = await res.json();
        console.error("Failed to send signed PDF:", err);
      }
    } catch (err) {
      console.error("Error generating/sending PDF:", err);
    } finally {
      setSendingPdf(false);
    }
  }, []);

  const signMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/sign-contract?token=${token}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
          body: JSON.stringify({ signatureDataUrl: signatureData, signerName }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Chyba při podepisování");
      }
      return res.json();
    },
    onSuccess: () => {
      setSigned(true);
      // After signing, generate PDF with the client's signature and send it
      if (contract) {
        // We need the signature URL - reconstruct it from storage pattern
        // The sign-contract function uploads to contract-signatures/{contractId}/signature-{timestamp}.png
        // We'll use the signatureData directly as the URL in the PDF
        const contractWithSignature = {
          ...contract,
          signature_url: signatureData, // base64 data URL works in img src
        };
        generateAndSendPdf(contractWithSignature, signatureData!);
      }
    },
  });

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="p-8 text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Neplatný odkaz</h1>
          <p className="text-muted-foreground">Odkaz pro podpis smlouvy je neplatný nebo chybí token.</p>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="p-8 text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Smlouva nenalezena</h1>
          <p className="text-muted-foreground">{(error as Error).message}</p>
        </Card>
      </div>
    );
  }

  if (signed || contract?.signed_at) {
    // Build contract data with signature for PDF rendering
    const signedContract = signed 
      ? { ...contract, signature_url: signatureData }
      : contract;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="p-8 text-center max-w-md">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Smlouva podepsána</h1>
          <p className="text-muted-foreground">
            Smlouva {contract?.contract_number} byla úspěšně podepsána.
            Děkujeme za důvěru!
          </p>
          {sendingPdf && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Odesíláme podepsanou smlouvu na váš e-mail...
            </div>
          )}
          {pdfSent && (
            <p className="mt-4 text-sm text-green-600">
              ✓ Podepsaná smlouva byla odeslána na váš e-mail.
            </p>
          )}
          {contract?.signature_url && !signed && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">Podpis:</p>
              <img src={contract.signature_url} alt="Podpis" className="max-h-20 mx-auto border rounded" />
            </div>
          )}
        </Card>

        {/* Hidden PDF template for generating the signed contract */}
        {signed && (
          <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
            <div id="signed-contract-pdf" ref={pdfRef}>
              <ContractPdfTemplate contract={signedContract} />
            </div>
          </div>
        )}
      </div>
    );
  }

  const deal = contract?.deal;
  const services = deal?.services || [];
  const travelers = deal?.travelers || [];
  const payments = contract?.payments || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <img src={yaroLogo} alt="YARO Travel" className="h-12 mx-auto logo-dark-mode" />
          <h1 className="text-2xl font-bold text-foreground">Smlouva o zájezdu</h1>
          <p className="text-muted-foreground">{contract.contract_number}</p>
        </div>

        {/* Contract summary */}
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold text-lg">Přehled smlouvy</h2>
          {(() => {
            const hotelService = services.find((s: any) => s.service_type === "hotel");
            const boardType = hotelService?.details?.board_type;
            const boardLabels: Record<string, string> = {
              "breakfast": "Snídaně",
              "half_board": "Polopenze",
              "full_board": "Plná penze",
              "all_inclusive": "All Inclusive",
              "room_only": "Bez stravy",
            };
            return (
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Klient:</span>{" "}
                  <span className="font-medium">{contract.client?.first_name} {contract.client?.last_name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Destinace:</span>{" "}
                  <span className="font-medium">
                    {deal?.destination?.name}{deal?.destination?.country?.name ? `, ${deal.destination.country.name}` : ""}
                  </span>
                </div>
                {hotelService && (
                  <div>
                    <span className="text-muted-foreground">Hotel:</span>{" "}
                    <span className="font-medium">{hotelService.service_name}</span>
                  </div>
                )}
                {boardType && (
                  <div>
                    <span className="text-muted-foreground">Stravování:</span>{" "}
                    <span className="font-medium">{boardLabels[boardType] || boardType}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Termín:</span>{" "}
                  <span className="font-medium">{formatDate(deal?.start_date)} – {formatDate(deal?.end_date)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Celková cena:</span>{" "}
                  <span className="font-bold">{formatPrice(contract.total_price, contract.currency)}</span>
                </div>
              </div>
            );
          })()}
        </Card>

        {/* Travelers */}
        {travelers.length > 0 && (
          <Card className="p-5 space-y-3">
            <h2 className="font-semibold text-lg">Cestující ({travelers.length})</h2>
            <div className="space-y-1 text-sm">
              {travelers.map((t: any, i: number) => (
                <p key={i}>
                  <span className="font-medium">{t.client?.title ? `${t.client.title} ` : ""}{t.client?.first_name} {t.client?.last_name}</span>
                  {t.client?.date_of_birth && <span className="text-muted-foreground"> • nar. {formatDate(t.client.date_of_birth)}</span>}
                </p>
              ))}
            </div>
          </Card>
        )}

        {/* Services */}
        {services.length > 0 && (
          <Card className="p-5 space-y-3">
            <h2 className="font-semibold text-lg">Služby</h2>
            <div className="space-y-2 text-sm">
              {services.map((s: any, i: number) => {
                const priceMode = s.details?.price_mode || "per_service";
                const multiplier = priceMode === "per_person" ? (s.person_count || 1) : (s.quantity || 1);
                const total = (s.price || 0) * multiplier;

                // Parse flight legs
                let flightLegs: { text: string }[] = [];
                if (s.service_type === "flight" && s.details) {
                  const det = typeof s.details === "string" ? JSON.parse(s.details) : s.details;
                  const parseLeg = (seg: any) => {
                    const parts: string[] = [];
                    if (seg.date) {
                      try { parts.push(new Date(seg.date).toLocaleDateString("cs-CZ", { day: "2-digit", month: "2-digit", year: "2-digit" })); } catch { parts.push(seg.date); }
                    }
                    const flightId = [seg.airline && seg.flight_number ? `${seg.airline}${seg.flight_number}` : (seg.flight_number || ""), seg.airline_name || ""].filter(Boolean).join(" ");
                    if (flightId) parts.push(flightId);
                    const dep = seg.departure_airport || seg.departure;
                    const arr = seg.arrival_airport || seg.arrival;
                    if (dep || arr) parts.push(`${dep || "?"} → ${arr || "?"}`);
                    if (seg.departure_time) parts.push(`Odlet: ${seg.departure_time}`);
                    if (seg.arrival_time) parts.push(`Přílet: ${seg.arrival_time}`);
                    return parts.join(" • ");
                  };
                  if (det.outbound_segments || det.return_segments) {
                    for (const seg of (det.outbound_segments || [])) flightLegs.push({ text: parseLeg(seg) });
                    for (const seg of (det.return_segments || [])) flightLegs.push({ text: parseLeg(seg) });
                  } else if (det.segments) {
                    for (const seg of det.segments) flightLegs.push({ text: parseLeg(seg) });
                  } else {
                    if (det.outbound) flightLegs.push({ text: parseLeg({ ...det.outbound, date: s.start_date }) });
                    if (det.return) flightLegs.push({ text: parseLeg({ ...det.return, date: s.end_date }) });
                  }
                }

                return (
                  <div key={i} className="flex justify-between items-start py-1 border-b last:border-0">
                    <div>
                      <p className="font-medium">{s.service_name}</p>
                      {s.description && <p className="text-muted-foreground text-xs">{s.description}</p>}
                      {flightLegs.length > 0 && (
                        <div className="text-muted-foreground text-xs space-y-0.5 mt-0.5">
                          {flightLegs.map((leg, idx) => <p key={idx}>{leg.text}</p>)}
                        </div>
                      )}
                      {flightLegs.length === 0 && s.start_date && (
                        <p className="text-muted-foreground text-xs">{formatDate(s.start_date)}{s.end_date ? ` – ${formatDate(s.end_date)}` : ""}</p>
                      )}
                    </div>
                    {s.price ? (
                      <div className="text-right whitespace-nowrap">
                        <span className="font-medium">{formatPrice(total)}</span>
                        {multiplier > 1 && (
                          <p className="text-muted-foreground text-xs">
                            {formatPrice(s.price)} × {multiplier} {priceMode === "per_person" ? "os." : "ks"}
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Payments */}
        {payments.length > 0 && (
          <Card className="p-5 space-y-3">
            <h2 className="font-semibold text-lg">Platební kalendář</h2>
            <div className="space-y-2 text-sm">
              {payments.map((p: any, i: number) => (
                <div key={i} className="flex justify-between items-center py-1 border-b last:border-0">
                  <div>
                    <span className="font-medium">{p.payment_type === "deposit" ? "Záloha" : p.payment_type === "final" ? "Doplatek" : p.payment_type}</span>
                    <span className="text-muted-foreground ml-2">do {formatDate(p.due_date)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{formatPrice(p.amount)}</span>
                    {p.paid && <Badge variant="outline" className="text-xs text-green-600">Zaplaceno</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Notes: Tee Times + Terms */}
        {(contract.tee_times?.length > 0 || contract.terms) && (
          <Card className="p-5 space-y-3">
            <h2 className="font-semibold text-lg">Poznámky</h2>
            {contract.tee_times?.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium">Startovací časy (Tee Times)</p>
                <div className="text-sm text-muted-foreground space-y-0.5">
                  {contract.tee_times.map((tt: any, i: number) => {
                    const dateStr = tt.date
                      ? new Date(tt.date).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "2-digit" })
                      : "—";
                    return (
                      <p key={i}>
                        {dateStr} – {tt.course || "—"}{tt.time ? ` – ${tt.time}` : ""}{tt.players ? ` (${tt.players}x)` : ""}
                      </p>
                    );
                  })}
                </div>
              </div>
            )}
            {contract.terms && (
              <div>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{contract.terms}</p>
              </div>
            )}
          </Card>
        )}

        {/* Signing section */}
        <Card className="p-5 space-y-5 border-primary/30 border-2">
          <div className="flex items-center gap-2">
            <FileSignature className="h-6 w-6 text-primary" />
            <h2 className="font-semibold text-lg">Podpis smlouvy</h2>
          </div>

          <div className="space-y-2">
            <Label>Jméno a příjmení *</Label>
            <Input
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Jan Novák"
              className="max-w-sm"
            />
          </div>

          <div className="space-y-2">
            <Label>Podpis *</Label>
            <SignatureCanvas onSignatureChange={setSignatureData} width={Math.min(500, window.innerWidth - 80)} height={180} />
          </div>

          <div className="flex items-start space-x-3">
            <Checkbox
              id="agree"
              checked={agreed}
              onCheckedChange={(v) => setAgreed(v === true)}
            />
            <label htmlFor="agree" className="text-sm leading-relaxed cursor-pointer">
              Souhlasím s podmínkami smlouvy o zájezdu a potvrzuji, že jsem se seznámil/a s veškerými informacemi uvedenými v tomto dokumentu. Svým podpisem stvrzuji závaznou objednávku zájezdu.
            </label>
          </div>

          <Button
            size="lg"
            className="w-full"
            disabled={!signerName.trim() || !signatureData || !agreed || signMutation.isPending}
            onClick={() => signMutation.mutate()}
          >
            {signMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Podepisuji...</>
            ) : (
              <><FileSignature className="h-4 w-4 mr-2" /> Podepsat smlouvu</>
            )}
          </Button>

          {signMutation.isError && (
            <p className="text-destructive text-sm text-center">
              {(signMutation.error as Error).message}
            </p>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Podpisem souhlasíte s elektronickým podepsáním smlouvy. Váš podpis, IP adresa a čas budou zaznamenány.
          </p>
        </Card>
      </div>
    </div>
  );
};

export default SignContract;
