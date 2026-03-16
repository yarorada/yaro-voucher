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
    // Check URL hash for recovery token first (Supabase puts tokens in hash)
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace('#', ''));
    const type = params.get('type');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    // If we have recovery tokens in the URL, set the session manually
    if (type === 'recovery' && accessToken && refreshToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(() => {
        setIsValidToken(true);
        setChecking(false);
      });
      return;
    }

    // Listen for password recovery event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsValidToken(true);
        setChecking(false);
      } else if (event === 'SIGNED_IN' && session) {
        // Could be a recovery sign-in
        setIsValidToken(true);
        setChecking(false);
      } else if (event === 'SIGNED_OUT') {
        navigate("/auth");
      }
    });

    // Also check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsValidToken(true);
      }
      setChecking(false);
    });

    return () => {
      subscription.unsubscribe();
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
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        toast({
          title: "Reset hesla selhal",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Heslo změněno",
          description: "Vaše heslo bylo úspěšně změněno. Nyní se můžete přihlásit.",
        });
        // Sign out and redirect to login
        await supabase.auth.signOut();
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

  if (!isValidToken) {
    return null;
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
