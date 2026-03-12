import { useEffect, useState } from "react";
import { useLocation } from "wouter";
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

const USER_COLORS = ["#007AFF", "#FF9500"];

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

  const buildChartData = (rawCheckIns: any[], userStats: UserStat[]) => {
    const userNames = userStats.map((s) => s.username);
    const moodMap: Record<string, ChartPoint> = {};
    const cravingMap: Record<string, ChartPoint> = {};
    const energyMap: Record<string, ChartPoint> = {};

    rawCheckIns.forEach((row: any) => {
      const d = new Date(row.createdAt);
      const dateKey = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
      const name = row.username;
      if (!name || !userNames.includes(name)) return;

      if (!moodMap[dateKey]) moodMap[dateKey] = { date: dateKey };
      if (!cravingMap[dateKey]) cravingMap[dateKey] = { date: dateKey };
      if (!energyMap[dateKey]) energyMap[dateKey] = { date: dateKey };

      moodMap[dateKey][name] = row.mood;
      cravingMap[dateKey][name] = row.craving;
      energyMap[dateKey][name] = row.energy;
    });

    const sort = (map: Record<string, ChartPoint>) =>
      Object.values(map).sort((a, b) => a.date.localeCompare(b.date));

    setMoodChartData(sort(moodMap));
    setCravingChartData(sort(cravingMap));
    setEnergyChartData(sort(energyMap));
  };

  const fetchStats = async (p: number) => {
    try {
      const res = await fetch(`/api/stats?page=${p}&limit=20`);
      if (res.status === 401 || res.status === 403) {
        setLocation("/login");
        return;
      }
      const data = await res.json();
      setStats(data.stats);
      if (p === 0) {
        setEntries(data.entries);
        if (data.chartData) buildChartData(data.chartData, data.stats);
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

  const loadMore = () => { setLoadingMore(true); fetchStats(page + 1); };

  const moodEmoji = (val: number) => {
    if (val <= 1) return "😞";
    if (val <= 2) return "😕";
    if (val <= 3) return "😐";
    if (val <= 4) return "🙂";
    return "😊";
  };

  const moodLabel = (val: number) => ({ 1: "Bloga", 2: "Prasta", 3: "Vidutinė", 4: "Gera", 5: "Puiki" }[val] || "");
  const cravingLabel = (val: number) => ({ 1: "Nenoriu", 2: "Šiek tiek", 3: "Vidutiniškai", 4: "Noriu", 5: "Labai noriu" }[val] || "");
  const energyLabel = (val: number) => ({ 1: "Nėra jėgų", 2: "Silpna", 3: "Vidutinė", 4: "Gera", 5: "Skraidau" }[val] || "");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F2F2F7]">
        <div className="text-[15px] text-[#8E8E93]">Kraunasi...</div>
      </div>
    );
  }

  const usernames = stats.map((s) => s.username);

  const renderChart = (data: ChartPoint[], title: string, color: string, testId: string) => {
    if (data.length === 0) return null;
    return (
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" data-testid={testId}>
        <div className="px-4 pt-4 pb-2">
          <div className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wider">{title}</div>
        </div>
        <div className="px-2 pb-3">
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={data}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#8E8E93" }} axisLine={false} tickLine={false} />
              <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10, fill: "#8E8E93" }} width={20} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.12)", fontSize: 12 }} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11, color: "#8E8E93" }} />
              {usernames.map((name, i) => (
                <Line key={name} type="monotone" dataKey={name} stroke={USER_COLORS[i % USER_COLORS.length]} strokeWidth={2.5} dot={{ r: 3, fill: USER_COLORS[i % USER_COLORS.length] }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7]" data-testid="statistics-page">
      <div className="sticky top-0 z-50 ios-header px-4 py-3 flex items-center gap-2">
        <button
          onClick={() => setLocation("/")}
          className="w-8 h-8 flex items-center justify-center rounded-full active:bg-[#E5E5EA] transition-colors -ml-1"
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5 text-[#007AFF]" />
        </button>
        <h1 className="text-[17px] font-semibold text-[#1C1C1E]">Statistika</h1>
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto pb-8">
        {renderChart(moodChartData, "Nuotaika", "#007AFF", "chart-mood")}
        {renderChart(cravingChartData, "Potraukis", "#FF9500", "chart-craving")}
        {renderChart(energyChartData, "Energija", "#34C759", "chart-energy")}

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" data-testid="stats-summary">
          <div className="px-4 pt-4 pb-2">
            <div className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wider">Bendra statistika</div>
          </div>
          <div className="px-4 pb-4 grid grid-cols-2 gap-3">
            {stats.map((s) => (
              <div key={s.userId} className="bg-[#F2F2F7] rounded-xl p-3 text-center space-y-1.5">
                <div className="text-[15px] font-semibold text-[#1C1C1E]">{s.username}</div>
                <div className="text-[12px] text-[#8E8E93]">{s.totalCheckins} įrašai</div>
                <div className="text-[12px] text-[#8E8E93]">Nuotaika: <span className="text-[#1C1C1E] font-medium">{s.avgMood || "—"}</span></div>
                <div className="text-[12px] text-[#8E8E93]">Potraukis: <span className="text-[#1C1C1E] font-medium">{s.avgCraving || "—"}</span></div>
                <div className="text-[12px] text-[#8E8E93]">Energija: <span className="text-[#1C1C1E] font-medium">{s.avgEnergy || "—"}</span></div>
              </div>
            ))}
          </div>
        </div>

        {entries.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden" data-testid="stats-entries">
            <div className="px-4 pt-4 pb-2">
              <div className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wider">Paskutiniai įrašai</div>
            </div>
            <div className="divide-y divide-[#F2F2F7]">
              {entries.map((c, idx) => {
                const d = new Date(c.createdAt);
                const dateStr = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
                return (
                  <div key={c.id} className="px-4 py-3" data-testid={`checkin-entry-${c.id}`}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[14px] font-semibold text-[#1C1C1E]">{c.username}</span>
                      <span className="text-[12px] text-[#8E8E93]">{dateStr}</span>
                    </div>
                    <div className="flex gap-4 text-[13px] text-[#8E8E93]">
                      <span>{moodEmoji(c.mood)} {c.mood}/5</span>
                      <span>🍬 {c.craving}/5</span>
                      <span>⚡ {c.energy}/5</span>
                    </div>
                    {c.note && (
                      <div className="text-[12px] text-[#8E8E93] mt-1 italic">„{c.note}"</div>
                    )}
                  </div>
                );
              })}
            </div>

            {hasMore && (
              <div className="px-4 pb-4 pt-2">
                <button
                  className="w-full py-3 rounded-xl bg-[#F2F2F7] text-[#007AFF] text-[15px] font-medium active:bg-[#E5E5EA] transition-colors disabled:opacity-50"
                  onClick={loadMore}
                  disabled={loadingMore}
                  data-testid="button-load-more"
                >
                  {loadingMore ? "Kraunasi..." : "Daugiau įrašų"}
                </button>
              </div>
            )}
          </div>
        )}

        {entries.length === 0 && (
          <div className="text-center text-[#8E8E93] py-12 text-[15px]">
            Dar nėra patikrinimų
          </div>
        )}
      </div>
    </div>
  );
}
