import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { removeDiacritics } from "@/lib/utils";
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
import { Plus, Trash2, BedDouble, Save, Users, X, FileDown, Send, Loader2, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import html2pdf from "html2pdf.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Traveler {
  id: string;
  client_id: string;
  is_lead_traveler: boolean;
  clients: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    title: string | null;
    date_of_birth: string | null;
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
  { value: "DBL", label: "DBL – Double (manželská postel)" },
  { value: "TWN", label: "TWN – Twin (dvě oddělené postele)" },
  { value: "SGL", label: "SGL – Single" },
  { value: "TRPL", label: "TRPL – Triple" },
  { value: "SUITE", label: "Suite" },
  { value: "FAM", label: "FAM – Family" },
  { value: "OTHER", label: "Jiný" },
];

// Sortable room wrapper component
function SortableRoomItem({ room, index, children }: { room: RoomAssignment; index: number; children: (dragHandle: React.ReactNode) => React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: room.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const dragHandle = (
    <button
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground touch-none flex-shrink-0 mt-4 p-1 rounded hover:bg-muted"
      title="Přetáhněte pro změnu pořadí"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );

  return (
    <div ref={setNodeRef} style={style}>
      {children(dragHandle)}
    </div>
  );
}

export function DealRoomingList({ dealId, travelers }: DealRoomingListProps) {
  const [rooms, setRooms] = useState<RoomAssignment[]>([]);
  const [hotelRoomTypes, setHotelRoomTypes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [hotelSupplier, setHotelSupplier] = useState<{ name: string; email: string | null } | null>(null);
  const [dealInfo, setDealInfo] = useState<{ deal_number: string; start_date: string | null; end_date: string | null; hotel_name: string | null } | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setRooms((prev) => {
        const oldIndex = prev.findIndex((r) => r.id === active.id);
        const newIndex = prev.findIndex((r) => r.id === over.id);
        const reordered = arrayMove(prev, oldIndex, newIndex);
        return reordered.map((r, i) => ({ ...r, room_label: `Room ${i + 1}` }));
      });
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      const { data: dealData } = await supabase
        .from("deals")
        .select("rooming_list, deal_number, start_date, end_date")
        .eq("id", dealId)
        .single();

      if (dealData?.rooming_list && Array.isArray(dealData.rooming_list) && (dealData.rooming_list as any[]).length > 0) {
        setRooms(dealData.rooming_list as unknown as RoomAssignment[]);
      }

      if (dealData) {
        // Fetch hotel service for supplier info and hotel name
        const { data: servicesData } = await supabase
          .from("deal_services")
          .select("description, service_name, supplier_id, suppliers(name, email)")
          .eq("deal_id", dealId)
          .eq("service_type", "hotel");

        let hotelName: string | null = null;
        if (servicesData) {
          const types = servicesData
            .map((s) => s.description)
            .filter((d): d is string => !!d && d.trim() !== "");
          setHotelRoomTypes([...new Set(types)]);

          // Find hotel supplier
          const hotelWithSupplier = servicesData.find((s: any) => s.suppliers?.email);
          if (hotelWithSupplier) {
            const sup = hotelWithSupplier.suppliers as any;
            setHotelSupplier({ name: sup.name, email: sup.email });
          }
          hotelName = servicesData[0]?.service_name || null;
        }

        setDealInfo({
          deal_number: dealData.deal_number,
          start_date: dealData.start_date,
          end_date: dealData.end_date,
          hotel_name: hotelName,
        });
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
        room_label: `Room ${prev.length + 1}`,
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
          return {
            ...r,
            traveler_ids: r.traveler_ids.filter((id) => id !== clientId),
          };
        }
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

  const getAgeCategory = (dateOfBirth: string | null): "adult" | "child" | "infant" => {
    if (!dateOfBirth) return "adult";
    const today = new Date();
    const dob = new Date(dateOfBirth);
    const ageMs = today.getTime() - dob.getTime();
    const ageYears = ageMs / (1000 * 60 * 60 * 24 * 365.25);
    if (ageYears < 2) return "infant";
    if (ageYears < 12) return "child";
    return "adult";
  };

  const getAgeCategoryColor = (category: "adult" | "child" | "infant") => {
    if (category === "infant") return "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700";
    if (category === "child") return "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700";
    return "bg-primary/10 text-primary border-primary/20";
  };

  const TITLE_EN_MAP: Record<string, string> = {
    "Pan": "Mr.",
    "Paní": "Mrs.",
    "Slečna": "Miss",
    "Mr.": "Mr.",
    "Mrs.": "Mrs.",
    "Miss": "Miss",
    "Ms.": "Ms.",
    "Dr.": "Dr.",
    "Prof.": "Prof.",
  };

  const getTravelerLabel = (clientId: string, forPdf = false) => {
    const t = travelers.find((tr) => tr.client_id === clientId);
    if (!t) return "Neznámý";
    const { first_name, last_name, title, date_of_birth } = t.clients;
    const resolvedTitle = forPdf && title ? (TITLE_EN_MAP[title] ?? title) : title;
    const titleStr = resolvedTitle ? `${resolvedTitle} ` : "";
    const displayFirst = forPdf ? removeDiacritics(first_name) : first_name;
    const displayLast = forPdf ? removeDiacritics(last_name) : last_name;
    const dobStr = date_of_birth
      ? ` (${formatDate(date_of_birth)})`
      : "";
    return `${titleStr}${displayFirst} ${displayLast}${dobStr}`;
  };

  const getTravelerName = (clientId: string) => {
    const t = travelers.find((tr) => tr.client_id === clientId);
    if (!t) return "Neznámý";
    return `${t.clients.first_name} ${t.clients.last_name}`;
  };

  const getRoomTypeLabel = (value: string) => {
    const found = ROOM_TYPES.find((rt) => rt.value === value);
    return found ? found.label : value;
  };

  const getRoomTypeLabelEn = (value: string) => {
    const EN_ROOM_TYPES: Record<string, string> = {
      DBL: "DBL – Double (double bed)",
      TWN: "TWN – Twin (two single beds)",
      SGL: "SGL – Single",
      TRPL: "TRPL – Triple",
      SUITE: "Suite",
      FAM: "FAM – Family",
      OTHER: "Other",
    };
    return EN_ROOM_TYPES[value] || value;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
  };

  // Generate PDF blob
  const generatePdfBlob = async (): Promise<Blob> => {
    const el = pdfRef.current;
    if (!el) throw new Error("PDF element not found");

    const opt = {
      margin: [10, 15, 10, 15] as [number, number, number, number],
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
    };

    return await html2pdf().set(opt).from(el).outputPdf('blob');
  };

  const handleDownloadPdf = async () => {
    try {
      const blob = await generatePdfBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rooming-list-${dealInfo?.deal_number || dealId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF staženo");
    } catch (e) {
      console.error("PDF generation error:", e);
      toast.error("Chyba při generování PDF");
    }
  };

  const handleSendToSupplier = async () => {
    if (!hotelSupplier?.email) {
      toast.error("Dodavatel ubytování nemá vyplněný e-mail");
      return;
    }

    setSending(true);
    try {
      // First save the rooming list
      await supabase.from("deals").update({ rooming_list: rooms as any }).eq("id", dealId);

      // Generate PDF
      const pdfBlob = await generatePdfBlob();
      const fileName = `rooming-list-${dealInfo?.deal_number || dealId}-${Date.now()}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("voucher-pdfs")
        .upload(fileName, pdfBlob, { contentType: "application/pdf" });

      if (uploadError) {
        toast.error("Chyba při nahrávání PDF");
        return;
      }

      // Send via edge function
      const { data, error } = await supabase.functions.invoke("send-rooming-list-email", {
        body: {
          dealId,
          pdfPath: fileName,
          supplierEmail: hotelSupplier.email,
          supplierName: hotelSupplier.name,
          hotelName: dealInfo?.hotel_name || "",
          dealNumber: dealInfo?.deal_number || "",
          dateFrom: dealInfo?.start_date || "",
          dateTo: dealInfo?.end_date || "",
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Rooming list odeslán na: ${hotelSupplier.email}`);
        setSendDialogOpen(false);
      } else {
        toast.error(data?.error || "Chyba při odesílání");
      }
    } catch (err: any) {
      console.error("Error sending rooming list:", err);
      toast.error("Chyba při odesílání rooming listu");
    } finally {
      setSending(false);
    }
  };

  const assignedIds = new Set(rooms.flatMap((r) => r.traveler_ids));
  const unassignedTravelers = travelers.filter(
    (t) => !assignedIds.has(t.client_id)
  );

  const allRoomTypes = [
    ...hotelRoomTypes.map((t) => ({ value: t, label: t })),
    ...ROOM_TYPES.filter(
      (rt) => !hotelRoomTypes.some((h) => h.toLowerCase() === rt.value.toLowerCase())
    ),
  ];

  if (!loaded) return null;

  return (
    <>
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
            <div className="flex gap-2 flex-wrap">
              {rooms.length > 0 && (
                <>
                  <Button size="sm" variant="outline" onClick={handleDownloadPdf}>
                    <FileDown className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">PDF</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSendDialogOpen(true)}
                    disabled={!hotelSupplier?.email}
                    title={!hotelSupplier?.email ? "Dodavatel ubytování nemá e-mail" : `Odeslat na ${hotelSupplier.email}`}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Odeslat</span>
                  </Button>
                </>
              )}
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
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={rooms.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {rooms.map((room, index) => (
                    <SortableRoomItem key={room.id} room={room} index={index}>
                      {(dragHandle) => (
                        <div className="border rounded-lg p-3 space-y-3">
                          <div className="flex items-center gap-2">
                            {dragHandle}
                            <div className="flex-1 grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs text-muted-foreground">Název</Label>
                                <Input
                                  value={room.room_label}
                                  onChange={(e) =>
                                    updateRoom(room.id, { room_label: e.target.value })
                                  }
                                  className="h-8 text-sm"
                                  placeholder={`Room ${index + 1}`}
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
                              {room.traveler_ids.map((clientId) => {
                                const t = travelers.find((tr) => tr.client_id === clientId);
                                const category = getAgeCategory(t?.clients.date_of_birth || null);
                                return (
                                  <span
                                    key={clientId}
                                    className={`inline-flex items-center gap-1 text-xs border px-2 py-1 rounded-full cursor-pointer hover:opacity-80 transition-opacity ${getAgeCategoryColor(category)}`}
                                    onClick={() => toggleTravelerInRoom(room.id, clientId)}
                                    title="Klikněte pro odebrání"
                                  >
                                    {getTravelerLabel(clientId)}
                                    <X className="h-3 w-3" />
                                  </span>
                                );
                              })}
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
                      )}
                    </SortableRoomItem>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
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

      {/* Hidden PDF content for generation */}
      <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
        <div ref={pdfRef} style={{ width: "700px", padding: "30px", fontFamily: "Arial, sans-serif", color: "#000", background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", borderBottom: "2px solid #333", paddingBottom: "15px" }}>
            <div>
              <h1 style={{ fontSize: "22px", fontWeight: "bold", margin: "0 0 4px 0" }}>Rooming List</h1>
              <p style={{ fontSize: "12px", color: "#555", margin: 0 }}>
                {dealInfo?.deal_number}
              </p>
            </div>
            <div style={{ textAlign: "right", fontSize: "11px", color: "#555" }}>
              <p style={{ margin: "0 0 2px 0", fontWeight: "bold" }}>YARO s.r.o.</p>
              <p style={{ margin: 0 }}>zajezdy@yarotravel.cz</p>
            </div>
          </div>

          {dealInfo?.hotel_name && (
            <p style={{ fontSize: "14px", marginBottom: "4px" }}>
              <strong>Hotel:</strong> {dealInfo.hotel_name}
            </p>
          )}
          {(dealInfo?.start_date || dealInfo?.end_date) && (
            <p style={{ fontSize: "12px", marginBottom: "16px", color: "#555" }}>
              <strong>Dates:</strong> {formatDate(dealInfo?.start_date || null)} – {formatDate(dealInfo?.end_date || null)}
            </p>
          )}

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ background: "#f0f0f0" }}>
                <th style={{ border: "1px solid #ccc", padding: "8px", textAlign: "left" }}>Room</th>
                <th style={{ border: "1px solid #ccc", padding: "8px", textAlign: "left" }}>Type</th>
                <th style={{ border: "1px solid #ccc", padding: "8px", textAlign: "left" }}>Guests</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id}>
                  <td style={{ border: "1px solid #ccc", padding: "8px", fontWeight: "bold" }}>{room.room_label}</td>
                  <td style={{ border: "1px solid #ccc", padding: "8px" }}>{getRoomTypeLabelEn(room.room_type)}</td>
                  <td style={{ border: "1px solid #ccc", padding: "8px" }}>
                    {room.traveler_ids.length > 0
                      ? room.traveler_ids.map((id) => {
                          const t = travelers.find((tr) => tr.client_id === id);
                          const cat = getAgeCategory(t?.clients.date_of_birth || null);
                          const color = cat === "infant" ? "#16a34a" : cat === "child" ? "#2563eb" : "#111";
                          return (
                            <span key={id} style={{ color, display: "block" }}>
                              {getTravelerLabel(id, true)}
                            </span>
                          );
                        })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: "12px", fontSize: "10px", color: "#555" }}>
            <span style={{ marginRight: "16px" }}>&#9632; <span style={{ color: "#111" }}>Adult</span></span>
            <span style={{ marginRight: "16px" }}>&#9632; <span style={{ color: "#2563eb" }}>Child (under 12)</span></span>
            <span>&#9632; <span style={{ color: "#16a34a" }}>Infant (under 2)</span></span>
          </div>

          <p style={{ fontSize: "10px", color: "#999", marginTop: "12px" }}>
            Generated: {new Date().toLocaleDateString("en-GB")}
          </p>
        </div>
      </div>

      {/* Send Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-md bg-background">
          <DialogHeader>
            <DialogTitle>Odeslat rooming list dodavateli</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">Příjemce</Label>
              <p className="text-sm font-medium">
                {hotelSupplier?.name} – {hotelSupplier?.email}
              </p>
            </div>
            {dealInfo?.hotel_name && (
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">Hotel</Label>
                <p className="text-sm">{dealInfo.hotel_name}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Rooming list bude odeslán jako PDF příloha.
            </p>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setSendDialogOpen(false)} disabled={sending}>
              Zrušit
            </Button>
            <Button onClick={handleSendToSupplier} disabled={sending}>
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Odesílám...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Odeslat
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
