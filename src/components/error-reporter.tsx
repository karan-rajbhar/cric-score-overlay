"use client";

import { useEffect } from "react";
import { describeError, reportClientError } from "~/lib/report-error";

/** Reports uncaught browser errors and unhandled promise rejections. */
export function ErrorReporter() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;

    const onError = (event: ErrorEvent) => {
      const { message, stack } = describeError(event.error ?? event.message);
      reportClientError({ kind: "error", message, stack });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const { message, stack } = describeError(event.reason);
      reportClientError({ kind: "unhandledrejection", message, stack });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
