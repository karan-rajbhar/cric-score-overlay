import { MatchHero } from "~/components/matches/match-hero";
import { sidesInBattingOrder } from "~/lib/cricket";
import type { MatchReportModel } from "~/lib/match-report";
import type { Match } from "~/lib/match-types";
import { ReportCharts } from "./report-charts";
import {
  ImpactCard,
  InfoCard,
  InningsSection,
  OverComparison,
  PhasesCard,
  ReportFooter,
  ReportHeader,
  ReportSectionTitle,
  SignoffCard,
} from "./report-sections";
import { ReportToolbar } from "./report-toolbar";

/** A4 sheets with a 10 mm margin; backgrounds (chips, bars) print too. */
const PRINT_CSS = `@page { size: A4 portrait; margin: 10mm; }
@media print { html, body { background: #fff !important; } }`;

/**
 * The match report: the match page's hero, the analysis, every innings'
 * scorecard, the over-by-over comparison and the sign-off, as one page of
 * design-system components. Each `.report-page` becomes PDF pages (the
 * first innings on the first, the second innings on the next).
 */
export function MatchReportView({
  match,
  report,
  qrDataUrl,
}: {
  match: Match;
  report: MatchReportModel;
  qrDataUrl: string;
}) {
  const [first, second, ...superOvers] = report.innings;
  const closing = (
    <>
      {(report.charts || report.overs) && (
        <section className="space-y-4" aria-label="Over by over">
          <ReportSectionTitle
            title="Over by over"
            description="Both innings side by side: the run progression, the runs in each over and every delivery."
          />
          {report.charts && <ReportCharts charts={report.charts} />}
          {report.overs && <OverComparison overs={report.overs} />}
        </section>
      )}
      <SignoffCard
        signoff={report.signoff}
        matchIdShort={report.matchIdShort}
        generated={report.generated}
      />
      <ReportFooter matchUrl={report.matchUrl} qrDataUrl={qrDataUrl} />
    </>
  );

  return (
    <div className="relative isolate min-h-screen bg-background text-foreground [-webkit-print-color-adjust:exact] [print-color-adjust:exact]">
      <style>{PRINT_CSS}</style>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-wash [mask-image:linear-gradient(to_bottom,#000_35%,transparent)] print:hidden"
      />
      <ReportToolbar fileName={report.fileName} matchUrl={report.matchUrl} />
      <main className="mx-auto max-w-[52rem] px-4 sm:px-6 print:max-w-none print:px-0">
        <article className="report-page space-y-6 pb-8 pt-6">
          <ReportHeader tournament={report.tournament} club={report.club} />
          <div>
            <p className="text-sm text-muted-foreground">Match report</p>
            <h1 className="text-balance text-2xl font-semibold text-foreground">
              {report.title}
            </h1>
            {report.date && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {[report.date, match.venue].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <MatchHero
            match={match}
            sides={sidesInBattingOrder(match)}
            plain={false}
            className="break-inside-avoid"
          />
          {(report.phases || report.impact.length > 0) && (
            <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
              {report.phases && <PhasesCard phases={report.phases} />}
              {report.impact.length > 0 && (
                <ImpactCard leaders={report.impact} />
              )}
            </div>
          )}
          <InfoCard info={report.info} />
          {first ? (
            <InningsSection inn={first} />
          ) : (
            <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
              No innings recorded yet.
            </p>
          )}
          {!second && closing}
        </article>
        {second && (
          <article className="report-page innings-page-2 break-before-page space-y-6 pb-12 pt-6">
            <InningsSection inn={second} />
            {superOvers.map((inn) => (
              <InningsSection key={inn.id} inn={inn} />
            ))}
            {closing}
          </article>
        )}
      </main>
    </div>
  );
}
