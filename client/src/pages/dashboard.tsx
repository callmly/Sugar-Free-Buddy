// Last updated: 2026-03-02T19:07:15.245Z
import { useEffect, useState, useRef } from "react";
  import { useLocation } from "wouter";
  import { Button } from "@/components/ui/button";
  import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
  import { Input } from "@/components/ui/input";
  import { Label } from "@/components/ui/label";
  import { Textarea } from "@/components/ui/textarea";
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
  import { Slider } from "@/components/ui/slider";
  import { useToast } from "@/hooks/use-toast";
  import { ScrollArea } from "@/components/ui/scroll-area";
  import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

  type Message = {
    id: string;
    userId: string | null;
    content: string;
    isCoach: boolean;
    createdAt: string;
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
    
    // Check-in form state
    const [mood, setMood] = useState<number>(3);
    const [craving, setCraving] = useState<number>(3);
    const [trigger, setTrigger] = useState<string>("");
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
      
      // Setup WebSocket
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      
      ws.onopen = () => {
        console.log("WebSocket connected");
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "new_message") {
          setMessages(prev => [...prev, data.message]);
        } else if (data.type === "streak_update") {
          fetchStreak();
        }
      };
      
      wsRef.current = ws;
      
      return () => {
        ws.close();
      };
    }, []);

    useEffect(() => {
      scrollToBottom();
    }, [messages]);

    const fetchUser = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          setLocation("/login");
          return;
        }
        const data = await res.json();
        setUser(data.user);
      } catch (error) {
        setLocation("/login");
      } finally {
        setLoading(false);
      }
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
        // Message will be added via WebSocket broadcast
        setNewMessage("");

        // Broadcast via WebSocket
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "new_message", message }));
        }
      } catch (error) {
        toast({
          title: "Klaida",
          description: "Nepavyko išsiųsti žinutės",
          variant: "destructive",
        });
      }
    };

    const submitCheckIn = async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmittingCheckIn(true);

      try {
        const res = await fetch("/api/checkins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mood, craving, trigger, note }),
        });

        if (!res.ok) throw new Error("Failed to submit check-in");

        toast({
          title: "Sėkmė!",
          description: "Patikrinimas išsaugotas",
        });

        setCheckInOpen(false);
        setMood(3);
        setCraving(3);
        setTrigger("");
        setNote("");

        // Refresh messages to get coach response
        setTimeout(fetchMessages, 1000);
      } catch (error) {
        toast({
          title: "Klaida",
          description: "Nepavyko išsaugoti patikrinimo",
          variant: "destructive",
        });
      } finally {
        setSubmittingCheckIn(false);
      }
    };

    const logout = async () => {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
        setLocation("/login");
      } catch (error) {
        console.error("Logout failed:", error);
      }
    };

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-lg">Kraunasi...</div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 p-4">
        <div className="max-w-6xl mx-auto space-y-4">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">🍬 No Sugar Challenge</h1>
              <p className="text-sm text-muted-foreground">Sveiki, {user?.username}!</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setLocation("/admin")}>
                Admin
              </Button>
              <Button variant="outline" onClick={logout}>
                Atsijungti
              </Button>
            </div>
          </div>

          {/* Streak Display */}
          <Card className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
            <CardHeader>
              <CardTitle className="text-center text-2xl">Jūsų Serija</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-6xl font-bold mb-2">
                  {streak.days}
                  <span className="text-3xl ml-2">dienų</span>
                </div>
                <div className="text-2xl">
                  {streak.hours} valandų
                </div>
                <div className="mt-4 text-lg opacity-90">
                  Be cukraus! 🎉
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-3 gap-4">
            {/* Chat Section */}
            <Card className="md:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Pokalbiai</CardTitle>
                <Dialog open={checkInOpen} onOpenChange={setCheckInOpen}>
                  <DialogTrigger asChild>
                    <Button>Patikrinimas</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md !bg-white dark:!bg-gray-900 !border-2 !border-gray-300 dark:!border-gray-600 shadow-2xl z-[100]">
                    <DialogHeader>
                      <DialogTitle>Dienos Patikrinimas</DialogTitle>
                      <DialogDescription>
                        Kaip jaučiatės šiandien?
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={submitCheckIn} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Nuotaika: {mood}/5</Label>
                        <Slider
                          value={[mood]}
                          onValueChange={(val) => setMood(val[0])}
                          min={1}
                          max={5}
                          step={1}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Troškimas: {craving}/5</Label>
                        <Slider
                          value={[craving]}
                          onValueChange={(val) => setCraving(val[0])}
                          min={1}
                          max={5}
                          step={1}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Trigeris</Label>
                        <Select value={trigger} onValueChange={setTrigger} required>
                          <SelectTrigger>
                            <SelectValue placeholder="Pasirinkite trigerį" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="vakaras">Vakaras</SelectItem>
                            <SelectItem value="po pietų">Po pietų</SelectItem>
                            <SelectItem value="stresas">Stresas</SelectItem>
                            <SelectItem value="filmai">Filmai</SelectItem>
                            <SelectItem value="kavinės">Kavinės</SelectItem>
                            <SelectItem value="kita">Kita</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Pastaba (neprivaloma)</Label>
                        <Textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Papildomi komentarai..."
                          rows={3}
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={submittingCheckIn}>
                        {submittingCheckIn ? "Saugoma..." : "Pateikti"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-3">
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
                            className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                              isCoach
                                ? "bg-amber-50 border border-amber-200 text-amber-900"
                                : isOwn
                                  ? "bg-blue-500 text-white"
                                  : "bg-gray-200 text-gray-900"
                            }`}
                          >
                            {isCoach && (
                              <div className="text-xs font-semibold mb-1">🤖 Treneris</div>
                            )}
                            {!isOwn && !isCoach && (
                              <div className="text-xs font-semibold mb-1 text-gray-600">👤 Partneris</div>
                            )}
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                            <div className={`text-[11px] mt-1 ${isOwn && !isCoach ? "text-blue-100" : "text-gray-500"}`}>
                              {timestamp}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
                <form onSubmit={sendMessage} className="mt-4 flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Rašykite žinutę..."
                    className="flex-1"
                  />
                  <Button type="submit">Siųsti</Button>
                </form>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Statistika</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">Bendra serija</div>
                  <div className="text-2xl font-bold">
                    {streak.days} d. {streak.hours} val.
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Žinutės</div>
                  <div className="text-2xl font-bold">{messages.length}</div>
                </div>
                <div className="pt-4">
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setCheckInOpen(true)}
                  >
                    📝 Dienos patikrinimas
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }
  