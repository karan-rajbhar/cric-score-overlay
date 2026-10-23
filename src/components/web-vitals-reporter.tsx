"use client";

import { useEffect } from "react";
import { useReportWebVitals } from "next/web-vitals";

const REPORTED = new Set(["LCP", "INP", "CLS", "FCP", "TTFB"]);
/** Most metrics one request carries (`/api/vitals` accepts up to 10). */
const MAX_BATCH = 10;

interface VitalEntry {
  name: string;
  value: number;
  rating: string;
  path: string;
  navigationType: string;
}

/** Metrics waiting for the page to be hidden (one request per batch). */
const pending: VitalEntry[] = [];

function send(metrics: VitalEntry[]): void {
  const body = JSON.stringify({ metrics });
  const blob = new Blob([body], { type: "application/json" });
  if (navigator.sendBeacon?.("/api/vitals", blob)) return;
  void fetch("/api/vitals", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
    keepalive: true,
  }).catch(() => undefined);
}

function flush(): void {
  while (pending.length) send(pending.splice(0, MAX_BATCH));
}

/**
 * Sends the Core Web Vitals of a real visit to `/api/vitals` (the server
 * log). They are collected and sent together with `sendBeacon` when the
 * page is hidden or left, which is also when INP and CLS are final, so a
 * visit costs one request instead of one per metric. Production only: dev
 * builds are not representative.
 */
export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (process.env.NODE_ENV !== "production") return;
    if (!REPORTED.has(metric.name)) return;
    pending.push({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      path: window.location.pathname,
      navigationType: metric.navigationType,
    });
    if (pending.length >= MAX_BATCH) flush();
    // Reported while hidden: web-vitals reports INP / CLS from its own
    // (capturing) visibilitychange listener, before the one below sends
    // them all at once; a later report goes out on its own.
    else if (document.visibilityState === "hidden") setTimeout(flush, 0);
  });
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, []);
  return null;
}
