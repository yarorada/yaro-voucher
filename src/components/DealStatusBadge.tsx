import { Badge } from "@/components/ui/badge";

type DealStatus = "inquiry" | "quote" | "approved" | "confirmed" | "completed" | "cancelled" | "dispatched";

interface DealStatusBadgeProps {
  status: DealStatus;
}

const statusConfig: Record<DealStatus, { label: string; className: string }> = {
  inquiry: { label: "Poptávka", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-transparent" },
  quote: { label: "Nabídka", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-transparent" },
  approved: { label: "Schváleno", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-transparent" },
  confirmed: { label: "Potvrzeno", className: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 border-transparent" },
  dispatched: { label: "Odbaveno", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-transparent" },
  completed: { label: "Dokončeno", className: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300 border-transparent" },
  cancelled: { label: "Zrušeno", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-transparent" },
};

export const DealStatusBadge = ({ status }: DealStatusBadgeProps) => {
  const config = statusConfig[status];

  return (
    <Badge className={`text-xs shrink-0 font-medium ${config.className}`}>
      {config.label}
    </Badge>
  );
};
