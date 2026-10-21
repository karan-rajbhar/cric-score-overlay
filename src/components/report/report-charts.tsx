import { Card, CardHeader } from "~/components/ds/card";
import { ChartLegend, OverBarsChart, WormChart } from "~/components/ds/charts";
import type { MatchReportModel } from "~/lib/match-report";

/** Drawn at this width and scaled to fit, so the PDF matches the screen. */
const CHART_W = 380;

/** The run progression and runs per over, side by side on A4. */
export function ReportCharts({
  charts,
}: {
  charts: NonNullable<MatchReportModel["charts"]>;
}) {
  const sides = charts.sides.slice(0, 2).map((s, i) => ({
    ...s,
    series: (i + 1) as 1 | 2,
  }));
  const vs = sides.map((s) => `${s.label} ${s.score}`).join(" vs ");
  return (
    <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
      <Card className="break-inside-avoid">
        <CardHeader
          title="Run progression"
          description="Runs over by over; dots mark wickets."
        />
        <div className="space-y-3 px-4 pb-4 sm:px-5 sm:pb-5">
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
            height={220}
            series={sides.map((s) => ({
              key: s.key,
              label: s.label,
              series: s.series,
              points: s.overs.map((o) => ({
                over: o.over,
                runs: o.total,
                wicketsSoFar: o.totalWickets,
                wickets: o.wickets,
              })),
            }))}
          />
        </div>
      </Card>
      <Card className="break-inside-avoid">
        <CardHeader
          title="Runs per over"
          description="Both sides on one scale; red dots are wickets."
        />
        <div className="space-y-3 px-4 pb-4 sm:px-5 sm:pb-5">
          <ChartLegend
            items={[
              ...sides.map((s) => ({ label: s.label, series: s.series })),
              { label: "Wicket", swatch: "bg-wicket", shape: "dot" as const },
            ]}
          />
          <OverBarsChart
            label={`Runs per over: ${vs}`}
            maxOvers={Math.max(1, ...sides.map((s) => s.overs.length))}
            width={CHART_W}
            height={220}
            series={sides.map((s) => ({
              key: s.key,
              label: s.label,
              series: s.series,
              overs: s.overs.map((o) => ({
                over: o.over,
                runs: o.runs,
                wickets: o.wickets,
              })),
            }))}
          />
        </div>
      </Card>
    </div>
  );
}
