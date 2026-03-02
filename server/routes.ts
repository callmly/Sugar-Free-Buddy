import type { Express, Request, Response } from "express";
import { db } from "./db";
import { users, messages, checkIns, adminSettings } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import OpenAI from "openai";
import { WebSocketServer } from "ws";

declare module "express-session" {
interface SessionData {
    userId: string;
}
}

function broadcastMessage(wss: WebSocketServer, message: any) {
  const payload = JSON.stringify({ type: "new_message", message });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
}

const loginAttempts = new Map<string, { count: number; lastAttempt: number; lockUntil: number }>();

function getLoginLockout(ip: string): { locked: boolean; retryAfter: number } {
  const record = loginAttempts.get(ip);
  if (!record) return { locked: false, retryAfter: 0 };
  if (record.lockUntil > Date.now()) {
    return { locked: true, retryAfter: Math.ceil((record.lockUntil - Date.now()) / 1000) };
  }
  return { locked: false, retryAfter: 0 };
}

function recordFailedLogin(ip: string) {
  const now = Date.now();
  const record = loginAttempts.get(ip) || { count: 0, lastAttempt: 0, lockUntil: 0 };

  if (now - record.lastAttempt > 60 * 60 * 1000) {
    record.count = 0;
  }

  record.count++;
  record.lastAttempt = now;

  if (record.count >= 12) {
    record.lockUntil = now + 24 * 60 * 60 * 1000;
  } else if (record.count >= 8) {
    record.lockUntil = now + 60 * 60 * 1000;
  } else if (record.count >= 4) {
    record.lockUntil = now + 15 * 60 * 1000;
  }

  loginAttempts.set(ip, record);
}

function clearLoginAttempts(ip: string) {
  loginAttempts.delete(ip);
}

export function registerRoutes(app: Express, wss?: WebSocketServer) {
const requireAuth = (req: Request, res: Response, next: Function) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    next();
};

app.get("/api/auth/registration-allowed", async (_req, res) => {
    try {
      const [settings] = await db.select().from(adminSettings).limit(1);
      const allUsers = await db.select({ id: users.id }).from(users);
      const allowed = (!settings || settings.allowRegistration) && allUsers.length < 2;
      res.json({ allowed });
    } catch {
      res.json({ allowed: false });
    }
});

app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: "Įveskite vartotojo vardą ir PIN kodą" });
      }

      if (!/^\d{4,6}$/.test(password)) {
        return res.status(400).json({ error: "PIN kodas turi būti 4-6 skaitmenų" });
      }

      const allUsers = await db.select({ id: users.id }).from(users);
      if (allUsers.length >= 2) {
        return res.status(403).json({ error: "Pasiektas maksimalus vartotojų skaičius (2)" });
      }

      const [settings] = await db.select().from(adminSettings).limit(1);
      if (settings && !settings.allowRegistration) {
        return res.status(403).json({ error: "Registracija šiuo metu išjungta" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const [user] = await db.insert(users).values({
        username,
        password: hashedPassword,
      }).returning();

      req.session.userId = user.id;
      res.json({ user: { id: user.id, username: user.username } });
    } catch (error: any) {
      if (error.code === "23505") {
        res.status(400).json({ error: "Toks vartotojo vardas jau užimtas" });
      } else {
        res.status(500).json({ error: "Nepavyko užregistruoti" });
      }
    }
});

app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password, rememberMe } = req.body;
      const ip = req.ip || req.socket.remoteAddress || "unknown";

      const lockout = getLoginLockout(ip);
      if (lockout.locked) {
        const mins = Math.ceil(lockout.retryAfter / 60);
        return res.status(429).json({ error: `Per daug bandymų. Bandykite po ${mins} min.`, retryAfter: lockout.retryAfter });
      }

      const [user] = await db.select().from(users).where(eq(users.username, username));

      if (!user) {
        recordFailedLogin(ip);
        return res.status(401).json({ error: "Neteisingi prisijungimo duomenys" });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        recordFailedLogin(ip);
        return res.status(401).json({ error: "Neteisingi prisijungimo duomenys" });
      }

      clearLoginAttempts(ip);
      req.session.userId = user.id;

      if (rememberMe) {
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
      }

      res.json({ user: { id: user.id, username: user.username } });
    } catch (error) {
      res.status(500).json({ error: "Nepavyko prisijungti" });
    }
});

