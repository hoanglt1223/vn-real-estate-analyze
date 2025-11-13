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
  propertyType: text("property_type"),
  valuation: integer("valuation"),
  askingPrice: integer("asking_price"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPropertyAnalysisSchema = createInsertSchema(propertyAnalyses).omit({
  id: true,
  createdAt: true,
});

export const updatePropertyAnalysisSchema = insertPropertyAnalysisSchema.partial().extend({
  id: z.string()
});

export type InsertPropertyAnalysis = z.infer<typeof insertPropertyAnalysisSchema>;
export type UpdatePropertyAnalysis = z.infer<typeof updatePropertyAnalysisSchema>;
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

// Property comparisons table
export const propertyComparisons = pgTable("property_comparisons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  propertyIds: jsonb("property_ids").notNull().$type<string[]>(),
  comparisonResult: jsonb("comparison_result").notNull().$type<any>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPropertyComparisonSchema = createInsertSchema(propertyComparisons).omit({
  id: true,
  createdAt: true,
});

export type InsertPropertyComparison = z.infer<typeof insertPropertyComparisonSchema>;
export type PropertyComparison = typeof propertyComparisons.$inferSelect;

// Property notes table
export const propertyNotes = pgTable("property_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").notNull(),
  userId: varchar("user_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPropertyNoteSchema = createInsertSchema(propertyNotes).omit({
  id: true,
  createdAt: true,
});

export type InsertPropertyNote = z.infer<typeof insertPropertyNoteSchema>;
export type PropertyNote = typeof propertyNotes.$inferSelect;

// Saved searches table
export const savedSearches = pgTable("saved_searches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  searchCriteria: jsonb("search_criteria").notNull().$type<any>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSavedSearchSchema = createInsertSchema(savedSearches).omit({
  id: true,
  createdAt: true,
});

export type InsertSavedSearch = z.infer<typeof insertSavedSearchSchema>;
export type SavedSearch = typeof savedSearches.$inferSelect;
