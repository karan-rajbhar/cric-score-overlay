"use client";

import * as React from "react";
import { cn } from "~/lib/utils";

/** Position dots; the current one is a navy bar. Tapping one jumps there. */
function CarouselDots({
  count,
  index,
  onSelect,
}: {
  count: number;
  index: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="-mt-2 flex justify-center gap-1.5">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(i)}
          aria-label={`Show ${i + 1} of ${count}`}
          aria-current={i === index ? "true" : undefined}
          className="flex h-6 items-center px-0.5"
        >
          <span
            className={cn(
              "block h-1.5 rounded-full transition-all",
              i === index ? "w-6 bg-primary" : "w-1.5 bg-primary/25",
            )}
          />
        </button>
      ))}
    </div>
  );
}

/**
 * Swipeable row (live matches): cards snap into place and the next one
 * peeks in so it is clear there are more. Dots below show the position and
 * jump on tap. No autoplay.
 */
export function Carousel({
  label,
  gridFromMd = false,
  className,
  children,
}: {
  /** What the slides are, for screen readers ("Live matches"). */
  label: string;
  /** From tablets up, lay the slides out as a grid instead (no dots). */
  gridFromMd?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const slides = React.Children.toArray(children);
  const track = React.useRef<HTMLDivElement>(null);
  const [index, setIndex] = React.useState(0);

  const onScroll = () => {
    const el = track.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (!el || !first) return;
    const step =
      first.offsetWidth + parseFloat(getComputedStyle(el).columnGap || "0");
    setIndex(Math.min(slides.length - 1, Math.round(el.scrollLeft / step)));
  };

  // Scroll the track only (scrollIntoView could move the page too).
  const goTo = (i: number) => {
    const el = track.current;
    const slide = el?.children[i] as HTMLElement | undefined;
    if (!el || !slide) return;
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    el.scrollTo({
      left:
        slide.offsetLeft -
        parseFloat(getComputedStyle(el).scrollPaddingLeft || "0"),
      behavior: reduce ? "auto" : "smooth",
    });
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      className={cn("min-w-0", className)}
    >
      <div
        ref={track}
        onScroll={onScroll}
        className={cn(
          "no-scrollbar relative -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-6 pt-1",
          gridFromMd &&
            "md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 md:pb-1 xl:grid-cols-3",
        )}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides.length}`}
            className={cn(
              "shrink-0 snap-start",
              slides.length > 1 ? "w-[88%] sm:w-[22rem]" : "w-full",
              gridFromMd && "md:w-auto",
            )}
          >
            {slide}
          </div>
        ))}
      </div>
      {slides.length > 1 && (
        <div className={cn(gridFromMd && "md:hidden")}>
          <CarouselDots count={slides.length} index={index} onSelect={goTo} />
        </div>
      )}
    </section>
  );
}
