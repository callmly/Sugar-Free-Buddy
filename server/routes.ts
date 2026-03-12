import type { Express, Request, Response } from "express";
import { db } from "./db";
import { users, messages, checkIns, adminSettings } from "@shared/schema";
import { eq, desc, and, gte, lt, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { WebSocketServer } from "ws";

declare module "express-session" {
interface SessionData {
    userId: string;
}
}

async function getAIResponse(settings: any, systemPrompt: string, userPrompt: string): Promise<string | null> {
  const provider = settings.aiProvider || "openai";

  if (provider === "anthropic" && settings.anthropicApiKey) {
    const anthropic = new Anthropic({ apiKey: settings.anthropicApiKey });
    const response = await anthropic.messages.create({
      model: settings.anthropicModel || "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const block = response.content[0];
    return block.type === "text" ? block.text : null;
  } else if (settings.openaiApiKey) {
    const openai = new OpenAI({ apiKey: settings.openaiApiKey });
    const completion = await openai.chat.completions.create({
      model: settings.openaiModel || "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    return completion.choices[0]?.message?.content ?? null;
  }

  return null;
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

const requireAdmin = async (req: Request, res: Response, next: Function) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const [user] = await db.select().from(users).where(eq(users.id, req.session.userId));
    if (!user || user.username !== "Tomas") {
      return res.status(403).json({ error: "Prieiga tik administratoriui" });
    }
    next();
};

app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
});

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
      const { username, password } = req.body;
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
          replyToId: messages.replyToId,
          createdAt: messages.createdAt,
          username: users.username,
        })
        .from(messages)
        .leftJoin(users, eq(messages.userId, users.id))
        .orderBy(desc(messages.createdAt))
        .limit(100);

      const reversed = allMessages.reverse();

      const replyIds = reversed.filter((m) => m.replyToId).map((m) => m.replyToId!);
      let replyMap = new Map<string, { id: string; content: string; username: string | null; isCoach: boolean }>();

      if (replyIds.length > 0) {
        const replyMessages = await db
          .select({ id: messages.id, content: messages.content, isCoach: messages.isCoach, username: users.username })
          .from(messages)
          .leftJoin(users, eq(messages.userId, users.id))
          .where(sql`${messages.id} IN (${sql.join(replyIds.map(id => sql`${id}`), sql`, `)})`);
        for (const r of replyMessages) {
          replyMap.set(r.id, r);
        }
      }

      const messagesWithReply = reversed.map((msg) => ({
        ...msg,
        replyTo: msg.replyToId ? replyMap.get(msg.replyToId) || null : null,
      }));

      res.json(messagesWithReply);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
});

