import { useState, useCallback, ReactNode, useRef, useMemo } from "react";
import { TasksCard } from "@/components/dashboard/TasksCard";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { OverduePaymentsCard } from "@/components/dashboard/OverduePaymentsCard";
import { RecentDealsCard } from "@/components/dashboard/RecentDealsCard";
import { RecentVouchersCard } from "@/components/dashboard/RecentVouchersCard";
import { RecentContractsCard } from "@/components/dashboard/RecentContractsCard";
import { BankNotificationsCard } from "@/components/dashboard/BankNotificationsCard";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Check, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageToolbar } from "@/hooks/usePageToolbar";
import { useUserPermissions } from "@/hooks/useUserPermissions";

const STORAGE_KEY = "yaro-dashboard-order";
const HIDDEN_KEY = "yaro-dashboard-hidden";
const SIZES_KEY = "yaro-dashboard-sizes";

const DEFAULT_ORDER = [
  "bank_notifications",
  "tasks",
  "stats",
  "overdue",
  "deals",
  "vouchers",
  "contracts",
];

type TileSize = "1x1" | "2x1" | "1x2" | "2x2";

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function loadOrder(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as string[];
      const valid = parsed.filter((id) => DEFAULT_ORDER.includes(id));
      const missing = DEFAULT_ORDER.filter((id) => !valid.includes(id));
      return [...valid, ...missing];
    }
  } catch { /* ignore */ }
  return DEFAULT_ORDER;
}

function loadHidden(): string[] {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch { /* ignore */ }
  return [];
}

function loadSizes(): Record<string, TileSize> {
  try {
    const raw = localStorage.getItem(SIZES_KEY);
    if (raw) return JSON.parse(raw) as Record<string, TileSize>;
  } catch { /* ignore */ }
  return {};
}

function saveSizes(sizes: Record<string, TileSize>) {
  localStorage.setItem(SIZES_KEY, JSON.stringify(sizes));
}

function getSizeClasses(size: TileSize): string {
  switch (size) {
    case "2x1": return "md:col-span-2";
    case "1x2": return "md:row-span-2";
    case "2x2": return "md:col-span-2 md:row-span-2";
    default:    return "";
  }
}

// ──────────────────────────────────────────────────────────
// Drag-to-resize handle (bottom-right corner)
// ──────────────────────────────────────────────────────────
function ResizeHandle({
  currentSize,
  onSizeChange,
  tileRef,
}: {
  currentSize: TileSize;
  onSizeChange: (size: TileSize) => void;
  tileRef: React.RefObject<HTMLDivElement>;
}) {
  const origin = useRef<{
    startX: number;
    startY: number;
    startCols: number;
    startRows: number;
    colUnit: number;
    rowUnit: number;
  } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!tileRef.current) return;
    const rect = tileRef.current.getBoundingClientRect();
    const startCols = currentSize === "2x1" || currentSize === "2x2" ? 2 : 1;
    const startRows = currentSize === "1x2" || currentSize === "2x2" ? 2 : 1;
    origin.current = {
      startX: e.clientX,
      startY: e.clientY,
      startCols,
      startRows,
      colUnit: rect.width / startCols,
      rowUnit: rect.height / startRows,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!origin.current) return;
    const { startX, startY, startCols, startRows, colUnit, rowUnit } = origin.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const targetW = colUnit * startCols + dx;
    const targetH = rowUnit * startRows + dy;
    const newCols = clamp(Math.round(targetW / colUnit), 1, 2);
    const newRows = clamp(Math.round(targetH / rowUnit), 1, 2);
    const newSize: TileSize =
      newCols === 2 && newRows === 2 ? "2x2" :
      newCols === 2 ? "2x1" :
      newRows === 2 ? "1x2" : "1x1";
    if (newSize !== currentSize) onSizeChange(newSize);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    origin.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  return (
    <div
      className="absolute bottom-1.5 right-1.5 w-5 h-5 cursor-se-resize z-20 flex items-center justify-center rounded bg-muted/90 hover:bg-primary/20 border border-border/60 transition-colors select-none"
      title="Táhněte pro změnu velikosti"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* 3-dot resize icon */}
      <svg width="10" height="10" viewBox="0 0 10 10" className="fill-muted-foreground">
        <circle cx="8.5" cy="8.5" r="1.3" />
        <circle cx="4.5" cy="8.5" r="1.3" />
        <circle cx="8.5" cy="4.5" r="1.3" />
      </svg>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Sortable tile wrapper
