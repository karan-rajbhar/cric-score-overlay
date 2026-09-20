-- Manhattan over chart undercounted team runs: `runs` only sums
-- runs_scored while `extras_off_bat_and_bowler` excludes
-- bye/leg_bye/penalty. Expose the full extras total per over so charts can
-- show true team runs (bat + all extras).

DROP VIEW IF EXISTS public.match_over_summaries CASCADE;

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
  (ARRAY_AGG(b.bowler_id ORDER BY b.seq))[1] AS bowler_id,
  COALESCE(SUM(b.extras), 0) AS extras_total
FROM public.ball_by_ball b
GROUP BY b.match_id, b.innings_id, b.over_number;

COMMENT ON VIEW public.match_over_summaries IS
  'Per-over rollup for Manhattan/over-comparison surfaces; native aggregation over ball_by_ball.';

GRANT SELECT ON public.match_over_summaries TO anon, authenticated;
