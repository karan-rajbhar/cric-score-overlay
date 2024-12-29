from typing import Literal, Optional

from pydantic import BaseModel


class Player(BaseModel):
    id: str
    name: str
    runs: Optional[int] = 0
    balls: Optional[int] = 0
    fours: Optional[int] = 0
    sixes: Optional[int] = 0
    strike_rate: Optional[float] = 0.0
    is_striker: Optional[bool] = False


class Bowler(BaseModel):
    id: str
    name: str
    overs: float = 0.0
    maidens: int = 0
    runs: int = 0
    wickets: int = 0
    economy: float = 0.0


class Team(BaseModel):
    id: str
    name: str
    score: int = 0
    wickets: int = 0
    overs: float = 0.0
    run_rate: float = 0.0
    players: list[Player]
    bowlers: list[Bowler]


class CricketMatch(BaseModel):
    id: str
    team1: Team
    team2: Team
    current_innings: Literal[1, 2] = 1
    match_type: Literal["T20", "ODI", "TEST"]
    overs_limit: Optional[int]
    target: Optional[int]
    required_run_rate: Optional[float]
    last_ball: Optional[str]
    current_over: list[str] = []
    partnership: dict = {"runs": 0, "balls": 0}
