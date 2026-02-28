import * as React from "react";
import { addDays } from "date-fns";
import { DateInput } from "@/components/ui/date-input";
import { cn } from "@/lib/utils";

interface DateRangePickerProps {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  onDateFromChange: (date: Date | undefined) => void;
  onDateToChange: (date: Date | undefined) => void;
  className?: string;
}

export const DateRangePicker = React.forwardRef<
  HTMLDivElement,
  DateRangePickerProps
>(({ dateFrom, dateTo, onDateFromChange, onDateToChange, className }, ref) => {
  const [toOpen, setToOpen] = React.useState(false);

  // When user selects "from" via calendar, auto-open "to" with +7 days
  const handleFromCalendarSelect = (date: Date) => {
    // Set default "to" date = from + 7 days if not already set
    if (!dateTo) {
      onDateToChange(addDays(date, 7));
    }
    setToOpen(true);
  };

  return (
    <div
      ref={ref}
      className={cn("flex flex-col sm:flex-row gap-2 items-start sm:items-center", className)}
    >
      <div className="flex items-center gap-2 flex-1 w-full">
        <span className="text-sm text-muted-foreground whitespace-nowrap min-w-[20px]">Od</span>
        <DateInput
          value={dateFrom}
          onChange={onDateFromChange}
          placeholder="DD.MM.RRRR"
          className="flex-1"
          onCalendarSelect={handleFromCalendarSelect}
        />
      </div>
      <div className="flex items-center gap-2 flex-1 w-full">
        <span className="text-sm text-muted-foreground whitespace-nowrap min-w-[20px]">Do</span>
        <DateInput
          value={dateTo}
          onChange={onDateToChange}
          placeholder="DD.MM.RRRR"
          className="flex-1"
          open={toOpen}
          onOpenChange={setToOpen}
        />
      </div>
    </div>
  );
});

DateRangePicker.displayName = "DateRangePicker";
