import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
username: text("username").notNull().unique(),
password: text("password").notNull(), // hashed PIN
createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
username: true,
password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Messages table for chat
export const messages = pgTable("messages", {
id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
userId: varchar("user_id").references(() => users.id),
content: text("content").notNull(),
isCoach: boolean("is_coach").default(false).notNull(),
replyToId: varchar("reply_to_id"),
createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMessageSchema = createInsertSchema(messages).pick({
userId: true,
content: true,
isCoach: true,
replyToId: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// Check-ins table
export const checkIns = pgTable("check_ins", {
id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
userId: varchar("user_id").references(() => users.id).notNull(),
mood: integer("mood").notNull(),
craving: integer("craving").notNull(),
energy: integer("energy").notNull().default(3),
trigger: text("trigger"),
note: text("note"),
createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCheckInSchema = createInsertSchema(checkIns).pick({
userId: true,
mood: true,
craving: true,
energy: true,
trigger: true,
note: true,
});

export type InsertCheckIn = z.infer<typeof insertCheckInSchema>;
export type CheckIn = typeof checkIns.$inferSelect;

// Admin settings table
export const adminSettings = pgTable("admin_settings", {
id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
openaiApiKey: text("openai_api_key"),
openaiModel: text("openai_model").default("gpt-4o-mini"),
customInstructions: text("custom_instructions"),
chatInstructions: text("chat_instructions"),
allowRegistration: boolean("allow_registration").default(true).notNull(),
relapseTime: timestamp("relapse_time").notNull(),
updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAdminSettingsSchema = createInsertSchema(adminSettings).pick({
openaiApiKey: true,
openaiModel: true,
customInstructions: true,
chatInstructions: true,
relapseTime: true,
});

export type InsertAdminSettings = z.infer<typeof insertAdminSettingsSchema>;
export type AdminSettings = typeof adminSettings.$inferSelect;
