import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

type CheckInEntry = {
  id: string;
  userId: string;
  mood: number;
  craving: number;
  energy: number;
  trigger: string;
  note: string | null;
  createdAt: string;
  username: string | null;
};

type UserStat = {
  userId: string;
  username: string;
  totalCheckins: number;
  avgMood: string | null;
  avgCraving: string | null;
  avgEnergy: string | null;
};

type ChartPoint = {
  date: string;
  [key: string]: number | string | undefined;
};

const USER_COLORS = ["#8b5cf6", "#f97316"];

export default function StatisticsPage() {
  const [, setLocation] = useLocation();
  const [stats, setStats] = useState<UserStat[]>([]);
  const [entries, setEntries] = useState<CheckInEntry[]>([]);
  const [moodChartData, setMoodChartData] = useState<ChartPoint[]>([]);
  const [cravingChartData, setCravingChartData] = useState<ChartPoint[]>([]);
  const [energyChartData, setEnergyChartData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    fetchStats(0);
  }, []);

  const buildChartData = (allCheckIns: CheckInEntry[], userStats: UserStat[]) => {
    const byDate: Record<string, Record<string, { mood: number; craving: number; energy: number }>> = {};

    allCheckIns.forEach((c) => {
      const d = new Date(c.createdAt);
      const dateKey = `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
      if (!byDate[dateKey]) byDate[dateKey] = {};
      if (c.username) {
        byDate[dateKey][c.username] = { mood: c.mood, craving: c.craving, energy: c.energy };
      }
    });

    const sortedDates = Object.keys(byDate).sort((a, b) => {
      const [am, ad] = a.split(".").map(Number);
      const [bm, bd] = b.split(".").map(Number);
      return am !== bm ? am - bm : ad - bd;
    });

    const usernames = userStats.map((u) => u.username);

    const moodPoints: ChartPoint[] = sortedDates.map((date) => {
      const point: ChartPoint = { date };
      usernames.forEach((name) => { point[name] = byDate[date]?.[name]?.mood; });
      return point;
    });

    const cravingPoints: ChartPoint[] = sortedDates.map((date) => {
      const point: ChartPoint = { date };
      usernames.forEach((name) => { point[name] = byDate[date]?.[name]?.craving; });
      return point;
    });

    const energyPoints: ChartPoint[] = sortedDates.map((date) => {
      const point: ChartPoint = { date };
      usernames.forEach((name) => { point[name] = byDate[date]?.[name]?.energy; });
      return point;
    });

    setMoodChartData(moodPoints);
    setCravingChartData(cravingPoints);
    setEnergyChartData(energyPoints);
  };

  const fetchStats = async (p: number) => {
    try {
      const res = await fetch(`/api/stats?page=${p}`);
      if (!res.ok) {
        setLocation("/login");
        return;
      }
      const data = await res.json();
      setStats(data.stats);
      if (p === 0) {
        setEntries(data.entries);
        if (data.chartData) {
          buildChartData(data.chartData, data.stats);
        }
      } else {
        setEntries((prev) => [...prev, ...data.entries]);
      }
      setHasMore(data.hasMore);
      setPage(p);
    } catch {
      setLocation("/login");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    setLoadingMore(true);
    fetchStats(page + 1);
  };

  const moodEmoji = (val: number) => {
    if (val <= 1) return "😞";
    if (val <= 2) return "😕";
    if (val <= 3) return "😐";
    if (val <= 4) return "🙂";
    return "😊";
  };

  const moodLabel = (val: number) => {
    const labels: Record<number, string> = { 1: "Bloga", 2: "Prasta", 3: "Vidutinė", 4: "Gera", 5: "Puiki" };
    return labels[val] || "";
  };

  const cravingLabel = (val: number) => {
    const labels: Record<number, string> = { 1: "Nenoriu", 2: "Šiek tiek", 3: "Vidutiniškai", 4: "Noriu", 5: "Labai noriu" };
    return labels[val] || "";
  };

  const energyLabel = (val: number) => {
    const labels: Record<number, string> = { 1: "Nėra jėgų", 2: "Silpna", 3: "Vidutinė", 4: "Gera", 5: "Skraidau" };
    return labels[val] || "";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-500">Kraunasi...</div>
      </div>
    );
  }

  const usernames = stats.map((s) => s.username);

  const renderChart = (data: ChartPoint[], title: string, testId: string) => {
    if (data.length === 0) return null;
    return (
      <Card data-testid={testId}>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} width={25} />
              <Tooltip />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              {usernames.map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={USER_COLORS[i % USER_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50" data-testid="statistics-page">
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Statistika</h1>
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {renderChart(moodChartData, "Nuotaika pagal dienas", "chart-mood")}
        {renderChart(cravingChartData, "Potraukis pagal dienas", "chart-craving")}
        {renderChart(energyChartData, "Energija pagal dienas", "chart-energy")}

        <Card data-testid="stats-summary">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Bendra statistika</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {stats.map((s) => (
                <div key={s.userId} className="bg-gray-50 rounded-lg p-3 text-center space-y-1">
                  <div className="text-sm font-semibold">{s.username}</div>
                  <div className="text-xs text-gray-500">Įrašai: {s.totalCheckins}</div>
                  <div className="text-xs text-gray-500">Vid. nuotaika: {s.avgMood || "—"}</div>
                  <div className="text-xs text-gray-500">Vid. potraukis: {s.avgCraving || "—"}</div>
                  <div className="text-xs text-gray-500">Vid. energija: {s.avgEnergy || "—"}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {entries.length > 0 && (
          <Card data-testid="stats-entries">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Paskutiniai įrašai</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {entries.map((c) => {
                const d = new Date(c.createdAt);
                const dateStr = `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
                return (
                  <div
                    key={c.id}
                    className="bg-gray-50 rounded-lg p-3 text-sm"
                    data-testid={`checkin-entry-${c.id}`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-xs">{c.username}</span>
                      <span className="text-gray-400 text-xs">{dateStr}</span>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <span>{moodEmoji(c.mood)} {c.mood}/5 ({moodLabel(c.mood)})</span>
                      <span>🍬 {c.craving}/5 ({cravingLabel(c.craving)})</span>
                      <span>⚡ {c.energy}/5 ({energyLabel(c.energy)})</span>
                    </div>
                    {c.note && (
                      <div className="text-gray-500 mt-1 italic text-xs">„{c.note}"</div>
                    )}
                  </div>
                );
              })}

              {hasMore && (
                <Button
                  variant="outline"
                  className="w-full mt-2"
                  onClick={loadMore}
                  disabled={loadingMore}
                  data-testid="button-load-more"
                >
                  {loadingMore ? "Kraunasi..." : "Daugiau įrašų"}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {entries.length === 0 && (
          <div className="text-center text-gray-400 py-8 text-sm">
            Dar nėra patikrinimų
          </div>
        )}
      </div>
    </div>
  );
}
