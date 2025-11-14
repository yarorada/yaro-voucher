import { useLocation, useNavigate } from "react-router-dom";
import { 
  Home, 
  FileText, 
  Building2, 
  Users, 
  Briefcase, 
  MapPin, 
  FileSignature,
  LogOut
} from "lucide-react";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import yaroLogo from "@/assets/yaro-logo-wide.png";

const menuItems = [
  { title: "Domů", url: "/", icon: Home },
  { title: "Vouchery", url: "/vouchers", icon: FileText },
  { title: "Obchodní případy", url: "/deals", icon: Briefcase },
  { title: "Smlouvy", url: "/contracts", icon: FileSignature },
  { title: "Klienti", url: "/clients", icon: Users },
  { title: "Dodavatelé", url: "/suppliers", icon: Building2 },
  { title: "Destinace", url: "/destinations", icon: MapPin },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { open } = useSidebar();
  const { signOut } = useAuth();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarContent>
        <SidebarGroup>
          <div className="flex items-center justify-center py-6 px-4 border-b border-border/50">
            <img 
              src={yaroLogo} 
              alt="YARO Travel" 
              className={`logo-dark-mode transition-all duration-300 ${open ? "h-10 w-auto" : "h-8 w-8 object-contain"}`}
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
                      onClick={() => navigate(item.url)}
                      isActive={active}
                      tooltip={item.title}
                      className={`
                        group relative transition-all duration-200
                        ${active 
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm' 
                          : 'hover:bg-accent/50 hover:text-accent-foreground'
                        }
                      `}
                    >
                      <item.icon className={`h-4 w-4 transition-transform duration-200 ${active ? 'scale-110' : 'group-hover:scale-110'}`} />
                      <span className="font-medium">{item.title}</span>
                      {active && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary-foreground rounded-r-full" />
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
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
              className="group hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
            >
              <LogOut className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
              <span className="font-medium">Odhlásit</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
