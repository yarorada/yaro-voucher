import { useState } from "react";
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

interface ShareOfferButtonProps {
  dealId: string;
  shareToken: string | null;
  onTokenGenerated: (token: string) => void;
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

export function ShareOfferButton({ dealId, shareToken, onTokenGenerated }: ShareOfferButtonProps) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const getPublicUrl = (token: string) => {
    // Use edge function URL so crawlers (email clients, social media) get OG meta tags
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    return `https://${projectId}.supabase.co/functions/v1/get-public-offer?token=${encodeURIComponent(token)}`;
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
    // Ensure share token exists first
    const token = await ensureShareToken();
    if (!token) return;

    setSendingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-offer-email', {
        body: { dealId },
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
              Klient uvidí varianty nabídky s fotkami hotelů
            </p>
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
}
