import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Menu, X, Send, Home, SmilePlus, BarChart3, LogOut, Reply, XCircle, Trophy } from "lucide-react";

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
  const [betOpen, setBetOpen] = useState(false);
  const [betConfirmed, setBetConfirmed] = useState(false);

  const [mood, setMood] = useState<number | null>(null);
  const [craving, setCraving] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [note, setNote] = useState<string>("");
  const [editDate, setEditDate] = useState<string>("");
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [submittingCheckIn, setSubmittingCheckIn] = useState(false);
  const [todayCheckIn, setTodayCheckIn] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingCheckIn, setEditingCheckIn] = useState<any>(null);
  const [historyView, setHistoryView] = useState(false);
  const [myCheckIns, setMyCheckIns] = useState<any[]>([]);

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

  const fetchMyCheckIns = async () => {
    try {
      const res = await fetch("/api/checkins/mine");
      if (res.ok) setMyCheckIns(await res.json());
    } catch {}
  };

  const openCheckInDialog = () => {
    fetchTodayCheckIn();
    fetchMyCheckIns();
    setHistoryView(false);
    setCheckInOpen(true);
  };

  const startEditingCheckIn = (ci: any) => {
    setEditingCheckIn(ci);
    setIsEditing(true);
    setMood(ci.mood);
    setCraving(ci.craving);
    setEnergy(ci.energy);
    setNote(ci.note || "");
    const d = new Date(ci.createdAt);
    setEditDate(d.toISOString().slice(0, 10));
    setHistoryView(false);
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
      if (isEditing && editingCheckIn) {
        const body: any = { mood, craving, energy, note };
        if (editDate) body.createdAt = new Date(editDate).toISOString();
        const res = await fetch(`/api/checkins/${editingCheckIn.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
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
    setEditDate("");
    setTodayCheckIn(null);
    setIsEditing(false);
    setEditingCheckIn(null);
    setHistoryView(false);
  };

  const surrender = async () => {
    try {
      const surrenderText = `🚨 ${user?.username} pasidavė :)`;
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: surrenderText }),
      });
      if (!res.ok) throw new Error("Failed");
      const message = await res.json();
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "new_message", message }));
      }
      setBetOpen(false);
      toast({ title: "Lažybos", description: "Pranešimas išsiųstas į chat'ą" });
    } catch {
      toast({ title: "Klaida", description: "Nepavyko išsiųsti pranešimo", variant: "destructive" });
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
      <div className="h-screen flex items-center justify-center bg-[#F2F2F7]">
        <div className="text-[15px] text-[#8E8E93]">Kraunasi...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#F2F2F7]" data-testid="dashboard-page">
      {/* iOS-style frosted glass header */}
      <header className="sticky top-0 z-50 ios-header px-4 pt-2 pb-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-[17px] font-semibold text-[#1C1C1E] truncate" data-testid="text-streak">
              🍬 {streak.days}d {streak.hours}h {streak.minutes}m
            </span>
            <div className="flex items-center gap-3 mt-0.5" data-testid="online-status">
              {onlineUsers.map((u) => (
                <span key={u.userId} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#34C759] inline-block animate-pulse" />
                  <span className="text-[12px] text-[#8E8E93]">{u.username}</span>
                </span>
              ))}
              {onlineUsers.length === 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#C7C7CC] inline-block" />
                  <span className="text-[12px] text-[#C7C7CC]">Niekas neprisijungęs</span>
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            data-testid="button-menu"
            className="w-9 h-9 flex items-center justify-center rounded-full bg-[#F2F2F7] active:bg-[#E5E5EA] transition-colors ml-3"
          >
            {menuOpen ? <X className="h-5 w-5 text-[#007AFF]" /> : <Menu className="h-5 w-5 text-[#007AFF]" />}
          </button>
        </div>
      </header>

      {/* iOS-style dropdown menu */}
      {menuOpen && (
        <div className="absolute top-[62px] right-4 z-40 w-56 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl overflow-hidden border border-[#E5E5EA]" data-testid="menu-dropdown">
          <button
            className="flex items-center gap-3 px-4 py-3.5 w-full text-left active:bg-[#F2F2F7] border-b border-[#E5E5EA]"
            onClick={() => { setMenuOpen(false); }}
            data-testid="menu-home"
          >
            <span className="w-7 h-7 rounded-lg bg-[#007AFF] flex items-center justify-center">
              <Home className="h-4 w-4 text-white" />
            </span>
            <span className="text-[15px] font-medium text-[#1C1C1E]">Pradžia</span>
          </button>
          <button
            className="flex items-center gap-3 px-4 py-3.5 w-full text-left active:bg-[#F2F2F7] border-b border-[#E5E5EA]"
            onClick={() => { setMenuOpen(false); openCheckInDialog(); }}
            data-testid="menu-checkin"
          >
            <span className="w-7 h-7 rounded-lg bg-[#5856D6] flex items-center justify-center">
              <SmilePlus className="h-4 w-4 text-white" />
            </span>
            <span className="text-[15px] font-medium text-[#1C1C1E]">Dienos savijauta</span>
          </button>
          <button
            className="flex items-center gap-3 px-4 py-3.5 w-full text-left active:bg-[#F2F2F7] border-b border-[#E5E5EA]"
            onClick={() => { setMenuOpen(false); setLocation("/statistics"); }}
            data-testid="menu-statistics"
          >
            <span className="w-7 h-7 rounded-lg bg-[#34C759] flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-white" />
            </span>
            <span className="text-[15px] font-medium text-[#1C1C1E]">Statistika</span>
          </button>
          <button
            className="flex items-center gap-3 px-4 py-3.5 w-full text-left active:bg-[#F2F2F7] border-b border-[#E5E5EA]"
            onClick={() => { setMenuOpen(false); setBetOpen(true); }}
            data-testid="menu-bet"
          >
            <span className="w-7 h-7 rounded-lg bg-[#FF9500] flex items-center justify-center">
              <Trophy className="h-4 w-4 text-white" />
            </span>
            <span className="text-[15px] font-medium text-[#1C1C1E]">Lažybos</span>
          </button>
          <button
            className="flex items-center gap-3 px-4 py-3.5 w-full text-left active:bg-[#F2F2F7]"
            onClick={() => { setMenuOpen(false); logout(); }}
            data-testid="menu-logout"
          >
            <span className="w-7 h-7 rounded-lg bg-[#FF3B30] flex items-center justify-center">
              <LogOut className="h-4 w-4 text-white" />
            </span>
            <span className="text-[15px] font-medium text-[#FF3B30]">Atsijungti</span>
          </button>
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-3 py-4" data-testid="chat-area">
        <div className="space-y-1 max-w-2xl mx-auto">
          {messages.map((msg) => {
            const isOwn = msg.userId === user?.id;
            const isCoach = msg.isCoach;
            const isSurrender = msg.content.includes("pasidavė :)");
            const d = new Date(msg.createdAt);
            const hh = String(d.getHours()).padStart(2, "0");
            const min = String(d.getMinutes()).padStart(2, "0");
            const mm = String(d.getMonth() + 1).padStart(2, "0");
            const dd = String(d.getDate()).padStart(2, "0");
            const timestamp = `${dd}.${mm} ${hh}:${min}`;

            if (isSurrender) {
              return (
                <div key={msg.id} data-testid={`message-${msg.id}`} className="flex justify-center my-3">
                  <div className="bg-[#FF3B30]/10 border border-[#FF3B30]/30 rounded-2xl px-5 py-2.5 text-center">
                    <div className="text-[#FF3B30] font-semibold text-[15px]">{msg.content}</div>
                    <div className="text-[11px] text-[#FF3B30]/60 mt-0.5">{timestamp}</div>
                  </div>
                </div>
              );
            }

            const replyAuthor = msg.replyTo?.isCoach ? "Treneris" : msg.replyTo?.username || "Partneris";
            const replyPreview = msg.replyTo?.content ? (msg.replyTo.content.length > 60 ? msg.replyTo.content.slice(0, 60) + "..." : msg.replyTo.content) : null;

            return (
              <div
                key={msg.id}
                data-testid={`message-${msg.id}`}
                className={`group flex items-end gap-1 ${isOwn ? "justify-end" : "justify-start"}`}
              >
                {isOwn && (
                  <button
                    onClick={() => setReplyingTo(msg)}
                    className="self-center mb-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full"
                    data-testid={`button-reply-${msg.id}`}
                  >
                    <Reply className="h-3.5 w-3.5 text-[#8E8E93]" />
                  </button>
                )}
                <div className={`max-w-[78%] ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
                  {!isOwn && !isCoach && (
                    <span className="text-[12px] text-[#8E8E93] ml-3 mb-0.5">{msg.username || "Partneris"}</span>
                  )}
                  {isCoach && (
                    <span className="text-[12px] text-[#FF9500] ml-3 mb-0.5">🤖 Treneris</span>
                  )}
                  <div
                    className={`rounded-[20px] px-4 py-2 ${
                      isCoach
                        ? "bg-[#FFF3CD] rounded-tl-md"
                        : isOwn
                          ? "bg-[#007AFF] rounded-br-md"
                          : "bg-white rounded-bl-md shadow-sm"
                    }`}
                  >
                    {msg.replyTo && (
                      <div
                        className={`text-[12px] rounded-xl px-2.5 py-1.5 mb-2 border-l-[3px] ${
                          isOwn && !isCoach
                            ? "bg-white/20 border-white/60 text-white/80"
                            : "bg-[#F2F2F7] border-[#8E8E93] text-[#8E8E93]"
                        }`}
                      >
                        <div className="font-semibold">{replyAuthor}</div>
                        <div className="truncate">{replyPreview}</div>
                      </div>
                    )}
                    <div className={`whitespace-pre-wrap text-[15px] leading-relaxed ${
                      isCoach ? "text-[#7D5A00]" : isOwn ? "text-white" : "text-[#1C1C1E]"
                    }`}>{msg.content}</div>
                    <div className={`text-[11px] mt-0.5 ${
                      isOwn && !isCoach ? "text-white/60" : "text-[#8E8E93]"
                    }`}>{timestamp}</div>
                  </div>
                </div>
                {!isOwn && (
                  <button
                    onClick={() => setReplyingTo(msg)}
                    className="self-center mb-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full"
                    data-testid={`button-reply-${msg.id}`}
                  >
                    <Reply className="h-3.5 w-3.5 text-[#8E8E93]" />
                  </button>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* iOS-style input bar */}
      <div className="ios-header px-3 pt-2 pb-4 shrink-0">
        {replyingTo && (
          <div className="flex items-center gap-2 mx-1 mb-2 bg-[#F2F2F7] rounded-xl px-3 py-2 border-l-[3px] border-[#007AFF]" data-testid="reply-preview">
            <Reply className="h-3.5 w-3.5 text-[#007AFF] shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold text-[#007AFF]">
                {replyingTo.isCoach ? "Treneris" : replyingTo.username || "Partneris"}
              </div>
              <div className="text-[12px] text-[#8E8E93] truncate">
                {replyingTo.content.length > 80 ? replyingTo.content.slice(0, 80) + "..." : replyingTo.content}
              </div>
            </div>
            <button onClick={() => setReplyingTo(null)} className="shrink-0" data-testid="button-cancel-reply">
              <XCircle className="h-4 w-4 text-[#8E8E93]" />
            </button>
          </div>
        )}
        <form onSubmit={sendMessage} className="flex items-end gap-2 max-w-2xl mx-auto" data-testid="form-send-message">
          <div className="flex-1 bg-white rounded-full border border-[#E5E5EA] px-4 py-2.5 shadow-sm">
            <input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Žinutė..."
              className="w-full text-[15px] text-[#1C1C1E] placeholder-[#C7C7CC] outline-none bg-transparent"
              data-testid="input-message"
            />
          </div>
          <button
            type="submit"
            className="w-9 h-9 rounded-full bg-[#007AFF] flex items-center justify-center shadow-sm active:bg-[#0062CC] transition-colors shrink-0 disabled:opacity-40"
            disabled={!newMessage.trim()}
            data-testid="button-send"
          >
            <Send className="h-4 w-4 text-white" />
          </button>
        </form>
      </div>

      {/* Check-in dialog */}
      <Dialog open={checkInOpen} onOpenChange={(open) => { setCheckInOpen(open); if (!open) resetCheckInForm(); }}>
        <DialogContent className="max-w-sm !bg-white !border-0 shadow-2xl z-[100] rounded-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-[17px] font-semibold text-[#1C1C1E]">
                {historyView ? "Istorija" : isEditing ? "Redaguoti įrašą" : "Dienos savijauta"}
              </DialogTitle>
              {!isEditing && (
                <button
                  type="button"
                  onClick={() => setHistoryView(!historyView)}
                  className="text-[15px] text-[#007AFF] font-medium"
                  data-testid="button-toggle-history"
                >
                  {historyView ? "Atgal" : "Istorija"}
                </button>
              )}
              {isEditing && (
                <button
                  type="button"
                  onClick={() => { setIsEditing(false); setEditingCheckIn(null); setMood(null); setCraving(null); setEnergy(null); setNote(""); setEditDate(""); }}
                  className="text-[15px] text-[#007AFF] font-medium"
                >
                  Atgal
                </button>
              )}
            </div>
            {!historyView && !isEditing && (
              <DialogDescription className="text-[13px] text-[#8E8E93]">
                {todayCheckIn ? "Šiandien jau pateikėte savijautą" : "Kaip jaučiuosi šiandien?"}
              </DialogDescription>
            )}
          </DialogHeader>

          {historyView ? (
            <div className="space-y-1 max-h-80 overflow-y-auto -mx-1">
              {myCheckIns.length === 0 && (
                <p className="text-[15px] text-[#8E8E93] text-center py-6">Įrašų nėra</p>
              )}
              {myCheckIns.map((ci) => {
                const d = new Date(ci.createdAt);
                const label = `${d.getDate()}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()}`;
                return (
                  <div key={ci.id} className="flex items-center justify-between bg-[#F2F2F7] rounded-xl px-3 py-3">
                    <div>
                      <span className="text-[15px] font-medium text-[#1C1C1E]">{label}</span>
                      <span className="text-[13px] text-[#8E8E93] ml-2">N:{ci.mood} P:{ci.craving} E:{ci.energy}</span>
                      {ci.note && <div className="text-[12px] text-[#8E8E93] truncate max-w-[180px]">{ci.note}</div>}
                    </div>
                    <button
                      onClick={() => startEditingCheckIn(ci)}
                      className="text-[15px] text-[#007AFF] font-medium shrink-0 ml-2"
                      data-testid={`button-edit-checkin-${ci.id}`}
                    >
                      Redaguoti
                    </button>
                  </div>
                );
              })}
            </div>
          ) : todayCheckIn && !isEditing ? (
            <div className="space-y-3">
              <div className="bg-[#F2F2F7] rounded-2xl p-4 space-y-2">
                <div className="flex justify-between text-[15px]"><span className="text-[#8E8E93]">Nuotaika</span><strong className="text-[#1C1C1E]">{todayCheckIn.mood}/5</strong></div>
                <div className="flex justify-between text-[15px]"><span className="text-[#8E8E93]">Potraukis</span><strong className="text-[#1C1C1E]">{todayCheckIn.craving}/5</strong></div>
                <div className="flex justify-between text-[15px]"><span className="text-[#8E8E93]">Energija</span><strong className="text-[#1C1C1E]">{todayCheckIn.energy}/5</strong></div>
                {todayCheckIn.note && <div className="text-[13px] text-[#8E8E93] italic">{todayCheckIn.note}</div>}
              </div>
              <button
                className="w-full py-3 rounded-2xl bg-[#F2F2F7] text-[#007AFF] text-[15px] font-medium active:bg-[#E5E5EA] transition-colors"
                onClick={() => startEditingCheckIn(todayCheckIn)}
                data-testid="button-edit-checkin"
              >
                Redaguoti šiandienos įrašą
              </button>
            </div>
          ) : (
          <form onSubmit={submitCheckIn} className="space-y-4">
            {isEditing && (
              <div className="bg-[#F2F2F7] rounded-xl px-4 py-2.5">
                <label className="block text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1">Data</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full text-[17px] text-[#1C1C1E] outline-none bg-transparent"
                  data-testid="input-edit-date"
                />
              </div>
            )}
            {[
              { label: "Nuotaika", key: "mood", val: mood, set: setMood, activeColor: "bg-[#5856D6]", low: "Bloga", high: "Puiki" },
              { label: "Potraukis", key: "craving", val: craving, set: setCraving, activeColor: "bg-[#FF9500]", low: "Nenoriu", high: "Labai noriu" },
              { label: "Energija", key: "energy", val: energy, set: setEnergy, activeColor: "bg-[#34C759]", low: "Nėra jėgų", high: "Skraidau" },
            ].map(({ label, key, val, set, activeColor, low, high }) => (
              <div key={key} className="space-y-2">
                <div className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wider">{label}</div>
                <div className="flex justify-between gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => set(n)}
                      className={`flex-1 h-11 rounded-xl text-[15px] font-semibold transition-all ${
                        val === n ? `${activeColor} text-white shadow-sm scale-105` : "bg-[#F2F2F7] text-[#1C1C1E]"
                      }`}
                      data-testid={`button-${key}-${n}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-[11px] text-[#C7C7CC] px-1">
                  <span>{low}</span><span>{high}</span>
                </div>
              </div>
            ))}
            <div className="space-y-1.5">
              <div className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wider">Pastaba</div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Kaip praėjo diena..."
                rows={3}
                className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-[15px] text-[#1C1C1E] placeholder-[#C7C7CC] outline-none resize-none"
                data-testid="input-note"
              />
            </div>
            <button
              type="submit"
              disabled={submittingCheckIn}
              className="w-full py-3.5 rounded-2xl bg-[#007AFF] text-white text-[17px] font-semibold active:bg-[#0062CC] transition-colors disabled:opacity-50"
              data-testid="button-submit-checkin"
            >
              {submittingCheckIn ? "Saugoma..." : isEditing ? "Atnaujinti" : "Pateikti"}
            </button>
          </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Bet dialog */}
      <Dialog open={betOpen} onOpenChange={(open) => { setBetOpen(open); if (!open) setBetConfirmed(false); }}>
        <DialogContent className="max-w-sm !bg-white !border-0 shadow-2xl z-[100] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-semibold text-[#1C1C1E] flex items-center gap-2" data-testid="dialog-title-bet">
              <Trophy className="h-5 w-5 text-[#FF9500]" />
              Lažybos
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="bg-[#FF3B30]/8 border border-[#FF3B30]/20 rounded-2xl p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={betConfirmed}
                  onChange={(e) => setBetConfirmed(e.target.checked)}
                  className="mt-1 h-5 w-5 accent-[#FF3B30] shrink-0"
                  data-testid="checkbox-surrender"
                />
                <div>
                  <span className="font-semibold text-[#FF3B30] text-[15px]">Negaliu be cukraus - pasiduodu :)</span>
                  <p className="text-[13px] text-[#FF3B30]/80 leading-relaxed mt-1.5">Pažymiu, kad arba jau prisivalgiau, arba planuoju prisivalgyti saldumynų. Suprantu, kad pralaimėjau lažybas ir savo draugą vaišinsiu pietumis arba vakariene. Pasirūpinsiu, kad draugas būtų sotus ir laimingas :)</p>
                </div>
              </label>
            </div>
            <button
              onClick={surrender}
              disabled={!betConfirmed}
              className="w-full py-3.5 rounded-2xl bg-[#FF3B30] text-white text-[17px] font-semibold active:bg-[#D63429] transition-colors disabled:opacity-40"
              data-testid="button-surrender"
            >
              Pasiduodu
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