app.post("/api/messages", requireAuth, async (req, res) => {
    try {
      const { content, replyToId } = req.body;
      
      const [message] = await db.insert(messages).values({
        userId: req.session.userId,
        content,
        isCoach: false,
        replyToId: replyToId || null,
      }).returning();

      const [sender] = await db.select().from(users).where(eq(users.id, req.session.userId!));

      let replyTo = null;
      if (replyToId) {
        const [replyMsg] = await db
          .select({ id: messages.id, content: messages.content, isCoach: messages.isCoach, username: users.username })
          .from(messages)
          .leftJoin(users, eq(messages.userId, users.id))
          .where(eq(messages.id, replyToId))
          .limit(1);
        if (replyMsg) {
          replyTo = replyMsg;
        }
      }

      const messageWithUser = { ...message, username: sender?.username || null, replyTo };

      res.json(messageWithUser);

      const coachMatch = content.match(/^[Tt]reneri[,:]?\s*(.*)/s);
      if (coachMatch && coachMatch[1]?.trim() && wss) {
        const userQuestion = coachMatch[1].trim();
        const senderName = sender?.username || "Vartotojas";

        (async () => {
          try {
            const [settings] = await db.select().from(adminSettings).limit(1);
            if (!settings?.openaiApiKey && !settings?.anthropicApiKey) return;

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

            const systemPrompt = settings.chatInstructions || `Tu esi palaikantis treneris, padedantis žmonėms atsisakyti saldumynų. Atsakyk lietuviškai, 3-6 sakiniais. Būk šiltas, draugiškas ir pasiūlyk konkrečių patarimų. Pridėk švelnų humorą.`;

            const userPrompt = `Vartotojas ${senderName} kreipiasi į tave:
"${userQuestion}"

Dabartinė serija: ${days} dienų ir ${hours} valandų be saldumynų.${chatContext}

Atsakyk lietuviškai, trumpai ir konkrečiai.`;

            const coachResponse = await getAIResponse(settings, systemPrompt, userPrompt);

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
      const page = parseInt(req.query.page as string) || 0;
      const limit = 10;
      const offset = page * limit;

      const allUsers = await db.select({ id: users.id, username: users.username }).from(users);
      const allCheckIns = await db
        .select({
          id: checkIns.id,
          userId: checkIns.userId,
          mood: checkIns.mood,
          craving: checkIns.craving,
          energy: checkIns.energy,
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
        const avgEnergy = userCheckins.length
          ? (userCheckins.reduce((s, c) => s + c.energy, 0) / userCheckins.length).toFixed(1)
          : null;
        return {
          userId: u.id,
          username: u.username,
          totalCheckins: userCheckins.length,
          avgMood,
          avgCraving,
          avgEnergy,
        };
      });

      const paginatedEntries = allCheckIns.slice(offset, offset + limit);
      const hasMore = allCheckIns.length > offset + limit;

      const response: any = { stats, entries: paginatedEntries, hasMore };
      if (page === 0) {
        response.chartData = allCheckIns;
      }
      res.json(response);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
});

app.get("/api/checkins/today", requireAuth, async (req, res) => {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      const [todayCheckIn] = await db
        .select()
        .from(checkIns)
        .where(
          and(
            eq(checkIns.userId, req.session.userId!),
            gte(checkIns.createdAt, startOfDay),
            lt(checkIns.createdAt, endOfDay)
          )
        )
        .limit(1);

      res.json(todayCheckIn || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch today's check-in" });
    }
});

app.post("/api/checkins", requireAuth, async (req, res) => {
    try {
      const { mood, craving, energy, note } = req.body;

      if (mood === undefined || craving === undefined || energy === undefined) {
        return res.status(400).json({ error: "Mood, craving and energy are required" });
      }

      const moodVal = parseInt(mood);
      const cravingVal = parseInt(craving);
      const energyVal = parseInt(energy);

      if (moodVal < 1 || moodVal > 5 || cravingVal < 1 || cravingVal > 5 || energyVal < 1 || energyVal > 5) {
        return res.status(400).json({ error: "Values must be between 1 and 5" });
      }

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      const [existing] = await db
        .select()
        .from(checkIns)
        .where(
          and(
            eq(checkIns.userId, req.session.userId!),
            gte(checkIns.createdAt, startOfDay),
            lt(checkIns.createdAt, endOfDay)
          )
        )
        .limit(1);

      if (existing) {
        return res.status(400).json({ error: "Šiandien jau pateikėte savijautą. Galite ją redaguoti." });
      }

      const [checkIn] = await db.insert(checkIns).values({
        userId: req.session.userId!,
        mood: moodVal,
        craving: cravingVal,
        energy: energyVal,
        trigger: null,
        note: note || null,
      }).returning();

      const [sender] = await db.select().from(users).where(eq(users.id, req.session.userId!));

      const moodLabels: Record<number, string> = { 1: "Bloga", 2: "Prasta", 3: "Vidutinė", 4: "Gera", 5: "Puiki" };
      const cravingLabels: Record<number, string> = { 1: "Nenoriu", 2: "Šiek tiek", 3: "Vidutiniškai", 4: "Noriu", 5: "Labai noriu" };
      const energyLabels: Record<number, string> = { 1: "Nėra jėgų", 2: "Silpna", 3: "Vidutinė", 4: "Gera", 5: "Skraidau" };

      let checkInText = `📊 Dienos savijauta:\n`;
      checkInText += `Nuotaika: ${moodVal}/5 (${moodLabels[moodVal]})\n`;
      checkInText += `Potraukis: ${cravingVal}/5 (${cravingLabels[cravingVal]})\n`;
      checkInText += `Energija: ${energyVal}/5 (${energyLabels[energyVal]})`;
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
            if (!settings?.openaiApiKey && !settings?.anthropicApiKey) return;

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
                historyText += `${i + 1}. ${dateStr} - Nuotaika: ${c.mood}/5, Potraukis: ${c.craving}/5, Energija: ${c.energy}/5${c.note ? ` (${c.note})` : ""}\n`;
              });
            }

            const systemPrompt = settings.customInstructions || `Tu esi palaikantis treneris, padedantis žmonėms atsisakyti saldumynų. Atsakyk lietuviškai, 3-6 sakiniais. Būk šiltas, pasiūlyk konkrečių patarimų ir pridėk švelnų humorą. Jei yra ankstesnių patikrinimų, palygink progresą ir pastebėk tendencijas.`;

            const userPrompt = `Vartotojas ${senderName} pateikė dienos savijautą:
- Nuotaika: ${moodVal}/5 (${moodLabels[moodVal]})
- Potraukis saldumynams: ${cravingVal}/5 (${cravingLabels[cravingVal]})
- Energija: ${energyVal}/5 (${energyLabels[energyVal]})
${note ? `- Pastaba: ${note}` : ""}

Dabartinė serija: ${days} dienų ir ${hours} valandų be saldumynų.${historyText}

Parašyk palaikantį atsakymą lietuviškai (3-6 sakiniais). Palygink su ankstesniais patikrinimais jei jų yra. Pasiūlyk konkretų veiksmą ir pridėk švelnų humorą.`;

            const coachResponse = await getAIResponse(settings, systemPrompt, userPrompt);

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

app.put("/api/checkins/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { mood, craving, energy, note, createdAt } = req.body;

      const moodVal = parseInt(mood);
      const cravingVal = parseInt(craving);
      const energyVal = parseInt(energy);

      if (moodVal < 1 || moodVal > 5 || cravingVal < 1 || cravingVal > 5 || energyVal < 1 || energyVal > 5) {
        return res.status(400).json({ error: "Values must be between 1 and 5" });
      }

      const [existing] = await db.select().from(checkIns).where(eq(checkIns.id, id)).limit(1);
      if (!existing || existing.userId !== req.session.userId) {
        return res.status(403).json({ error: "Negalite redaguoti šio įrašo" });
      }

      const updateData: any = { mood: moodVal, craving: cravingVal, energy: energyVal, note: note || null };
      if (createdAt) {
        const parsedDate = new Date(createdAt);
        if (!isNaN(parsedDate.getTime())) {
          updateData.createdAt = parsedDate;
        }
      }

      const [updated] = await db
        .update(checkIns)
        .set(updateData)
        .where(eq(checkIns.id, id))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Check-in update error:", error);
      res.status(500).json({ error: "Failed to update check-in" });
    }
});

app.get("/api/checkins/mine", requireAuth, async (req, res) => {
    try {
      const myCheckIns = await db
        .select()
        .from(checkIns)
        .where(eq(checkIns.userId, req.session.userId!))
        .orderBy(desc(checkIns.createdAt));
      res.json(myCheckIns);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch check-ins" });
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
app.get("/api/admin/settings", requireAdmin, async (req, res) => {
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

app.put("/api/admin/settings", requireAdmin, async (req, res) => {
    try {
      const { openaiApiKey, openaiModel, anthropicApiKey, anthropicModel, aiProvider, customInstructions, chatInstructions, allowRegistration, relapseTime } = req.body;

      const [settings] = await db.select().from(adminSettings).limit(1);

      const updateData: any = {
        updatedAt: new Date(),
      };

      if (openaiApiKey !== undefined) updateData.openaiApiKey = openaiApiKey;
      if (openaiModel !== undefined) updateData.openaiModel = openaiModel;
      if (anthropicApiKey !== undefined) updateData.anthropicApiKey = anthropicApiKey;
      if (anthropicModel !== undefined) updateData.anthropicModel = anthropicModel;
      if (aiProvider !== undefined) updateData.aiProvider = aiProvider;
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
