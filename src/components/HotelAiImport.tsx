import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2, Sparkles, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ParsedHotelData {
  hotel_name: string;
  room_type?: string;
  check_in?: string;
  check_out?: string;
  nights?: number;
  rooms?: number;
  persons?: number;
  meal_plan?: string;
  price_per_night?: number;
  total_price?: number;
  currency?: string;
  supplier_name?: string;
  notes?: string;
}

interface HotelAiImportProps {
  onImport: (data: ParsedHotelData) => void;
}

const mealPlanLabels: Record<string, string> = {
  RO: "Room Only",
  BB: "Bed & Breakfast",
  HB: "Half Board",
  FB: "Full Board",
  AI: "All Inclusive",
};

export const HotelAiImport = ({ onImport }: HotelAiImportProps) => {
  const [importText, setImportText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedHotelData | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleParse = async () => {
    if (!importText.trim()) {
      toast.error("Vložte text k rozparsování");
      return;
    }

    setParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-hotel-data", {
        body: { text: importText },
      });

      if (error) throw error;

      if (!data?.success || !data?.hotelData?.hotel_name) {
        toast.error("Nepodařilo se extrahovat údaje o ubytování z textu");
        return;
      }

      setParsedData(data.hotelData);
      setShowPreview(true);
      toast.success("Údaje o ubytování extrahovány");
    } catch (error) {
      console.error("Error parsing hotel data:", error);
      toast.error("Chyba při zpracování dat");
    } finally {
      setParsing(false);
    }
  };

  const updateField = (field: keyof ParsedHotelData, value: string | number) => {
    if (!parsedData) return;
    setParsedData({ ...parsedData, [field]: value });
  };

  const handleConfirm = () => {
    if (!parsedData) return;
    onImport(parsedData);
    setImportText("");
    setParsedData(null);
    setShowPreview(false);
  };

  const handleCancel = () => {
    setShowPreview(false);
    setParsedData(null);
  };

  if (showPreview && parsedData) {
    return (
      <div className="space-y-3 p-4 border rounded-lg bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <Label className="text-sm font-semibold">Extrahované údaje o ubytování</Label>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={handleCancel}>
              <X className="h-3 w-3 mr-1" />
              Zrušit
            </Button>
            <Button type="button" size="sm" onClick={handleConfirm}>
              <Check className="h-3 w-3 mr-1" />
              Použít data
            </Button>
          </div>
        </div>

        <Card className="p-3 bg-muted/50">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <Label className="text-xs">Hotel</Label>
              <Input
                value={parsedData.hotel_name || ""}
                onChange={(e) => updateField("hotel_name", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Typ pokoje</Label>
              <Input
                value={parsedData.room_type || ""}
                onChange={(e) => updateField("room_type", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Check-in</Label>
              <Input
                type="date"
                value={parsedData.check_in || ""}
                onChange={(e) => updateField("check_in", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Check-out</Label>
              <Input
                type="date"
                value={parsedData.check_out || ""}
                onChange={(e) => updateField("check_out", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Osoby</Label>
              <Input
                type="number"
                value={parsedData.persons || ""}
                onChange={(e) => updateField("persons", parseInt(e.target.value) || 0)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Stravování</Label>
              <Input
                value={parsedData.meal_plan || ""}
                onChange={(e) => updateField("meal_plan", e.target.value)}
                placeholder="BB, HB, FB, AI..."
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Celková cena</Label>
              <Input
                type="number"
                value={parsedData.total_price || ""}
                onChange={(e) => updateField("total_price", parseFloat(e.target.value) || 0)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Měna</Label>
              <Input
                value={parsedData.currency || ""}
                onChange={(e) => updateField("currency", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
          {parsedData.supplier_name && (
            <div className="mt-2">
              <Label className="text-xs">Dodavatel</Label>
              <Input
                value={parsedData.supplier_name}
                onChange={(e) => updateField("supplier_name", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          )}
          {parsedData.notes && (
            <div className="mt-2">
              <Label className="text-xs">Poznámky</Label>
              <Input
                value={parsedData.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          )}
          {parsedData.meal_plan && mealPlanLabels[parsedData.meal_plan.toUpperCase()] && (
            <p className="text-xs text-muted-foreground mt-1">
              {mealPlanLabels[parsedData.meal_plan.toUpperCase()]}
            </p>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-primary/5 border-primary/20">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="h-4 w-4 text-primary" />
        AI Import ubytování
      </div>
      <Textarea
        value={importText}
        onChange={(e) => setImportText(e.target.value)}
        placeholder="Vložte text s informacemi o ubytování (email, potvrzení rezervace, nabídku)..."
        rows={3}
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
