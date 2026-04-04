import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { ShieldCheck, User, ChevronDown, ChevronUp, Database, Pencil, Check, X } from "lucide-react";
import { ALL_SECTIONS, useUserPermissionsForUser, SectionKey } from "@/hooks/useUserPermissions";

interface Profile {
  id: string;
  email: string;
  name: string | null;
}

interface UserRoleRow {
  user_id: string;
  role: string;
}

function UserPermissionRow({ profile, currentRole, onRoleChange, onNameChange, assigning }: {
  profile: Profile;
  currentRole: string | null;
  onRoleChange: (userId: string, role: string) => void;
  onNameChange: (userId: string, name: string) => void;
  assigning: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(profile.name ?? "");
  const [savingName, setSavingName] = useState(false);
  const { loading, getEffective, setOverride, defaults, overrides, getDataScope, setDataScope, dataScopeLoading } = useUserPermissionsForUser(profile.id);

  const handleSaveName = async () => {
    setSavingName(true);
    try {
      const { error } = await supabase.from("profiles").update({ name: nameValue || null }).eq("id", profile.id);
      if (error) throw error;
      onNameChange(profile.id, nameValue);
      toast.success("Jméno uloženo");
      setEditingName(false);
    } catch (e: any) {
      toast.error("Chyba při ukládání jména: " + e.message);
    } finally {
      setSavingName(false);
    }
  };

  const handleCancelName = () => {
    setNameValue(profile.name ?? "");
    setEditingName(false);
  };

  return (
    <div className="rounded-lg border border-border bg-muted/20">
      <div className="p-3 space-y-2">
        {/* Row 1: User info */}
        <div className="flex items-start gap-2 min-w-0">
          <User className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{profile.email}</p>
            {editingName ? (
              <div className="flex items-center gap-1 mt-0.5">
                <Input
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  className="h-6 text-xs px-1.5 w-full max-w-[160px]"
                  placeholder="Celé jméno"
                  onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") handleCancelName(); }}
                  autoFocus
                />
                <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={handleSaveName} disabled={savingName}>
                  <Check className="h-3 w-3 text-green-600" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={handleCancelName}>
                  <X className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <p className="text-xs text-muted-foreground">{profile.name || <span className="italic">bez jména</span>}</p>
                <Button size="icon" variant="ghost" className="h-4 w-4 p-0 opacity-50 hover:opacity-100" onClick={() => setEditingName(true)} title="Změnit jméno">
                  <Pencil className="h-2.5 w-2.5" />
                </Button>
              </div>
            )}
          </div>
          {currentRole && (
            <Badge variant={currentRole === "admin" ? "default" : "secondary"} className="shrink-0">
              {currentRole === "admin" ? "Admin" : "Prodejce"}
            </Badge>
          )}
        </div>
        {/* Row 2: Role select + expand */}
        <div className="flex items-center gap-2">
          <Select
            value={currentRole ?? "none"}
            onValueChange={(val) => onRoleChange(profile.id, val)}
            disabled={assigning === profile.id}
          >
            <SelectTrigger className="flex-1 h-8 text-xs">
              <SelectValue placeholder="Bez role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Bez role (admin)</SelectItem>
              <SelectItem value="prodejce">Prodejce</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 shrink-0"
            onClick={() => setExpanded((e) => !e)}
            title="Upravit oprávnění"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-3 py-3">
          <p className="text-xs text-muted-foreground mb-3">
            Přepisy oprávnění pro tohoto uživatele (přepisují výchozí nastavení role).
          </p>
          {loading ? (
            <div className="flex justify-center py-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ALL_SECTIONS.map((section) => {
                const effective = getEffective(section.key as SectionKey);
                const isDefault = !(section.key in overrides);
                const defaultVal = defaults.includes(section.key as SectionKey);
                return (
                  <div key={section.key} className="flex items-center justify-between rounded-md border border-border/50 bg-background px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm truncate">{section.label}</p>
                      {!isDefault && (
                        <p className="text-xs text-amber-500">
                          {effective ? "Přidáno" : "Odebráno"} (výchozí: {defaultVal ? "✓" : "✗"})
                        </p>
                      )}
                      {isDefault && (
                        <p className="text-xs text-muted-foreground">Výchozí role</p>
                      )}
                    </div>
                    <Switch
                      checked={effective}
                      onCheckedChange={(val) => setOverride(section.key as SectionKey, val)}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Data scope section */}
          <div className="mt-4 rounded-md border border-border bg-background p-3">
            <div className="flex items-center gap-2 mb-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Rozsah přístupu k datům</p>
            </div>
            {dataScopeLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                {[
                  { value: "all", label: "Všechna data", desc: "Vidí záznamy všech kolegů" },
                  { value: "own", label: "Pouze vlastní", desc: "Vidí jen vlastní záznamy" },
                ].map((opt) => {
                  const current = getDataScope();
                  return (
                    <label key={opt.value} className={`flex-1 cursor-pointer rounded-md border px-3 py-2 transition-colors ${current === opt.value ? "border-primary bg-primary/5" : "border-border"}`}>
                      <input
                        type="radio"
                        className="sr-only"
                        name={`scope-${profile.id}`}
                        value={opt.value}
                        checked={current === opt.value}
                        onChange={() => setDataScope(opt.value)}
                      />
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminRoles() {
  const { isAdmin, loading, role } = useUserRole();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userRoles, setUserRoles] = useState<UserRoleRow[]>([]);
  const [assigning, setAssigning] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && role !== null && !isAdmin) {
      navigate("/");
    }
  }, [isAdmin, loading, role, navigate]);

  useEffect(() => {
    if (isAdmin) fetchData();
  }, [isAdmin]);

  const fetchData = async () => {
    const [{ data: profilesData }, { data: rolesData }] = await Promise.all([
      supabase.from("profiles").select("id, email, name").order("email"),
      (supabase as any).from("user_roles").select("user_id, role"),
    ]);
    setProfiles(profilesData || []);
    setUserRoles((rolesData as any) || []);
  };

  const getRoleForUser = (userId: string) =>
    userRoles.find((r) => r.user_id === userId)?.role ?? null;

  const handleNameChange = (userId: string, name: string) => {
    setProfiles((prev) => prev.map((p) => p.id === userId ? { ...p, name: name || null } : p));
  };

  const handleSetRole = async (userId: string, role: string) => {
    setAssigning(userId);
    try {
      await (supabase as any).from("user_roles").delete().eq("user_id", userId);
      if (role && role !== "none") {
        const { error } = await (supabase as any).from("user_roles").insert({ user_id: userId, role });
        if (error) throw error;
      }
      toast.success("Role uložena");
      await fetchData();
    } catch (e: any) {
      toast.error("Chyba při ukládání role: " + e.message);
    } finally {
      setAssigning(null);
    }
  };

  if (loading) return (
    <div className="p-6 flex items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
  if (!isAdmin) return null;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto overflow-hidden">
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck className="h-5 w-5 md:h-6 md:w-6 text-primary shrink-0" />
        <h1 className="text-xl md:text-2xl font-bold">Správa rolí a oprávnění</h1>
      </div>

      <Card className="mb-4">
        <CardHeader className="pb-2 px-3 md:px-6">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Výchozí přístupy dle role
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 md:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <p className="font-semibold mb-1">Admin</p>
              <p className="text-muted-foreground text-xs">Vše</p>
            </div>
            <div>
              <p className="font-semibold mb-1">Prodejce</p>
              <p className="text-muted-foreground text-xs">Deals, Smlouvy, Vouchery, Klienti, Hotely</p>
            </div>
            <div>
              <p className="font-semibold mb-1">Bez role</p>
              <p className="text-muted-foreground text-xs">Vše (legacy)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium text-muted-foreground">
            Uživatelé — klikněte na šipku pro přepis oprávnění konkrétního uživatele
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {profiles.map((profile) => (
              <UserPermissionRow
                key={profile.id}
                profile={profile}
                currentRole={getRoleForUser(profile.id)}
                onRoleChange={handleSetRole}
                onNameChange={handleNameChange}
                assigning={assigning}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
