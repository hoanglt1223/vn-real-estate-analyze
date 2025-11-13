import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const propertyAnalyses = pgTable("property_analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  coordinates: jsonb("coordinates").notNull().$type<number[][]>(),
  area: real("area").notNull(),
  orientation: text("orientation").notNull(),
  frontageCount: integer("frontage_count").notNull(),
  center: jsonb("center").notNull().$type<{ lat: number; lng: number }>(),
  amenities: jsonb("amenities").$type<any[]>(),
  infrastructure: jsonb("infrastructure").$type<any>(),
  marketData: jsonb("market_data").$type<any>(),
  aiAnalysis: jsonb("ai_analysis").$type<any>(),
  risks: jsonb("risks").$type<any[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPropertyAnalysisSchema = createInsertSchema(propertyAnalyses).omit({
  id: true,
  createdAt: true,
});

export type InsertPropertyAnalysis = z.infer<typeof insertPropertyAnalysisSchema>;
export type PropertyAnalysis = typeof propertyAnalyses.$inferSelect;

export const amenitiesCache = pgTable("amenities_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  radius: integer("radius").notNull(),
  category: text("category").notNull(),
  data: jsonb("data").notNull().$type<any[]>(),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
});

export const marketDataCache = pgTable("market_data_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  radius: integer("radius").notNull(),
  source: text("source").notNull(),
  data: jsonb("data").notNull().$type<any>(),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
});
