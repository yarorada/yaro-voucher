import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import yaroLogo from "@/assets/yaro-logo-wide.png";
import { Loader2, Shield } from "lucide-react";

const MfaVerify = () => {
  const [verifyCode, setVerifyCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [factorId, setFactorId] = useState<string>("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkMfaStatus();
  }, []);

  const checkMfaStatus = async () => {
    try {
      // Check current AAL level
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      
      if (aalData?.currentLevel === 'aal2') {
        // Already verified, go to main app
        navigate("/");
        return;
      }

      // Get user's MFA factors
      const { data: factors } = await supabase.auth.mfa.listFactors();
      
      if (!factors?.totp || factors.totp.length === 0) {
        // No MFA enrolled, redirect to setup
        navigate("/mfa-setup");
        return;
      }

      const verifiedFactor = factors.totp.find(f => f.status === 'verified');
      if (!verifiedFactor) {
        // No verified factor, redirect to setup
        navigate("/mfa-setup");
        return;
      }

      setFactorId(verifiedFactor.id);
    } catch (error) {
      console.error("Error checking MFA status:", error);
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
        title: "Ověření úspěšné",
        description: "Byli jste úspěšně přihlášeni",
      });

      navigate("/");
    } catch (error: any) {
      console.error("MFA verify error:", error);
      toast({
        title: "Ověření selhalo",
        description: "Neplatný kód. Zkontrolujte, zda máte správný čas na telefonu.",
        variant: "destructive",
      });
      setVerifyCode("");
    } finally {
      setVerifying(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut({ scope: "local" });
    navigate("/auth");
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
            <CardTitle className="text-2xl text-center">Dvoufaktorové ověření</CardTitle>
          </div>
          <CardDescription className="text-center">
            Zadejte kód z vaší autentizační aplikace
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                "Ověřit"
              )}
            </Button>
          </form>
          
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={handleSignOut}
              className="text-sm text-muted-foreground hover:text-primary hover:underline"
            >
              Přihlásit se jiným účtem
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MfaVerify;
