"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun, Laptop, Check } from "lucide-react";
import { useTheme } from "~/lib/theme-provider";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

const emptySubscribe = () => () => {};

export function ThemeToggle() {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const { theme, resolvedTheme, setTheme } = useTheme();

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-9 w-9 p-0 text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground"
        aria-label="Toggle theme"
      >
        <span className="h-4 w-4" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0 text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground"
          aria-label={`Current theme: ${theme}. Click to change theme`}
        >
          {resolvedTheme === "dark" ? (
            <Moon className="h-4 w-4 text-emerald-400 transition-all duration-200" />
          ) : (
            <Sun className="h-4 w-4 text-amber-600 transition-all duration-200" />
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-36 border border-border bg-popover/95 shadow-lg backdrop-blur-md"
      >
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className="flex cursor-pointer items-center justify-between text-xs font-medium"
        >
          <div className="flex items-center gap-2">
            <Sun className="h-3.5 w-3.5 text-amber-500" />
            <span>Light</span>
          </div>
          {theme === "light" && <Check className="h-3.5 w-3.5 text-primary" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className="flex cursor-pointer items-center justify-between text-xs font-medium"
        >
          <div className="flex items-center gap-2">
            <Moon className="h-3.5 w-3.5 text-emerald-400" />
            <span>Dark</span>
          </div>
          {theme === "dark" && <Check className="h-3.5 w-3.5 text-primary" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className="flex cursor-pointer items-center justify-between text-xs font-medium"
        >
          <div className="flex items-center gap-2">
            <Laptop className="h-3.5 w-3.5 text-sky-400" />
            <span>System</span>
          </div>
          {theme === "system" && <Check className="h-3.5 w-3.5 text-primary" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
