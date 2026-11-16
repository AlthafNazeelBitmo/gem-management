import { useLayoutEffect, useRef } from "react";

export const compactWorkspace = "(max-width: 760px), (max-width: 920px) and (pointer: coarse)";
const sheetKey = "gemMobileSheet";

export function hasSheetHistory() {
  return history.state?.[sheetKey] === true;
}

function pushSheetHistory() {
  history.pushState({ ...history.state, [sheetKey]: true }, "");
}

// One same-route entry represents the active sheet stack. Back dismisses the
// top sheet through the same cancel path as Escape, including an editor's guard.
export function MobileSheetHistory({ open }: { open: boolean }) {
  const active = useRef(false);
  const removingEntry = useRef(false);
  const removeEntry = () => {
    if (removingEntry.current) return;
    removingEntry.current = true;
    history.back();
  };
  useLayoutEffect(() => {
    const onBack = () => {
      if (removingEntry.current) {
        removingEntry.current = false;
        // Another sheet can open before the previous close's popstate arrives.
        if (active.current && !hasSheetHistory()) pushSheetHistory();
        return;
      }
      if (hasSheetHistory()) {
        // Forward into a dismissed sheet must not reopen it or create a dead Back step.
        if (!active.current) removeEntry();
        return;
      }
      if (!active.current) return;
      const dialog = [...document.querySelectorAll("dialog[open]")].at(-1);
      if (!dialog) return;
      pushSheetHistory();
      dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    };
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, []);

  useLayoutEffect(() => {
    active.current = open && matchMedia(compactWorkspace).matches;
    if (active.current) {
      if (!hasSheetHistory()) pushSheetHistory();
    } else if (hasSheetHistory()) {
      removeEntry();
    }
  }, [open]);

  return null;
}
