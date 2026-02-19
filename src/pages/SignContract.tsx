import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { SignatureCanvas } from "@/components/SignatureCanvas";
import { CheckCircle2, FileSignature, Loader2, AlertCircle } from "lucide-react";
import yaroLogo from "@/assets/yaro-logo-wide.png";

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
    onSuccess: () => setSigned(true),
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="p-8 text-center max-w-md">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Smlouva podepsána</h1>
          <p className="text-muted-foreground">
            Smlouva {contract?.contract_number} byla úspěšně podepsána.
            Děkujeme za důvěru!
          </p>
          {contract?.signature_url && !signed && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">Podpis:</p>
              <img src={contract.signature_url} alt="Podpis" className="max-h-20 mx-auto border rounded" />
            </div>
          )}
        </Card>
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
            <div>
              <span className="text-muted-foreground">Termín:</span>{" "}
              <span className="font-medium">{formatDate(deal?.start_date)} – {formatDate(deal?.end_date)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Celková cena:</span>{" "}
              <span className="font-bold">{formatPrice(contract.total_price, contract.currency)}</span>
            </div>
          </div>
        </Card>

        {/* Travelers */}
        {travelers.length > 0 && (
          <Card className="p-5 space-y-3">
            <h2 className="font-semibold text-lg">Cestující</h2>
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
              {services.map((s: any, i: number) => (
                <div key={i} className="flex justify-between items-start py-1 border-b last:border-0">
                  <div>
                    <p className="font-medium">{s.service_name}</p>
                    {s.description && <p className="text-muted-foreground text-xs">{s.description}</p>}
                    {s.start_date && <p className="text-muted-foreground text-xs">{formatDate(s.start_date)}{s.end_date ? ` – ${formatDate(s.end_date)}` : ""}</p>}
                  </div>
                  {s.price && <span className="font-medium whitespace-nowrap">{formatPrice(s.price)}</span>}
                </div>
              ))}
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

        {/* Terms */}
        {contract.terms && (
          <Card className="p-5 space-y-3">
            <h2 className="font-semibold text-lg">Podmínky smlouvy</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{contract.terms}</p>
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
