import { useState, useCallback, ReactNode } from "react";
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
import { GripVertical, Pencil, Check, Eye, EyeOff, Columns2, Rows2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageToolbar } from "@/hooks/usePageToolbar";

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

const TILE_LABELS: Record<string, string> = {
  bank_notifications: "Příchozí platby",
  tasks: "Úkoly",
  stats: "Statistiky",
  overdue: "Nezaplacené",
  deals: "Obchodní případy",
  vouchers: "Vouchery",
  contracts: "Smlouvy",
};

const TILE_COMPONENTS: Record<string, ReactNode> = {
  bank_notifications: <BankNotificationsCard />,
  tasks: <TasksCard />,
  stats: <StatsCard />,
  overdue: <OverduePaymentsCard />,
  deals: <RecentDealsCard />,
  vouchers: <RecentVouchersCard />,
  contracts: <RecentContractsCard />,
};

type TileSize = "1x1" | "2x1" | "1x2" | "2x2";

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

// Returns tailwind col/row span classes
function getSizeClasses(size: TileSize) {
  switch (size) {
    case "2x1": return "md:col-span-2";
    case "1x2": return "md:row-span-2";
    case "2x2": return "md:col-span-2 md:row-span-2";
    default:    return "";
  }
}

// Cycle through sizes
const SIZE_CYCLE: TileSize[] = ["1x1", "2x1", "1x2", "2x2"];

function nextSize(current: TileSize): TileSize {
  const idx = SIZE_CYCLE.indexOf(current);
  return SIZE_CYCLE[(idx + 1) % SIZE_CYCLE.length];
}

const SIZE_LABELS: Record<TileSize, string> = {
  "1x1": "1×1",
  "2x1": "2 sloupce",
  "1x2": "2 řádky",
  "2x2": "2×2",
};

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
  onChangeSize: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !editing });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : hidden ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${getSizeClasses(size)} ${editing ? "ring-2 ring-primary/30 rounded-lg" : ""}`}
    >
      {editing && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
          <button
            onClick={onChangeSize}
            className="p-1 rounded-md bg-muted/80 hover:bg-muted transition-colors flex items-center gap-0.5"
            aria-label="Změnit velikost dlaždice"
            title={`Velikost: ${SIZE_LABELS[size]} → ${SIZE_LABELS[nextSize(size)]}`}
          >
            {(size === "2x1" || size === "2x2") ? (
              <Columns2 className="h-4 w-4 text-primary" />
            ) : (
              <Columns2 className="h-4 w-4 text-muted-foreground" />
            )}
            {(size === "1x2" || size === "2x2") ? (
              <Rows2 className="h-4 w-4 text-primary" />
            ) : (
              <Rows2 className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
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

const Index = () => {
  const [order, setOrder] = useState<string[]>(loadOrder);
  const [hiddenTiles, setHiddenTiles] = useState<string[]>(loadHidden);
  const [tileSizes, setTileSizes] = useState<Record<string, TileSize>>(loadSizes);
  const [editing, setEditing] = useState(false);

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

  const changeTileSize = useCallback((tileId: string) => {
    setTileSizes((prev) => {
      const current: TileSize = prev[tileId] ?? "1x1";
      const next = { ...prev, [tileId]: nextSize(current) };
      saveSizes(next);
      return next;
    });
  }, []);

  // In edit mode show all tiles; otherwise filter out hidden ones
  const visibleOrder = editing
    ? order
    : order.filter((id) => !hiddenTiles.includes(id));

  return (
    <div className="min-h-full bg-[var(--gradient-subtle)]">
      <div className="container max-w-7xl mx-auto py-6 px-4 space-y-6">

        {/* Draggable tiles */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={visibleOrder} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
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
                    onChangeSize={() => changeTileSize(id)}
                  >
                    <div className="aspect-square [&>div]:h-full [&>div]:flex [&>div]:flex-col [&>div>div:last-child]:flex-1 [&>div>div:last-child]:overflow-y-auto">
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
