import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Menu, X, Send, Home, SmilePlus, BarChart3, LogOut } from "lucide-react";

type Message = {
  id: string;
  userId: string | null;
  content: string;
  isCoach: boolean;
  createdAt: string;
  username: string | null;
};

type User = {
  id: string;
  username: string;
};

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [streak, setStreak] = useState({ days: 0, hours: 0 });
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const [mood, setMood] = useState<number>(3);
  const [craving, setCraving] = useState<number>(3);
  const [note, setNote] = useState<string>("");
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [submittingCheckIn, setSubmittingCheckIn] = useState(false);

  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    fetchUser();
    fetchStreak();
    fetchMessages();

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => console.log("WebSocket connected");

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "new_message") {
        setMessages((prev) => [...prev, data.message]);
      } else if (data.type === "streak_update") {
        fetchStreak();
      }
    };

    wsRef.current = ws;
    return () => ws.close();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) { setLocation("/login"); return; }
      const data = await res.json();
      setUser(data.user);
    } catch { setLocation("/login"); }
    finally { setLoading(false); }
  };

  const fetchStreak = async () => {
    try {
      const res = await fetch("/api/streak");
      const data = await res.json();
      setStreak({ days: data.days, hours: data.hours });
    } catch (error) {
      console.error("Failed to fetch streak:", error);
    }
  };

  const fetchMessages = async () => {
    try {
      const res = await fetch("/api/messages");
      const data = await res.json();
      setMessages(data);
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newMessage }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      const message = await res.json();
      setNewMessage("");
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "new_message", message }));
      }
    } catch {
      toast({ title: "Klaida", description: "Nepavyko išsiųsti žinutės", variant: "destructive" });
    }
  };

  const submitCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingCheckIn(true);
    try {
      const res = await fetch("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood, craving, note }),
      });
      if (!res.ok) throw new Error("Failed to submit check-in");
      const data = await res.json();
      setCheckInOpen(false);
      setMood(3);
      setCraving(3);
      setNote("");

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "new_message", message: data.chatMessage }));
        if (data.coachMessage) {
          wsRef.current.send(JSON.stringify({ type: "new_message", message: data.coachMessage }));
        }
      }
    } catch {
      toast({ title: "Klaida", description: "Nepavyko išsaugoti", variant: "destructive" });
    } finally {
      setSubmittingCheckIn(false);
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setLocation("/login");
    } catch {
      console.error("Logout failed");
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-500">Kraunasi...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50" data-testid="dashboard-page">
      <header className="sticky top-0 z-50 bg-gradient-to-r from-purple-600 to-pink-500 text-white px-4 py-3 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base font-semibold truncate" data-testid="text-streak">
            Be saldumynų: {streak.days} d. ir {streak.hours} val.
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMenuOpen(!menuOpen)}
          data-testid="button-menu"
          className="shrink-0"
        >
          {menuOpen ? <X className="h-6 w-6 text-white" /> : <Menu className="h-6 w-6 text-white" />}
        </Button>
      </header>

      {menuOpen && (
        <div className="absolute top-[57px] right-0 left-0 z-40 bg-white border-b border-gray-200 shadow-lg" data-testid="menu-dropdown">
          <nav className="flex flex-col">
            <button
              className="flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 active:bg-gray-100 border-b border-gray-100"
              onClick={() => { setMenuOpen(false); }}
              data-testid="menu-home"
            >
              <Home className="h-5 w-5 text-gray-500" />
              <span className="font-medium">Pradžia</span>
            </button>
            <button
              className="flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 active:bg-gray-100 border-b border-gray-100"
              onClick={() => { setMenuOpen(false); setCheckInOpen(true); }}
              data-testid="menu-checkin"
            >
              <SmilePlus className="h-5 w-5 text-gray-500" />
              <span className="font-medium">Dienos savijauta</span>
            </button>
            <button
              className="flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 active:bg-gray-100 border-b border-gray-100"
              onClick={() => { setMenuOpen(false); setLocation("/statistics"); }}
              data-testid="menu-statistics"
            >
              <BarChart3 className="h-5 w-5 text-gray-500" />
              <span className="font-medium">Statistika</span>
            </button>
            <button
              className="flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 active:bg-gray-100 text-red-600"
              onClick={() => { setMenuOpen(false); logout(); }}
              data-testid="menu-logout"
            >
              <LogOut className="h-5 w-5" />
              <span className="font-medium">Atsijungti</span>
            </button>
          </nav>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-3" data-testid="chat-area">
        <div className="space-y-2 max-w-2xl mx-auto">
          {messages.map((msg) => {
            const isOwn = msg.userId === user?.id;
            const isCoach = msg.isCoach;
            const d = new Date(msg.createdAt);
            const mm = String(d.getMonth() + 1).padStart(2, "0");
            const dd = String(d.getDate()).padStart(2, "0");
            const hh = String(d.getHours()).padStart(2, "0");
            const min = String(d.getMinutes()).padStart(2, "0");
            const timestamp = `${mm}.${dd} / ${hh}:${min}`;

            return (
              <div
                key={msg.id}
                data-testid={`message-${msg.id}`}
                className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                    isCoach
                      ? "bg-amber-50 border border-amber-200 text-amber-900"
                      : isOwn
                        ? "bg-blue-500 text-white"
                        : "bg-white border border-gray-200 text-gray-900"
                  }`}
                >
                  {isCoach && (
                    <div className="text-xs font-semibold mb-1">🤖 Treneris</div>
                  )}
                  {!isOwn && !isCoach && (
                    <div className="text-xs font-semibold mb-1 text-gray-500">
                      👤 {msg.username || "Partneris"}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap text-[15px]">{msg.content}</div>
                  <div
                    className={`text-[11px] mt-1 ${
                      isOwn && !isCoach ? "text-blue-100" : "text-gray-400"
                    }`}
                  >
                    {timestamp}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-3 py-3 shrink-0">
        <form
          onSubmit={sendMessage}
          className="flex gap-2 max-w-2xl mx-auto"
          data-testid="form-send-message"
        >
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Rašykite žinutę..."
            className="flex-1"
            data-testid="input-message"
          />
          <Button type="submit" size="icon" data-testid="button-send">
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </div>

      <Dialog open={checkInOpen} onOpenChange={setCheckInOpen}>
        <DialogContent className="max-w-sm !bg-white dark:!bg-gray-900 !border-2 !border-gray-300 dark:!border-gray-600 shadow-2xl z-[100]">
          <DialogHeader>
            <DialogTitle className="text-xl">Dienos savijauta</DialogTitle>
            <DialogDescription>Kaip jaučiuosi šiandien?</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitCheckIn} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Nuotaika</Label>
              <div className="flex justify-between gap-1">
                {[0, 1, 2, 3, 4, 5].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setMood(val)}
                    className={`w-11 h-11 rounded-full text-sm font-semibold transition-all ${
                      mood === val
                        ? "bg-purple-500 text-white scale-110 shadow-md"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                    data-testid={`button-mood-${val}`}
                  >
                    {val}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-[11px] text-gray-400 px-1">
                <span>Prastai</span>
                <span>Puiki</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Potraukis</Label>
              <div className="flex justify-between gap-1">
                {[0, 1, 2, 3, 4, 5].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setCraving(val)}
                    className={`w-11 h-11 rounded-full text-sm font-semibold transition-all ${
                      craving === val
                        ? "bg-orange-500 text-white scale-110 shadow-md"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                    data-testid={`button-craving-${val}`}
                  >
                    {val}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-[11px] text-gray-400 px-1">
                <span>Nenoriu</span>
                <span>Labai noriu</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Pastaba</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Kaip praėjo diena..."
                rows={3}
                data-testid="input-note"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
              disabled={submittingCheckIn}
              data-testid="button-submit-checkin"
            >
              {submittingCheckIn ? "Saugoma..." : "Pateikti"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