app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.session.userId!));
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ user: { id: user.id, username: user.username } });
    } catch (error) {
      res.status(500).json({ error: "Failed to get user" });
    }
});

// Messages routes
app.get("/api/messages", requireAuth, async (req, res) => {
    try {
      const allMessages = await db
        .select({
          id: messages.id,
          userId: messages.userId,
          content: messages.content,
          isCoach: messages.isCoach,
          createdAt: messages.createdAt,
          username: users.username,
        })
        .from(messages)
        .leftJoin(users, eq(messages.userId, users.id))
        .orderBy(desc(messages.createdAt))
        .limit(100);
      res.json(allMessages.reverse());
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
});

app.post("/api/messages", requireAuth, async (req, res) => {
    try {
      const { content } = req.body;
      
      const [message] = await db.insert(messages).values({
        userId: req.session.userId,
        content,
        isCoach: false,
      }).returning();

      const [sender] = await db.select().from(users).where(eq(users.id, req.session.userId!));
      const messageWithUser = { ...message, username: sender?.username || null };

      res.json(messageWithUser);

      const coachMatch = content.match(/^[Tt]reneri[,:]?\s*(.*)/s);
      if (coachMatch && coachMatch[1]?.trim() && wss) {
        const userQuestion = coachMatch[1].trim();
        const senderName = sender?.username || "Vartotojas";

        (async () => {
          try {
            const [settings] = await db.select().from(adminSettings).limit(1);
            if (!settings?.openaiApiKey) return;

            const relapseTime = settings.relapseTime;
            const now = new Date();
            const diffMs = now.getTime() - relapseTime.getTime();
            const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

            const recentMessages = await db
              .select({ content: messages.content, isCoach: messages.isCoach, username: users.username })
              .from(messages)
              .leftJoin(users, eq(messages.userId, users.id))
              .orderBy(desc(messages.createdAt))
              .limit(10);

            let chatContext = "";
            if (recentMessages.length > 0) {
              chatContext = "\n\nPaskutinės pokalbių žinutės:\n";
              recentMessages.reverse().forEach((m) => {
                const who = m.isCoach ? "Treneris" : (m.username || "Vartotojas");
                chatContext += `${who}: ${m.content}\n`;
              });
            }

            const openai = new OpenAI({ apiKey: settings.openaiApiKey });

            const systemPrompt = settings.chatInstructions || `Tu esi palaikantis treneris, padedantis žmonėms atsisakyti saldumynų. Atsakyk lietuviškai, 3-6 sakiniais. Būk šiltas, draugiškas ir pasiūlyk konkrečių patarimų. Pridėk švelnų humorą.`;

            const userPrompt = `Vartotojas ${senderName} kreipiasi į tave:
"${userQuestion}"

Dabartinė serija: ${days} dienų ir ${hours} valandų be saldumynų.${chatContext}

Atsakyk lietuviškai, trumpai ir konkrečiai.`;

            const completion = await openai.chat.completions.create({
              model: settings.openaiModel || "gpt-4o-mini",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
            });

            const coachResponse = completion.choices[0]?.message?.content;

            if (coachResponse) {
              const [coachMsg] = await db.insert(messages).values({
                userId: null,
                content: coachResponse,
                isCoach: true,
              }).returning();

              broadcastMessage(wss, { ...coachMsg, username: null });
            }
          } catch (error) {
            console.error("Failed to get coach response:", error);
          }
        })();
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to send message" });
    }
});

// Check-ins routes
app.get("/api/checkins", requireAuth, async (req, res) => {
    try {
      const allCheckIns = await db.select().from(checkIns).orderBy(desc(checkIns.createdAt));
      res.json(allCheckIns);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch check-ins" });
    }
});

app.get("/api/stats", requireAuth, async (req, res) => {
    try {
      const allUsers = await db.select({ id: users.id, username: users.username }).from(users);
      const allCheckIns = await db
        .select({
          id: checkIns.id,
          userId: checkIns.userId,
          mood: checkIns.mood,
          craving: checkIns.craving,
          trigger: checkIns.trigger,
          note: checkIns.note,
          createdAt: checkIns.createdAt,
          username: users.username,
        })
        .from(checkIns)
        .leftJoin(users, eq(checkIns.userId, users.id))
        .orderBy(desc(checkIns.createdAt));

      const stats = allUsers.map((u) => {
        const userCheckins = allCheckIns.filter((c) => c.userId === u.id);
        const avgMood = userCheckins.length
          ? (userCheckins.reduce((s, c) => s + c.mood, 0) / userCheckins.length).toFixed(1)
          : null;
        const avgCraving = userCheckins.length
          ? (userCheckins.reduce((s, c) => s + c.craving, 0) / userCheckins.length).toFixed(1)
          : null;
        return {
          userId: u.id,
          username: u.username,
          totalCheckins: userCheckins.length,
          avgMood,
          avgCraving,
          checkins: userCheckins.slice(0, 14),
        };
      });

      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
});

app.post("/api/checkins", requireAuth, async (req, res) => {
    try {
      const { mood, craving, note } = req.body;

      if (mood === undefined || craving === undefined) {
        return res.status(400).json({ error: "Mood and craving are required" });
      }

      const moodVal = parseInt(mood);
      const cravingVal = parseInt(craving);

      const [checkIn] = await db.insert(checkIns).values({
        userId: req.session.userId!,
        mood: moodVal,
        craving: cravingVal,
        trigger: null,
        note: note || null,
      }).returning();

      const [sender] = await db.select().from(users).where(eq(users.id, req.session.userId!));

      const moodLabels = ["Labai blogai", "Blogai", "Vidutiniškai", "Gerai", "Labai gerai", "Puikiai"];
      const cravingLabels = ["Nenoriu", "Šiek tiek", "Vidutiniškai", "Noriu", "Labai noriu", "Neįmanoma atsispirti"];

      let checkInText = `📊 Dienos savijauta:\n`;
      checkInText += `Nuotaika: ${moodVal}/5 (${moodLabels[moodVal]})\n`;
      checkInText += `Potraukis: ${cravingVal}/5 (${cravingLabels[cravingVal]})`;
      if (note) checkInText += `\n💬 ${note}`;

      const [chatMsg] = await db.insert(messages).values({
        userId: req.session.userId!,
        content: checkInText,
        isCoach: false,
      }).returning();

      const chatMsgWithUser = { ...chatMsg, username: sender?.username || null };

      res.json({ checkIn, chatMessage: chatMsgWithUser });

      if (wss) {
        const userId = req.session.userId!;
        const senderName = sender?.username || "Vartotojas";

        (async () => {
          try {
            const [settings] = await db.select().from(adminSettings).limit(1);
            if (!settings?.openaiApiKey) return;

            const relapseTime = settings.relapseTime;
            const now = new Date();
            const diffMs = now.getTime() - relapseTime.getTime();
            const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

            const lastCheckins = await db
              .select()
              .from(checkIns)
              .where(eq(checkIns.userId, userId))
              .orderBy(desc(checkIns.createdAt))
              .limit(5);

            let historyText = "";
            if (lastCheckins.length > 1) {
              historyText = "\n\nPaskutiniai patikrinimai (naujausi pirmi):\n";
              lastCheckins.forEach((c, i) => {
                const d = new Date(c.createdAt);
                const dateStr = `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
                historyText += `${i + 1}. ${dateStr} - Nuotaika: ${c.mood}/5, Potraukis: ${c.craving}/5${c.note ? ` (${c.note})` : ""}\n`;
              });
            }

            const openai = new OpenAI({ apiKey: settings.openaiApiKey });

            const systemPrompt = settings.customInstructions || `Tu esi palaikantis treneris, padedantis žmonėms atsisakyti saldumynų. Atsakyk lietuviškai, 3-6 sakiniais. Būk šiltas, pasiūlyk konkrečių patarimų ir pridėk švelnų humorą. Jei yra ankstesnių patikrinimų, palygink progresą ir pastebėk tendencijas.`;

            const userPrompt = `Vartotojas ${senderName} pateikė dienos savijautą:
- Nuotaika: ${moodVal}/5 (${moodLabels[moodVal]})
- Potraukis saldumynams: ${cravingVal}/5 (${cravingLabels[cravingVal]})
${note ? `- Pastaba: ${note}` : ""}

Dabartinė serija: ${days} dienų ir ${hours} valandų be saldumynų.${historyText}

Parašyk palaikantį atsakymą lietuviškai (3-6 sakiniais). Palygink su ankstesniais patikrinimais jei jų yra. Pasiūlyk konkretų veiksmą ir pridėk švelnų humorą.`;

            const completion = await openai.chat.completions.create({
              model: settings.openaiModel || "gpt-4o-mini",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
            });

            const coachResponse = completion.choices[0]?.message?.content;

            if (coachResponse) {
              const [coachMsg] = await db.insert(messages).values({
                userId: null,
                content: coachResponse,
                isCoach: true,
              }).returning();

              broadcastMessage(wss, { ...coachMsg, username: null });
            }
          } catch (error) {
            console.error("Failed to get coach response:", error);
          }
        })();
      }
    } catch (error) {
      console.error("Check-in error:", error);
      res.status(500).json({ error: "Failed to create check-in" });
    }
});

// Streak calculation
app.get("/api/streak", requireAuth, async (req, res) => {
    try {
      const [settings] = await db.select().from(adminSettings).limit(1);
      
      if (!settings) {
        return res.json({ days: 0, hours: 0, relapseTime: null });
      }

      const relapseTime = settings.relapseTime;
      const now = new Date();
      const diffMs = now.getTime() - relapseTime.getTime();
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      res.json({ days, hours, minutes, relapseTime: relapseTime.toISOString() });
    } catch (error) {
      res.status(500).json({ error: "Failed to calculate streak" });
    }
});

// Admin routes
app.get("/api/admin/settings", requireAuth, async (req, res) => {
    try {
      const [settings] = await db.select().from(adminSettings).limit(1);
      
      if (!settings) {
        // Create default settings
        const [newSettings] = await db.insert(adminSettings).values({
          relapseTime: new Date(),
          openaiModel: "gpt-4o-mini",
        }).returning();
        return res.json(newSettings);
      }

      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
});

app.put("/api/admin/settings", requireAuth, async (req, res) => {
    try {
      const { openaiApiKey, openaiModel, customInstructions, chatInstructions, allowRegistration, relapseTime } = req.body;

      const [settings] = await db.select().from(adminSettings).limit(1);

      const updateData: any = {
        updatedAt: new Date(),
      };

      if (openaiApiKey !== undefined) updateData.openaiApiKey = openaiApiKey;
      if (openaiModel !== undefined) updateData.openaiModel = openaiModel;
      if (customInstructions !== undefined) updateData.customInstructions = customInstructions;
      if (chatInstructions !== undefined) updateData.chatInstructions = chatInstructions;
      if (allowRegistration !== undefined) updateData.allowRegistration = allowRegistration;
      if (relapseTime !== undefined) updateData.relapseTime = new Date(relapseTime);

      if (settings) {
        const [updated] = await db.update(adminSettings)
          .set(updateData)
          .where(eq(adminSettings.id, settings.id))
          .returning();
        res.json(updated);
      } else {
        const [created] = await db.insert(adminSettings)
          .values({
            ...updateData,
            relapseTime: updateData.relapseTime || new Date(),
          })
          .returning();
        res.json(created);
      }
    } catch (error) {
      console.error("Settings update error:", error);
      res.status(500).json({ error: "Failed to update settings" });
    }
});
}
