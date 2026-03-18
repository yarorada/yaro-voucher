import { useLocation, useNavigate } from "react-router-dom";
import { 
  Home, 
  FileText, 
  Building2, 
  Users, 
  Briefcase, 
  MapPin, 
  FileSignature,
  BarChart3,
  LogOut,
  Mail,
  Hotel,
  Calculator,
  ShieldCheck,
  UserCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useIsMobile } from "@/hooks/use-mobile";
import yaroLogo from "@/assets/yaro-logo-wide.png";
import { useSidebar } from "@/components/ui/sidebar";

const allMenuItems = [
  { title: "Přehled", url: "/", icon: Home, prodejce: true },
  { title: "Obchodní případy", url: "/deals", icon: Briefcase, prodejce: true },
  { title: "Smlouvy", url: "/contracts", icon: FileSignature, prodejce: true },
  { title: "Vouchery", url: "/vouchers", icon: FileText, prodejce: true },
  { title: "Statistiky", url: "/statistics", icon: BarChart3, prodejce: false },
  { title: "Klienti", url: "/clients", icon: Users, prodejce: true },
  { title: "Dodavatelé", url: "/suppliers", icon: Building2, prodejce: false },
  { title: "Hotely", url: "/hotels", icon: Hotel, prodejce: true },
  { title: "Destinace", url: "/destinations", icon: MapPin, prodejce: false },
  { title: "Účetnictví", url: "/accounting", icon: Calculator, prodejce: false },
  { title: "E-maily", url: "/email-templates", icon: Mail, prodejce: false },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { open, setOpen, setOpenMobile } = useSidebar();
  const { signOut, user } = useAuth();
  const { isAdmin } = useUserRole();
  const { canAccess } = useUserPermissions();
  const isMobile = useIsMobile();
  const [profileName, setProfileName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfileName(data?.name ?? null));
  }, [user?.id]);

  const displayName = profileName || user?.email?.split("@")[0] || "Uživatel";
  const displayEmail = user?.email ?? "";

  const menuItems = allMenuItems.filter(item => {
    if (item.url === "/") return true;
    const key = item.url.replace("/", "");
    return canAccess(key as any);
  });

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const handleNavigate = (url: string) => {
    navigate(url);
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarContent>
        <SidebarGroup>
          <div className="flex items-center justify-between py-4 px-4 border-b border-border/50">
            <img 
              src={yaroLogo} 
              alt="YARO Travel" 
              className="h-10 w-auto logo-dark-mode group-data-[state=collapsed]:hidden"
            />
          </div>
          
          <SidebarGroupLabel className="mt-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Navigace
          </SidebarGroupLabel>
          <SidebarGroupContent className="mt-2">
            <SidebarMenu className="space-y-1">
              {menuItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      onClick={() => handleNavigate(item.url)}
                      isActive={active}
                      tooltip={item.title}
                      className={`
                        group relative transition-colors duration-150
                        ${active 
                          ? 'bg-primary/10 text-primary font-medium' 
                          : 'hover:bg-muted text-foreground/70 hover:text-foreground'
                        }
                      `}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      {active && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-primary rounded-r-full" />
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => handleNavigate("/admin/roles")}
                    isActive={isActive("/admin/roles")}
                    tooltip="Správa rolí"
                    className={`
                      group relative transition-colors duration-150
                      ${isActive("/admin/roles")
                        ? 'bg-primary/10 text-primary font-medium' 
                        : 'hover:bg-muted text-foreground/70 hover:text-foreground'
                      }
                    `}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span>Správa rolí</span>
                    {isActive("/admin/roles") && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-primary rounded-r-full" />
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="border-t border-border/50 mt-auto">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="px-2 py-1">
              <ThemeToggle />
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={signOut} 
              tooltip="Odhlásit"
              className="group hover:bg-destructive/10 hover:text-destructive transition-colors duration-150"
            >
              <LogOut className="h-4 w-4" />
              <span className="font-medium">Odhlásit</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