// ──────────────────────────────────────────────────────────
function SortableTile({
  id,
  children,
  editing,
  hidden,
  size,
  onToggleVisibility,
  onChangeSize,
}: {
  id: string;
  children: ReactNode;
  editing: boolean;
  hidden: boolean;
  size: TileSize;
  onToggleVisibility: () => void;
  onChangeSize: (size: TileSize) => void;
}) {
  const tileRef = useRef<HTMLDivElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !editing });

  // Combine dnd-kit ref with our tileRef
  const setRefs = useCallback((node: HTMLDivElement | null) => {
    (tileRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    setNodeRef(node);
  }, [setNodeRef]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : hidden ? 0.4 : 1,
  };

  return (
    <div
      ref={setRefs}
      style={style}
      className={`relative ${getSizeClasses(size)} ${editing ? "ring-2 ring-primary/30 rounded-lg" : ""}`}
    >
      {editing && (
        <>
          {/* Top-right controls: visibility + drag handle */}
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
            <button
              onClick={onToggleVisibility}
              className="p-1 rounded-md bg-muted/80 hover:bg-muted transition-colors"
              aria-label={hidden ? "Zobrazit dlaždici" : "Skrýt dlaždici"}
            >
              {hidden ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            <button
              {...attributes}
              {...listeners}
              className="p-1 rounded-md bg-muted/80 cursor-grab active:cursor-grabbing"
              aria-label="Přesunout dlaždici"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Bottom-right resize handle */}
          <ResizeHandle
            currentSize={size}
            onSizeChange={onChangeSize}
            tileRef={tileRef}
          />
        </>
      )}

      {editing && hidden && (
        <div className="absolute inset-0 z-[5] rounded-lg bg-background/60 flex items-center justify-center pointer-events-none">
          <span className="text-sm font-medium text-muted-foreground">Skryto</span>
        </div>
      )}
      {children}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Main dashboard
// ──────────────────────────────────────────────────────────
const Index = () => {
  const [order, setOrder] = useState<string[]>(loadOrder);
  const [hiddenTiles, setHiddenTiles] = useState<string[]>(loadHidden);
  const [tileSizes, setTileSizes] = useState<Record<string, TileSize>>(loadSizes);
  const [editing, setEditing] = useState(false);
  const { canAccess } = useUserPermissions();

  const TILE_COMPONENTS = useMemo<Record<string, ReactNode>>(() => ({
    bank_notifications: <BankNotificationsCard />,
    tasks: <TasksCard />,
    stats: canAccess("statistics") ? <StatsCard /> : null,
    overdue: <OverduePaymentsCard />,
    deals: <RecentDealsCard />,
    vouchers: <RecentVouchersCard />,
    contracts: <RecentContractsCard />,
  }), [canAccess]);

  const toolbarButtonClass = "h-8 text-xs bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20";

  usePageToolbar(
    <Button
      variant={editing ? "default" : "outline"}
      size="sm"
      className={editing ? "h-8 text-xs gap-1" : toolbarButtonClass + " gap-1"}
      onClick={() => setEditing((e) => !e)}
    >
      {editing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
      {editing ? "Hotovo" : "Upravit plochu"}
    </Button>,
    [editing]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      const next = arrayMove(prev, oldIndex, newIndex);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const toggleVisibility = useCallback((tileId: string) => {
    setHiddenTiles((prev) => {
      const next = prev.includes(tileId)
        ? prev.filter((id) => id !== tileId)
        : [...prev, tileId];
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const changeTileSize = useCallback((tileId: string, size: TileSize) => {
    setTileSizes((prev) => {
      const next = { ...prev, [tileId]: size };
      saveSizes(next);
      return next;
    });
  }, []);

  const visibleOrder = editing
    ? order.filter((id) => TILE_COMPONENTS[id] !== null)
    : order.filter((id) => !hiddenTiles.includes(id) && TILE_COMPONENTS[id] !== null);

  return (
    <div className="min-h-full bg-[var(--gradient-subtle)]">
      <div className="container max-w-7xl mx-auto py-6 px-4 space-y-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={visibleOrder} strategy={rectSortingStrategy}>
            <div
              className="grid grid-cols-1 md:grid-cols-3 gap-6 grid-flow-dense"
              style={{ gridAutoRows: "320px" }}
            >
              {visibleOrder.map((id) => {
                const size: TileSize = tileSizes[id] ?? "1x1";
                return (
                  <SortableTile
                    key={id}
                    id={id}
                    editing={editing}
                    hidden={hiddenTiles.includes(id)}
                    size={size}
                    onToggleVisibility={() => toggleVisibility(id)}
                    onChangeSize={(s) => changeTileSize(id, s)}
                  >
                    <div className="h-full [&>div]:h-full [&>div]:flex [&>div]:flex-col [&>div>div:last-child]:flex-1 [&>div>div:last-child]:overflow-y-auto">
                      {TILE_COMPONENTS[id]}
                    </div>
                  </SortableTile>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
};

export default Index;
