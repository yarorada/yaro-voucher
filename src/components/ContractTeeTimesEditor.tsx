import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Pencil, Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { GolfAiImport, type ParsedTeeTime } from "@/components/GolfAiImport";

interface TeeTime {
  date: string | null;
  club: string;
  time: string;
}

interface ContractTeeTimesEditorProps {
  contractId: string;
  teeTimes: TeeTime[];
  onUpdate: () => void;
}

export const ContractTeeTimesEditor = ({ contractId, teeTimes, onUpdate }: ContractTeeTimesEditorProps) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<TeeTime[]>([]);
  const [saving, setSaving] = useState(false);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setItems(teeTimes?.length ? teeTimes.map(t => ({ ...t })) : []);
    }
    setOpen(isOpen);
  };

  const addItem = () => {
    setItems(prev => [...prev, { date: "", club: "", time: "" }]);
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof TeeTime, value: string) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const handleAiImport = (parsedTeeTimes: ParsedTeeTime[]) => {
    const newItems: TeeTime[] = parsedTeeTimes
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .map(tt => ({
        date: tt.date || null,
        club: tt.club || '',
        time: tt.time || '',
      }));
    setItems(prev => [...prev, ...newItems]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // @ts-ignore
      const { error } = await (supabase as any)
        .from("travel_contracts")
        .update({ tee_times: items.length > 0 ? items : null })
        .eq("id", contractId);

      if (error) throw error;
      toast.success("Startovací časy uloženy");
      setOpen(false);
      onUpdate();
    } catch (err) {
      console.error(err);
      toast.error("Chyba při ukládání");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4 mr-2" />
          Upravit tee times
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle>Upravit startovací časy</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          <GolfAiImport onImport={handleAiImport} />

          {items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Žádné startovací časy. Použijte AI import výše nebo přidejte ručně.
            </p>
          )}

          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                type="date"
                value={item.date || ""}
                onChange={e => updateItem(idx, "date", e.target.value)}
                className="w-[140px] shrink-0"
              />
              <Input
                placeholder="Název hřiště"
                value={item.club}
                onChange={e => updateItem(idx, "club", e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="HH:MM"
                value={item.time}
                onChange={e => updateItem(idx, "time", e.target.value)}
                className="w-[100px] shrink-0"
              />
              <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="shrink-0">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={addItem} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Přidat startovací čas
          </Button>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => setOpen(false)}>Zrušit</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Ukládám..." : "Uložit"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
