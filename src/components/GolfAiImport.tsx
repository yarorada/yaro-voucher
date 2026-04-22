import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2, Sparkles, Trash2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ParsedTeeTime {
  date: string;
  club: string;
  time: string;
  golfers: string;
  price_per_person?: number;
  currency?: string;
}

interface GolfAiImportProps {
  onImport: (teeTimes: ParsedTeeTime[], supplierName?: string) => void;
}

export const GolfAiImport = ({ onImport }: GolfAiImportProps) => {
  const [importText, setImportText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsedTeeTimes, setParsedTeeTimes] = useState<ParsedTeeTime[]>([]);
  const [supplierName, setSupplierName] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);

  const handleParse = async () => {
    if (!importText.trim()) {
      toast.error("Vložte text k rozparsování");
      return;
    }

    setParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-golf-tee-times", {
        body: { text: importText },
      });

      if (error) throw error;

      if (!data?.success || !data?.tee_times?.length) {
        toast.error("Nepodařilo se extrahovat žádné tee times z textu");
        return;
      }

      const sorted = [...data.tee_times].sort((a: ParsedTeeTime, b: ParsedTeeTime) => {
        const dateA = a.date || "";
        const dateB = b.date || "";
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        const timeA = a.time || "";
        const timeB = b.time || "";
        return timeA.localeCompare(timeB);
      });
      setParsedTeeTimes(sorted);
      setSupplierName(data.supplier_name || "");
      setShowPreview(true);
      toast.success(`Extrahováno ${data.tee_times.length} tee times`);
    } catch (error) {
      console.error("Error parsing golf data:", error);
      toast.error("Chyba při zpracování dat");
    } finally {
      setParsing(false);
    }
  };

  const updateTeeTime = (index: number, field: keyof ParsedTeeTime, value: string | number) => {
    const updated = [...parsedTeeTimes];
    updated[index] = { ...updated[index], [field]: value };
    setParsedTeeTimes(updated);
  };

  const removeTeeTime = (index: number) => {
    setParsedTeeTimes(parsedTeeTimes.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    onImport(parsedTeeTimes, supplierName);
    setImportText("");
    setParsedTeeTimes([]);
    setShowPreview(false);
    setSupplierName("");
  };

  const handleCancel = () => {
    setShowPreview(false);
    setParsedTeeTimes([]);
    setSupplierName("");
  };

  if (showPreview && parsedTeeTimes.length > 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Extrahované Tee Times ({parsedTeeTimes.length})</Label>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={handleCancel}>
              <X className="h-3 w-3 mr-1" />
              Zrušit
            </Button>
            <Button type="button" size="sm" onClick={handleConfirm}>
              <Check className="h-3 w-3 mr-1" />
              Potvrdit a přidat tee times
            </Button>
          </div>
        </div>

        {supplierName && (
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground shrink-0">Dodavatel:</Label>
            <Input
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              className="h-7 text-xs"
            />
          </div>
        )}

        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {parsedTeeTimes.map((tt, idx) => (
            <Card key={idx} className="p-3 bg-muted/50">
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-xs font-semibold text-muted-foreground">#{idx + 1}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-destructive"
                  onClick={() => removeTeeTime(idx)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div>
                  <Label className="text-xs">Datum</Label>
                  <Input
                    value={tt.date || ""}
                    onChange={(e) => updateTeeTime(idx, "date", e.target.value)}
                    placeholder="YYYY-MM-DD"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Golfový klub</Label>
                  <Input
                    value={tt.club || ""}
                    onChange={(e) => updateTeeTime(idx, "club", e.target.value)}
                    placeholder="Název klubu"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Čas</Label>
                  <Input
                    value={tt.time || ""}
                    onChange={(e) => updateTeeTime(idx, "time", e.target.value)}
                    placeholder="09:30 - 14:00"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Golfisté</Label>
                  <Input
                    value={tt.golfers || ""}
                    onChange={(e) => updateTeeTime(idx, "golfers", e.target.value)}
                    placeholder="4"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              {(tt.price_per_person || tt.currency) && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <Label className="text-xs">Cena/os</Label>
                    <Input
                      type="number"
                      value={tt.price_per_person || ""}
                      onChange={(e) => updateTeeTime(idx, "price_per_person", parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Měna</Label>
                    <Input
                      value={tt.currency || ""}
                      onChange={(e) => updateTeeTime(idx, "currency", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <Label className="text-sm font-semibold">AI Import tee times</Label>
      </div>
      <Textarea
        value={importText}
        onChange={(e) => setImportText(e.target.value)}
        placeholder="Vložte text s informacemi o tee times (email, tabulku, seznam)..."
        rows={4}
        className="text-sm"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleParse}
        disabled={parsing || !importText.trim()}
        className="w-full"
      >
        {parsing ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Zpracovávám...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            Rozparsovat pomocí AI
          </>
        )}
      </Button>
    </div>
  );
};
