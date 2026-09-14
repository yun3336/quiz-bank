"use client";

import { useEffect, useState } from "react";
import { applyTheme, resolveTheme, saveTheme } from "@/lib/storage";

export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    const theme = resolveTheme();
    applyTheme(theme);
    setDark(theme === "dark");
  }, []);

  function toggle() {
    const next = dark ? "light" : "dark";
    saveTheme(next);
    applyTheme(next);
    setDark(next === "dark");
  }

  if (dark === null) {
    return <span className="inline-block h-11 w-11 shrink-0" aria-hidden />;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="qb-icon-btn shrink-0 text-[var(--qb-navy)]"
      aria-label={dark ? "改為淺色外觀" : "改為深色外觀"}
      aria-pressed={dark}
      title={dark ? "淺色" : "深色"}
    >
      {dark ? (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v2M12 19v2M5 12H3M21 12h-2M6.2 6.2 7.6 7.6M16.4 16.4l1.4 1.4M6.2 17.8 7.6 16.4M16.4 7.6l1.4-1.4" />
        </svg>
      ) : (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M21 14.3A8.5 8.5 0 0 1 9.7 3 7.5 7.5 0 1 0 21 14.3z" />
        </svg>
      )}
    </button>
  );
}
