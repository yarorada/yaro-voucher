import { Badge } from "@/components/ui/badge";

type ContractStatus = "draft" | "sent" | "signed" | "cancelled";

interface ContractStatusBadgeProps {
  status: ContractStatus;
}

const statusConfig: Record<ContractStatus, { label: string; className: string }> = {
  draft: { label: "Koncept", className: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300 border-transparent" },
  sent: { label: "Odesláno", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-transparent" },
  signed: { label: "Podepsáno", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-transparent" },
  cancelled: { label: "Zrušeno", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-transparent" },
};

export const ContractStatusBadge = ({ status }: ContractStatusBadgeProps) => {
  const config = statusConfig[status];

  return (
    <Badge className={`text-xs shrink-0 font-medium ${config.className}`}>
      {config.label}
    </Badge>
  );
};
