"use client";

import { useEffect } from "react";

/**
 * Reads the saved theme from localStorage and applies the `dark` class
 * to <html> on mount. Must be rendered inside <body>.
 * The anti-FOUC inline script in layout.tsx handles the initial paint
 * before React hydrates.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldBeDark = saved === "dark" || (!saved && prefersDark);
    document.documentElement.classList.toggle("dark", shouldBeDark);
  }, []);

  return <>{children}</>;
}
