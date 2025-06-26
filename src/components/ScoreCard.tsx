/**
 * Cricket ScoreCard Component
 * 
 * A example component showing how to use shadcn/ui for cricket-specific UI
 */

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";

interface ScoreCardProps {
  match: {
    id: string;
    team1: string;
    team2: string;
    status: 'upcoming' | 'live' | 'completed';
    team1Score?: {
      runs: number;
      wickets: number;
      overs: number;
    };
    team2Score?: {
      runs: number;
      wickets: number;
      overs: number;
    };
    currentBatsmen?: {
      batsman1: { name: string; runs: number; balls: number };
      batsman2: { name: string; runs: number; balls: number };
    };
    recentOvers?: string[];
  };
}

export function ScoreCard({ match }: ScoreCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live':
        return 'bg-red-500 hover:bg-red-600';
      case 'completed':
        return 'bg-green-500 hover:bg-green-600';
      default:
        return 'bg-blue-500 hover:bg-blue-600';
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl font-bold">
            {match.team1} vs {match.team2}
          </CardTitle>
          <Badge className={getStatusColor(match.status)}>
            {match.status === 'live' ? '🔴 LIVE' : match.status.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Team Scores */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">{match.team1}</h3>
                {match.team1Score ? (
                  <div className="text-3xl font-bold">
                    {match.team1Score.runs}/{match.team1Score.wickets}
                    <span className="text-sm text-muted-foreground ml-2">
                      ({match.team1Score.overs} overs)
                    </span>
                  </div>
                ) : (
                  <div className="text-xl text-muted-foreground">Yet to bat</div>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">{match.team2}</h3>
                {match.team2Score ? (
                  <div className="text-3xl font-bold">
                    {match.team2Score.runs}/{match.team2Score.wickets}
                    <span className="text-sm text-muted-foreground ml-2">
                      ({match.team2Score.overs} overs)
                    </span>
                  </div>
                ) : (
                  <div className="text-xl text-muted-foreground">Yet to bat</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Current Batsmen (only show if match is live) */}
        {match.status === 'live' && match.currentBatsmen && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Current Batsmen</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batsman</TableHead>
                    <TableHead>Runs</TableHead>
                    <TableHead>Balls</TableHead>
                    <TableHead>Strike Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">
                      {match.currentBatsmen.batsman1.name}
                    </TableCell>
                    <TableCell>{match.currentBatsmen.batsman1.runs}</TableCell>
                    <TableCell>{match.currentBatsmen.batsman1.balls}</TableCell>
                    <TableCell>
                      {((match.currentBatsmen.batsman1.runs / match.currentBatsmen.batsman1.balls) * 100).toFixed(1)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      {match.currentBatsmen.batsman2.name}
                    </TableCell>
                    <TableCell>{match.currentBatsmen.batsman2.runs}</TableCell>
                    <TableCell>{match.currentBatsmen.batsman2.balls}</TableCell>
                    <TableCell>
                      {((match.currentBatsmen.batsman2.runs / match.currentBatsmen.batsman2.balls) * 100).toFixed(1)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Recent Overs */}
        {match.recentOvers && match.recentOvers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Overs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {match.recentOvers.map((over, index) => (
                  <Badge key={index} variant="outline" className="font-mono">
                    {over}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 justify-center">
          <Button variant="outline">
            View Scorecard
          </Button>
          <Button variant="outline">
            Ball by Ball
          </Button>
          {match.status === 'live' && (
            <Button>
              Live Commentary
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 