import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

export const ALL_SECTIONS = [
  { key: "deals", label: "Obchodní případy" },
  { key: "contracts", label: "Smlouvy" },
  { key: "vouchers", label: "Vouchery" },
  { key: "statistics", label: "Statistiky" },
  { key: "clients", label: "Klienti" },
  { key: "suppliers", label: "Dodavatelé" },
  { key: "hotels", label: "Hotely" },
  { key: "destinations", label: "Destinace" },
  { key: "accounting", label: "Účetnictví" },
  { key: "invoicing", label: "Fakturace" },
  { key: "email-templates", label: "E-maily" },
] as const;

export type SectionKey = (typeof ALL_SECTIONS)[number]["key"];

// Default sections visible per role
const ROLE_DEFAULTS: Record<string, SectionKey[]> = {
  admin: ALL_SECTIONS.map((s) => s.key) as SectionKey[],
  prodejce: ["deals", "contracts", "vouchers", "clients", "hotels"],
  // no role = full access (legacy behaviour)
  none: ALL_SECTIONS.map((s) => s.key) as SectionKey[],
};

export interface UserPermissions {
  loading: boolean;
  canAccess: (section: SectionKey) => boolean;
  allowedSections: SectionKey[];
}

export function useUserPermissions(): UserPermissions {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const [overrides, setOverrides] = useState<Record<string, boolean> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || roleLoading) return;

    const fetchOverrides = async () => {
      const { data } = await (supabase as any)
        .from("user_permissions")
        .select("section, allowed")
        .eq("user_id", user.id);

      if (data) {
        const map: Record<string, boolean> = {};
        (data as { section: string; allowed: boolean }[]).forEach((row) => {
          map[row.section] = row.allowed;
        });
        setOverrides(map);
      } else {
        setOverrides({});
      }
      setLoading(false);
    };

    fetchOverrides();
  }, [user?.id, roleLoading, role]);

  const roleKey = role ?? "none";
  const defaults = ROLE_DEFAULTS[roleKey] ?? ROLE_DEFAULTS.none;

  const allowedSections: SectionKey[] = ALL_SECTIONS.map((s) => s.key).filter((key) => {
    if (overrides && key in overrides) return overrides[key];
    return defaults.includes(key);
  }) as SectionKey[];

  const canAccess = (section: SectionKey) => allowedSections.includes(section);

  return { loading: loading || roleLoading, canAccess, allowedSections };
}

// Hook for admin: fetch permissions for a specific user
export function useUserPermissionsForUser(userId: string) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const [{ data: roleData }, { data: permData }] = await Promise.all([
      (supabase as any).from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
      (supabase as any).from("user_permissions").select("section, allowed").eq("user_id", userId),
    ]);

    setUserRole((roleData as any)?.role ?? null);

    const map: Record<string, boolean> = {};
    if (permData) {
      (permData as { section: string; allowed: boolean }[]).forEach((row) => {
        map[row.section] = row.allowed;
      });
    }
    setOverrides(map);
    setLoading(false);
  };

  useEffect(() => {
    if (userId) fetchData();
  }, [userId]);

  const effectiveRole = userRole ?? "none";
  const defaults = ROLE_DEFAULTS[effectiveRole] ?? ROLE_DEFAULTS.none;

  const getEffective = (key: SectionKey): boolean => {
    if (key in overrides) return overrides[key];
    return defaults.includes(key);
  };

  const setOverride = async (key: SectionKey, value: boolean) => {
    const defaultVal = defaults.includes(key);
    if (value === defaultVal) {
      // Remove override if matches default
      await (supabase as any)
        .from("user_permissions")
        .delete()
        .eq("user_id", userId)
        .eq("section", key);
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } else {
      await (supabase as any).from("user_permissions").upsert(
        { user_id: userId, section: key, allowed: value },
        { onConflict: "user_id,section" }
      );
      setOverrides((prev) => ({ ...prev, [key]: value }));
    }
  };

  // Data scope
  const [dataScope, setDataScopeState] = useState<string | null>(null);
  const [dataScopeLoading, setDataScopeLoading] = useState(true);

  const fetchDataScope = async () => {
    const { data } = await (supabase as any)
      .from("user_data_scope")
      .select("scope")
      .eq("user_id", userId)
      .maybeSingle();
    setDataScopeState(data?.scope ?? null);
    setDataScopeLoading(false);
  };

  useEffect(() => {
    if (userId) fetchDataScope();
  }, [userId]);

  const getDataScope = (): string => {
    if (dataScope !== null) return dataScope;
    // role default
    const roleDefaults: Record<string, string> = { admin: "all", prodejce: "own", none: "all" };
    return roleDefaults[userRole ?? "none"] ?? "all";
  };

  const setDataScope = async (scope: string) => {
    await (supabase as any).from("user_data_scope").upsert(
      { user_id: userId, scope },
      { onConflict: "user_id" }
    );
    setDataScopeState(scope);
  };

  return { loading, overrides, userRole, getEffective, setOverride, defaults, refetch: fetchData, getDataScope, setDataScope, dataScopeLoading };
}
