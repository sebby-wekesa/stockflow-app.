"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

const subscribe = () => () => {};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);

  return (
    <div className="theme-toggle" aria-label="Appearance" role="group">
      <button
        type="button"
        className={`theme-option ${hydrated && theme === "light" ? "active" : ""}`}
        aria-pressed={hydrated && theme === "light"}
        onClick={() => setTheme("light")}
      >
        <Sun size={14} aria-hidden="true" />
        Light
      </button>
      <button
        type="button"
        className={`theme-option ${hydrated && theme === "dark" ? "active" : ""}`}
        aria-pressed={hydrated && theme === "dark"}
        onClick={() => setTheme("dark")}
      >
        <Moon size={14} aria-hidden="true" />
        Dark
      </button>
    </div>
  );
}
