import { Undo2, Redo2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DraftControlsProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  lastSaved: Date | null;
  showTimestamp?: boolean;
}

export function DraftControls({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  lastSaved,
  showTimestamp = true,
}: DraftControlsProps) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onUndo}
        disabled={!canUndo}
        title="Zpět (Ctrl+Z)"
        className="h-8 w-8"
      >
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRedo}
        disabled={!canRedo}
        title="Vpřed (Ctrl+Shift+Z)"
        className="h-8 w-8"
      >
        <Redo2 className="h-4 w-4" />
      </Button>
      {showTimestamp && lastSaved && (
        <span className="text-xs text-muted-foreground ml-2">
          <Save className="h-3 w-3 inline mr-1" />
          Uloženo
        </span>
      )}
    </div>
  );
}

interface DraftBannerProps {
  onRestore: () => void;
  onDiscard: () => void;
  lastSaved: Date | null;
}

export function DraftBanner({ onRestore, onDiscard, lastSaved }: DraftBannerProps) {
  return (
    <div className="bg-accent/50 border border-border rounded-lg p-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm">
        <Save className="h-4 w-4 text-primary" />
        <span className="text-foreground">
          Nalezen rozpracovaný formulář
          {lastSaved && (
            <span className="text-muted-foreground ml-1">
              (rozpracováno)
            </span>
          )}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onDiscard}
          className="h-7 text-xs"
        >
          <X className="h-3 w-3 mr-1" />
          Zahodit
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={onRestore}
          className="h-7 text-xs"
        >
          <Undo2 className="h-3 w-3 mr-1" />
          Obnovit
        </Button>
      </div>
    </div>
  );
}
