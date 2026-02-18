import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AirportCombobox } from "./AirportCombobox";
import { AirlineCombobox } from "./AirlineCombobox";
import { Plane, Plus, Trash2 } from "lucide-react";

export interface FlightSegment {
  departure: string;
  arrival: string;
  airline: string;
  airline_name: string;
  flight_number: string;
  date?: string;
  departure_time?: string;
  arrival_time?: string;
}

export const emptySegment = (): FlightSegment => ({
  departure: "",
  arrival: "",
  airline: "",
  airline_name: "",
  flight_number: "",
  departure_time: "",
  arrival_time: "",
});

interface FlightSegmentRowProps {
  segment: FlightSegment;
  index: number;
  canRemove: boolean;
  onUpdate: (index: number, field: keyof FlightSegment, value: string) => void;
  onBatchUpdate: (index: number, fields: Partial<FlightSegment>) => void;
  onRemove: (index: number) => void;
}

const FlightSegmentRow = ({ segment, index, canRemove, onUpdate, onBatchUpdate, onRemove }: FlightSegmentRowProps) => (
  <div className="space-y-2 p-3 border rounded bg-background/50 relative">
    {canRemove && (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute top-1 right-1 h-6 w-6 p-0"
        onClick={() => onRemove(index)}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    )}
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1">
        <Label className="text-xs">Odkud {index === 0 ? '*' : ''}</Label>
        <AirportCombobox
          value={segment.departure}
          onSelect={(iata) => onUpdate(index, "departure", iata)}
          placeholder="Letiště..."
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Kam {index === 0 ? '*' : ''}</Label>
        <AirportCombobox
          value={segment.arrival}
          onSelect={(iata) => onUpdate(index, "arrival", iata)}
          placeholder="Letiště..."
        />
      </div>
    </div>
    <div className="grid grid-cols-4 gap-2">
      <div className="space-y-1">
        <Label className="text-xs">Letecká spol.</Label>
        <AirlineCombobox
          value={segment.airline}
          onSelect={(code, name) => {
            onBatchUpdate(index, { airline: code, airline_name: name });
          }}
          placeholder="Vyberte..."
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Číslo letu</Label>
        <Input
          value={segment.flight_number}
          onChange={(e) => onUpdate(index, "flight_number", e.target.value)}
          placeholder="W64600"
          className="h-9"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Odlet</Label>
        <Input
          value={segment.departure_time || ""}
          onChange={(e) => onUpdate(index, "departure_time", e.target.value)}
          placeholder="18:25"
          className="h-9"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Přílet</Label>
        <Input
          value={segment.arrival_time || ""}
          onChange={(e) => onUpdate(index, "arrival_time", e.target.value)}
          placeholder="22:50"
          className="h-9"
        />
      </div>
    </div>
  </div>
);

export interface FlightFormData {
  outbound_segments: FlightSegment[];
  return_segments: FlightSegment[];
  is_one_way: boolean;
}

interface FlightSegmentFormProps {
  data: FlightFormData;
  onChange: (data: FlightFormData) => void;
  /** Auto-fill return arrival from first outbound departure */
  autoFillReturn?: boolean;
}

