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
import { GripVertical, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageToolbar } from "@/hooks/usePageToolbar";

const STORAGE_KEY = "yaro-dashboard-order";

interface TileDef {
  id: string;
  component: ReactNode;
}

const DEFAULT_ORDER = [
  "bank_notifications",
  "tasks",
  "stats",
  "overdue",
  "deals",
  "vouchers",
  "contracts",
];

const TILE_COMPONENTS: Record<string, ReactNode> = {
  bank_notifications: <BankNotificationsCard />,
  tasks: <TasksCard />,
  stats: <StatsCard />,
  overdue: <OverduePaymentsCard />,
  deals: <RecentDealsCard />,
  vouchers: <RecentVouchersCard />,
  contracts: <RecentContractsCard />,
};

function loadOrder(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as string[];
      // Ensure all tiles are present
      const valid = parsed.filter((id) => DEFAULT_ORDER.includes(id));
      const missing = DEFAULT_ORDER.filter((id) => !valid.includes(id));
      return [...valid, ...missing];
    }
  } catch {
    // ignore
  }
  return DEFAULT_ORDER;
}

function SortableTile({ id, children, editing }: { id: string; children: ReactNode; editing: boolean }) {
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
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={`relative ${editing ? "ring-2 ring-primary/30 rounded-lg" : ""}`}>
      {editing && (
        <button
          {...attributes}
          {...listeners}
          className="absolute top-2 right-2 z-10 p-1 rounded-md bg-muted/80 cursor-grab active:cursor-grabbing"
          aria-label="Přesunout dlaždici"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
      {children}
    </div>
  );
}

const Index = () => {
  const [order, setOrder] = useState<string[]>(loadOrder);
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

  return (
    <div className="min-h-full bg-[var(--gradient-subtle)]">
      <div className="container max-w-7xl mx-auto py-6 px-4 space-y-6">

        {/* Draggable tiles */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={order} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {order.map((id) => (
                <SortableTile key={id} id={id} editing={editing}>
                  <div className="aspect-square [&>div]:h-full [&>div]:flex [&>div]:flex-col [&>div>div:last-child]:flex-1 [&>div>div:last-child]:overflow-y-auto">
                    {TILE_COMPONENTS[id]}
                  </div>
                </SortableTile>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
};

export default Index;
