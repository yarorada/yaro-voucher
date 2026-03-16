import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import yaroLogo from "@/assets/yaro-logo-wide.png";
import { z } from "zod";

const passwordSchema = z.object({
  password: z.string().min(6, "Heslo musí mít alespoň 6 znaků").max(100, "Heslo musí mít méně než 100 znaků"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Hesla se neshodují",
  path: ["confirmPassword"],
});

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const init = async () => {
      // 1) PKCE flow: Supabase sends ?code= in query params (newer versions)
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          setIsValidToken(true);
          setChecking(false);
          // Clean up URL
          window.history.replaceState({}, '', window.location.pathname);
          return;
        }
      }

      // 2) Legacy implicit flow: tokens in URL hash
      const hash = window.location.hash;
      const hashParams = new URLSearchParams(hash.replace('#', ''));
      const type = hashParams.get('type');
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      if (type === 'recovery' && accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (!error) {
          setIsValidToken(true);
          setChecking(false);
          window.history.replaceState({}, '', window.location.pathname);
          return;
        }
      }

      // 3) Listen for PASSWORD_RECOVERY event (email client may follow the link and trigger it)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setIsValidToken(true);
          setChecking(false);
        } else if (event === 'SIGNED_IN' && session) {
          setIsValidToken(true);
          setChecking(false);
        } else if (event === 'SIGNED_OUT') {
          navigate("/auth");
        }
      });
      unsubscribe = () => subscription.unsubscribe();

      // 4) Check if there's already a valid session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsValidToken(true);
      }
      setChecking(false);
    };

    init();

    return () => {
      unsubscribe?.();
    };
  }, [navigate]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    const validation = passwordSchema.safeParse({ password, confirmPassword });
    if (!validation.success) {
      toast({
        title: "Chyba validace",
        description: validation.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Get current session token (may be AAL1 from recovery link)
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        toast({
          title: "Chyba session",
          description: "Platnost odkazu vypršela. Požádejte o nový reset odkaz.",
          variant: "destructive",
        });
        return;
      }

      // Use edge function to bypass AAL2 requirement when MFA is enabled
      const { data: funcData, error: funcError } = await supabase.functions.invoke("reset-password", {
        body: { password },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (funcError || funcData?.error) {
        toast({
          title: "Reset hesla selhal",
          description: funcData?.error || funcError?.message || "Nastala chyba.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Heslo změněno",
          description: "Vaše heslo bylo úspěšně změněno. Nyní se můžete přihlásit.",
        });
        // Use scope: 'local' to always clear local session even if server-side session expired
        await supabase.auth.signOut({ scope: 'local' });
        setTimeout(() => navigate("/auth"), 1500);
      }
    } catch (error) {
      toast({
        title: "Chyba",
        description: "Nastala neočekávaná chyba. Zkuste to prosím znovu.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[var(--gradient-subtle)] flex items-center justify-center p-4">
        <div className="text-muted-foreground">Načítám...</div>
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div className="min-h-screen bg-[var(--gradient-subtle)] flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-4">
            <div className="flex justify-center">
              <img src={yaroLogo} alt="YARO Travel" className="h-16" />
            </div>
            <CardTitle className="text-2xl text-center">Neplatný odkaz</CardTitle>
            <CardDescription className="text-center">
              Odkaz pro reset hesla je neplatný nebo vypršel. Požádejte o nový.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate("/auth")}>
              Zpět na přihlášení
            </Button>
          </CardContent>
        </Card>
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
          <CardTitle className="text-2xl text-center">
            Nastavit nové heslo
          </CardTitle>
          <CardDescription className="text-center">
            Zadejte své nové heslo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nové heslo</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Potvrdit heslo</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Nastavuji heslo..." : "Nastavit nové heslo"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
