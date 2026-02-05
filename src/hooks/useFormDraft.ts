import { useState, useEffect, useCallback, useRef } from "react";

interface DraftState<T> {
  data: T;
  timestamp: number;
}

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

interface UseFormDraftOptions<T> {
  key: string;
  initialData: T;
  debounceMs?: number;
  maxHistoryLength?: number;
  enabled?: boolean;
}

interface UseFormDraftReturn<T> {
  data: T;
  setData: (newData: T | ((prev: T) => T)) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearDraft: () => void;
  hasDraft: boolean;
  restoreDraft: () => void;
  lastSaved: Date | null;
  resetToInitial: () => void;
}

const DRAFT_PREFIX = "lovable_draft_";

export function useFormDraft<T extends Record<string, unknown>>({
  key,
  initialData,
  debounceMs = 500,
  maxHistoryLength = 50,
  enabled = true,
}: UseFormDraftOptions<T>): UseFormDraftReturn<T> {
  const storageKey = `${DRAFT_PREFIX}${key}`;
  
  // Initialize history state
  const [history, setHistory] = useState<HistoryState<T>>(() => ({
    past: [],
    present: initialData,
    future: [],
  }));
  
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);

  // Check for existing draft on mount
  useEffect(() => {
    if (!enabled) return;
    
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const draft: DraftState<T> = JSON.parse(stored);
        // Only mark as having draft if data is different from initial
        const isDifferent = JSON.stringify(draft.data) !== JSON.stringify(initialData);
        setHasDraft(isDifferent);
        if (isDifferent) {
          setLastSaved(new Date(draft.timestamp));
        }
      }
    } catch (e) {
      console.error("Error reading draft from localStorage:", e);
    }
  }, [storageKey, enabled]);

  // Save to localStorage with debounce
  const saveDraft = useCallback((data: T) => {
    if (!enabled) return;
    
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    debounceTimer.current = setTimeout(() => {
      try {
        const draftState: DraftState<T> = {
          data,
          timestamp: Date.now(),
        };
        localStorage.setItem(storageKey, JSON.stringify(draftState));
        setLastSaved(new Date(draftState.timestamp));
        
        // Check if different from initial
        const isDifferent = JSON.stringify(data) !== JSON.stringify(initialData);
        setHasDraft(isDifferent);
      } catch (e) {
        console.error("Error saving draft to localStorage:", e);
      }
    }, debounceMs);
  }, [storageKey, debounceMs, enabled, initialData]);

  // Set data with history tracking
  const setData = useCallback((newDataOrFn: T | ((prev: T) => T)) => {
    setHistory((prev) => {
      const newData = typeof newDataOrFn === "function" 
        ? (newDataOrFn as (prev: T) => T)(prev.present) 
        : newDataOrFn;
      
      // Don't add to history if data hasn't changed
      if (JSON.stringify(newData) === JSON.stringify(prev.present)) {
        return prev;
      }
      
      const newPast = [...prev.past, prev.present].slice(-maxHistoryLength);
      
      return {
        past: newPast,
        present: newData,
        future: [],
      };
    });
  }, [maxHistoryLength]);

  // Save to localStorage whenever present changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    saveDraft(history.present);
  }, [history.present, saveDraft]);

  // Undo
  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;
      
      const newPast = prev.past.slice(0, -1);
      const newPresent = prev.past[prev.past.length - 1];
      const newFuture = [prev.present, ...prev.future];
      
      return {
        past: newPast,
        present: newPresent,
        future: newFuture,
      };
    });
  }, []);

  // Redo
  const redo = useCallback(() => {
    setHistory((prev) => {
      if (prev.future.length === 0) return prev;
      
      const newFuture = prev.future.slice(1);
      const newPresent = prev.future[0];
      const newPast = [...prev.past, prev.present];
      
      return {
        past: newPast,
        present: newPresent,
        future: newFuture,
      };
    });
  }, []);

  // Clear draft from localStorage
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      setHasDraft(false);
      setLastSaved(null);
    } catch (e) {
      console.error("Error clearing draft:", e);
    }
  }, [storageKey]);

  // Restore draft from localStorage
  const restoreDraft = useCallback(() => {
    if (!enabled) return;
    
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const draft: DraftState<T> = JSON.parse(stored);
        setHistory({
          past: [],
          present: draft.data,
          future: [],
        });
        setLastSaved(new Date(draft.timestamp));
      }
    } catch (e) {
      console.error("Error restoring draft:", e);
    }
  }, [storageKey, enabled]);

  // Reset to initial data
  const resetToInitial = useCallback(() => {
    setHistory({
      past: [],
      present: initialData,
      future: [],
    });
    clearDraft();
  }, [initialData, clearDraft]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return {
    data: history.present,
    setData,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    clearDraft,
    hasDraft,
    restoreDraft,
    lastSaved,
    resetToInitial,
  };
}

// Hook for keyboard shortcuts
export function useUndoRedoShortcuts(
  undo: () => void,
  redo: () => void,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        redo();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, enabled]);
}

// Utility to get all draft keys
export function getAllDraftKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(DRAFT_PREFIX)) {
      keys.push(key.replace(DRAFT_PREFIX, ""));
    }
  }
  return keys;
}

// Utility to clear all drafts
export function clearAllDrafts(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(DRAFT_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}
