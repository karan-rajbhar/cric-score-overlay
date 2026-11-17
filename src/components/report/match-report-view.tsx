import { LocalDate } from "~/components/ds/local-date";
import { MatchHero } from "~/components/matches/match-hero";
import { sidesInBattingOrder } from "~/lib/cricket";
import type { MatchReportModel } from "~/lib/match-report";
import type { Match } from "~/lib/match-types";
import { ReportCharts } from "./report-charts";
import {
  ImpactCard,
  InfoCard,
  InningsSection,
  InningsSummaryCard,
  OverComparison,
  PhasesCard,
  ReportFooter,
  ReportHeader,
  ReportSectionTitle,
  SignoffCard,
} from "./report-sections";
import { ReportToolbar } from "./report-toolbar";

/**
 * A4 sheets with a 10 mm margin; backgrounds (chips, bars) print too. The
 * summary is a sheet of its own: at a sheet's 718 px it stands about 1,200
 * px high, more than the 1,047 px a sheet holds, so it prints smaller (the
 * PDF draws it at 820 px, where it fits).
 */
const PRINT_CSS = `@page { size: A4 portrait; margin: 10mm; }
@media print {
  html, body { background: #fff !important; }
  .summary-page { zoom: 0.84; padding-top: 0; }
}`;

type ReportProps = {
  match: Match;
  report: MatchReportModel;
  qrDataUrl: string;
};

/**
 * The analysis, the over-by-over comparison, the match information, the
 * sign-off and the link.
 */
function ReportClosing({
  report,
  qrDataUrl,
}: Omit<ReportProps, "match">) {
  return (
    <>
      {(report.phases || report.impact.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
          {report.phases && <PhasesCard phases={report.phases} />}
          {report.impact.length > 0 && <ImpactCard leaders={report.impact} />}
        </div>
      )}
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
      {/* Reference, beside the sign-off (umpires, toss), as scorecard
          sites put it under the scorecard. */}
      <InfoCard info={report.info} />
      <SignoffCard
        signoff={report.signoff}
        matchIdShort={report.matchIdShort}
        generatedAt={report.generatedAt}
      />
      <ReportFooter matchUrl={report.matchUrl} qrDataUrl={qrDataUrl} />
    </>
  );
}

/**
 * The first page, as on the share-summary image: the result, each side's
 * score with its top batters beside the bowlers who bowled at them, and the
 * link. Many only ever look at a PDF's first page. With no innings yet, the
 * report has only this page and it closes it.
 */
function SummaryPage({ match, report, qrDataUrl }: ReportProps) {
  return (
    <article className="report-page summary-page space-y-6 pb-8 pt-6">
      <ReportHeader tournament={report.tournament} club={report.club} />
      <div>
        <p className="text-sm text-muted-foreground">Match report</p>
        <h1 className="text-balance text-2xl font-semibold text-foreground">
          {report.title}
        </h1>
        {(report.scheduledAt || match.venue) && (
          <p className="mt-0.5 text-sm text-muted-foreground">
            <LocalDate value={report.scheduledAt} format="shortTime" />
            {report.scheduledAt && match.venue && " · "}
            {match.venue}
          </p>
        )}
      </div>
      {/* Each side's best are on its card below, not under its name. */}
      <MatchHero
        match={match}
        sides={sidesInBattingOrder(match)}
        plain={false}
        performers={false}
        className="break-inside-avoid"
      />
      {report.innings.length > 0 ? (
        <>
          <div className="space-y-4">
            <InningsSummaryCard
              team={report.teams[0]}
              stats={report.summary[0]}
            />
            <InningsSummaryCard
              team={report.teams[1]}
              stats={report.summary[1]}
            />
          </div>
          <ReportFooter
            matchUrl={report.matchUrl}
            qrDataUrl={qrDataUrl}
            hint="The full scorecard follows on the next pages. Scan the code for the ball-by-ball log."
          />
        </>
      ) : (
        <>
          <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
            No innings recorded yet.
          </p>
          <ReportClosing report={report} qrDataUrl={qrDataUrl} />
        </>
      )}
    </article>
  );
}

/**
 * The match report: the summary page, then the detail (every innings'
 * scorecard, the analysis with the phases and match impact, the
 * over-by-over comparison, the match information, the sign-off). Each
 * `.report-page` becomes PDF pages: the summary, the first innings, then
 * the second innings onwards.
 */
export function MatchReportView({ match, report, qrDataUrl }: ReportProps) {
  const [first, second, ...superOvers] = report.innings;
  const closing = <ReportClosing report={report} qrDataUrl={qrDataUrl} />;

  return (
    <div className="relative isolate min-h-screen bg-background text-foreground [-webkit-print-color-adjust:exact] [print-color-adjust:exact]">
      <style>{PRINT_CSS}</style>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-wash [mask-image:linear-gradient(to_bottom,#000_35%,transparent)] print:hidden"
      />
      <ReportToolbar fileName={report.fileName} matchUrl={report.matchUrl} />
      <main className="mx-auto max-w-[52rem] px-4 sm:px-6 print:max-w-none print:px-0">
        <SummaryPage match={match} report={report} qrDataUrl={qrDataUrl} />
        {first && (
          <article className="report-page innings-page-1 break-before-page space-y-6 pb-8 pt-6">
            <InningsSection inn={first} />
            {!second && closing}
          </article>
        )}
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
