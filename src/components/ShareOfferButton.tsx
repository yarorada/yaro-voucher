import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Check, Link, Loader2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

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

export function ShareOfferButton({ dealId, shareToken, onTokenGenerated, variants }: ShareOfferButtonProps) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(new Set());

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

  const toggleVariant = (id: string) => {
    setSelectedVariantIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id); // keep at least 1
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
    if (!hasMultipleVariants) {
      return base;
    }
    // Always use explicit variant IDs to ensure correct filtering
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
    if (token) {
      await copyToClipboard(getPublicUrl(token));
    }
  };

  const handleSendEmail = async () => {
    const token = await ensureShareToken();
    if (!token) return;

    setSendingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-offer-email', {
        body: {
          dealId,
          allVariants: false,
          variantIds: hasMultipleVariants ? Array.from(selectedVariantIds) : undefined,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Nabídka odeslána na ${data.recipient}`);
      } else {
        throw new Error(data?.error || 'Nepodařilo se odeslat');
      }
    } catch (error: any) {
      console.error("Error sending offer email:", error);
      const msg = error?.message || "Nepodařilo se odeslat nabídku mailem";
      if (msg.includes('no email')) {
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 md:size-default"
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
            </div>
            <Button
              size="sm"
              className="w-full gap-2"
              onClick={handleSendEmail}
              disabled={sendingEmail}
            >
              {sendingEmail ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              {sendingEmail ? "Odesílám..." : "Odeslat mailem"}
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
  );
}