export const FlightSegmentForm = ({ data, onChange, autoFillReturn = true }: FlightSegmentFormProps) => {
  const { outbound_segments, return_segments, is_one_way } = data;

  const applyAutoFill = (newData: FlightFormData, index: number, fields: Partial<FlightSegment>) => {
    if (autoFillReturn && index === 0 && !is_one_way) {
      if (fields.departure && !return_segments[return_segments.length - 1]?.arrival) {
        const lastReturn = { ...return_segments[return_segments.length - 1], arrival: fields.departure };
        newData.return_segments = return_segments.map((s, i) => i === return_segments.length - 1 ? lastReturn : s);
      }
      if (fields.arrival && !return_segments[0]?.departure) {
        const firstReturn = { ...return_segments[0], departure: fields.arrival };
        newData.return_segments = return_segments.map((s, i) => i === 0 ? firstReturn : s);
      }
      if (fields.airline && !return_segments[0]?.airline) {
        const returnFields: Partial<FlightSegment> = { airline: fields.airline };
        if (fields.airline_name) returnFields.airline_name = fields.airline_name;
        const firstReturn = { ...return_segments[0], ...returnFields };
        newData.return_segments = return_segments.map((s, i) => i === 0 ? firstReturn : s);
      }
    }
  };

  const updateOutbound = (index: number, field: keyof FlightSegment, value: string) => {
    const updated = outbound_segments.map((seg, i) =>
      i === index ? { ...seg, [field]: value } : seg
    );
    const newData: FlightFormData = { ...data, outbound_segments: updated };
    applyAutoFill(newData, index, { [field]: value });
    onChange(newData);
  };

  const batchUpdateOutbound = (index: number, fields: Partial<FlightSegment>) => {
    const updated = outbound_segments.map((seg, i) =>
      i === index ? { ...seg, ...fields } : seg
    );
    const newData: FlightFormData = { ...data, outbound_segments: updated };
    applyAutoFill(newData, index, fields);
    onChange(newData);
  };

  const updateReturn = (index: number, field: keyof FlightSegment, value: string) => {
    const updated = return_segments.map((seg, i) =>
      i === index ? { ...seg, [field]: value } : seg
    );
    onChange({ ...data, return_segments: updated });
  };

  const batchUpdateReturn = (index: number, fields: Partial<FlightSegment>) => {
    const updated = return_segments.map((seg, i) =>
      i === index ? { ...seg, ...fields } : seg
    );
    onChange({ ...data, return_segments: updated });
  };

  const addOutbound = () => onChange({ ...data, outbound_segments: [...outbound_segments, emptySegment()] });
  const addReturn = () => onChange({ ...data, return_segments: [...return_segments, emptySegment()] });

  const removeOutbound = (index: number) => {
    if (outbound_segments.length > 1) {
      onChange({ ...data, outbound_segments: outbound_segments.filter((_, i) => i !== index) });
    }
  };
  const removeReturn = (index: number) => {
    if (return_segments.length > 1) {
      onChange({ ...data, return_segments: return_segments.filter((_, i) => i !== index) });
    }
  };

  const toggleOneWay = (checked: boolean) => {
    onChange({
      ...data,
      is_one_way: checked,
      return_segments: checked ? [emptySegment()] : data.return_segments,
    });
  };

  return (
    <>
      {/* Outbound */}
      <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Plane className="h-4 w-4" />
            Odletový let
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={addOutbound} className="h-7 text-xs gap-1">
            <Plus className="h-3 w-3" /> Segment
          </Button>
        </div>
        {outbound_segments.map((seg, idx) => (
          <FlightSegmentRow
            key={idx}
            segment={seg}
            index={idx}
            canRemove={outbound_segments.length > 1}
            onUpdate={updateOutbound}
            onBatchUpdate={batchUpdateOutbound}
            onRemove={removeOutbound}
          />
        ))}
      </div>

      {/* One-way checkbox */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="is_one_way"
          checked={is_one_way}
          onCheckedChange={(checked) => toggleOneWay(!!checked)}
        />
        <Label htmlFor="is_one_way" className="text-sm cursor-pointer">
          Jednosměrná letenka (bez zpátečního letu)
        </Label>
      </div>

      {/* Return */}
      {!is_one_way && (
        <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Plane className="h-4 w-4 rotate-180" />
              Zpáteční let
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={addReturn} className="h-7 text-xs gap-1">
              <Plus className="h-3 w-3" /> Segment
            </Button>
          </div>
          {return_segments.map((seg, idx) => (
            <FlightSegmentRow
              key={idx}
              segment={seg}
              index={idx}
              canRemove={return_segments.length > 1}
              onUpdate={updateReturn}
              onBatchUpdate={batchUpdateReturn}
              onRemove={removeReturn}
            />
          ))}
        </div>
      )}
    </>
  );
};
