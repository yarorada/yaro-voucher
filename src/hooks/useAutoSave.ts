import { useEffect, useRef, useState, useCallback } from "react";

interface UseAutoSaveOptions<T> {
  data: T;
  saveFn: (data: T) => Promise<void>;
  debounceMs?: number;
  enabled?: boolean;
}

interface UseAutoSaveReturn {
  isSaving: boolean;
  lastSaved: Date | null;
}

/**
 * Debounced auto-save hook. Triggers saveFn after debounceMs ms of inactivity.
 * Skips save on initial mount.
 */
export function useAutoSave<T>({
  data,
  saveFn,
  debounceMs = 1500,
  enabled = true,
}: UseAutoSaveOptions<T>): UseAutoSaveReturn {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);
  const isSavingRef = useRef(false);
  const saveFnRef = useRef(saveFn);
  const dataRef = useRef(data);

  // Keep refs current
  saveFnRef.current = saveFn;
  dataRef.current = data;

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (!enabled) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      if (isSavingRef.current) return;
      isSavingRef.current = true;
      setIsSaving(true);
      try {
        await saveFnRef.current(dataRef.current);
        setLastSaved(new Date());
      } catch (e) {
        console.error("Auto-save error:", e);
      } finally {
        isSavingRef.current = false;
        setIsSaving(false);
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, enabled, debounceMs]);

  return { isSaving, lastSaved };
}
