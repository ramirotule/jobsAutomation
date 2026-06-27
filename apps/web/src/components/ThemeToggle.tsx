"use client";

import { useState, useEffect } from "react";

function getIsDark() {
  if (typeof window === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(getIsDark());

    // Sync when another toggle instance changes the theme
    const observer = new MutationObserver(() => {
      setDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setDark(next);
  }

  if (!mounted) return <div className={`w-12 h-6 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse ${className}`} />;

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={`relative inline-flex items-center w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        dark ? "bg-indigo-600" : "bg-gray-300"
      } ${className}`}
    >
      <span className="absolute left-1 text-[10px] select-none pointer-events-none">
        {dark ? "🌙" : ""}
      </span>
      <span className="absolute right-1 text-[10px] select-none pointer-events-none">
        {!dark ? "☀️" : ""}
      </span>
      <span
        className={`inline-block w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 ${
          dark ? "translate-x-6" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
