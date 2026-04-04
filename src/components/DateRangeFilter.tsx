import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";
import { cs } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

export type DateField = "departure" | "arrival";
export type DatePreset = "all" | "this_month" | "last_month" | "custom";

export interface DateRangeFilterValue {
  preset: DatePreset;
  dateField: DateField;
  from: string | null; // YYYY-MM-DD
  to: string | null;   // YYYY-MM-DD
}

interface DateRangeFilterProps {
  value: DateRangeFilterValue;
  onChange: (value: DateRangeFilterValue) => void;
  showArrival?: boolean;
}

const formatShort = (d: string | null) => {
  if (!d) return "";
  const date = new Date(d + "T00:00:00");
  return `${date.getDate()}.${date.getMonth() + 1}.`;
};

const formatForDisplay = (d: string | null) => {
  if (!d) return "";
  const date = new Date(d + "T00:00:00");
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${day}.${month}.${year}`;
};

const toDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export function DateRangeFilter({ value, onChange, showArrival = true }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);

  const handlePresetChange = (preset: DatePreset) => {
    const now = new Date();
    let from: string | null = null;
    let to: string | null = null;

    if (preset === "this_month") {
      from = toDateStr(startOfMonth(now));
      to = toDateStr(endOfMonth(now));
    } else if (preset === "last_month") {
      const lastMonth = subMonths(now, 1);
      from = toDateStr(startOfMonth(lastMonth));
      to = toDateStr(endOfMonth(lastMonth));
    }

    onChange({ ...value, preset, from, to });
    if (preset !== "custom") setOpen(false);
  };

  const handleDateFieldChange = (dateField: DateField) => {
    onChange({ ...value, dateField });
  };

  const handleRangeSelect = (range: DateRange | undefined) => {
    onChange({
      ...value,
      preset: "custom",
      from: range?.from ? toDateStr(range.from) : null,
      to: range?.to ? toDateStr(range.to) : null,
    });
  };

  const handleClear = () => {
    onChange({ preset: "all", dateField: value.dateField, from: null, to: null });
    setOpen(false);
  };

  const isActive = value.preset !== "all";

  const getLabel = (short = false) => {
    if (value.preset === "all") return short ? "" : "Datum";
    if (value.preset === "this_month") return short ? "Teď" : `Tento měsíc`;
    if (value.preset === "last_month") return short ? "Min." : `Minulý měsíc`;
    if (value.preset === "custom") {
      const fmt = short ? formatShort : formatForDisplay;
      const parts: string[] = [];
      if (value.from) parts.push(fmt(value.from));
      if (value.to) parts.push(fmt(value.to));
      return parts.join("–");
    }
    return short ? "" : "Datum";
  };

  const selected: DateRange | undefined =
    value.from || value.to
      ? {
          from: value.from ? new Date(value.from + "T00:00:00") : undefined,
          to: value.to ? new Date(value.to + "T00:00:00") : undefined,
        }
      : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={isActive ? "default" : "outline"}
          size="sm"
          className={cn("h-9 gap-1 text-sm shrink-0", isActive && "pr-2")}
          title={getLabel(false)}
        >
          <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline truncate max-w-[200px]">{getLabel()}</span>
          {isActive && <span className="sm:hidden text-xs">{getLabel(true)}</span>}
          {isActive && (
            <span
              role="button"
              className="ml-1 rounded-full hover:bg-primary-foreground/20 p-0.5"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4 space-y-3" align="start">
        {/* Date field selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Podle:</span>
          <Select value={value.dateField} onValueChange={(v) => handleDateFieldChange(v as DateField)}>
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="departure">Odjezdu</SelectItem>
              {showArrival && <SelectItem value="arrival">Příjezdu</SelectItem>}
            </SelectContent>
          </Select>
        </div>

        {/* Presets */}
        <div className="flex gap-2">
          <Button
            variant={value.preset === "this_month" ? "default" : "outline"}
            size="sm"
            onClick={() => handlePresetChange("this_month")}
          >
            Tento měsíc
          </Button>
          <Button
            variant={value.preset === "last_month" ? "default" : "outline"}
            size="sm"
            onClick={() => handlePresetChange("last_month")}
          >
            Minulý měsíc
          </Button>
        </div>

        {/* Single calendar with range selection */}
        <div className="space-y-1">
          <span className="text-sm font-medium">Vlastní rozsah:</span>
          <Calendar
            mode="range"
            selected={selected}
            onSelect={handleRangeSelect}
            locale={cs}
            numberOfMonths={1}
            className={cn("p-2 pointer-events-auto border rounded-md")}
          />
        </div>

        <div className="flex justify-between pt-2 border-t">
          <Button variant="ghost" size="sm" onClick={handleClear}>
            Zrušit filtr
          </Button>
          <Button size="sm" onClick={() => setOpen(false)}>
            Hotovo
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const defaultDateRangeFilter: DateRangeFilterValue = {
  preset: "all",
  dateField: "departure",
  from: null,
  to: null,
};
