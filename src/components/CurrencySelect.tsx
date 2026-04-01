import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CURRENCIES = [
  { code: "CZK", name: "Česká koruna", symbol: "Kč" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "USD", name: "US dolar", symbol: "$" },
  { code: "GBP", name: "Britská libra", symbol: "£" },
  { code: "CHF", name: "Švýcarský frank", symbol: "Fr" },
  { code: "PLN", name: "Polský zlotý", symbol: "zł" },
  { code: "HUF", name: "Maďarský forint", symbol: "Ft" },
  { code: "THB", name: "Thajský baht", symbol: "฿" },
  { code: "AED", name: "Emirátský dirham", symbol: "د.إ" },
  { code: "TRY", name: "Turecká lira", symbol: "₺" },
  { code: "ZAR", name: "Jihoafrický rand", symbol: "R" },
  { code: "CNY", name: "Čínský jüan", symbol: "¥" },
];

interface CurrencySelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function CurrencySelect({ value, onChange, className }: CurrencySelectProps) {
  return (
    <Select value={value || "CZK"} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CURRENCIES.map((currency) => (
          <SelectItem key={currency.code} value={currency.code}>
            {currency.code} ({currency.symbol})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function getCurrencySymbol(code: string): string {
  const currency = CURRENCIES.find(c => c.code === code);
  return currency?.symbol || code;
}

export { CURRENCIES };
