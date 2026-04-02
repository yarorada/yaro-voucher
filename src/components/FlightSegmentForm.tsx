import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AirportCombobox } from "./AirportCombobox";
import { AirlineCombobox } from "./AirlineCombobox";
import { Plane, Plus, Trash2, Briefcase, Luggage, BaggageClaim } from "lucide-react";
import golfBagIcon from "@/assets/golf-bag.png";

/** Input pro čas s auto-formátováním HHMM → HH:MM */
const TimeInput = ({
  value,
  onChange,
  placeholder = "HH:MM",
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
    if (raw.length === 0) { onChange(""); return; }
    if (raw.length >= 3) {
      onChange(raw.slice(0, 2) + ":" + raw.slice(2, 4));
    } else {
      onChange(raw);
    }
  };
  return (
    <Input
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      className="h-9"
    />
  );
};

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
        <TimeInput
          value={segment.departure_time || ""}
          onChange={(val) => onUpdate(index, "departure_time", val)}
          placeholder="18:25"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Přílet</Label>
        <TimeInput
          value={segment.arrival_time || ""}
          onChange={(val) => onUpdate(index, "arrival_time", val)}
          placeholder="22:50"
        />
      </div>
    </div>
  </div>
);

export interface BaggageItem {
  included: boolean;
  kg?: number;
  count?: number;
}

export interface FlightFormData {
  outbound_segments: FlightSegment[];
  return_segments: FlightSegment[];
  is_one_way: boolean;
  baggage?: {
    cabin_bag?: BaggageItem;
    hand_luggage?: BaggageItem;
    checked_luggage?: BaggageItem;
    golf_bag?: BaggageItem;
  };
}

interface FlightSegmentFormProps {
  data: FlightFormData;
  onChange: (data: FlightFormData) => void;
  /** Auto-fill return arrival from first outbound departure */
  autoFillReturn?: boolean;
}

