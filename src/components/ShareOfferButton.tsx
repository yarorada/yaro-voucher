import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Check, Link, Loader2, Mail, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface VariantInfo {
  id: string;
  variant_name: string;
  is_selected: boolean;
}

interface ShareOfferButtonProps {
  dealId: string;
  shareToken: string | null;
  onTokenGenerated: (token: string) => void;
  variants: VariantInfo[];
  triggerClassName?: string;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

interface ServicePreview {
  service_type: string;
  service_name: string;
  description: string | null;
  quantity: number;
  person_count: number | null;
  price: number | null;
  price_currency: string | null;
  order_index: number | null;
}

interface VariantPreview {
  id: string;
  variant_name: string;
  hotel_name: string | null;
  hotel_image: string | null;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  total_price: number | null;
  hide_price: boolean;
  currency: string;
  services: ServicePreview[];
  notes: string | null;
}

function generateToken(length = 12): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const values = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i++) {
    result += chars[values[i] % chars.length];
  }
  return result;
}

const buildDefaultMessage = (client: any) => {
  if (!client) return "zasíláme Vám nabídku podle Vašich požadavků.";
  const lastName = client.last_name || "";
  const title = client.title || "";
  const isFemale = title === "paní" || title === "Paní" || lastName.endsWith("ová") || lastName.endsWith("á");
  const salutation = isFemale ? "paní" : "pane";
  const vazeny = isFemale ? "Vážená" : "Vážený";
  return `${vazeny} ${salutation} ${lastName},\n\nzasíláme Vám nabídku podle Vašich požadavků.`;
};

function formatDate(d: string | null): string {
  if (!d) return "";
  const dt = new Date(d);
  return `${dt.getDate()}.${dt.getMonth() + 1}.${dt.getFullYear()}`;
}

function formatPrice(n: number, currency = "CZK"): string {
  const fmt = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(n);
  const symbols: Record<string, string> = { EUR: "€", USD: "$", GBP: "£" };
  return currency === "CZK" ? `${fmt} CZK` : `${fmt} ${symbols[currency] || currency}`;
}

