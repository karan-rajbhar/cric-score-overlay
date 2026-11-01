"use client";

import { Fragment, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "~/components/ds/avatar";
import { Button } from "~/components/ds/button";
import { ListCard, ListRow, SectionHeader } from "~/components/ds/list";
import { matchParts, partFigures } from "~/lib/match-players";
import type { Match } from "~/lib/match-types";
import { ReplacePlayerPanel } from "./replace-player-panel";
import {
  ReplacedPlayerNotice,
  type ReplacedPlayerInfo,
} from "./replaced-player-notice";

type EditorMatch = Pick<
  Match,
  "id" | "team1_id" | "team2_id" | "team1" | "team2" | "innings" | "club_id"
>;

/**
 * The match's team sheet for its scorers (Play-Cricket's Team Selection,
 * NV Play's Teams): each team's players with what they did, and Replace
 * beside each one. The choice of who really played opens under that row,
 * not in a dialog, so the player and their figures stay in view.
 */
export function MatchPlayersEditor({ match }: { match: EditorMatch }) {
  const router = useRouter();
  const baseId = useId();
  const parts = useMemo(() => matchParts(match), [match]);
  const inMatch = useMemo(() => new Set(parts.map((p) => p.id)), [parts]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [replaced, setReplaced] = useState<ReplacedPlayerInfo | null>(null);

  return (
    <div className="space-y-6">
      {replaced && (
        <ReplacedPlayerNotice
          matchId={match.id}
          player={replaced}
          onClose={() => setReplaced(null)}
        />
      )}
      <p className="text-sm text-muted-foreground [text-wrap:pretty]">
        Recorded the wrong person? Tap Replace next to them and pick who really
        played. Their runs, wickets and catches move across; the score stays
        the same.
      </p>
      {[match.team1, match.team2].map((team) => {
        const teamParts = parts.filter((p) => p.teamId === team.id);
        return (
          <section key={team.id} className="space-y-3">
            <SectionHeader as="h2" title={team.name} />
            <ListCard>
              {teamParts.map((p) => {
                const open = openId === p.id;
                const panelId = `${baseId}-${p.id}`;
                return (
                  <Fragment key={p.id}>
                    <ListRow
                      leading={<Avatar name={p.name} size="sm" />}
                      title={p.name}
                      subtitle={
                        <span className="tabular-nums">
                          {p.username && `@${p.username} · `}
                          {partFigures(p) || "Fielded"}
                        </span>
                      }
                      trailing={
                        <Button
                          variant={open ? "soft" : "outline"}
                          size="sm"
                          aria-expanded={open}
                          aria-controls={open ? panelId : undefined}
                          aria-label={`Replace ${p.name}`}
                          onClick={() => setOpenId(open ? null : p.id)}
                        >
                          Replace
                        </Button>
                      }
                    />
                    {open && (
                      <ReplacePlayerPanel
                        id={panelId}
                        matchId={match.id}
                        clubId={match.club_id}
                        part={p}
                        team={team}
                        inMatch={inMatch}
                        onCancel={() => setOpenId(null)}
                        onDone={(leftover) => {
                          setOpenId(null);
                          setReplaced(
                            leftover && {
                              id: p.id,
                              name: p.name,
                              teamId: team.id,
                              teamName: team.name,
                              otherMatches: leftover.otherMatches,
                            },
                          );
                          router.refresh();
                        }}
                      />
                    )}
                  </Fragment>
                );
              })}
              {teamParts.length === 0 && (
                <p className="px-4 py-5 text-center text-sm text-muted-foreground">
                  Nobody from {team.name} has batted, bowled or fielded yet.
                </p>
              )}
            </ListCard>
          </section>
        );
      })}
    </div>
  );
}
