import { useRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SmartSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  noResults: boolean;
  addLabel: string; // e.g. 'hotel „{text}"'
  onAddNew: (text: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  hint?: string | null; // optional hint shown below the add button (e.g. suggested country)
}

export function SmartSearchInput({
  value,
  onChange,
  noResults,
  addLabel,
  onAddNew,
  placeholder = "Hledat...",
  className,
  inputClassName,
  hint,
}: SmartSearchInputProps) {
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const showSuggestion = value.trim().length > 0 && noResults && focused;

  // Dismiss suggestion on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleAdd = () => {
    onAddNew(value.trim());
    setFocused(false);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        className={cn("pl-9 pr-8", inputClassName)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && showSuggestion) {
            e.preventDefault();
            handleAdd();
          }
          if (e.key === "Escape") {
            setFocused(false);
          }
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => { onChange(""); setFocused(false); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {showSuggestion && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-md border border-border bg-popover shadow-md">
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); handleAdd(); }}
            className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-left hover:bg-accent rounded-md transition-colors"
          >
            <Plus className="h-4 w-4 text-primary shrink-0" />
            <span>
              Přidat {addLabel.replace("{text}", value.trim())}
            </span>
          </button>
          {hint && (
            <div className="px-3 pb-2 text-xs text-muted-foreground flex items-center gap-1">
              <span>🌍</span>
              <span>{hint}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
