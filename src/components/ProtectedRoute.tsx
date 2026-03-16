import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const [mfaChecking, setMfaChecking] = useState(true);
  const [mfaVerified, setMfaVerified] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const checkMfa = async () => {
      if (!user) {
        setMfaChecking(false);
        return;
      }

      try {
        // Skip MFA for Apple OAuth users (Apple provides strong auth via Face ID/Touch ID)
        const isApple = user.app_metadata?.provider === 'apple' || 
          (Array.isArray(user.app_metadata?.providers) && user.app_metadata.providers.includes('apple'));
        if (isApple) {
          setMfaVerified(true);
          setMfaChecking(false);
          return;
        }

        // Check current AAL level
        const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

        if (aalError) {
          // Invalid/expired session (e.g. recovery token after password reset) — sign out and redirect
          console.error("AAL check error, signing out:", aalError);
          await supabase.auth.signOut({ scope: 'local' });
          navigate("/auth");
          return;
        }
        
        if (aalData?.currentLevel === 'aal2') {
          // MFA is verified
          setMfaVerified(true);
          setMfaChecking(false);
          return;
        }

        // Check if user has MFA enrolled
        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();

        if (factorsError) {
          // Invalid token (e.g. "missing sub claim") — sign out and redirect
          console.error("Factors check error, signing out:", factorsError);
          await supabase.auth.signOut({ scope: 'local' });
          navigate("/auth");
          return;
        }
        
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

        // MFA is enrolled but not verified this session
        navigate("/mfa-verify");
      } catch (error) {
        console.error("Error checking MFA:", error);
        await supabase.auth.signOut({ scope: 'local' });
        navigate("/auth");
      }
    };

    if (user && !loading) {
      checkMfa();
    }
  }, [user, loading, navigate]);

  if (loading || mfaChecking) {
    return (
      <div className="min-h-screen bg-[var(--gradient-subtle)] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !mfaVerified) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
