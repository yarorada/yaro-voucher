import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

type DataScope = "all" | "own";

// Default scope per role
const ROLE_DEFAULT_SCOPE: Record<string, DataScope> = {
  admin: "all",
  prodejce: "own",
  none: "all",
};

interface DataScopeResult {
  scope: DataScope;
  loading: boolean;
}

export function useDataScope(): DataScopeResult {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const [scope, setScope] = useState<DataScope>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || roleLoading) return;

    const fetchScope = async () => {
      const { data } = await (supabase as any)
        .from("user_data_scope")
        .select("scope")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data?.scope) {
        setScope(data.scope as DataScope);
      } else {
        // Fall back to role default
        const roleKey = role ?? "none";
        setScope(ROLE_DEFAULT_SCOPE[roleKey] ?? "all");
      }
      setLoading(false);
    };

    fetchScope();
  }, [user?.id, role, roleLoading]);

  return { scope, loading: loading || roleLoading };
}
