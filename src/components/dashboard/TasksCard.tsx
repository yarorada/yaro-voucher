import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ListTodo, Pencil, Check, X, CalendarDays } from "lucide-react";
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
  description: string | null;
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
  description: string;
}

const TaskRow = ({
  task,
  showOwner,
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
  showOwner: boolean;
  currentUserId?: string;
  profilesMap: Record<string, string>;
  editing: EditingState | null;
  onStartEdit: (task: Task) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditChange: (field: "title" | "priority" | "description", value: string) => void;
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
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={editing.title}
                onChange={(e) => onEditChange("title", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) onSaveEdit();
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
            <Textarea
              value={editing.description}
              onChange={(e) => onEditChange("description", e.target.value)}
              placeholder="Poznámka..."
              className="text-sm"
              rows={5}
            />
          </div>
        ) : (
          <div>
            <span
              className={`text-sm ${
                task.completed ? "line-through text-muted-foreground" : ""
              }`}
            >
              {task.title}
            </span>
            {showOwner && task.user_id !== currentUserId && (
              <span className="text-xs text-muted-foreground ml-1">
                ({profilesMap[task.user_id] || "?"})
              </span>
            )}
            {task.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {task.description}
              </p>
            )}
          </div>
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
  // "mine" = current user, "all" = everyone, or a specific user_id
  const [viewMode, setViewMode] = useState<string>("mine");
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

  // Profiles for admin user selector
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-list"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, email, name").order("email");
      if (error) throw error;
      return data;
    },
  });

  const profilesMap: Record<string, string> = {};
  for (const p of profiles) {
    profilesMap[p.id] = p.name || p.email.split("@")[0];
  }

  const profileLabel = (p: { id: string; email: string; name?: string | null }) => {
    return p.name || p.email.split("@")[0].charAt(0).toUpperCase() + p.email.split("@")[0].slice(1);
  };

  // Determine the effective user_id filter
  const filterUserId =
    viewMode === "mine" ? currentUser?.id :
    viewMode === "all" ? undefined :
    viewMode; // specific user_id

  const showOwner = viewMode === "all";

  // Today's tasks
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", today, viewMode],
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select("*")
        .eq("due_date", today)
        .order("completed", { ascending: true })
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });

      if (filterUserId) {
        query = query.eq("user_id", filterUserId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Task[];
    },
    enabled: !!currentUser?.id,
  });

  // Upcoming tasks
  const { data: upcomingTasks = [] } = useQuery({
    queryKey: ["tasks-upcoming", today, viewMode],
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select("*")
        .neq("due_date", today)
        .eq("completed", false)
        .order("due_date", { ascending: true })
        .order("priority", { ascending: false })
        .limit(20);

      if (filterUserId) {
        query = query.eq("user_id", filterUserId);
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
      queryClient.invalidateQueries({ queryKey: ["tasks-upcoming"] });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, title, priority, description }: { id: string; title: string; priority: string; description?: string }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ title, priority, description: description ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks-upcoming"] });
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
      queryClient.invalidateQueries({ queryKey: ["tasks-upcoming"] });
      toast({ title: "Úkol smazán" });
    },
  });

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    addTaskMutation.mutate({ title: newTaskTitle.trim(), priority: newTaskPriority });
  };

  const handleStartEdit = (task: Task) => {
    setEditing({ id: task.id, title: task.title, priority: task.priority, description: task.description || "" });
  };

  const handleSaveEdit = () => {
    if (!editing || !editing.title.trim()) return;
    updateTaskMutation.mutate({ id: editing.id, title: editing.title.trim(), priority: editing.priority, description: editing.description });
  };

  const handleEditChange = (field: "title" | "priority" | "description", value: string) => {
    if (!editing) return;
    if (field === "priority") {
      // Auto-save priority change immediately
      updateTaskMutation.mutate({ id: editing.id, title: editing.title.trim() || editing.title, priority: value, description: editing.description });
    } else {
      setEditing({ ...editing, [field]: value });
    }
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

  const groupedUpcoming = upcomingTasks.reduce<Record<string, Task[]>>((acc, task) => {
    if (!acc[task.due_date]) acc[task.due_date] = [];
    acc[task.due_date].push(task);
    return acc;
  }, {});

  const taskRowProps = {
    showOwner,
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

  // Label for subtitle
  const viewLabel =
    viewMode === "mine" ? "" :
    viewMode === "all" ? " • Všichni uživatelé" :
    ` • ${profileLabel(profiles.find((p) => p.id === viewMode) || { id: "", email: "" })}`;

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
            <Select value={viewMode} onValueChange={setViewMode}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mine">Moje úkoly</SelectItem>
                <SelectItem value="all">Všichni</SelectItem>
                <Separator className="my-1" />
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {profileLabel(p)}
                    {p.id === currentUser?.id && " (já)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {format(new Date(), "EEEE, d. MMMM yyyy", { locale: cs })}
          {isAdmin && viewLabel}
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
