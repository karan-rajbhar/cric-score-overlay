"use client";

import { useId } from "react";
import { Check } from "lucide-react";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import {
  isTeamColor,
  MIN_TEXT_CONTRAST,
  TEAM_COLOR_SWATCHES,
  textOn,
} from "~/lib/team-colors";

/**
 * One team colour: a dozen swatches (a radio group) plus a hex field.
 * `value` is "#rrggbb" or "" (no colour).
 */
function ColourField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const labelId = useId();
  const hexId = useId();
  const hexHint = useId();
  const typed = value.trim();
  const invalid = typed !== "" && !isTeamColor(typed);
  const current = typed.toLowerCase();

  return (
    <div className="space-y-2">
      <span id={labelId} className="block text-sm font-medium">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="flex flex-wrap gap-2"
      >
        <button
          type="button"
          role="radio"
          aria-checked={current === ""}
          onClick={() => onChange("")}
          className={cn(
            "flex h-10 min-w-10 items-center justify-center rounded-full border px-3 text-xs font-medium text-muted-foreground",
            current === "" && "border-primary ring-2 ring-primary/40",
          )}
        >
          None
        </button>
        {TEAM_COLOR_SWATCHES.map((s) => {
          const selected = current === s.hex;
          return (
            <button
              key={s.hex}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${s.name} ${s.hex}`}
              title={s.name}
              onClick={() => onChange(s.hex)}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full border border-border",
                selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
              )}
              style={{ backgroundColor: s.hex }}
            >
              {selected && (
                <Check
                  className="h-4 w-4"
                  style={{ color: textOn(s.hex).best }}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>
      <div>
        <label htmlFor={hexId} className="text-xs text-muted-foreground">
          {label}, hex code
        </label>
        <Input
          id={hexId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#1e3a8a"
          maxLength={7}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? hexHint : undefined}
          className="mt-1 w-32 font-mono"
        />
        {invalid && (
          <p id={hexHint} className="mt-1 text-xs text-destructive">
            Use a hex code such as #1e3a8a.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Primary and secondary team colours with a preview of the short code on
 * the primary colour. Warns (never blocks) when white or navy text would
 * be hard to read on it.
 */
export function TeamColourPicker({
  shortName,
  primary,
  secondary,
  onPrimaryChange,
  onSecondaryChange,
}: {
  shortName: string;
  primary: string;
  secondary: string;
  onPrimaryChange: (value: string) => void;
  onSecondaryChange: (value: string) => void;
}) {
  const bg = isTeamColor(primary) ? primary.trim().toLowerCase() : null;
  const stripe = isTeamColor(secondary) ? secondary.trim().toLowerCase() : null;
  const text = bg ? textOn(bg) : null;
  const warnings: string[] = [];
  if (text && text.white < MIN_TEXT_CONTRAST) {
    warnings.push(
      `White text is hard to read on this colour (${text.white.toFixed(1)}:1).`,
    );
  }
  if (text && text.navy < MIN_TEXT_CONTRAST) {
    warnings.push(
      `Navy text is hard to read on this colour (${text.navy.toFixed(1)}:1).`,
    );
  }

  return (
    <div className="space-y-4">
      <ColourField
        label="Primary colour"
        value={primary}
        onChange={onPrimaryChange}
      />
      <ColourField
        label="Secondary colour"
        value={secondary}
        onChange={onSecondaryChange}
      />
      {bg && text && (
        <div className="space-y-2">
          <span className="block text-xs text-muted-foreground">Preview</span>
          <div
            className="flex h-12 w-28 items-center justify-center overflow-hidden rounded-lg font-score text-lg font-bold tabular-nums"
            style={{
              backgroundColor: bg,
              color: text.best,
              boxShadow: stripe ? `inset 0 -6px 0 ${stripe}` : undefined,
            }}
            aria-label={`Preview: ${shortName || "short name"} on the primary colour`}
            role="img"
          >
            {shortName || "ABC"}
          </div>
          {warnings.length > 0 && (
            <p role="status" className="text-xs text-warning">
              {warnings.join(" ")} Scoreboards and overlays may be hard to
              read; you can still save it.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
