import React from "react";
import { CricketMatch } from "../../types/cricket";

interface ScoreBoardProps {
  match: CricketMatch;
}

export const ScoreBoard: React.FC<ScoreBoardProps> = ({ match }) => {
  const battingTeam = match.currentInnings === 1 ? match.team1 : match.team2;
  const bowlingTeam = match.currentInnings === 1 ? match.team2 : match.team1;

  return (
    <div className="score-board">
      <div className="main-score">
        <div className="team-score">
          {battingTeam.name}: {battingTeam.score}/{battingTeam.wickets}
          <span className="overs">({battingTeam.overs})</span>
        </div>
        {match.currentInnings === 2 && (
          <div className="target">
            Target: {match.target}
            <span className="required-rate">RRR: {match.requiredRunRate}</span>
          </div>
        )}
      </div>

      <div className="batsmen">
        {battingTeam.players
          .filter((player) => player.isStriker !== undefined)
          .map((player) => (
            <div key={player.id} className="batsman">
              {player.name} {player.runs}({player.balls})
              {player.isStriker && "*"}
            </div>
          ))}
      </div>

      <div className="bowler">
        {bowlingTeam.bowlers
          .filter((bowler) => bowler.overs % 1 !== 0)
          .map((bowler) => (
            <div key={bowler.id}>
              {bowler.name}: {bowler.wickets}-{bowler.runs}
            </div>
          ))}
      </div>

      <div className="this-over">This Over: {match.currentOver.join(" ")}</div>
    </div>
  );
};
