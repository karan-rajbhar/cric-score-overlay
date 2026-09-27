import type { OverlayTheme } from "~/components/overlay/types";

export function oversText(balls: number | null): string {
  if (!balls) return "0.0";
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

/**
 * Standard broadcast-grade ball chip (clean, high-contrast, no neon halos).
 */
export function BallChip({ label }: { label: string }) {
  let bg = "bg-slate-900 text-slate-200 border-slate-700/80";
  if (label === "W") {
    bg = "bg-rose-700 text-white border-rose-500 font-bold";
  } else if (label === "4") {
    bg = "bg-blue-600 text-white border-blue-400 font-bold";
  } else if (label === "6") {
    bg = "bg-amber-400 text-slate-950 border-amber-300 font-black";
  } else if (
    label.includes("wd") ||
    label.includes("nb") ||
    label.endsWith("b")
  ) {
    bg = "bg-amber-600 text-white border-amber-400 font-semibold";
  } else if (label === "0" || label === "•") {
    bg = "bg-slate-950/80 text-slate-400 border-slate-800 font-medium";
  }

  const ariaLabel =
    label === "W"
      ? "Wicket"
      : label === "4"
        ? "Four"
        : label === "6"
          ? "Six"
          : label === "0" || label === "•"
            ? "Dot ball"
            : `${label} runs`;

  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className={`inline-flex h-6 min-w-[24px] items-center justify-center rounded border px-1.5 font-score text-xs tabular-nums ${bg}`}
    >
      <span>{label === "0" ? "•" : label}</span>
    </span>
  );
}

/**
 * Circular TV bug dot ball chip.
 */
