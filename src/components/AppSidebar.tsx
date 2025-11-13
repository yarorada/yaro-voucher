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
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <div className="flex items-center justify-center py-4 px-2">
            <img 
              src={yaroLogo} 
              alt="YARO Travel" 
              className={`transition-all ${open ? "h-10 w-auto" : "h-8 w-8 object-contain"}`}
            />
          </div>
          
          <SidebarGroupLabel>Navigace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.url)}
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} tooltip="Odhlásit">
              <LogOut className="h-4 w-4" />
              <span>Odhlásit</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
