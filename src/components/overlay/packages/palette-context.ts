"use client";

/**
 * The stage's resolved package style (palette variables, the package's own
 * variables and fonts): `OverlayFrame` uses it inside a stage, so every
 * component, a package's or a Standard fallback, reads the same colours.
 * Outside a stage (a component on its own) the frame computes its theme.
 */

import { createContext, useContext, type CSSProperties } from "react";

export const StageStyleContext = createContext<CSSProperties | null>(null);

export const useStageStyle = () => useContext(StageStyleContext);
