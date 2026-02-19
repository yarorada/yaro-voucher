import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, ListTodo, Users, Pencil, Check, X, CalendarDays } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, isBefore, parseISO } from "date-fns";
import { cs } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

interface Task {
  id: string;
  title: string;
  due_date: string;
  priority: string;
  completed: boolean;
  user_id: string;
}

const ADMIN_EMAIL = "radek@yarotravel.cz";

const priorityColors: Record<string, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const priorityLabels: Record<string, string> = {
  low: "Nízká",
  medium: "Střední",
  high: "Vysoká",
};

interface EditingState {
  id: string;
  title: string;
  priority: string;
}

const TaskRow = ({
  task,
  showAll,
  currentUserId,
  profilesMap,
  editing,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditChange,
  onToggle,
  onDelete,
}: {
  task: Task;
  showAll: boolean;
  currentUserId?: string;
  profilesMap: Record<string, string>;
  editing: EditingState | null;
  onStartEdit: (task: Task) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditChange: (field: "title" | "priority", value: string) => void;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}) => {
  const isEditing = editing?.id === task.id;

  return (
    <div
      className={`flex items-center gap-3 p-2 rounded-lg border transition-colors ${
        task.completed ? "bg-muted/50 opacity-60" : "bg-background"
      }`}
    >
      <Checkbox
        checked={task.completed}
        onCheckedChange={(checked) => onToggle(task.id, !!checked)}
      />
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Input
              value={editing.title}
              onChange={(e) => onEditChange("title", e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSaveEdit();
                if (e.key === "Escape") onCancelEdit();
              }}
              className="h-7 text-sm"
              autoFocus
            />
            <Select
              value={editing.priority}
              onValueChange={(v) => onEditChange("priority", v)}
            >
              <SelectTrigger className="w-24 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Nízká</SelectItem>
                <SelectItem value="medium">Střední</SelectItem>
                <SelectItem value="high">Vysoká</SelectItem>
              </SelectContent>
            </Select>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onSaveEdit}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCancelEdit}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <>
            <span
              className={`text-sm ${
                task.completed ? "line-through text-muted-foreground" : ""
              }`}
            >
              {task.title}
            </span>
            {showAll && task.user_id !== currentUserId && (
              <span className="text-xs text-muted-foreground ml-1">
                ({profilesMap[task.user_id] || "?"})
              </span>
            )}
          </>
        )}
      </div>
      {!isEditing && (
        <>
          <Badge className={priorityColors[task.priority]} variant="outline">
            {priorityLabels[task.priority]}
          </Badge>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => onStartEdit(task)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(task.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
};

export const TasksCard = () => {
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("medium");
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const isAdmin = currentUser?.email === ADMIN_EMAIL;

  const { data: profilesMap = {} } = useQuery({
    queryKey: ["profiles-map"],
    enabled: isAdmin && showAll,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, email");
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const p of data || []) {
        map[p.id] = p.email.split("@")[0];
      }
      return map;
    },
  });

  // Today's tasks
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", today, showAll],
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select("*")
        .eq("due_date", today)
        .order("completed", { ascending: true })
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });

      if (!showAll) {
        query = query.eq("user_id", currentUser?.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Task[];
    },
    enabled: !!currentUser?.id,
  });

  // Upcoming tasks (future + overdue, not today)
  const { data: upcomingTasks = [] } = useQuery({
    queryKey: ["tasks-upcoming", today, showAll],
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select("*")
        .neq("due_date", today)
        .eq("completed", false)
        .order("due_date", { ascending: true })
        .order("priority", { ascending: false })
        .limit(20);

      if (!showAll) {
        query = query.eq("user_id", currentUser?.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Task[];
    },
    enabled: !!currentUser?.id,
  });

  const addTaskMutation = useMutation({
    mutationFn: async ({ title, priority }: { title: string; priority: string }) => {
      const { error } = await supabase.from("tasks").insert({
        title,
        priority,
        due_date: today,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setNewTaskTitle("");
      toast({ title: "Úkol přidán" });
    },
    onError: () => {
      toast({ title: "Chyba při přidávání úkolu", variant: "destructive" });
    },
  });

  const toggleTaskMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase
        .from("tasks")
        .update({
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, title, priority }: { id: string; title: string; priority: string }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ title, priority })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setEditing(null);
      toast({ title: "Úkol upraven" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Úkol smazán" });
    },
  });

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    addTaskMutation.mutate({ title: newTaskTitle.trim(), priority: newTaskPriority });
  };

  const handleStartEdit = (task: Task) => {
    setEditing({ id: task.id, title: task.title, priority: task.priority });
  };

  const handleSaveEdit = () => {
    if (!editing || !editing.title.trim()) return;
    updateTaskMutation.mutate({ id: editing.id, title: editing.title.trim(), priority: editing.priority });
  };

  const handleEditChange = (field: "title" | "priority", value: string) => {
    if (!editing) return;
    setEditing({ ...editing, [field]: value });
  };

  const completedCount = tasks.filter((t) => t.completed).length;

  const formatUpcomingDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    const isOverdue = isBefore(date, parseISO(today));
    return {
      label: format(date, "EEE d.M.", { locale: cs }),
      isOverdue,
    };
  };

  // Group upcoming by date
  const groupedUpcoming = upcomingTasks.reduce<Record<string, Task[]>>((acc, task) => {
    if (!acc[task.due_date]) acc[task.due_date] = [];
    acc[task.due_date].push(task);
    return acc;
  }, {});

  const taskRowProps = {
    showAll,
    currentUserId: currentUser?.id,
    profilesMap,
    editing,
    onStartEdit: handleStartEdit,
    onCancelEdit: () => setEditing(null),
    onSaveEdit: handleSaveEdit,
    onEditChange: handleEditChange,
    onToggle: (id: string, completed: boolean) => toggleTaskMutation.mutate({ id, completed }),
    onDelete: (id: string) => deleteTaskMutation.mutate(id),
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ListTodo className="h-5 w-5 text-primary" />
            Dnešní úkoly
            {tasks.length > 0 && (
              <Badge variant="secondary">
                {completedCount}/{tasks.length}
              </Badge>
            )}
          </CardTitle>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <Switch
                checked={showAll}
                onCheckedChange={setShowAll}
                aria-label="Zobrazit úkoly všech"
              />
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {format(new Date(), "EEEE, d. MMMM yyyy", { locale: cs })}
          {isAdmin && showAll && " • Všichni uživatelé"}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Nový úkol..."
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
            className="flex-1"
          />
          <Select value={newTaskPriority} onValueChange={setNewTaskPriority}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Nízká</SelectItem>
              <SelectItem value="medium">Střední</SelectItem>
              <SelectItem value="high">Vysoká</SelectItem>
            </SelectContent>
          </Select>
          <Button size="icon" onClick={handleAddTask} disabled={!newTaskTitle.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center text-muted-foreground py-4">Načítání...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            Žádné úkoly na dnešek
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} {...taskRowProps} />
            ))}
          </div>
        )}

        {/* Upcoming / overdue tasks */}
        {Object.keys(groupedUpcoming).length > 0 && (
          <>
            <Separator />
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              Nadcházející úkoly
            </div>
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {Object.entries(groupedUpcoming).map(([date, dateTasks]) => {
                const { label, isOverdue } = formatUpcomingDate(date);
                return (
                  <div key={date}>
                    <p className={`text-xs font-medium mb-1 ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                      {isOverdue && "⚠ "}{label}
                    </p>
                    <div className="space-y-1.5">
                      {dateTasks.map((task) => (
                        <TaskRow key={task.id} task={task} {...taskRowProps} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
