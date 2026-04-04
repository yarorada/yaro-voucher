import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, Filter, Search, SlidersHorizontal } from "lucide-react";
import { removeDiacritics, parseDateSafe } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type FilterField =
  | "name"
  | "email"
  | "phone"
  | "address"
  | "date_of_birth"
  | "passport"
  | "id_card";

export type FilterOperator = "contains" | "starts_with" | "equals" | "year";

export interface FilterCondition {
  id: string;
  field: FilterField;
  operator: FilterOperator;
  value: string;
}

interface Client {
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  date_of_birth: string | null;
  passport_number: string | null;
  id_card_number: string | null;
}

const FIELD_LABELS: Record<FilterField, string> = {
  name: "Jméno",
  email: "Email",
  phone: "Telefon",
  address: "Adresa / Město",
  date_of_birth: "Datum narození",
  passport: "Pas č.",
  id_card: "OP č.",
};

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  contains: "obsahuje",
  starts_with: "začíná na",
  equals: "je přesně",
  year: "rok narození",
};

function getOperatorsForField(field: FilterField): FilterOperator[] {
  if (field === "date_of_birth") return ["contains", "year"];
  return ["contains", "starts_with", "equals"];
}

function matchCondition(client: Client, condition: FilterCondition): boolean {
  const { field, operator, value } = condition;
  if (!value.trim()) return true;

  const normalize = (s: string) => removeDiacritics(s.toLowerCase().trim());
  const v = normalize(value);

  let haystack = "";
  switch (field) {
    case "name":
      haystack = normalize(`${client.first_name} ${client.last_name}`);
      break;
    case "email":
      haystack = normalize(client.email || "");
      break;
    case "phone":
      haystack = (client.phone || "").replace(/\s/g, "");
      break;
    case "address":
      haystack = normalize(client.address || "");
      break;
    case "passport":
      haystack = normalize(client.passport_number || "");
      break;
    case "id_card":
      haystack = normalize(client.id_card_number || "");
      break;
    case "date_of_birth": {
      if (operator === "year") {
        const d = parseDateSafe(client.date_of_birth);
        return d ? d.getFullYear().toString() === value.trim() : false;
      }
      const d = parseDateSafe(client.date_of_birth);
      if (!d) return false;
      haystack = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
      break;
    }
  }

  switch (operator) {
    case "contains":
      return haystack.includes(v);
    case "starts_with":
      return haystack.startsWith(v);
    case "equals":
      return haystack === v;
    default:
      return haystack.includes(v);
  }
}

export function applyClientFilters<T extends Client>(clients: T[], conditions: FilterCondition[], quickSearch?: string): T[] {
  let result = clients;

  // Quick full-text search
  if (quickSearch && quickSearch.trim()) {
    const q = removeDiacritics(quickSearch.toLowerCase().trim());
    result = result.filter((c) => {
      const name = removeDiacritics(`${c.first_name} ${c.last_name}`.toLowerCase());
      const email = removeDiacritics((c.email || "").toLowerCase());
      const phone = (c.phone || "").replace(/\s/g, "");
      const address = removeDiacritics((c.address || "").toLowerCase());
      return name.includes(q) || email.includes(q) || phone.includes(q) || address.includes(q);
    });
  }

  // Advanced filter conditions
  const active = conditions.filter((c) => c.value.trim() !== "");
  if (active.length === 0) return result;
  return result.filter((client) => active.every((cond) => matchCondition(client, cond)));
}

let conditionCounter = 0;
function newConditionId() {
  return `cond-${++conditionCounter}`;
}

interface ClientFilterBarProps {
  conditions: FilterCondition[];
  onChange: (conditions: FilterCondition[]) => void;
  quickSearch: string;
  onQuickSearchChange: (v: string) => void;
  noResults: boolean;
  onAddNew: (text: string) => void;
}

