import { PageContainer } from "~/components/layout/page";
import { ThemeSwitch } from "./_components/theme-switch";
import { PrinciplesSection } from "./_sections/principles";
import { FoundationsSection } from "./_sections/foundations";
import { ControlsSection } from "./_sections/controls";
import { ContentSection, FeedbackSection } from "./_sections/content";
import { CricketSection } from "./_sections/cricket";
import { DetailPagesSection } from "./_sections/detail-pages";
import { ScreensSection } from "./_sections/screens";

const SECTIONS = [
  ["principles", "Principles"],
  ["foundations", "Foundations"],
  ["controls", "Controls"],
  ["content", "Layout"],
  ["feedback", "Feedback"],
  ["cricket", "Cricket"],
  ["screens", "Screens"],
  ["detail-pages", "Detail pages"],
] as const;

export default function DesignSystemPage() {
  return (
    <PageContainer className="space-y-12 sm:space-y-16">
      <header className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">CricScore</p>
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground">
              Design system
            </h1>
            <p className="mt-2 max-w-2xl text-pretty text-sm text-muted-foreground">
              How screens should behave and why, then the app&apos;s tokens and
              components, inspired by Scoreline: the reference to build new
              screens from. This page only exists on local dev servers.{" "}
              <a href="/design/match" className="underline underline-offset-4">
                The match page on sample data
              </a>{" "}
              is here too, with ?state=live or upcoming.
            </p>
          </div>
          <ThemeSwitch />
        </div>
        <nav aria-label="Design system sections">
          <ul className="no-scrollbar flex gap-2 overflow-x-auto">
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="inline-flex h-9 items-center whitespace-nowrap rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <PrinciplesSection />
      <FoundationsSection />
      <ControlsSection />
      <ContentSection />
      <FeedbackSection />
      <CricketSection />
      <ScreensSection />
      <DetailPagesSection />
    </PageContainer>
  );
}
