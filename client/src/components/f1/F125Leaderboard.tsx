import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

interface LeaderboardEntry {
  rank: number;
  date: string;
  lapTime: string;
  player: string;
  team: string;
  sessionType: string;
}

interface F125TrackData {
  leaderboard?: LeaderboardEntry[];
}

interface F125TrackSummary {
  trackSlug: string;
  trackOrdinal: number;
}

export function F125Leaderboard({ trackOrdinal }: { trackOrdinal: number }) {
  const { data: tracks = [] } = useQuery<F125TrackSummary[]>({
    queryKey: ["f125-tracks"],
    queryFn: () => client.api["f1-25"].tracks.$get().then(r => r.json() as any),
  });

  const trackSlug = tracks.find(t => t.trackOrdinal === trackOrdinal)?.trackSlug;

  const { data: trackData } = useQuery<F125TrackData>({
    queryKey: ["f125-setups", trackSlug],
    queryFn: () => client.api["f1-25"].setups.$get({ query: { track: trackSlug! } }).then(r => r.json() as any),
    enabled: !!trackSlug,
  });

  const leaderboard = trackData?.leaderboard;
  if (!leaderboard?.length) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="text-app-label text-app-text-muted uppercase tracking-wider">
          F1Laps Leaderboard
        </div>
        <a
          href={`https://www.f1laps.com/f1-25/leaderboard/${trackSlug}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-app-unit text-app-accent hover:underline"
        >
          View Full
        </a>
      </div>
      <table className="w-full text-app-unit">
        <thead>
          <tr className="text-app-text-dim uppercase border-b border-app-border/20">
            <th className="text-left py-1 px-1 w-6">#</th>
            <th className="text-left py-1 px-1">Player</th>
            <th className="text-left py-1 px-1">Team</th>
            <th className="text-left py-1 px-1">Session</th>
            <th className="text-right py-1 px-1">Time</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((e) => (
            <tr key={e.rank} className="border-b border-app-border/10 hover:bg-app-surface-alt/30">
              <td className="py-1 px-1 text-app-text-dim font-mono">{e.rank}</td>
              <td className="py-1 px-1 text-app-text font-medium">{e.player}</td>
              <td className="py-1 px-1 text-app-text-secondary">{e.team}</td>
              <td className="py-1 px-1 text-app-text-dim">{e.sessionType}</td>
              <td className="py-1 px-1 text-right font-mono text-emerald-400">{e.lapTime}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
