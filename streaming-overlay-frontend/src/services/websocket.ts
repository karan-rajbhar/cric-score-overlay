import { io, Socket } from "socket.io-client";
import { CricketMatch } from "../types/cricket";

type ScoreUpdate = {
  type: string;
  timestamp: string;
  runs?: number;
  extras?: number;
  wicket?: boolean;
};

export class CricketWebSocketService {
  private socket: Socket;

  constructor() {
    this.socket = io(import.meta.env.VITE_WS_URL);

    this.socket.on("connect", () => {
      console.log("Connected to WebSocket");
    });
  }

  subscribeToMatchUpdates(callback: (match: CricketMatch) => void) {
    this.socket.on("match_update", callback);
  }

  sendScore(update: ScoreUpdate) {
    this.socket.emit("score_update", update);
  }

  updateBowler(bowlerId: string) {
    this.socket.emit("bowler_change", { bowlerId });
  }

  updateStriker(batsmanId: string) {
    this.socket.emit("striker_change", { batsmanId });
  }
}
