import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type AppRole = "admin" | "prodejce" | null;

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setLoading(false);
      return;
    }

    const fetchRole = async () => {
      const { data } = await supabase
        .from("user_roles" as any)
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      setRole((data as any)?.role ?? null);
      setLoading(false);
    };

    fetchRole();
  }, [user?.id]);

  const isProdejce = role === "prodejce";
  const isAdmin = role === "admin";

  return { role, loading, isProdejce, isAdmin };
}
