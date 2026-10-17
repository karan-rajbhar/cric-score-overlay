"use client";

import { useEffect } from "react";

/**
 * Publishes the visible viewport (the screen minus the on-screen keyboard)
 * as CSS variables: --vvh (height) and --vv-top (offset from the layout
 * viewport). iOS Safari overlays the keyboard instead of resizing the page,
 * so fixed elements like dialogs use these to stay in the visible area.
 */
export function ViewportVars() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.style.setProperty("--vvh", `${vv.height}px`);
        root.style.setProperty("--vv-top", `${vv.offsetTop}px`);
      });
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return null;
}
