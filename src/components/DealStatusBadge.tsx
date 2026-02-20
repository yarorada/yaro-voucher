import { Badge } from "@/components/ui/badge";

type DealStatus = "inquiry" | "quote" | "confirmed" | "completed" | "cancelled" | "dispatched";

interface DealStatusBadgeProps {
  status: DealStatus;
}

const statusConfig: Record<DealStatus, { label: string; className: string }> = {
  inquiry: { label: "Poptávka", className: "bg-amber-500 hover:bg-amber-600 text-white border-transparent" },
  quote: { label: "Nabídka", className: "bg-blue-500 hover:bg-blue-600 text-white border-transparent" },
  confirmed: { label: "Potvrzeno", className: "bg-indigo-600 hover:bg-indigo-700 text-white border-transparent" },
  dispatched: { label: "Odbaveno", className: "bg-emerald-600 hover:bg-emerald-700 text-white border-transparent" },
  completed: { label: "Dokončeno", className: "bg-teal-600 hover:bg-teal-700 text-white border-transparent" },
  cancelled: { label: "Zrušeno", className: "bg-destructive hover:bg-destructive/80 text-destructive-foreground border-transparent" },
};

export const DealStatusBadge = ({ status }: DealStatusBadgeProps) => {
  const config = statusConfig[status];

  return (
    <Badge className={`text-xs shrink-0 ${config.className}`}>
      {config.label}
    </Badge>
  );
};
