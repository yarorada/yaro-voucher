import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ListTodo } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Task {
  id: string;
  title: string;
  due_date: string;
  priority: string;
  completed: boolean;
}

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

export const TasksCard = () => {
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("medium");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("due_date", today)
        .order("completed", { ascending: true })
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Task[];
    },
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
          completed_at: completed ? new Date().toISOString() : null 
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
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

  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ListTodo className="h-5 w-5 text-primary" />
          Dnešní úkoly
          {tasks.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {completedCount}/{tasks.length}
            </Badge>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {format(new Date(), "EEEE, d. MMMM yyyy", { locale: cs })}
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
              <div
                key={task.id}
                className={`flex items-center gap-3 p-2 rounded-lg border transition-colors ${
                  task.completed ? "bg-muted/50 opacity-60" : "bg-background"
                }`}
              >
                <Checkbox
                  checked={task.completed}
                  onCheckedChange={(checked) =>
                    toggleTaskMutation.mutate({ id: task.id, completed: !!checked })
                  }
                />
                <span
                  className={`flex-1 text-sm ${
                    task.completed ? "line-through text-muted-foreground" : ""
                  }`}
                >
                  {task.title}
                </span>
                <Badge className={priorityColors[task.priority]} variant="outline">
                  {priorityLabels[task.priority]}
                </Badge>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteTaskMutation.mutate(task.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
