"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/** Header toggle: flips between the night match and the day match. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";
  const label = mounted ? `Switch to ${isDark ? "light" : "dark"} theme` : "Toggle theme";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
      title={label}
      data-testid="theme-toggle"
      className="relative grid size-11 place-items-center overflow-hidden rounded-xl border border-line-strong bg-surface text-text transition-colors hover:border-accent-fg hover:text-accent-fg"
    >
      {/* Both icons render; CSS shows the right one so there's no hydration flash. */}
      <Sun className="size-[18px] transition-transform duration-500 ease-out-quint dark:-translate-y-8 dark:rotate-90" aria-hidden />
      <Moon className="absolute size-[18px] translate-y-8 transition-transform duration-500 ease-out-quint dark:translate-y-0" aria-hidden />
    </button>
  );
}

const OPTIONS = [
  { value: "system", label: "System", Icon: Monitor },
  { value: "light", label: "Day", Icon: Sun },
  { value: "dark", label: "Night", Icon: Moon },
] as const;

/** Footer control with an explicit "follow the system" choice. */
export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex gap-1 rounded-2xl border border-line-strong bg-surface p-1">
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors",
              active ? "bg-accent text-accent-ink" : "text-muted hover:text-text",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
