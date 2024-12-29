import React from "react";
import { useWebSocket } from "../../hooks/useWebSocket";

const SCORING_OPTIONS = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "6",
  "W",
  "WD",
  "NB",
  "B",
  "LB",
];

export const ScoreInput: React.FC = () => {
  const { sendScore } = useWebSocket();

  const handleScoreClick = (score: string) => {
    sendScore({
      type: score,
      timestamp: new Date().toISOString(),
    });
  };

  return (
    <div className="grid grid-cols-4 gap-2">
      {SCORING_OPTIONS.map((score) => (
        <button
          key={score}
          onClick={() => handleScoreClick(score)}
          className="p-4 bg-blue-500 text-white rounded"
        >
          {score}
        </button>
      ))}
    </div>
  );
};
