/**
 * The theme pick as React state: persisted under `<prefix>:theme`, applied to
 * <html>, followed across tabs, and — in "system" — following the OS live.
 * Call `bootstrapTheme()` in main.tsx too, so the first frame is right.
 */

import { useCallback, useEffect, useState } from "react";
import { applyTheme, readTheme, themeStorageKey, writeTheme, type Theme } from "../theme.ts";

export function useTheme(fallback: Theme = "dark"): [Theme, (next: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => readTheme(fallback));

  // Another tab changed it.
  useEffect(() => {
    let key: string;
    try {
      key = themeStorageKey();
    } catch {
      return;
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      const next = readTheme(fallback);
      setTheme(next);
      applyTheme(next);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [fallback]);

  // In "system", the OS changed its mind.
  useEffect(() => {
    if (theme !== "system" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const update = useCallback((next: Theme) => {
    writeTheme(next);
    applyTheme(next);
    setTheme(next);
  }, []);

  return [theme, update];
}
