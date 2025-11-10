import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import yaroLogo from "@/assets/yaro-logo-wide.png";
import { z } from "zod";

const authSchema = z.object({
  email: z.string().email("Neplatná emailová adresa").max(255, "Email musí mít méně než 255 znaků"),
  password: z.string().min(6, "Heslo musí mít alespoň 6 znaků").max(100, "Heslo musí mít méně než 100 znaků"),
});

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if auto sign out is enabled and sign out if needed
    const autoSignOut = sessionStorage.getItem("autoSignOut");
    if (autoSignOut === "true") {
      supabase.auth.signOut();
      sessionStorage.removeItem("autoSignOut");
    }

    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/");
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Don't redirect if this is a password recovery flow
      if (session && event !== 'PASSWORD_RECOVERY') {
        navigate("/");
      }
    });

    // Add event listener for window unload if auto sign out is enabled
    const handleBeforeUnload = () => {
      const autoSignOut = sessionStorage.getItem("autoSignOut");
      if (autoSignOut === "true") {
        supabase.auth.signOut();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    const validation = authSchema.safeParse({ email, password });
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
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast({
              title: "Přihlášení selhalo",
              description: "Neplatný email nebo heslo. Zkuste to prosím znovu.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Přihlášení selhalo",
              description: error.message,
              variant: "destructive",
            });
          }
        } else if (!rememberMe) {
          // If "remember me" is not checked, add event listener to sign out on window close
          sessionStorage.setItem("autoSignOut", "true");
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        
        if (error) {
          if (error.message.includes("already registered")) {
            toast({
              title: "Registrace selhala",
              description: "Tento email je již registrován. Místo toho se přihlaste.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Registrace selhala",
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Účet vytvořen",
            description: "Váš účet byl úspěšně vytvořen. Nyní se můžete přihlásit.",
          });
          setIsLogin(true);
        }
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.trim()) {
      toast({
        title: "Chyba",
        description: "Zadejte prosím emailovou adresu",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        toast({
          title: "Chyba",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Email odeslán",
          description: "Zkontrolujte svou emailovou schránku pro odkaz na reset hesla.",
        });
        setIsForgotPassword(false);
        setIsLogin(true);
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

  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <img src={yaroLogo} alt="YARO Travel" className="h-16" />
          </div>
          <CardTitle className="text-2xl text-center">
            {isForgotPassword ? "Resetovat heslo" : isLogin ? "Vítejte zpět" : "Vytvořit účet"}
          </CardTitle>
          <CardDescription className="text-center">
            {isForgotPassword
              ? "Zadejte svůj email a my vám pošleme odkaz pro reset hesla"
              : isLogin
              ? "Přihlaste se pro přístup k systému správy voucherů"
              : "Vytvořte si účet a začněte spravovat vouchery"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="vas@email.cz"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Odesílám..." : "Odeslat reset odkaz"}
              </Button>
              <div className="text-center text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setIsLogin(true);
                  }}
                  className="text-primary hover:underline"
                  disabled={loading}
                >
                  Zpět na přihlášení
                </button>
              </div>
            </form>
          ) : (
            <>
              <form onSubmit={handleAuth} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="vas@email.cz"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Heslo</Label>
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
                {isLogin && (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="remember"
                          checked={rememberMe}
                          onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                          disabled={loading}
                        />
                        <Label
                          htmlFor="remember"
                          className="text-sm font-normal cursor-pointer"
                        >
                          Pamatovat si přihlášení
                        </Label>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsForgotPassword(true)}
                        className="text-sm text-primary hover:underline"
                        disabled={loading}
                      >
                        Zapomenuté heslo?
                      </button>
                    </div>
                  </>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Zpracovávám..." : isLogin ? "Přihlásit se" : "Registrovat"}
                </Button>
              </form>
              <div className="mt-4 text-center text-sm">
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-primary hover:underline"
                  disabled={loading}
                >
                  {isLogin
                    ? "Nemáte účet? Zaregistrujte se"
                    : "Již máte účet? Přihlaste se"}
                </button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
