import React, { createContext, useContext, useCallback, useState } from "react";

interface HistorySnapshot {
  label: string;
  revertFn: () => Promise<void> | void;
}

interface GlobalHistoryContextValue {
  canUndo: boolean;
  canRedo: boolean;
  pushSnapshot: (label: string, revertFn: () => Promise<void> | void) => void;
  undo: () => void;
  redo: () => void;
  isSaving: boolean;
  setIsSaving: (v: boolean) => void;
  lastSaved: Date | null;
  setLastSaved: (d: Date | null) => void;
}

const GlobalHistoryContext = createContext<GlobalHistoryContextValue | null>(null);

const MAX_HISTORY = 30;

export function GlobalHistoryProvider({ children }: { children: React.ReactNode }) {
  const [undoStack, setUndoStack] = useState<HistorySnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<HistorySnapshot[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const pushSnapshot = useCallback((label: string, revertFn: () => Promise<void> | void) => {
    setUndoStack(prev => [...prev.slice(-MAX_HISTORY + 1), { label, revertFn }]);
    setRedoStack([]);
  }, []);

  const undo = useCallback(async () => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const snapshot = prev[prev.length - 1];
      const next = prev.slice(0, -1);
      setRedoStack(r => [snapshot, ...r]);
      Promise.resolve(snapshot.revertFn()).then(() => setLastSaved(new Date()));
      return next;
    });
  }, []);

  const redo = useCallback(async () => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      const snapshot = prev[0];
      const next = prev.slice(1);
      setUndoStack(u => [...u, snapshot]);
      Promise.resolve(snapshot.revertFn()).then(() => setLastSaved(new Date()));
      return next;
    });
  }, []);

  return (
    <GlobalHistoryContext.Provider
      value={{
        canUndo: undoStack.length > 0,
        canRedo: redoStack.length > 0,
        pushSnapshot,
        undo,
        redo,
        isSaving,
        setIsSaving,
        lastSaved,
        setLastSaved,
      }}
    >
      {children}
    </GlobalHistoryContext.Provider>
  );
}

export function useGlobalHistory() {
  const ctx = useContext(GlobalHistoryContext);
  if (!ctx) throw new Error("useGlobalHistory must be used inside GlobalHistoryProvider");
  return ctx;
}
