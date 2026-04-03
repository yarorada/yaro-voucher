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

  // When user selects "from" via calendar OR types it, auto-fill "to" = from + 7 days
  const handleFromDateSet = (date: Date) => {
    if (!dateTo) {
      onDateToChange(addDays(date, 7));
    }
    setToOpen(true);
  };

  return (
    <div
      ref={ref}
      className={cn("flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center", className)}
    >
      <div className="flex w-full min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0 text-sm text-muted-foreground">Od</span>
        <DateInput
          value={dateFrom}
          onChange={onDateFromChange}
          placeholder="DD.MM.RRRR"
          className="min-w-0 flex-1"
          onCalendarSelect={handleFromDateSet}
          onTextInput={handleFromDateSet}
        />
      </div>
      <div className="flex w-full min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0 text-sm text-muted-foreground">Do</span>
        <DateInput
          value={dateTo}
          onChange={onDateToChange}
          placeholder="DD.MM.RRRR"
          className="min-w-0 flex-1"
          open={toOpen}
          onOpenChange={setToOpen}
        />
      </div>
    </div>
  );
});

DateRangePicker.displayName = "DateRangePicker";
