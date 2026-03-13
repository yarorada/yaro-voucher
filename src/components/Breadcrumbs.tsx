import { useLocation, Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

const routeNames: Record<string, string> = {
  "": "Domů",
  "vouchers": "Vouchery",
  "create": "Vytvořit voucher",
  "edit": "Upravit voucher",
  "voucher": "Detail voucheru",
  "deals": "Obchodní případy",
  "new": "Nový případ",
  "clients": "Klienti",
  "suppliers": "Dodavatelé",
  "destinations": "Destinace",
  "contracts": "Smlouvy",
  "statistics": "Statistiky",
  "hotels": "Hotely",
};

interface Breadcrumb {
  name: string;
  path: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export function Breadcrumbs() {
  const location = useLocation();
  const pathSegments = location.pathname.split("/").filter(Boolean);

  // Don't show breadcrumbs on home page
  if (pathSegments.length === 0) {
    return null;
  }

  const breadcrumbs: Breadcrumb[] = [
    { name: "Domů", path: "/", icon: Home },
  ];

  let currentPath = "";
  pathSegments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    
    // Skip UUIDs and numbers (they're not meaningful for breadcrumbs)
    if (/^[0-9a-f-]{36}$/i.test(segment) || /^\d+$/.test(segment)) {
      return;
    }

    const name = routeNames[segment] || segment;
    breadcrumbs.push({
      name,
      path: currentPath,
    });
  });

  return (
    <nav className="flex items-center space-x-1 text-sm text-muted-foreground">
      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1;
        const Icon = crumb.icon;

        return (
          <div key={crumb.path} className="flex items-center">
            {index > 0 && (
              <ChevronRight className="h-4 w-4 mx-1 flex-shrink-0" />
            )}
            {isLast ? (
              <span className="font-medium text-foreground flex items-center">
                {Icon && <Icon className="h-4 w-4 mr-1" />}
                {crumb.name}
              </span>
            ) : (
              <Link
                to={crumb.path}
                className="hover:text-foreground transition-colors flex items-center"
              >
                {Icon && <Icon className="h-4 w-4 mr-1" />}
                {crumb.name}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
