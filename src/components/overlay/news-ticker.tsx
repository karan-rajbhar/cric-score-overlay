"use client";

interface NewsTickerProps {
  text?: string;
  badge?: string;
  visible?: boolean;
}

export function NewsTicker({
  text = "Live scores and stats update ball by ball",
  badge = "Update",
  visible = true,
}: NewsTickerProps) {
  if (!visible || !text.trim()) return null;

  return (
    <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-20 flex h-7 select-none items-center overflow-hidden border-t border-white/10 bg-[#0b0f17]/95 text-white">
      <div className="z-10 flex h-full shrink-0 items-center bg-amber-500 px-3 text-xs font-semibold text-black">
        <span>{badge}</span>
      </div>

      {/* Marquee scrolling container */}
      <div className="relative flex w-full overflow-hidden whitespace-nowrap">
        <div className="animate-marquee inline-flex items-center text-xs font-medium text-slate-200 motion-reduce:animate-none">
          <span className="mx-6 inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
            {text}
            <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
          </span>
          <span className="mx-6 inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
            {text}
            <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
          </span>
        </div>
      </div>
    </div>
  );
}
