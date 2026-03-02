import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

type CheckInEntry = {
  id: string;
  userId: string;
  mood: number;
  craving: number;
  trigger: string;
  note: string | null;
  createdAt: string;
  username: string | null;
};

type UserStats = {
  userId: string;
  username: string;
  totalCheckins: number;
  avgMood: string | null;
  avgCraving: string | null;
  checkins: CheckInEntry[];
};

export default function StatisticsPage() {
  const [, setLocation] = useLocation();
  const [stats, setStats] = useState<UserStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/stats");
      if (!res.ok) {
        setLocation("/login");
        return;
      }
      const data = await res.json();
      setStats(data);
    } catch {
      setLocation("/login");
    } finally {
      setLoading(false);
    }
  };

  const moodEmoji = (val: number) => {
    if (val <= 1) return "😞";
    if (val <= 2) return "😕";
    if (val <= 3) return "😐";
    if (val <= 4) return "🙂";
    return "😊";
  };

  const cravingLabel = (val: number) => {
    if (val <= 1) return "Labai silpnas";
    if (val <= 2) return "Silpnas";
    if (val <= 3) return "Vidutinis";
    if (val <= 4) return "Stiprus";
    return "Labai stiprus";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-500">Kraunasi...</div>
      </div>
    );
  }

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
        {stats.map((userStat) => (
          <Card key={userStat.userId} data-testid={`stats-card-${userStat.userId}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{userStat.username}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-blue-600" data-testid={`text-total-checkins-${userStat.userId}`}>
                    {userStat.totalCheckins}
                  </div>
                  <div className="text-xs text-gray-500">Patikrinimai</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-green-600" data-testid={`text-avg-mood-${userStat.userId}`}>
                    {userStat.avgMood || "—"}
                  </div>
                  <div className="text-xs text-gray-500">Vid. nuotaika</div>
                </div>
                <div className="bg-orange-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-orange-600" data-testid={`text-avg-craving-${userStat.userId}`}>
                    {userStat.avgCraving || "—"}
                  </div>
                  <div className="text-xs text-gray-500">Vid. troškimas</div>
                </div>
              </div>

              {userStat.checkins.length > 0 && (
                <div className="space-y-2 mt-3">
                  <div className="text-sm font-medium text-gray-600">Paskutiniai patikrinimai</div>
                  {userStat.checkins.map((c) => {
                    const d = new Date(c.createdAt);
                    const dateStr = `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
                    return (
                      <div
                        key={c.id}
                        className="bg-gray-50 rounded-lg p-3 text-sm"
                        data-testid={`checkin-entry-${c.id}`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-gray-400 text-xs">{dateStr}</span>
                          <span className="text-xs bg-gray-200 rounded px-2 py-0.5">{c.trigger}</span>
                        </div>
                        <div className="flex gap-4">
                          <span>
                            {moodEmoji(c.mood)} Nuotaika: {c.mood}/5
                          </span>
                          <span>
                            🍬 Troškimas: {c.craving}/5 ({cravingLabel(c.craving)})
                          </span>
                        </div>
                        {c.note && (
                          <div className="text-gray-500 mt-1 italic">„{c.note}"</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {userStat.checkins.length === 0 && (
                <div className="text-center text-gray-400 py-4 text-sm">
                  Dar nėra patikrinimų
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
