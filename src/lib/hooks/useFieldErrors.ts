"use client";

import { useCallback, useState } from "react";

/**
 * A form's mistakes, each shown under its own field (`Field`'s `error`),
 * with focus on the first one (F1, `/design#spec-form-errors`). Forms using
 * it set `noValidate`, so the browser's own bubbles never show; whatever is
 * not about one field goes in `form` (a callout above the button).
 */
export function useFieldErrors<K extends string>() {
  const [errors, setErrors] = useState<Partial<Record<K | "form", string>>>(
    {},
  );

  /** Shows these mistakes (none: clears them) and focuses the first. */
  const show = useCallback(
    (form: HTMLFormElement | null, next: Partial<Record<K | "form", string>>) => {
      setErrors(next);
      if (!form || Object.keys(next).length === 0) return;
      requestAnimationFrame(() => {
        const first = form.querySelector<HTMLElement>('[aria-invalid="true"]');
        (first ?? form.querySelector<HTMLElement>('[role="alert"]'))?.focus();
      });
    },
    [],
  );

  /** Forgets one field's mistake once it is being corrected. */
  const clear = useCallback((field: K) => {
    setErrors((e) => {
      if (!e[field]) return e;
      const next = { ...e };
      delete next[field];
      return next;
    });
  }, []);

  return { errors, show, clear };
}
