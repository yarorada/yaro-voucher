import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, User, Trash2 } from "lucide-react";

interface Profile {
  id: string;
  email: string;
  name: string | null;
}

interface UserRoleRow {
  user_id: string;
  role: string;
}

export default function AdminRoles() {
  const { isAdmin, loading, role } = useUserRole();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userRoles, setUserRoles] = useState<UserRoleRow[]>([]);
  const [assigning, setAssigning] = useState<string | null>(null);

  useEffect(() => {
    // Only redirect if loading is done AND role is definitively not admin
    if (!loading && role !== null && !isAdmin) {
      navigate("/");
    }
  }, [isAdmin, loading, role, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  const fetchData = async () => {
    const [{ data: profilesData }, { data: rolesData }] = await Promise.all([
      supabase.from("profiles").select("id, email, name").order("email"),
      supabase.from("user_roles" as any).select("user_id, role"),
    ]);
    setProfiles(profilesData || []);
    setUserRoles((rolesData as any) || []);
  };

  const getRoleForUser = (userId: string) => {
    return userRoles.find(r => r.user_id === userId)?.role ?? null;
  };

  const handleSetRole = async (userId: string, role: string) => {
    setAssigning(userId);
    try {
      // Remove existing role
      await supabase.from("user_roles" as any).delete().eq("user_id", userId);
      
      if (role && role !== "none") {
        const { error } = await supabase.from("user_roles" as any).insert({ user_id: userId, role });
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
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Správa rolí uživatelů</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium text-muted-foreground">
            Přidělte role uživatelům. Prodejce vidí pouze svá vlastní data.
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {profiles.map(profile => {
              const currentRole = getRoleForUser(profile.id);
              return (
                <div key={profile.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                  <div className="flex items-center gap-3 min-w-0">
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{profile.email}</p>
                      {profile.name && <p className="text-xs text-muted-foreground">{profile.name}</p>}
                    </div>
                    {currentRole && (
                      <Badge variant={currentRole === "admin" ? "default" : "secondary"}>
                        {currentRole === "admin" ? "Admin" : "Prodejce"}
                      </Badge>
                    )}
                  </div>
                  <Select
                    value={currentRole ?? "none"}
                    onValueChange={(val) => handleSetRole(profile.id, val)}
                    disabled={assigning === profile.id}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Bez role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Bez role (admin)</SelectItem>
                      <SelectItem value="prodejce">Prodejce</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
