import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, BedDouble, Save, Users, X } from "lucide-react";
import { toast } from "sonner";

interface Traveler {
  id: string;
  client_id: string;
  is_lead_traveler: boolean;
  clients: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
  };
}

interface RoomAssignment {
  id: string;
  room_type: string;
  room_label: string;
  traveler_ids: string[];
}

interface DealRoomingListProps {
  dealId: string;
  travelers: Traveler[];
}

const ROOM_TYPES = [
  { value: "DBL", label: "DBL – Double" },
  { value: "TWN", label: "TWN – Twin" },
  { value: "SGL", label: "SGL – Single" },
  { value: "TRPL", label: "TRPL – Triple" },
  { value: "SUITE", label: "Suite" },
  { value: "FAM", label: "FAM – Family" },
  { value: "OTHER", label: "Jiný" },
];

export function DealRoomingList({ dealId, travelers }: DealRoomingListProps) {
  const [rooms, setRooms] = useState<RoomAssignment[]>([]);
  const [hotelRoomTypes, setHotelRoomTypes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Fetch existing rooming list + hotel service descriptions
  useEffect(() => {
    const fetchData = async () => {
      // Fetch deal rooming_list
      const { data: dealData } = await supabase
        .from("deals")
        .select("rooming_list")
        .eq("id", dealId)
        .single();

      if (dealData?.rooming_list && Array.isArray(dealData.rooming_list) && (dealData.rooming_list as any[]).length > 0) {
        setRooms(dealData.rooming_list as unknown as RoomAssignment[]);
      }

      // Fetch hotel service descriptions for room type suggestions
      const { data: servicesData } = await supabase
        .from("deal_services")
        .select("description")
        .eq("deal_id", dealId)
        .eq("service_type", "hotel");

      if (servicesData) {
        const types = servicesData
          .map((s) => s.description)
          .filter((d): d is string => !!d && d.trim() !== "");
        setHotelRoomTypes([...new Set(types)]);
      }

      setLoaded(true);
    };
    fetchData();
  }, [dealId]);

  const addRoom = () => {
    setRooms((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        room_type: hotelRoomTypes[0] || "DBL",
        room_label: `Pokoj ${prev.length + 1}`,
        traveler_ids: [],
      },
    ]);
  };

  const removeRoom = (roomId: string) => {
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
  };

  const updateRoom = (roomId: string, updates: Partial<RoomAssignment>) => {
    setRooms((prev) =>
      prev.map((r) => (r.id === roomId ? { ...r, ...updates } : r))
    );
  };

  const toggleTravelerInRoom = (roomId: string, clientId: string) => {
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id !== roomId) {
          // Remove from other rooms if added to this one
          return {
            ...r,
            traveler_ids: r.traveler_ids.filter((id) => id !== clientId),
          };
        }
        // Toggle in current room
        const has = r.traveler_ids.includes(clientId);
        return {
          ...r,
          traveler_ids: has
            ? r.traveler_ids.filter((id) => id !== clientId)
            : [...r.traveler_ids, clientId],
        };
      })
    );
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("deals")
      .update({ rooming_list: rooms as any })
      .eq("id", dealId);

    if (error) {
      console.error("Save rooming list error:", error);
      toast.error("Nepodařilo se uložit rooming list");
    } else {
      toast.success("Rooming list uložen");
    }
    setSaving(false);
  };

  // Get traveler name by client_id
  const getTravelerName = (clientId: string) => {
    const t = travelers.find((tr) => tr.client_id === clientId);
    if (!t) return "Neznámý";
    return `${t.clients.first_name} ${t.clients.last_name}`;
  };

  // Get unassigned travelers
  const assignedIds = new Set(rooms.flatMap((r) => r.traveler_ids));
  const unassignedTravelers = travelers.filter(
    (t) => !assignedIds.has(t.client_id)
  );

  // Combined room type options: from hotel services + standard types
  const allRoomTypes = [
    ...hotelRoomTypes.map((t) => ({ value: t, label: t })),
    ...ROOM_TYPES.filter(
      (rt) => !hotelRoomTypes.some((h) => h.toLowerCase() === rt.value.toLowerCase())
    ),
  ];

  if (!loaded) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BedDouble className="h-5 w-5" />
              Rooming list
            </CardTitle>
            <CardDescription>
              Přiřaďte cestující k pokojům
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={addRoom}>
              <Plus className="h-4 w-4 mr-1" />
              Pokoj
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />
              Uložit
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {rooms.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Zatím žádné pokoje. Klikněte na „Pokoj" pro přidání.
          </p>
        ) : (
          <div className="space-y-3">
            {rooms.map((room, index) => (
              <div
                key={room.id}
                className="border rounded-lg p-3 space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Název</Label>
                      <Input
                        value={room.room_label}
                        onChange={(e) =>
                          updateRoom(room.id, { room_label: e.target.value })
                        }
                        className="h-8 text-sm"
                        placeholder={`Pokoj ${index + 1}`}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Typ pokoje</Label>
                      <Select
                        value={room.room_type}
                        onValueChange={(v) =>
                          updateRoom(room.id, { room_type: v })
                        }
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {allRoomTypes.map((rt) => (
                            <SelectItem key={rt.value} value={rt.value}>
                              {rt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive flex-shrink-0 mt-4"
                    onClick={() => removeRoom(room.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Assigned travelers */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Cestující ({room.traveler_ids.length})
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {room.traveler_ids.map((clientId) => (
                      <span
                        key={clientId}
                        className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full cursor-pointer hover:bg-primary/20 transition-colors"
                        onClick={() => toggleTravelerInRoom(room.id, clientId)}
                        title="Klikněte pro odebrání"
                      >
                        {getTravelerName(clientId)}
                        <X className="h-3 w-3" />
                      </span>
                    ))}
                    {room.traveler_ids.length === 0 && (
                      <span className="text-xs text-muted-foreground italic">
                        Klikněte na cestujícího níže pro přiřazení
                      </span>
                    )}
                  </div>
                </div>

                {/* Available travelers to add */}
                {unassignedTravelers.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {unassignedTravelers.map((t) => (
                      <button
                        key={t.client_id}
                        className="text-xs px-2 py-1 rounded border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
                        onClick={() =>
                          toggleTravelerInRoom(room.id, t.client_id)
                        }
                      >
                        + {t.clients.first_name} {t.clients.last_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Summary: unassigned travelers */}
        {rooms.length > 0 && unassignedTravelers.length > 0 && (
          <div className="rounded-lg bg-muted border border-border p-3">
            <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Nepřiřazení cestující ({unassignedTravelers.length})
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {unassignedTravelers
                .map((t) => `${t.clients.first_name} ${t.clients.last_name}`)
                .join(", ")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
