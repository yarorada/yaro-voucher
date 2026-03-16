import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import yaroLogo from "@/assets/yaro-logo-wide.png";
import { Loader2, Shield, Smartphone } from "lucide-react";

const MfaSetup = () => {
  const [qrCode, setQrCode] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [factorId, setFactorId] = useState<string>("");
  const [verifyCode, setVerifyCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    enrollMfa();
  }, []);

  const enrollMfa = async () => {
    try {
      setLoading(true);

      // Skip MFA for Apple OAuth users
      const { data: { user } } = await supabase.auth.getUser();
      const isApple = user?.app_metadata?.provider === 'apple' || 
        (Array.isArray(user?.app_metadata?.providers) && user.app_metadata.providers.includes('apple'));
      if (isApple) {
        navigate("/");
        return;
      }
      
      // Check if user already has MFA enrolled
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) {
        // Invalid session (e.g. recovery token) — sign out and redirect to login
        await supabase.auth.signOut({ scope: 'local' });
        navigate("/auth");
        return;
      }
      
      if (factors?.totp && factors.totp.length > 0) {
        const verifiedFactor = factors.totp.find(f => f.status === 'verified');
        if (verifiedFactor) {
          // Already has verified MFA, redirect to verify page
          navigate("/mfa-verify");
          return;
        }
        
        // Has unverified factors, unenroll them first
        for (const factor of factors.totp) {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }
      }

      // Enroll new TOTP factor
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'YARO Travel 2FA'
      });

      if (error) {
        // If factor already exists, user already has 2FA - redirect to verify
        if (error.code === 'mfa_factor_name_conflict') {
          navigate("/mfa-verify");
          return;
        }
        throw error;
      }

      if (data) {
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
        setFactorId(data.id);
      }
    } catch (error: any) {
      console.error("MFA enrollment error:", error);
      toast({
        title: "Chyba při nastavení 2FA",
        description: error.message || "Nepodařilo se nastavit dvoufaktorovou autentizaci",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (verifyCode.length !== 6) {
      toast({
        title: "Neplatný kód",
        description: "Zadejte 6místný kód z autentizační aplikace",
        variant: "destructive",
      });
      return;
    }

    setVerifying(true);

    try {
      // Create challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: factorId,
      });

      if (challengeError) {
        throw challengeError;
      }

      // Verify the code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factorId,
        challengeId: challengeData.id,
        code: verifyCode,
      });

      if (verifyError) {
        throw verifyError;
      }

      toast({
        title: "2FA aktivována",
        description: "Dvoufaktorová autentizace byla úspěšně nastavena",
      });

      navigate("/");
    } catch (error: any) {
      console.error("MFA verify error:", error);
      toast({
        title: "Ověření selhalo",
        description: error.message || "Neplatný kód. Zkuste to znovu.",
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--gradient-subtle)] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <img src={yaroLogo} alt="YARO Travel" className="h-16" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl text-center">Nastavení 2FA</CardTitle>
          </div>
          <CardDescription className="text-center">
            Pro zabezpečení vašeho účtu je vyžadována dvoufaktorová autentizace
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Smartphone className="h-4 w-4" />
              <span>1. Stáhněte si autentizační aplikaci (Google Authenticator, Authy)</span>
            </div>
            
            <div className="text-sm text-muted-foreground">
              2. Naskenujte QR kód nebo zadejte klíč ručně:
            </div>

            {qrCode && (
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <img src={qrCode} alt="QR kód pro 2FA" className="w-48 h-48" />
              </div>
            )}

            {secret && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Ruční klíč:</Label>
                <div className="p-2 bg-muted rounded text-center font-mono text-sm break-all select-all">
                  {secret}
                </div>
              </div>
            )}

            <div className="text-sm text-muted-foreground">
              3. Zadejte 6místný kód z aplikace:
            </div>
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Ověřovací kód</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl tracking-widest"
                autoFocus
                disabled={verifying}
              />
            </div>
            <Button type="submit" className="w-full" disabled={verifying || verifyCode.length !== 6}>
              {verifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ověřuji...
                </>
              ) : (
                "Aktivovat 2FA"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default MfaSetup;
