import { LocalDate } from "~/components/ds/local-date";
import { MatchHero } from "~/components/matches/match-hero";
import { matchFormatLabel, sidesInBattingOrder } from "~/lib/cricket";
import type { MatchReportModel } from "~/lib/match-report";
import type { Match } from "~/lib/match-types";
import { ReportCharts } from "./report-charts";
import {
  InningsSummaryCard,
  ReportFooter,
  ReportHeader,
} from "./report-sections";
import {
  AnalysisSheet,
  InningsSheet,
  OverGrid,
  SignoffSheet,
} from "./report-sheet";
import { ReportToolbar } from "./report-toolbar";

/**
 * A4 sheets with a 10 mm margin; backgrounds (chips, bars) print too. The
 * summary is a sheet of its own: at a sheet's 718 px it stands taller than
 * the 1,047 px a sheet holds, so it prints smaller (the PDF draws it at
 * 820 px, where it fits).
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

/** The side that bowled an innings: the other of the two. */
const bowlingSideOf = (report: MatchReportModel, team: string) =>
  report.teams.find((t) => t.name !== team)?.name ?? null;

/**
 * The detail after the scorecards: the analysis, the charts and the over
 * grid, and the sign-off (tournament matches: a league's official record).
 * The link and its QR code are on the first page.
 */
function ReportClosing({ report }: { report: MatchReportModel }) {
  return (
    <>
      <AnalysisSheet report={report} />
      {(report.charts || report.overs) && (
        <section
          aria-label="Over by over"
          data-sheet-label="Over by over"
          className="space-y-3"
        >
          {report.charts && <ReportCharts charts={report.charts} flat />}
          {report.overs && <OverGrid overs={report.overs} />}
        </section>
      )}
      {report.tournament && (
        <SignoffSheet
          signoff={report.signoff}
          matchIdShort={report.matchIdShort}
          generatedAt={report.generatedAt}
        />
      )}
    </>
  );
}

/**
 * What the running header at the top of every detail sheet says (the PDF
 * builder reads its text once the date shows in the viewer's zone).
 */
function SheetHeading({ report }: { report: MatchReportModel }) {
  return (
    <p hidden data-report-heading="">
      {report.teams[0].name} vs {report.teams[1].name}
      {report.scheduledAt && (
        <>
          {" · "}
          <LocalDate value={report.scheduledAt} format="short" />
        </>
      )}
      {(report.tournament ?? report.club) &&
        ` · ${report.tournament ?? report.club}`}
    </p>
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
        {/* When, where and the format (the hero below repeats none). */}
        <p className="mt-0.5 text-sm text-muted-foreground">
          {report.scheduledAt && (
            <>
              <LocalDate value={report.scheduledAt} format="shortTime" />
              {" · "}
            </>
          )}
          {match.venue && `${match.venue} · `}
          {matchFormatLabel(match)}
        </p>
      </div>
      {/* Each side's best are on its card below, not under its name. */}
      <MatchHero
        match={match}
        sides={sidesInBattingOrder(match)}
        plain={false}
        performers={false}
        quiet
        className="break-inside-avoid"
      />
      {report.innings.length > 0 ? (
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
      ) : (
        <>
          <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
            No innings recorded yet.
          </p>
          <ReportClosing report={report} />
        </>
      )}
      <ReportFooter
        matchUrl={report.matchUrl}
        qrDataUrl={qrDataUrl}
        hint={
          report.innings.length > 0
            ? "The full scorecard follows on the next pages. Scan the code for the ball-by-ball log."
            : "Scan the code to follow the match."
        }
      />
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
  const page = "report-page break-before-page space-y-6 pb-8 pt-6";

  return (
    <div className="relative isolate min-h-screen bg-background text-foreground [-webkit-print-color-adjust:exact] [print-color-adjust:exact]">
      <style>{PRINT_CSS}</style>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-wash [mask-image:linear-gradient(to_bottom,#000_35%,transparent)] print:hidden"
      />
      <ReportToolbar fileName={report.fileName} matchUrl={report.matchUrl} />
      <SheetHeading report={report} />
      <main className="mx-auto max-w-[52rem] px-4 sm:px-6 print:max-w-none print:px-0">
        <SummaryPage match={match} report={report} qrDataUrl={qrDataUrl} />
        {/* Each innings on a sheet of its own, then the rest: each page is
            drawn as one picture, and a picture taller than about four
            sheets fails on an iPhone (Safari's canvas limit). */}
        {first && (
          <article data-running-header="" className={page}>
            <InningsSheet inn={first} bowlingSide={bowlingSideOf(report, first.team.name)} />
          </article>
        )}
        {second && (
          <article data-running-header="" className={page}>
            <InningsSheet inn={second} bowlingSide={bowlingSideOf(report, second.team.name)} />
            {superOvers.map((inn) => (
              <InningsSheet
                key={inn.id}
                inn={inn}
                bowlingSide={bowlingSideOf(report, inn.team.name)}
              />
            ))}
          </article>
        )}
        {first && (
          <article data-running-header="" className={page}>
            <ReportClosing report={report} />
          </article>
        )}
      </main>
    </div>
  );
}
