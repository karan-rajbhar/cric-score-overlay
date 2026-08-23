-- Native per-over rollup so scoring surfaces (Manhattan chart, over
-- comparison, live over summary) never need to haul the full ball log
-- through joins. Postgres aggregates ball_by_ball once, here, with the
-- same index the scoring engine already uses.
--
-- This is a view rather than a rollup table: it cannot drift from the
-- ball log, needs no engine writes, and the underlying index makes it
-- effectively free for match-sized data (<= ~150 rows per innings).

CREATE OR REPLACE VIEW public.match_over_summaries
WITH (security_invoker = true) AS
SELECT
  b.match_id,
  b.innings_id,
  b.over_number,
  COALESCE(SUM(b.runs_scored), 0) AS runs,
  COALESCE(SUM(
    CASE WHEN b.extra_type IN ('bye', 'leg_bye', 'penalty') THEN 0 ELSE COALESCE(b.extras, 0) END
  ), 0) AS extras_off_bat_and_bowler,
  COUNT(*) FILTER (WHERE b.is_wicket) AS wickets,
  COUNT(*) FILTER (WHERE b.extra_type = 'wide') AS wides,
  COUNT(*) FILTER (WHERE b.extra_type = 'no_ball') AS no_balls,
  COUNT(*) FILTER (
    WHERE b.extra_type IS NULL OR b.extra_type NOT IN ('wide', 'no_ball')
  ) AS legal_deliveries,
  (ARRAY_AGG(b.bowler_id ORDER BY b.seq))[1] AS bowler_id
FROM public.ball_by_ball b
GROUP BY b.match_id, b.innings_id, b.over_number;

COMMENT ON VIEW public.match_over_summaries IS
  'Per-over rollup for Manhattan/over-comparison surfaces; native aggregation over ball_by_ball.';

GRANT SELECT ON public.match_over_summaries TO anon, authenticated;
