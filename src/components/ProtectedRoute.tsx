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
        // Check current AAL level
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        
        if (aalData?.currentLevel === 'aal2') {
          // MFA is verified
          setMfaVerified(true);
          setMfaChecking(false);
          return;
        }

        // Check if user has MFA enrolled
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

        // MFA is enrolled but not verified this session
        navigate("/mfa-verify");
      } catch (error) {
        console.error("Error checking MFA:", error);
        setMfaChecking(false);
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
