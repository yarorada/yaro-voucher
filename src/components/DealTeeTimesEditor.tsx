import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { GolfAiImport, type ParsedTeeTime } from "@/components/GolfAiImport";

interface TeeTime {
  date: string | null;
  club: string;
  time: string;
}

interface DealTeeTimesEditorProps {
  dealId: string;
  teeTimes: TeeTime[];
  onUpdate: () => void;
}

export const DealTeeTimesEditor = ({ dealId, teeTimes, onUpdate }: DealTeeTimesEditorProps) => {
  const [items, setItems] = useState<TeeTime[]>(teeTimes?.length ? teeTimes.map(t => ({ ...t })) : []);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleAiImport = (parsedTeeTimes: ParsedTeeTime[]) => {
    const newItems: TeeTime[] = parsedTeeTimes
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .map(tt => ({
        date: tt.date || null,
        club: tt.club || '',
        time: tt.time || '',
      }));
    setItems(prev => [...prev, ...newItems]);
    setHasChanges(true);
  };

  const addItem = () => {
    setItems(prev => [...prev, { date: "", club: "", time: "" }]);
    setHasChanges(true);
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
    setHasChanges(true);
  };

  const updateItem = (idx: number, field: keyof TeeTime, value: string) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("deals")
        .update({ tee_times: items.length > 0 ? items : null } as any)
        .eq("id", dealId);

      if (error) throw error;
      toast.success("Startovací časy uloženy");
      setHasChanges(false);
      onUpdate();
    } catch (err) {
      console.error(err);
      toast.error("Chyba při ukládání");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <Label className="text-sm font-semibold">Startovací časy (Tee Times)</Label>
        {hasChanges && (
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Uložit
          </Button>
        )}
      </div>

      <GolfAiImport onImport={handleAiImport} />

      {items.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-3">
          Žádné startovací časy. Použijte AI import výše nebo přidejte ručně.
        </p>
      )}

      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <Input
              type="date"
              value={item.date || ""}
              onChange={e => updateItem(idx, "date", e.target.value)}
              className="w-[140px] shrink-0 h-8 text-xs"
            />
            <Input
              placeholder="Název hřiště"
              value={item.club}
              onChange={e => updateItem(idx, "club", e.target.value)}
              className="flex-1 h-8 text-xs"
            />
            <Input
              placeholder="HH:MM - HH:MM"
              value={item.time}
              onChange={e => updateItem(idx, "time", e.target.value)}
              className="w-[120px] shrink-0 h-8 text-xs"
            />
            <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="shrink-0 h-7 w-7">
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={addItem} className="w-full mt-2">
        <Plus className="h-3 w-3 mr-1" />
        Přidat tee time
      </Button>
    </Card>
  );
};
