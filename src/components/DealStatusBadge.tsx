import { Badge } from "@/components/ui/badge";

type DealStatus = "inquiry" | "quote" | "confirmed" | "completed" | "cancelled" | "dispatched";

interface DealStatusBadgeProps {
  status: DealStatus;
}

const statusConfig = {
  inquiry: { label: "Poptávka", variant: "secondary" as const },
  quote: { label: "Nabídka", variant: "default" as const },
  confirmed: { label: "Potvrzeno", variant: "default" as const },
  dispatched: { label: "Odbaveno", variant: "default" as const, className: "bg-emerald-600 hover:bg-emerald-700" },
  completed: { label: "Dokončeno", variant: "default" as const },
  cancelled: { label: "Zrušeno", variant: "destructive" as const },
};

export const DealStatusBadge = ({ status }: DealStatusBadgeProps) => {
  const config = statusConfig[status];
  
  return (
    <Badge variant={config.variant} className={`capitalize ${'className' in config ? config.className : ''}`}>
      {config.label}
    </Badge>
  );
};
