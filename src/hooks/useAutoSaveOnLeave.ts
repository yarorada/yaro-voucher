import { useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";

interface UseAutoSaveOnLeaveOptions {
  /** Returns true if there are unsaved changes */
  hasUnsavedChanges: () => boolean;
  /** Function to save changes — should return a promise */
  onSave: () => Promise<void>;
  /** Whether the hook is enabled */
  enabled?: boolean;
}

/**
 * Auto-saves form data when the user navigates away or closes the tab.
 * - On browser close/refresh: shows native "unsaved changes" warning
 * - On in-app navigation: silently auto-saves before navigating
 */
export function useAutoSaveOnLeave({
  hasUnsavedChanges,
  onSave,
  enabled = true,
}: UseAutoSaveOnLeaveOptions) {
  const hasUnsavedRef = useRef(hasUnsavedChanges);
  const onSaveRef = useRef(onSave);
  const isSavingRef = useRef(false);

  // Keep refs up to date
  useEffect(() => {
    hasUnsavedRef.current = hasUnsavedChanges;
    onSaveRef.current = onSave;
  }, [hasUnsavedChanges, onSave]);

  // Warn on browser close/refresh
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedRef.current()) {
        e.preventDefault();
        // Trigger auto-save attempt
        if (!isSavingRef.current) {
          isSavingRef.current = true;
          onSaveRef.current().finally(() => {
            isSavingRef.current = false;
          });
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [enabled]);

  // Auto-save on unmount (in-app navigation)
  useEffect(() => {
    if (!enabled) return;

    return () => {
      if (hasUnsavedRef.current() && !isSavingRef.current) {
        isSavingRef.current = true;
        onSaveRef.current().finally(() => {
          isSavingRef.current = false;
        });
      }
    };
  }, [enabled]);
}

/**
 * Warns the user about unsaved changes when navigating away.
 * For creation forms where auto-save to DB isn't possible.
 */
export function useUnsavedChangesWarning(hasUnsavedChanges: () => boolean, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges()) {
        e.preventDefault();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges, enabled]);
}
