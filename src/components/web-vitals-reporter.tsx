"use client";

import { useReportWebVitals } from "next/web-vitals";

const REPORTED = new Set(["LCP", "INP", "CLS", "FCP", "TTFB"]);

/**
 * Sends each Core Web Vital of a real visit to `/api/vitals` (the server
 * log), with `sendBeacon` so a metric reported as the page is hidden (INP,
 * CLS) still arrives. Production only: dev builds are not representative.
 */
export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (process.env.NODE_ENV !== "production") return;
    if (!REPORTED.has(metric.name)) return;
    const body = JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      path: window.location.pathname,
      navigationType: metric.navigationType,
    });
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon?.("/api/vitals", blob)) return;
    void fetch("/api/vitals", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    }).catch(() => undefined);
  });
  return null;
}
