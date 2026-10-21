"use client";

import * as React from "react";
import { Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger as UiSelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";

/** The control look shared by inputs, selects and textareas. */
export const controlClass =
  "w-full rounded-lg border border-input bg-card px-3.5 text-base text-foreground transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive sm:text-sm";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(controlClass, "h-11", className)}
      {...props}
    />
  ),
);
Input.displayName = "Input";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(controlClass, "min-h-24 py-2.5", className)}
    {...props}
  />
));
Textarea.displayName = "Textarea";

/** Search box: icon inside, no autocorrect, clears with Escape (native). */
const SearchField = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<"input">, "type">
>(({ className, ...props }, ref) => (
  <div className={cn("relative", className)}>
    <Search
      aria-hidden="true"
      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
    />
    <input
      ref={ref}
      type="search"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      className={cn(controlClass, "h-11 rounded-full pl-10")}
      {...props}
    />
  </div>
));
SearchField.displayName = "SearchField";

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof UiSelectTrigger>,
  React.ComponentPropsWithoutRef<typeof UiSelectTrigger>
>(({ className, ...props }, ref) => (
  <UiSelectTrigger
    ref={ref}
    className={cn(controlClass, "h-11 shadow-none focus:ring-2", className)}
    {...props}
  />
));
SelectTrigger.displayName = "SelectTrigger";

type ControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

/**
 * Label, control, hint and error, wired together: the control gets the id,
 * aria-describedby and aria-invalid through the render prop.
 */
function Field({
  label,
  hint,
  error,
  optional,
  className,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  optional?: boolean;
  className?: string;
  children: (control: ControlProps) => React.ReactNode;
}) {
  const id = React.useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
        {optional && (
          <span className="font-normal text-muted-foreground"> (optional)</span>
        )}
      </label>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}
      {error && (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * One choice from a few: native radios drawn as pills or cards (toss
 * winner, bat or bowl, dismissal type). Arrow keys move between them.
 */
function ChoiceGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  layout = "pills",
  className,
}: {
  legend: React.ReactNode;
  name: string;
  options: readonly {
    value: T;
    label: React.ReactNode;
    description?: React.ReactNode;
  }[];
  value: T | null;
  onChange: (value: T) => void;
  layout?: "pills" | "cards";
  className?: string;
}) {
  return (
    <fieldset className={cn("space-y-2", className)}>
      <legend className="mb-2 text-sm font-medium text-foreground">
        {legend}
      </legend>
      <div
        className={cn(
          layout === "pills"
            ? "flex flex-wrap gap-2"
            : "grid gap-2 sm:grid-cols-2",
        )}
      >
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "cursor-pointer border border-border bg-card text-sm text-foreground transition-colors hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:text-primary-soft-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
              layout === "pills"
                ? "inline-flex h-10 items-center rounded-full px-4 font-medium"
                : "block rounded-lg p-3.5",
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            <span className={cn(layout === "cards" && "block font-medium")}>
              {o.label}
            </span>
            {layout === "cards" && o.description && (
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {o.description}
              </span>
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Checkbox with its label; the box uses the navy accent. */
function Checkbox({
  label,
  description,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & {
  label: React.ReactNode;
  description?: React.ReactNode;
}) {
  const id = React.useId();
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary"
        {...props}
      />
      <label htmlFor={id} className="cursor-pointer text-sm leading-tight">
        <span className="font-medium text-foreground">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {description}
          </span>
        )}
      </label>
    </div>
  );
}

export {
  Field,
  Input,
  Textarea,
  SearchField,
  ChoiceGroup,
  Checkbox,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
