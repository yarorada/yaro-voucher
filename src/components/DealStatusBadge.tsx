import { Badge } from "@/components/ui/badge";

type DealStatus = "inquiry" | "quote" | "confirmed" | "completed" | "cancelled";

interface DealStatusBadgeProps {
  status: DealStatus;
}

const statusConfig = {
  inquiry: { label: "Poptávka", variant: "secondary" as const },
  quote: { label: "Nabídka", variant: "default" as const },
  confirmed: { label: "Potvrzeno", variant: "default" as const },
  completed: { label: "Dokončeno", variant: "default" as const },
  cancelled: { label: "Zrušeno", variant: "destructive" as const },
};

export const DealStatusBadge = ({ status }: DealStatusBadgeProps) => {
  const config = statusConfig[status];
  
  return (
    <Badge variant={config.variant} className="capitalize">
      {config.label}
    </Badge>
  );
};