export function CircularBallDot({ label }: { label: string }) {
  let bg = "bg-slate-800 text-slate-200 border-slate-700";
  if (label === "W") {
    bg = "bg-rose-700 text-white border-rose-500 font-bold";
  } else if (label === "4") {
    bg = "bg-blue-600 text-white border-blue-400 font-bold";
  } else if (label === "6") {
    bg = "bg-amber-400 text-slate-950 border-amber-300 font-black";
  } else if (
    label.includes("wd") ||
    label.includes("nb") ||
    label.endsWith("b")
  ) {
    bg = "bg-amber-600 text-white border-amber-400 font-semibold";
  } else if (label === "0" || label === "•") {
    bg = "bg-slate-900/90 text-slate-400 border-slate-800 font-medium";
  }

  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded-full border font-score text-[11px] tabular-nums ${bg}`}
    >
      {label === "0" ? "•" : label}
    </span>
  );
}

export function CyberBallCell({ label }: { label: string }) {
  return <BallChip label={label} />;
}

export function HexBallDot({ label }: { label: string }) {
  return <CircularBallDot label={label} />;
}

export function EmberBallDot({ label }: { label: string }) {
  return <BallChip label={label} />;
}

/**
 * Broadcast-grade theme specifications.
 * Modeled after real world television networks (Sky Sports, Star Sports, Fox Cricket, The Hundred)
 * with authentic sports production palettes, clean drop shadows, and zero neon AI-slop glows.
 */
export const THEME_STYLES: Record<
  OverlayTheme,
  {
    outerBorder: string;
    teamBadge: string;
    mainBarBg: string;
    subBarBg: string;
    accentColor: string;
    accentText: string;
    strikeChevron: string;
  }
> = {
  starsports: {
    outerBorder: "border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.85)]",
    teamBadge: "bg-blue-700 text-white font-bold tracking-wider",
    mainBarBg: "bg-[#071329] text-white",
    subBarBg: "bg-[#030917] border-t border-white/10 text-amber-300",
    accentColor: "#f59e0b",
    accentText: "text-amber-400 font-bold",
    strikeChevron: "text-amber-400",
  },
  sonysports: {
    outerBorder: "border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.85)]",
    teamBadge: "bg-rose-700 text-white font-bold tracking-wider",
    mainBarBg: "bg-[#111317] text-white",
    subBarBg: "bg-[#0a0c0e] border-t border-white/10 text-rose-300",
    accentColor: "#e11d48",
    accentText: "text-rose-400 font-bold",
    strikeChevron: "text-rose-500",
  },
  foxcricket: {
    outerBorder: "border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.85)]",
    teamBadge: "bg-zinc-800 text-lime-400 font-mono font-bold tracking-wider",
    mainBarBg: "bg-[#0c1017] text-white",
    subBarBg: "bg-[#06080d] border-t border-white/10 text-lime-300",
    accentColor: "#a3e635",
    accentText: "text-lime-400 font-bold",
    strikeChevron: "text-lime-400",
  },
  thehundred: {
    outerBorder: "border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.85)]",
    teamBadge: "bg-pink-700 text-white font-black tracking-wider",
    mainBarBg: "bg-[#140822] text-white",
    subBarBg: "bg-[#0a0312] border-t border-white/10 text-cyan-300",
    accentColor: "#ec4899",
    accentText: "text-pink-400 font-bold",
    strikeChevron: "text-cyan-400",
  },
  skysports: {
    outerBorder: "border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.85)]",
    teamBadge: "bg-red-700 text-white font-bold tracking-wider",
    mainBarBg: "bg-[#080e1c] text-white",
    subBarBg: "bg-[#040810] border-t border-white/10 text-slate-300",
    accentColor: "#ef4444",
    accentText: "text-red-400 font-bold",
    strikeChevron: "text-red-400",
  },
  apex: {
    outerBorder: "border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.85)]",
    teamBadge: "bg-amber-600 text-black font-bold tracking-wider",
    mainBarBg: "bg-[#121316] text-white",
    subBarBg: "bg-[#0a0a0c] border-t border-white/10 text-amber-200",
    accentColor: "#f59e0b",
    accentText: "text-amber-400 font-bold",
    strikeChevron: "text-amber-400",
  },
  volt: {
    outerBorder: "border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.85)]",
    teamBadge: "bg-emerald-600 text-black font-mono font-bold tracking-wider",
    mainBarBg: "bg-[#08120d] text-white",
    subBarBg: "bg-[#040a07] border-t border-white/10 text-emerald-300 font-mono",
    accentColor: "#10b981",
    accentText: "text-emerald-400 font-bold",
    strikeChevron: "text-emerald-400",
  },
  agni: {
    outerBorder: "border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.85)]",
    teamBadge: "bg-orange-700 text-white font-bold tracking-wider",
    mainBarBg: "bg-[#140b08] text-white",
    subBarBg: "bg-[#0b0503] border-t border-white/10 text-orange-200",
    accentColor: "#f97316",
    accentText: "text-orange-400 font-bold",
    strikeChevron: "text-orange-400",
  },
  dharma: {
    outerBorder: "border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.85)]",
    teamBadge: "bg-red-900 text-amber-200 font-bold tracking-wider border border-amber-500/30",
    mainBarBg: "bg-[#150a0e] text-white",
    subBarBg: "bg-[#0a0406] border-t border-white/10 text-amber-300",
    accentColor: "#f59e0b",
    accentText: "text-amber-300 font-bold",
    strikeChevron: "text-amber-400",
  },
  thunder: {
    outerBorder: "border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.85)]",
    teamBadge: "bg-blue-800 text-yellow-300 font-bold tracking-wider",
    mainBarBg: "bg-[#081126] text-white",
    subBarBg: "bg-[#040916] border-t border-white/10 text-blue-200",
    accentColor: "#60a5fa",
    accentText: "text-yellow-300 font-bold",
    strikeChevron: "text-yellow-400",
  },
  nakshatra: {
    outerBorder: "border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.85)]",
    teamBadge: "bg-purple-800 text-white font-bold tracking-wider",
    mainBarBg: "bg-[#0f091c] text-white",
    subBarBg: "bg-[#08040f] border-t border-white/10 text-purple-200",
    accentColor: "#c084fc",
    accentText: "text-purple-300 font-bold",
    strikeChevron: "text-purple-300",
  },
  broadcast: {
    outerBorder: "border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.85)]",
    teamBadge: "bg-amber-600 text-black font-bold tracking-wider",
    mainBarBg: "bg-[#0f1115] text-white",
    subBarBg: "bg-[#08090b] border-t border-white/10 text-amber-300",
    accentColor: "#eab308",
    accentText: "text-amber-400 font-bold",
    strikeChevron: "text-amber-400",
  },
  emerald: {
    outerBorder: "border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.85)]",
    teamBadge: "bg-emerald-700 text-white font-bold tracking-wider",
    mainBarBg: "bg-[#061410] text-white",
    subBarBg: "bg-[#020b08] border-t border-white/10 text-emerald-300",
    accentColor: "#10b981",
    accentText: "text-emerald-400 font-bold",
    strikeChevron: "text-emerald-400",
  },
  dark: {
    outerBorder: "border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.85)]",
    teamBadge: "bg-zinc-800 text-white font-bold tracking-wider",
    mainBarBg: "bg-[#09090b] text-white",
    subBarBg: "bg-[#030303] border-t border-white/10 text-zinc-300",
    accentColor: "#ffffff",
    accentText: "text-white font-bold",
    strikeChevron: "text-emerald-400",
  },
  minimal: {
    outerBorder: "border-zinc-800 shadow-[0_8px_30px_rgba(0,0,0,0.85)]",
    teamBadge: "bg-zinc-800 text-zinc-100 font-bold tracking-wider",
    mainBarBg: "bg-[#121214] text-zinc-100",
    subBarBg: "bg-[#0a0a0c] border-t border-zinc-800 text-zinc-400",
    accentColor: "#e4e4e7",
    accentText: "text-white font-semibold",
    strikeChevron: "text-zinc-300",
  },
  custom: {
    outerBorder: "border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.85)]",
    teamBadge: "bg-amber-600 text-black font-bold tracking-wider",
    mainBarBg: "bg-[#0f1115] text-white",
    subBarBg: "bg-[#08090b] border-t border-white/10 text-amber-300",
    accentColor: "#f59e0b",
    accentText: "text-amber-400 font-bold",
    strikeChevron: "text-amber-400",
  },
};
