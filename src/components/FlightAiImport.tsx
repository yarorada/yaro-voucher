import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { FlightFormData, FlightSegment } from "@/components/FlightSegmentForm";

interface FlightAiImportProps {
  onImport: (data: FlightFormData, price?: number, personCount?: number) => void;
}

export const FlightAiImport = ({ onImport }: FlightAiImportProps) => {
  const [importText, setImportText] = useState("");
  const [parsing, setParsing] = useState(false);

  const handleParse = async () => {
    if (!importText.trim()) {
      toast.error("Vložte text k rozparsování");
      return;
    }

    setParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-flight-data", {
        body: { text: importText },
      });

      if (error) throw error;

      if (!data?.flightData) {
        toast.error("Nepodařilo se extrahovat letová data z textu");
        return;
      }

      const fd = data.flightData;

      const mapSegment = (s: any): FlightSegment => ({
        departure: s.departure_airport || "",
        arrival: s.arrival_airport || "",
        airline: s.airline_code || "",
        airline_name: s.airline_name || "",
        flight_number: s.flight_number || "",
        date: s.date || "",
        departure_time: s.departure_time || "",
        arrival_time: s.arrival_time || "",
      });

      const outbound = (fd.outbound_segments || []).map(mapSegment);
      const returnSegs = (fd.return_segments || []).map(mapSegment);

      const formData: FlightFormData = {
        outbound_segments: outbound.length > 0 ? outbound : [{ departure: "", arrival: "", airline: "", airline_name: "", flight_number: "", departure_time: "", arrival_time: "" }],
        return_segments: returnSegs.length > 0 ? returnSegs : [{ departure: "", arrival: "", airline: "", airline_name: "", flight_number: "", departure_time: "", arrival_time: "" }],
        is_one_way: fd.is_one_way ?? returnSegs.length === 0,
      };

      onImport(formData, fd.price, fd.person_count);
      setImportText("");
      
      const totalSegments = outbound.length + returnSegs.length;
      toast.success(`Extrahováno ${totalSegments} letových segmentů`);
    } catch (error) {
      console.error("Error parsing flight data:", error);
      toast.error("Chyba při zpracování letových dat");
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <Label className="text-sm font-semibold">AI Import letů</Label>
      </div>
      <Textarea
        value={importText}
        onChange={(e) => setImportText(e.target.value)}
        placeholder="Vložte text s informacemi o letech (email, itinerář, rezervaci)..."
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
