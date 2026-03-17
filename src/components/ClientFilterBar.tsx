import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, Filter } from "lucide-react";
import { removeDiacritics } from "@/lib/utils";
import { parseDateSafe } from "@/lib/utils";

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
      // format to DD.MM.YYYY for contains matching
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

export function applyClientFilters<T extends Client>(clients: T[], conditions: FilterCondition[]): T[] {
  const active = conditions.filter((c) => c.value.trim() !== "");
  if (active.length === 0) return clients;
  return clients.filter((client) =>
    active.every((cond) => matchCondition(client, cond))
  );
}

let conditionCounter = 0;
function newConditionId() {
  return `cond-${++conditionCounter}`;
}

interface ClientFilterBarProps {
  conditions: FilterCondition[];
  onChange: (conditions: FilterCondition[]) => void;
}

export function ClientFilterBar({ conditions, onChange }: ClientFilterBarProps) {
  const addCondition = () => {
    onChange([
      ...conditions,
      { id: newConditionId(), field: "name", operator: "contains", value: "" },
    ]);
  };

  const removeCondition = (id: string) => {
    onChange(conditions.filter((c) => c.id !== id));
  };

  const updateCondition = (id: string, patch: Partial<FilterCondition>) => {
    onChange(
      conditions.map((c) => {
        if (c.id !== id) return c;
        const updated = { ...c, ...patch };
        // reset operator if field changes and operator not valid
        if (patch.field) {
          const validOps = getOperatorsForField(patch.field as FilterField);
          if (!validOps.includes(updated.operator)) updated.operator = validOps[0];
        }
        return updated;
      })
    );
  };

  const activeCount = conditions.filter((c) => c.value.trim()).length;

  return (
    <div className="flex flex-wrap items-center gap-2">
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
          {/* Field selector */}
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

          {/* Operator selector */}
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

          {/* Value input */}
          <Input
            value={cond.value}
            onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
            placeholder={cond.field === "date_of_birth" && cond.operator === "year" ? "2000" : "Hodnota…"}
            className="h-7 text-xs w-28 border-0 bg-transparent px-1 focus-visible:ring-0"
          />

          {/* Remove */}
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
        {conditions.length === 0 ? (
          <>
            <Filter className="h-3.5 w-3.5" />
            Filtrovat
          </>
        ) : (
          <>
            <Plus className="h-3.5 w-3.5" />
            Přidat podmínku
          </>
        )}
      </Button>

      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground gap-1"
          onClick={() => onChange([])}
        >
          <X className="h-3 w-3" />
          Zrušit vše
        </Button>
      )}
    </div>
  );
}
