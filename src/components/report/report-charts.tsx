import type * as React from "react";
import { Card, CardHeader } from "~/components/ds/card";
import { ChartLegend, OverBarsChart, WormChart } from "~/components/ds/charts";
import type { MatchReportModel } from "~/lib/match-report";
import { cn } from "~/lib/utils";

/** Drawn at this width and scaled to fit, so the PDF matches the screen. */
const CHART_W = 380;

/** A side's key, name and colour in both charts. */
const seriesOf = (s: { key: string; label: string; series: 1 | 2 }) => ({
  key: s.key,
  label: s.label,
  series: s.series,
});

/**
 * The run progression and runs per over, side by side on A4. `flat`: on a
 * detail sheet, under a rule instead of in cards, and lower.
 */
export function ReportCharts({
  charts,
  flat = false,
}: {
  charts: NonNullable<MatchReportModel["charts"]>;
  flat?: boolean;
}) {
  const sides = charts.sides.slice(0, 2).map((s, i) => ({
    ...s,
    series: (i + 1) as 1 | 2,
  }));
  const vs = sides.map((s) => `${s.label} ${s.score}`).join(" vs ");
  const height = flat ? 176 : 220;
  const Panel = flat ? FlatPanel : CardPanel;
  return (
    <div
      data-keep-whole=""
      className={cn(
        "grid md:grid-cols-2 print:grid-cols-2",
        flat ? "gap-x-6 gap-y-4" : "gap-4",
      )}
    >
      <Panel
        title="Run progression"
        description="Runs over by over; dots mark wickets."
      >
        <ChartLegend
          items={sides.map((s) => ({
            label: s.label,
            value: s.score,
            series: s.series,
            shape: "line" as const,
          }))}
        />
        <WormChart
          label={`Run progression: ${vs}`}
          maxOvers={charts.maxOvers}
          width={CHART_W}
          height={height}
          series={sides.map((s) => ({
            ...seriesOf(s),
            points: s.overs.map((o) => ({
              over: o.over,
              runs: o.total,
              wicketsSoFar: o.totalWickets,
              wickets: o.wickets,
            })),
          }))}
        />
      </Panel>
      <Panel
        title="Runs per over"
        description="Both sides on one scale; red dots are wickets."
      >
        <ChartLegend
          items={[
            ...sides.map((s) => ({ label: s.label, series: s.series })),
            { label: "Wicket", swatch: "bg-wicket", shape: "dot" as const },
          ]}
        />
        <OverBarsChart
          label={`Runs per over: ${vs}`}
          maxOvers={charts.maxOvers}
          width={CHART_W}
          height={height}
          series={sides.map((s) => ({
            ...seriesOf(s),
            overs: s.overs.map((o) => ({
              over: o.over,
              runs: o.runs,
              wickets: o.wickets,
            })),
          }))}
        />
      </Panel>
    </div>
  );
}

type PanelProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

function CardPanel({ title, description, children }: PanelProps) {
  return (
    <Card className="break-inside-avoid">
      <CardHeader title={title} description={description} />
      <div className="space-y-3 px-4 pb-4 sm:px-5 sm:pb-5">{children}</div>
    </Card>
  );
}

/** A chart on a flat sheet: a firm rule, the title and its note, the chart. */
function FlatPanel({ title, description, children }: PanelProps) {
  return (
    <div className="min-w-0 space-y-2 border-t-[1.5px] border-foreground pt-1.5">
      <h3 className="text-sm font-semibold text-foreground">
        {title}{" "}
        <span className="text-xs font-medium text-muted-foreground">
          {description}
        </span>
      </h3>
      {children}
    </div>
  );
}
