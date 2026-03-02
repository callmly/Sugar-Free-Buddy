import type { Express, Request, Response } from "express";
import { db } from "./db";
import { users, messages, checkIns, adminSettings } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import OpenAI from "openai";

// Extend session type
declare module "express-session" {
interface SessionData {
    userId: string;
}
}

export function registerRoutes(app: Express) {
// Auth middleware
const requireAuth = (req: Request, res: Response, next: Function) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    next();
};

// Auth routes
app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
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
        res.status(400).json({ error: "Username already exists" });
      } else {
        res.status(500).json({ error: "Failed to register" });
      }
    }
});

app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password, rememberMe } = req.body;

      const [user] = await db.select().from(users).where(eq(users.username, username));

      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      req.session.userId = user.id;
      
      if (rememberMe) {
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
      }

      res.json({ user: { id: user.id, username: user.username } });
    } catch (error) {
      res.status(500).json({ error: "Failed to login" });
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
      const allMessages = await db.select().from(messages).orderBy(desc(messages.createdAt)).limit(100);
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

      res.json(message);
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

app.post("/api/checkins", requireAuth, async (req, res) => {
    try {
      const { mood, craving, trigger, note } = req.body;

      if (!mood || !craving || !trigger) {
        return res.status(400).json({ error: "Mood, craving, and trigger are required" });
      }

      const [checkIn] = await db.insert(checkIns).values({
        userId: req.session.userId!,
        mood: parseInt(mood),
        craving: parseInt(craving),
        trigger,
        note: note || null,
      }).returning();

      // Get admin settings for OpenAI
      const [settings] = await db.select().from(adminSettings).limit(1);
      
      if (settings?.openaiApiKey) {
        try {
          // Get user info
          const [user] = await db.select().from(users).where(eq(users.id, req.session.userId!));
          
          // Calculate streak
          const relapseTime = settings.relapseTime;
          const now = new Date();
          const diffMs = now.getTime() - relapseTime.getTime();
          const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

          const openai = new OpenAI({ apiKey: settings.openaiApiKey });

          const systemPrompt = settings.customInstructions || `Tu esi palaikantis treneris, padedantis žmonėms įveikti cukraus vartojimą. Atsakyk lietuviškai, 3-6 sakiniais. Būk šiltas, humoringas, ir pasiūlyk konkrečių veiksmų. Naudok skaičius apie seriją savo atsakyme.`;

          const userPrompt = `Vartotojas ${user.username} pateikė patikrinimą:
- Nuotaika: ${mood}/5
- Troškimas: ${craving}/5
- Trigeris: ${trigger}
${note ? `- Pastaba: ${note}` : ''}

Dabartinė serija: ${days} dienos ir ${hours} valandos be cukraus.

Parašyk palaikantį atsakymą lietuviškai (3-6 sakiniais), pasiūlyk konkrečių veiksmų ir būk šiek tiek humoringas.`;

          const completion = await openai.chat.completions.create({
            model: settings.openaiModel || "gpt-4o-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
          });

          const coachResponse = completion.choices[0]?.message?.content;

          if (coachResponse) {
            await db.insert(messages).values({
              userId: null,
              content: coachResponse,
              isCoach: true,
            });
          }
        } catch (error) {
          console.error("Failed to get coach response:", error);
        }
      }

      res.json(checkIn);
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

      res.json({ days, hours, relapseTime: relapseTime.toISOString() });
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
      const { openaiApiKey, openaiModel, customInstructions, relapseTime } = req.body;

      const [settings] = await db.select().from(adminSettings).limit(1);

      const updateData: any = {
        updatedAt: new Date(),
      };

      if (openaiApiKey !== undefined) updateData.openaiApiKey = openaiApiKey;
      if (openaiModel !== undefined) updateData.openaiModel = openaiModel;
      if (customInstructions !== undefined) updateData.customInstructions = customInstructions;
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