export function ShareOfferButton({ dealId, shareToken, onTokenGenerated, variants, triggerClassName, externalOpen, onExternalOpenChange }: ShareOfferButtonProps) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(new Set());

  // Email compose dialog
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");

  // Preview data
  const [variantPreviews, setVariantPreviews] = useState<VariantPreview[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [clientName, setClientName] = useState("");

  const hasMultipleVariants = variants.length > 1;

  // Initialize: select the is_selected variant, or all if none
  useEffect(() => {
    if (variants.length <= 1) {
      setSelectedVariantIds(new Set(variants.map(v => v.id)));
      return;
    }
    const selected = variants.filter(v => v.is_selected);
    if (selected.length > 0) {
      setSelectedVariantIds(new Set(selected.map(v => v.id)));
    } else {
      setSelectedVariantIds(new Set(variants.map(v => v.id)));
    }
  }, [variants]);

  // Handle external open trigger — use Dialog instead of Popover (hidden trigger can't anchor popover)
  useEffect(() => {
    if (!externalOpen) return;
    let cancelled = false;
    (async () => {
      onExternalOpenChange?.(false);
      const token = await ensureShareToken();
      if (!cancelled && token) {
        setShareDialogOpen(true);
      }
    })();
    return () => { cancelled = true; };
  }, [externalOpen]);

  const toggleVariant = (id: string) => {
    setSelectedVariantIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => setSelectedVariantIds(new Set(variants.map(v => v.id)));

  const allSelected = selectedVariantIds.size === variants.length;

  const getPublicUrl = (token: string) => {
    const base = `https://yarogolf-crm.lovable.app/offer/${encodeURIComponent(token)}`;
    if (!hasMultipleVariants) return base;
    return `${base}?variants=${Array.from(selectedVariantIds).join(",")}`;
  };

  const ensureShareToken = async (): Promise<string | null> => {
    if (shareToken) return shareToken;
    setLoading(true);
    try {
      const token = generateToken();
      const { error } = await supabase
        .from("deals")
        .update({ share_token: token } as any)
        .eq("id", dealId);
      if (error) throw error;
      onTokenGenerated(token);
      return token;
    } catch (error) {
      console.error("Error generating share token:", error);
      toast.error("Nepodařilo se vygenerovat odkaz");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    const token = await ensureShareToken();
    if (token) await copyToClipboard(getPublicUrl(token));
  };

  

  // Fetch preview data
  const fetchPreviewData = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const selectedIds = Array.from(selectedVariantIds);
      const { data: vData } = await supabase
        .from("deal_variants")
        .select(`
          id, variant_name, start_date, end_date, total_price, hide_price, notes,
          destination:destinations(name, country:countries(name)),
          deal_variant_services(service_type, service_name, description, price, price_currency, quantity, person_count, order_index)
        `)
        .in("id", selectedIds);

      // Fetch hotel images
      const hotelNames = (vData || [])
        .flatMap((v: any) => (v.deal_variant_services || []).filter((s: any) => s.service_type === "hotel").map((s: any) => s.service_name))
        .filter(Boolean);

      let hotelImages: Record<string, string | null> = {};
      if (hotelNames.length > 0) {
        const { data: hotels } = await supabase
          .from("hotel_templates")
          .select("name, image_url")
          .in("name", hotelNames);
        (hotels || []).forEach((h: any) => { hotelImages[h.name] = h.image_url; });
      }

      const previews: VariantPreview[] = (vData || []).map((v: any) => {
        const services: ServicePreview[] = (v.deal_variant_services || [])
          .sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))
          .map((s: any) => ({
            service_type: s.service_type,
            service_name: s.service_name,
            description: s.description || null,
            quantity: s.quantity || 1,
            person_count: s.person_count || null,
            price: s.price || null,
            price_currency: s.price_currency || null,
            order_index: s.order_index,
          }));
        const hotelSvc = services.find(s => s.service_type === "hotel");
        const dest = v.destination;
        const currency = services.find(s => s.price_currency)?.price_currency || "CZK";
        return {
          id: v.id,
          variant_name: v.variant_name,
          hotel_name: hotelSvc?.service_name || null,
          hotel_image: hotelSvc ? (hotelImages[hotelSvc.service_name] || null) : null,
          destination: dest ? `${dest.name}${dest.country?.name ? ", " + dest.country.name : ""}` : null,
          start_date: v.start_date,
          end_date: v.end_date,
          total_price: v.hide_price ? null : v.total_price,
          hide_price: v.hide_price,
          currency,
          services,
          notes: v.notes || null,
        };
      });

      // Sort by selectedVariantIds order (respects drag order)
      const ordered = selectedIds.map(id => previews.find(p => p.id === id)).filter(Boolean) as VariantPreview[];
      setVariantPreviews(ordered);
    } catch (e) {
      console.error("Preview fetch error:", e);
    } finally {
      setPreviewLoading(false);
    }
  }, [selectedVariantIds]);

  const handleOpenEmailDialog = async () => {
    const token = await ensureShareToken();
    if (!token) return;

    try {
      const { data: deal } = await supabase
        .from("deals")
        .select("lead_client_id, clients:lead_client_id(title, first_name, last_name)")
        .eq("id", dealId)
        .single();
      const client = (deal as any)?.clients;
      setCustomMessage(buildDefaultMessage(client));
      setClientName(client ? `${client.first_name || ""} ${client.last_name || ""}`.trim() : "");
    } catch {
      setCustomMessage("zasíláme Vám nabídku podle Vašich požadavků.");
      setClientName("");
    }

    setActiveTab("edit");
    setOpen(false);
    setEmailDialogOpen(true);
  };

  // Load preview data when switching to preview tab
  const handleTabChange = (tab: string) => {
    setActiveTab(tab as "edit" | "preview");
    if (tab === "preview" && variantPreviews.length === 0) {
      fetchPreviewData();
    }
  };

  // Re-fetch when selected variants change and preview is open
  useEffect(() => {
    if (activeTab === "preview" && emailDialogOpen) {
      fetchPreviewData();
    }
  }, [selectedVariantIds, activeTab, emailDialogOpen, fetchPreviewData]);

  const handleSendEmail = async () => {
    setSendingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-offer-email", {
        body: {
          dealId,
          allVariants: false,
          variantIds: variants
            .filter(v => selectedVariantIds.has(v.id))
            .map(v => v.id),
          customMessage: customMessage.trim() || undefined,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Nabídka odeslána na ${data.recipient}`);
        setEmailDialogOpen(false);
      } else {
        throw new Error(data?.error || "Nepodařilo se odeslat");
      }
    } catch (error: any) {
      console.error("Error sending offer email:", error);
      const msg = error?.message || "Nepodařilo se odeslat nabídku mailem";
      if (msg.includes("no email")) {
        toast.error("Hlavní klient nemá vyplněný e-mail");
      } else {
        toast.error(msg);
      }
    } finally {
      setSendingEmail(false);
    }
  };

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Odkaz zkopírován do schránky");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Nepodařilo se zkopírovat odkaz");
    }
  };

  const publicUrl = shareToken ? getPublicUrl(shareToken) : null;

  const selectedNames = variants
    .filter(v => selectedVariantIds.has(v.id))
    .map(v => v.variant_name);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={triggerClassName || "gap-2 md:size-default"}
            onClick={(e) => {
              if (!shareToken) {
                e.preventDefault();
                handleShare();
              }
            }}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {loading ? "Generuji..." : copied ? "Zkopírováno" : "Sdílet nabídku"}
            </span>
          </Button>
        </PopoverTrigger>
        {publicUrl && (
          <PopoverContent className="w-80" align="end">
            <div className="space-y-3">
              <p className="text-sm font-medium">Veřejný odkaz na nabídku</p>

              {hasMultipleVariants && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Varianty k odeslání:</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto px-1 py-0 text-xs"
                      onClick={allSelected ? () => {
                        const sel = variants.find(v => v.is_selected);
                        setSelectedVariantIds(new Set([sel?.id || variants[0].id]));
                      } : selectAll}
                    >
                      {allSelected ? "Jen vybraná" : "Vybrat vše"}
                    </Button>
                  </div>
                  {variants.map(v => (
                    <div key={v.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`variant-${v.id}`}
                        checked={selectedVariantIds.has(v.id)}
                        onCheckedChange={() => toggleVariant(v.id)}
                      />
                      <Label htmlFor={`variant-${v.id}`} className="text-sm cursor-pointer flex-1">
                        {v.variant_name}
                        {v.is_selected && (
                          <span className="ml-1 text-xs text-muted-foreground">(vybraná)</span>
                        )}
                      </Label>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Input
                  value={publicUrl}
                  readOnly
                  className="text-xs"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(publicUrl)}>
                  {copied ? <Check className="h-4 w-4" /> : <Link className="h-4 w-4" />}
                </Button>
                <Button size="sm" variant="outline" onClick={() => window.open(publicUrl, "_blank")}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              <Button
                size="sm"
                className="w-full gap-2"
                onClick={handleOpenEmailDialog}
                disabled={sendingEmail}
              >
                <Mail className="h-4 w-4" />
                Odeslat mailem
              </Button>
              <p className="text-xs text-muted-foreground">
                {allSelected && hasMultipleVariants
                  ? "Klient uvidí všechny varianty nabídky"
                  : hasMultipleVariants
                    ? `Klient uvidí: ${selectedNames.join(", ")}`
                    : "Klient uvidí vybranou variantu nabídky s fotkami hotelů"}
              </p>
            </div>
          </PopoverContent>
        )}
      </Popover>

      {/* Email compose dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Odeslat nabídku e-mailem
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0">
            <TabsList className="w-full">
              <TabsTrigger value="edit" className="flex-1">✏️ Zpráva</TabsTrigger>
              <TabsTrigger value="preview" className="flex-1">👁️ Náhled e-mailu</TabsTrigger>
            </TabsList>

            <TabsContent value="edit" className="flex-1 space-y-4 py-2 mt-0">
              <div className="space-y-1.5">
                <Label className="text-sm">Text zprávy</Label>
                <p className="text-xs text-muted-foreground">
                  Oslovení je předvyplněno, ale lze upravit.
                </p>
                <Textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={5}
                  placeholder="zasíláme Vám nabídku podle Vašich požadavků."
                />
              </div>
              <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
                <p>📧 E-mail bude obsahovat:</p>
                <p className="pl-3">· Váš text zprávy (oslovení + obsah)</p>
                <p className="pl-3">· Přehled nabídky s hotely a cenami</p>
                <p className="pl-3">· Odkaz na online nabídku (nahoře i dole)</p>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="flex-1 min-h-0 mt-0 overflow-hidden">
              <div className="h-full overflow-y-auto rounded-md border bg-[#f8fafc] p-3">
                {previewLoading ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Načítám náhled…
                  </div>
                ) : (
                  <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", maxWidth: 560, margin: "0 auto" }}>
                    {/* Header */}
                    <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 0 }}>
                      <span style={{ fontWeight: 700, fontSize: 18, color: "#1e293b", letterSpacing: 1 }}>YARO Travel</span>
                      <span style={{ fontSize: 11, color: "#64748b" }}>📞 +420 602 102 108</span>
                    </div>

                    <div style={{ padding: "24px 16px" }}>
                      {/* Title */}
                      <div style={{ textAlign: "center", marginBottom: 20 }}>
                        <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 700, color: "#1e293b" }}>
                          Nabídka{clientName ? ` pro ${clientName}` : ""}
                        </h1>
                      </div>

                      {/* Greeting */}
                      <div style={{ marginBottom: 16 }}>
                        {customMessage.split("\n").map((line, i) => (
                          <p key={i} style={{ fontSize: 14, color: "#334155", lineHeight: 1.6, margin: "0 0 4px" }}>
                            {line || <>&nbsp;</>}
                          </p>
                        ))}
                      </div>

                      {/* CTA top */}
                      <div style={{ textAlign: "center", marginBottom: 20 }}>
                        <span style={{ display: "inline-block", background: "#2563eb", color: "#fff", padding: "10px 28px", borderRadius: 8, fontSize: 14, fontWeight: 600 }}>
                          Zobrazit nabídku online
                        </span>
                      </div>


                      {/* Variant cards */}
                      {variantPreviews.map((v) => {
                        const hotelSvc = v.services.find(s => s.service_type === "hotel");
                        const golfSvcs = v.services.filter(s => s.service_type === "golf");
                        const otherSvcs = v.services.filter(s => s.service_type !== "hotel" && s.service_type !== "golf");
                        const totalGreenFees = golfSvcs.reduce((sum, s) => sum + (s.quantity || 1), 0);
                        const golfCourses = golfSvcs.map(s => s.description).filter(Boolean).join(", ");

                        // Nights
                        const nights = v.start_date && v.end_date
                          ? Math.round((new Date(v.end_date).getTime() - new Date(v.start_date).getTime()) / 86400000)
                          : null;

                        // Per-person prices
                        const hotelSvcs = v.services.filter(s => s.service_type === "hotel");
                        const sharedSvcs = v.services.filter(s => s.service_type !== "hotel");
                        const sharedPerPerson = sharedSvcs.reduce((sum, s) => {
                          const total = (s.price || 0) * (s.quantity || 1);
                          return sum + total / (s.person_count || 1);
                        }, 0);
                        const perPersonLines = hotelSvcs.map(h => {
                          const persons = h.person_count || 1;
                          const hotelPP = ((h.price || 0) * (h.quantity || 1)) / persons;
                          const label = persons === 1 ? "Jednolůžkový pokoj" : persons === 2 ? "Dvoulůžkový pokoj" : `Pokoj pro ${persons} osoby`;
                          return { label, persons, price: Math.round(hotelPP + sharedPerPerson) };
                        });

                        const serviceEmoji: Record<string, string> = {
                          flight: "✈️", hotel: "🏨", golf: "⛳", transfer: "🚗", insurance: "🛡️", other: "📋", meal: "🍽️",
                        };

                        return (
                          <div key={v.id} style={{ marginBottom: 20, borderRadius: 12, overflow: "hidden", background: "#fff", border: "1px solid #e2e8f0" }}>
                            {v.hotel_image && (
                              <img src={v.hotel_image} alt={v.hotel_name || "Hotel"} style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }} />
                            )}
                            <div style={{ padding: 16 }}>
                              {variantPreviews.length > 1 && (
                                <div style={{ marginBottom: 8 }}>
                                  <span style={{ background: "#f1f5f9", color: "#334155", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999 }}>{v.variant_name}</span>
                                </div>
                              )}
                              {v.hotel_name && <div style={{ fontSize: 17, fontWeight: 700, color: "#1e293b", marginBottom: 2 }}>{v.hotel_name}</div>}
                              {v.destination && <div style={{ fontSize: 13, color: "#64748b", marginBottom: 4 }}>{v.destination}</div>}
                              {(v.start_date || v.end_date) && (
                                <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>{formatDate(v.start_date)} – {formatDate(v.end_date)}</div>
                              )}

                              {/* Cena zahrnuje */}
                              {v.services.length > 0 && (
                                <div style={{ marginBottom: 12 }}>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Cena zahrnuje</div>
                                  {hotelSvc && (
                                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "4px 0", fontSize: 13, color: "#334155" }}>
                                      <span>🏨</span>
                                      <span>
                                        <strong>{nights ? `${nights} nocí — ubytování v hotelu ${hotelSvc.service_name}` : `Ubytování v hotelu ${hotelSvc.service_name}`}</strong>
                                        {hotelSvc.description && <span style={{ color: "#94a3b8" }}>, {hotelSvc.description}</span>}
                                      </span>
                                    </div>
                                  )}
                                  {totalGreenFees > 0 && (
                                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "4px 0", fontSize: 13, color: "#334155" }}>
                                      <span>⛳</span>
                                      <span>
                                        <strong>{totalGreenFees}× green fee</strong>
                                        {golfCourses && <span style={{ color: "#94a3b8" }}> ({golfCourses})</span>}
                                      </span>
                                    </div>
                                  )}
                                  {otherSvcs.map((s, i) => (
                                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "4px 0", fontSize: 13, color: "#334155" }}>
                                      <span>{serviceEmoji[s.service_type] || "📋"}</span>
                                      <span>
                                        <strong>{s.service_name}</strong>
                                        {s.description && <span style={{ color: "#94a3b8" }}> · {s.description}</span>}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Notes */}
                              {v.notes && (
                                <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10, marginTop: 4, marginBottom: 10 }}>
                                  {v.notes.split("\n").filter(Boolean).map((line, i) => (
                                    <div key={i} style={{ fontSize: 12, color: "#94a3b8", marginBottom: 3 }}>• {line.trim()}</div>
                                  ))}
                                </div>
                              )}

                              {/* Cena na osobu */}
                              {perPersonLines.length > 0 && (
                                <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 12, marginBottom: 8 }}>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Cena na osobu</div>
                                  {perPersonLines.map((l, i) => (
                                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                                      <span style={{ color: "#475569" }}>{l.label} <span style={{ color: "#94a3b8" }}>({l.persons} os.)</span></span>
                                      <strong style={{ color: "#1e293b" }}>{formatPrice(l.price, v.currency)}</strong>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {!v.hide_price && v.total_price && v.total_price > 0 && (
                                <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <span style={{ fontSize: 13, color: "#64748b" }}>Celková cena</span>
                                  <span style={{ fontSize: 20, fontWeight: 700, color: "#1e293b" }}>{formatPrice(v.total_price, v.currency)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* CTA bottom */}
                      <div style={{ textAlign: "center", marginTop: 12 }}>
                        <span style={{ display: "inline-block", background: "#2563eb", color: "#fff", padding: "10px 28px", borderRadius: 8, fontSize: 14, fontWeight: 600 }}>
                          Zobrazit nabídku online
                        </span>
                      </div>

                      {/* Footer */}
                      <div style={{ textAlign: "center", marginTop: 24, borderTop: "1px solid #e2e8f0", paddingTop: 16, color: "#94a3b8", fontSize: 11 }}>
                        <p style={{ margin: 0 }}>S pozdravem, <strong style={{ color: "#475569" }}>YARO Travel</strong></p>
                        <p style={{ margin: "6px 0 0" }}>📞 +420 602 102 108 · ✉️ radek@yarotravel.cz</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>Zrušit</Button>
            <Button onClick={handleSendEmail} disabled={sendingEmail} className="gap-2">
              {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {sendingEmail ? "Odesílám..." : "Odeslat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
