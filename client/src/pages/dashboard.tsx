import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Menu, X, Send, Home, SmilePlus, BarChart3, LogOut, Reply, XCircle } from "lucide-react";

type ReplyTo = {
  id: string;
  content: string;
  username: string | null;
  isCoach: boolean;
};

type Message = {
  id: string;
  userId: string | null;
  content: string;
  isCoach: boolean;
  replyToId: string | null;
  replyTo: ReplyTo | null;
  createdAt: string;
  username: string | null;
};

type User = {
  id: string;
  username: string;
};

type OnlineUser = {
  userId: string;
  username: string;
};

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [streak, setStreak] = useState({ days: 0, hours: 0, minutes: 0 });
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  const [mood, setMood] = useState<number | null>(null);
  const [craving, setCraving] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [note, setNote] = useState<string>("");
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [submittingCheckIn, setSubmittingCheckIn] = useState(false);
  const [todayCheckIn, setTodayCheckIn] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const userRef = useRef<User | null>(null);

  useEffect(() => {
    fetchUser();
    fetchStreak();
    fetchMessages();

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      console.log("WebSocket connected");
      if (userRef.current) {
        ws.send(JSON.stringify({ type: "identify", userId: userRef.current.id, username: userRef.current.username }));
      }
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "new_message") {
        setMessages((prev) => [...prev, data.message]);
      } else if (data.type === "streak_update") {
        fetchStreak();
      } else if (data.type === "online_users") {
        setOnlineUsers(data.users);
      }
    };

    wsRef.current = ws;
    return () => ws.close();
  }, []);

  useEffect(() => {
    if (user && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "identify", userId: user.id, username: user.username }));
    }
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) { setLocation("/login"); return; }
      const data = await res.json();
      setUser(data.user);
      userRef.current = data.user;
    } catch { setLocation("/login"); }
    finally { setLoading(false); }
  };

  const fetchStreak = async () => {
    try {
      const res = await fetch("/api/streak");
      const data = await res.json();
      setStreak({ days: data.days, hours: data.hours, minutes: data.minutes });
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

  const fetchTodayCheckIn = async () => {
    try {
      const res = await fetch("/api/checkins/today");
      const data = await res.json();
      setTodayCheckIn(data);
    } catch {
      setTodayCheckIn(null);
    }
  };

  const openCheckInDialog = () => {
    fetchTodayCheckIn().then(() => {
      setCheckInOpen(true);
    });
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newMessage, replyToId: replyingTo?.id || null }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      const message = await res.json();
      setNewMessage("");
      setReplyingTo(null);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "new_message", message }));
      }
    } catch {
      toast({ title: "Klaida", description: "Nepavyko išsiųsti žinutės", variant: "destructive" });
    }
  };

  const submitCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mood === null || craving === null || energy === null) {
      toast({ title: "Klaida", description: "Pasirinkite visus parametrus", variant: "destructive" });
      return;
    }
    setSubmittingCheckIn(true);
    try {
      if (isEditing && todayCheckIn) {
        const res = await fetch(`/api/checkins/${todayCheckIn.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mood, craving, energy, note }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to update check-in");
        }
        setCheckInOpen(false);
        resetCheckInForm();
        toast({ title: "Atnaujinta", description: "Savijauta sėkmingai atnaujinta" });
      } else {
        const res = await fetch("/api/checkins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mood, craving, energy, note }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to submit check-in");
        }
        const data = await res.json();
        setCheckInOpen(false);
        resetCheckInForm();

        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "new_message", message: data.chatMessage }));
        }
      }
    } catch (err: any) {
      toast({ title: "Klaida", description: err.message || "Nepavyko išsaugoti", variant: "destructive" });
    } finally {
      setSubmittingCheckIn(false);
    }
  };

  const resetCheckInForm = () => {
    setMood(null);
    setCraving(null);
    setEnergy(null);
    setNote("");
    setTodayCheckIn(null);
    setIsEditing(false);
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
      <header className="sticky top-0 z-50 bg-gradient-to-r from-purple-600 to-pink-500 text-white px-4 py-2.5 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-base font-semibold truncate" data-testid="text-streak">
            Be saldumynų: {streak.days} d. {streak.hours} val. {streak.minutes} min.
          </span>
          <div className="flex items-center gap-2 text-xs text-white/80" data-testid="online-status">
            {onlineUsers.map((u) => (
              <span key={u.userId} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block animate-pulse" />
                {u.username}
              </span>
            ))}
            {onlineUsers.length === 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
                Niekas neprisijungęs
              </span>
            )}
          </div>
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
              onClick={() => { setMenuOpen(false); openCheckInDialog(); }}
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

            const replyAuthor = msg.replyTo?.isCoach ? "Treneris" : msg.replyTo?.username || "Partneris";
            const replyPreview = msg.replyTo?.content ? (msg.replyTo.content.length > 60 ? msg.replyTo.content.slice(0, 60) + "..." : msg.replyTo.content) : null;

            return (
              <div
                key={msg.id}
                data-testid={`message-${msg.id}`}
                className={`group flex ${isOwn ? "justify-end" : "justify-start"}`}
              >
                {isOwn && (
                  <button
                    onClick={() => setReplyingTo(msg)}
                    className="self-center mr-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-gray-200"
                    data-testid={`button-reply-${msg.id}`}
                  >
                    <Reply className="h-4 w-4 text-gray-400" />
                  </button>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                    isCoach
                      ? "bg-amber-50 border border-amber-200 text-amber-900"
                      : isOwn
                        ? "bg-blue-500 text-white"
                        : "bg-white border border-gray-200 text-gray-900"
                  }`}
                >
                  {msg.replyTo && (
                    <div
                      className={`text-xs rounded-lg px-2.5 py-1.5 mb-2 border-l-2 ${
                        isOwn && !isCoach
                          ? "bg-blue-400/30 border-blue-200 text-blue-100"
                          : "bg-gray-100 border-gray-300 text-gray-500"
                      }`}
                    >
                      <span className="font-semibold">{replyAuthor}</span>
                      <div className="truncate">{replyPreview}</div>
                    </div>
                  )}
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
                {!isOwn && (
                  <button
                    onClick={() => setReplyingTo(msg)}
                    className="self-center ml-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-gray-200"
                    data-testid={`button-reply-${msg.id}`}
                  >
                    <Reply className="h-4 w-4 text-gray-400" />
                  </button>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-3 py-3 shrink-0">
        {replyingTo && (
          <div className="flex items-center gap-2 max-w-2xl mx-auto mb-2 bg-gray-50 rounded-lg px-3 py-2 border-l-3 border-blue-500" data-testid="reply-preview">
            <Reply className="h-4 w-4 text-blue-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-blue-600">
                {replyingTo.isCoach ? "Treneris" : replyingTo.username || "Partneris"}
              </div>
              <div className="text-xs text-gray-500 truncate">
                {replyingTo.content.length > 80 ? replyingTo.content.slice(0, 80) + "..." : replyingTo.content}
              </div>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="shrink-0 p-0.5 rounded-full hover:bg-gray-200"
              data-testid="button-cancel-reply"
            >
              <XCircle className="h-4 w-4 text-gray-400" />
            </button>
          </div>
        )}
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

      <Dialog open={checkInOpen} onOpenChange={(open) => {
        setCheckInOpen(open);
        if (!open) resetCheckInForm();
      }}>
        <DialogContent className="max-w-sm !bg-white dark:!bg-gray-900 !border-2 !border-gray-300 dark:!border-gray-600 shadow-2xl z-[100]">
          <DialogHeader>
            <DialogTitle className="text-xl">Dienos savijauta</DialogTitle>
            <DialogDescription>
              {todayCheckIn && !isEditing
                ? "Šiandien jau pateikėte savijautą"
                : "Kaip jaučiuosi šiandien?"}
            </DialogDescription>
          </DialogHeader>
          {todayCheckIn && !isEditing ? (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div>Nuotaika: <strong>{todayCheckIn.mood}/5</strong></div>
                <div>Potraukis: <strong>{todayCheckIn.craving}/5</strong></div>
                <div>Energija: <strong>{todayCheckIn.energy}/5</strong></div>
                {todayCheckIn.note && <div>Pastaba: <em>{todayCheckIn.note}</em></div>}
              </div>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => {
                  setIsEditing(true);
                  setMood(todayCheckIn.mood);
                  setCraving(todayCheckIn.craving);
                  setEnergy(todayCheckIn.energy);
                  setNote(todayCheckIn.note || "");
                }}
                data-testid="button-edit-checkin"
              >
                Redaguoti
              </Button>
            </div>
          ) : (
          <form onSubmit={submitCheckIn} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Nuotaika</Label>
              <div className="flex justify-between gap-1">
                {[1, 2, 3, 4, 5].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setMood(val)}
                    className={`w-12 h-12 rounded-full text-sm font-semibold transition-all ${
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
                <span>Bloga</span>
                <span>Puiki</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Potraukis</Label>
              <div className="flex justify-between gap-1">
                {[1, 2, 3, 4, 5].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setCraving(val)}
                    className={`w-12 h-12 rounded-full text-sm font-semibold transition-all ${
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
              <Label className="text-sm font-medium">Energija</Label>
              <div className="flex justify-between gap-1">
                {[1, 2, 3, 4, 5].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setEnergy(val)}
                    className={`w-12 h-12 rounded-full text-sm font-semibold transition-all ${
                      energy === val
                        ? "bg-green-500 text-white scale-110 shadow-md"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                    data-testid={`button-energy-${val}`}
                  >
                    {val}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-[11px] text-gray-400 px-1">
                <span>Nėra jėgų</span>
                <span>Skraidau</span>
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
              {submittingCheckIn ? "Saugoma..." : isEditing ? "Atnaujinti" : "Pateikti"}
            </Button>
          </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
