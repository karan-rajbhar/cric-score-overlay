"use client";

import { useEffect } from "react";

/** Input types that raise no on-screen keyboard. */
const NO_KEYBOARD = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

/** Whether focusing this element raises the on-screen keyboard. */
export function takesTyping(el: Element | null): boolean {
  if (el instanceof HTMLTextAreaElement) return !el.readOnly;
  if (el instanceof HTMLInputElement)
    return !NO_KEYBOARD.has(el.type) && !el.readOnly;
  return el instanceof HTMLElement && el.isContentEditable;
}

/** How much shorter than its tallest the viewport is with a keyboard up. */
const KEYBOARD_PX = 120;

/**
 * Publishes the visible viewport (the screen minus the on-screen keyboard)
 * as CSS variables: --vvh (height) and --vv-top (offset from the layout
 * viewport). iOS Safari overlays the keyboard instead of resizing the page,
 * so fixed elements like dialogs use these to stay in the visible area.
 *
 * It also marks the root `data-keyboard` while a text field has focus and
 * the viewport is well short of its tallest at this width: the keyboard is
 * up, and the phone tab bar steps aside instead of riding on top of it
 * (N38; Android resizes the page for the keyboard).
 */
export function ViewportVars() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    let frame = 0;
    let width = vv.width;
    let tallest = vv.height;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.style.setProperty("--vvh", `${vv.height}px`);
        root.style.setProperty("--vv-top", `${vv.offsetTop}px`);
        // A turn of the phone starts a new measure.
        if (Math.abs(vv.width - width) > 1) {
          width = vv.width;
          tallest = vv.height;
        }
        tallest = Math.max(tallest, vv.height);
        const up =
          takesTyping(document.activeElement) &&
          vv.height < tallest - KEYBOARD_PX;
        if (up) root.dataset.keyboard = "";
        else delete root.dataset.keyboard;
      });
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      delete root.dataset.keyboard;
    };
  }, []);
  return null;
}