export const FlightSegmentForm = ({ data, onChange, autoFillReturn = true }: FlightSegmentFormProps) => {
  const { outbound_segments, return_segments, is_one_way, baggage } = data;

  const updateBaggageIncluded = (field: keyof NonNullable<FlightFormData['baggage']>, included: boolean) => {
    const existing = baggage?.[field] || {};
    onChange({ ...data, baggage: { ...(baggage || {}), [field]: { ...existing, included } } });
  };

  const updateBaggageKg = (field: keyof NonNullable<FlightFormData['baggage']>, value: string) => {
    const num = value === "" ? undefined : Number(value);
    const existing = baggage?.[field] || { included: true };
    onChange({ ...data, baggage: { ...(baggage || {}), [field]: { ...existing, kg: num } } });
  };

  const updateBaggageCount = (field: keyof NonNullable<FlightFormData['baggage']>, value: string) => {
    const num = value === "" ? undefined : Number(value);
    const existing = baggage?.[field] || { included: true };
    onChange({ ...data, baggage: { ...(baggage || {}), [field]: { ...existing, count: num } } });
  };

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

      {/* Zavazadla */}
      <div className="p-4 border rounded-lg bg-blue-50/30 dark:bg-blue-950/20 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
          <Luggage className="h-4 w-4" /> Zavazadla
        </div>
        <div className="grid grid-cols-4 gap-3">
          {/* Taška na palubu */}
          {(() => {
            const item = baggage?.cabin_bag;
            const included = item?.included ?? false;
            return (
              <div className={`flex flex-col items-center gap-1 p-2 border rounded bg-background transition-colors ${included ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-950/30' : 'border-border'}`}>
                <Briefcase className={`h-6 w-6 ${included ? 'text-blue-500' : 'text-muted-foreground'}`} />
                <span className="text-xs text-center leading-tight font-medium">Taška na palubu</span>
                <label className="flex items-center gap-1 cursor-pointer mt-0.5">
                  <Checkbox checked={included} onCheckedChange={(c) => updateBaggageIncluded("cabin_bag", !!c)} />
                  <span className="text-xs">V ceně</span>
                </label>
                {included && (
                  <>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Input type="number" min={1} value={item?.count ?? ""} onChange={(e) => updateBaggageCount("cabin_bag", e.target.value)} placeholder="1" className="w-10 h-7 text-center text-xs p-1" />
                      <span className="text-xs text-muted-foreground">ks</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input type="number" min={0} value={item?.kg ?? ""} onChange={(e) => updateBaggageKg("cabin_bag", e.target.value)} placeholder="–" className="w-14 h-7 text-center text-xs p-1" />
                      <span className="text-xs text-muted-foreground">kg</span>
                    </div>
                  </>
                )}
              </div>
            );
          })()}
          {/* Palubní zavazadlo */}
          {(() => {
            const item = baggage?.hand_luggage;
            const included = item?.included ?? false;
            return (
              <div className={`flex flex-col items-center gap-1 p-2 border rounded bg-background transition-colors ${included ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-950/30' : 'border-border'}`}>
                <Luggage className={`h-6 w-6 ${included ? 'text-blue-500' : 'text-muted-foreground'}`} />
                <span className="text-xs text-center leading-tight font-medium">Palubní zavazadlo</span>
                <label className="flex items-center gap-1 cursor-pointer mt-0.5">
                  <Checkbox checked={included} onCheckedChange={(c) => updateBaggageIncluded("hand_luggage", !!c)} />
                  <span className="text-xs">V ceně</span>
                </label>
                {included && (
                  <>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Input type="number" min={1} value={item?.count ?? ""} onChange={(e) => updateBaggageCount("hand_luggage", e.target.value)} placeholder="1" className="w-10 h-7 text-center text-xs p-1" />
                      <span className="text-xs text-muted-foreground">ks</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input type="number" min={0} value={item?.kg ?? ""} onChange={(e) => updateBaggageKg("hand_luggage", e.target.value)} placeholder="–" className="w-14 h-7 text-center text-xs p-1" />
                      <span className="text-xs text-muted-foreground">kg</span>
                    </div>
                  </>
                )}
              </div>
            );
          })()}
          {/* Odbavené zavazadlo */}
          {(() => {
            const item = baggage?.checked_luggage;
            const included = item?.included ?? false;
            return (
              <div className={`flex flex-col items-center gap-1 p-2 border rounded bg-background transition-colors ${included ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-950/30' : 'border-border'}`}>
                <BaggageClaim className={`h-6 w-6 ${included ? 'text-blue-500' : 'text-muted-foreground'}`} />
                <span className="text-xs text-center leading-tight font-medium">Odbavené zavazadlo</span>
                <label className="flex items-center gap-1 cursor-pointer mt-0.5">
                  <Checkbox checked={included} onCheckedChange={(c) => updateBaggageIncluded("checked_luggage", !!c)} />
                  <span className="text-xs">V ceně</span>
                </label>
                {included && (
                  <>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Input type="number" min={1} value={item?.count ?? ""} onChange={(e) => updateBaggageCount("checked_luggage", e.target.value)} placeholder="1" className="w-10 h-7 text-center text-xs p-1" />
                      <span className="text-xs text-muted-foreground">ks</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input type="number" min={0} value={item?.kg ?? ""} onChange={(e) => updateBaggageKg("checked_luggage", e.target.value)} placeholder="–" className="w-14 h-7 text-center text-xs p-1" />
                      <span className="text-xs text-muted-foreground">kg</span>
                    </div>
                  </>
                )}
              </div>
            );
          })()}
          {/* Golfový bag */}
          {(() => {
            const item = baggage?.golf_bag;
            const included = item?.included ?? false;
            return (
              <div className={`flex flex-col items-center gap-1 p-2 border rounded bg-background transition-colors ${included ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-950/30' : 'border-border'}`}>
                <img src={golfBagIcon} alt="Golf bag" className={`h-6 w-6 dark:invert ${included ? 'opacity-100' : 'opacity-40'}`} />
                <span className="text-xs text-center leading-tight font-medium">Golfový bag</span>
                <label className="flex items-center gap-1 cursor-pointer mt-0.5">
                  <Checkbox checked={included} onCheckedChange={(c) => updateBaggageIncluded("golf_bag", !!c)} />
                  <span className="text-xs">V ceně</span>
                </label>
                {included && (
                  <>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Input type="number" min={1} value={item?.count ?? ""} onChange={(e) => updateBaggageCount("golf_bag", e.target.value)} placeholder="1" className="w-10 h-7 text-center text-xs p-1" />
                      <span className="text-xs text-muted-foreground">ks</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input type="number" min={0} value={item?.kg ?? ""} onChange={(e) => updateBaggageKg("golf_bag", e.target.value)} placeholder="–" className="w-14 h-7 text-center text-xs p-1" />
                      <span className="text-xs text-muted-foreground">kg</span>
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </>
  );
};
