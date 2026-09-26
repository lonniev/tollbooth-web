/**
 * An open/closed popover done once: the site nav's phone menu and its account
 * menu. The button carries `aria-expanded`; opening focuses the first item;
 * Escape closes and hands focus back to the button; a press or focus outside
 * closes; the arrows, Home and End move between the items.
 */

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { menuFocusIndex } from "./navState.ts";

const FOCUSABLE = "a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])";

function items(panel: HTMLElement | null): HTMLElement[] {
  return panel ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];
}

export function useDisclosure<Root extends HTMLElement, Panel extends HTMLElement>() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<Root>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<Panel>(null);

  const close = useCallback((returnFocus = false) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);
  const toggle = useCallback(() => setOpen((o) => !o), []);

  useEffect(() => {
    if (!open) return;
    items(panelRef.current)[0]?.focus();
    const outside = (e: Event) => {
      const root = rootRef.current;
      if (root && e.target instanceof Node && !root.contains(e.target)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onPanelKeyDown = useCallback((e: KeyboardEvent) => {
    const list = items(panelRef.current);
    const next = menuFocusIndex(e.key, list.indexOf(document.activeElement as HTMLElement), list.length);
    if (next === null) return;
    e.preventDefault();
    list[next]?.focus();
  }, []);

  return { open, setOpen, toggle, close, rootRef, buttonRef, panelRef, onPanelKeyDown };
}