export function ClientFilterBar({
  conditions,
  onChange,
  quickSearch,
  onQuickSearchChange,
  noResults,
  onAddNew,
}: ClientFilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const showSuggestion = quickSearch.trim().length > 0 && noResults && focused;
  const activeConditions = conditions.filter((c) => c.value.trim()).length;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const addCondition = () => {
    setShowAdvanced(true);
    onChange([
      ...conditions,
      { id: newConditionId(), field: "name", operator: "contains", value: "" },
    ]);
  };

  const removeCondition = (id: string) => {
    const next = conditions.filter((c) => c.id !== id);
    onChange(next);
    if (next.length === 0) setShowAdvanced(false);
  };

  const updateCondition = (id: string, patch: Partial<FilterCondition>) => {
    onChange(
      conditions.map((c) => {
        if (c.id !== id) return c;
        const updated = { ...c, ...patch };
        if (patch.field) {
          const validOps = getOperatorsForField(patch.field as FilterField);
          if (!validOps.includes(updated.operator)) updated.operator = validOps[0];
        }
        return updated;
      })
    );
  };

  const handleAdd = () => {
    const text = quickSearch.trim();
    onAddNew(text);
    setFocused(false);
  };

  return (
    <div ref={containerRef} className="flex flex-wrap items-center gap-1.5 md:gap-2 min-w-0">
      {/* Quick search input with dropdown suggestion */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none z-10" />
        <Input
          placeholder="Hledat klienta..."
          value={quickSearch}
          onChange={(e) => onQuickSearchChange(e.target.value)}
          onFocus={() => setFocused(true)}
          className="h-8 text-xs pl-8 pr-7 w-36 md:w-52"
          onKeyDown={(e) => {
            if (e.key === "Enter" && showSuggestion) { e.preventDefault(); handleAdd(); }
            if (e.key === "Escape") setFocused(false);
          }}
        />
        {quickSearch && (
          <button
            type="button"
            onClick={() => { onQuickSearchChange(""); setFocused(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10"
          >
            <X className="h-3 w-3" />
          </button>
        )}

        {showSuggestion && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-md border border-border bg-popover shadow-md min-w-[220px]">
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleAdd(); }}
              className="flex items-center gap-2 w-full px-3 py-2.5 text-xs text-left hover:bg-accent rounded-md transition-colors"
            >
              <Plus className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>Přidat klienta <strong>„{quickSearch.trim()}"</strong></span>
            </button>
          </div>
        )}
      </div>

      {/* Toggle advanced filters */}
      <Button
        variant={showAdvanced || activeConditions > 0 ? "secondary" : "outline"}
        size="sm"
        className={cn("h-8 text-xs gap-1.5", activeConditions > 0 && "border-primary/50")}
        onClick={() => setShowAdvanced(!showAdvanced)}
        title="Pokročilý filtr"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        {activeConditions > 0 ? `Filtr (${activeConditions})` : "Filtr"}
      </Button>

      {/* Advanced conditions */}
      {showAdvanced && (
        <>
          {conditions.map((cond, i) => (
            <div
              key={cond.id}
              className="flex items-center gap-1.5 bg-muted/50 border border-border rounded-lg px-2 py-1"
            >
              {i > 0 && (
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mr-0.5">
                  A
                </span>
              )}
              <Select
                value={cond.field}
                onValueChange={(v) => updateCondition(cond.id, { field: v as FilterField })}
              >
                <SelectTrigger className="h-7 text-xs w-[120px] border-0 bg-transparent px-1 focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  {(Object.keys(FIELD_LABELS) as FilterField[]).map((f) => (
                    <SelectItem key={f} value={f} className="text-xs">
                      {FIELD_LABELS[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={cond.operator}
                onValueChange={(v) => updateCondition(cond.id, { operator: v as FilterOperator })}
              >
                <SelectTrigger className="h-7 text-xs w-[100px] border-0 bg-transparent px-1 focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  {getOperatorsForField(cond.field).map((op) => (
                    <SelectItem key={op} value={op} className="text-xs">
                      {OPERATOR_LABELS[op]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                value={cond.value}
                onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                placeholder={cond.field === "date_of_birth" && cond.operator === "year" ? "2000" : "Hodnota…"}
                className="h-7 text-xs w-28 border-0 bg-transparent px-1 focus-visible:ring-0"
              />

              <button
                onClick={() => removeCondition(cond.id)}
                className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={addCondition}
          >
            <Plus className="h-3.5 w-3.5" />
            {conditions.length === 0 ? "Přidat podmínku" : "Další podmínka"}
          </Button>

          {(conditions.length > 0 || activeConditions > 0) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground gap-1"
              onClick={() => { onChange([]); setShowAdvanced(false); }}
            >
              <X className="h-3 w-3" />
              Zrušit
            </Button>
          )}
        </>
      )}
    </div>
  );
}
