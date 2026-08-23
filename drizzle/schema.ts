import { boolean, double, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const sources = mysqlTable("sources", {
  id: int("id").autoincrement().primaryKey(),
  sourceKey: varchar("sourceKey", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  baseUrl: varchar("baseUrl", { length: 1024 }).notNull(),
  termsUrl: varchar("termsUrl", { length: 1024 }),
  robotsUrl: varchar("robotsUrl", { length: 1024 }),
  complianceStatus: mysqlEnum("complianceStatus", ["pending_review", "approved", "rejected", "expired"]).default("pending_review").notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  rateLimitSeconds: int("rateLimitSeconds").default(60).notNull(),
  parserVersion: varchar("parserVersion", { length: 32 }),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const earthquakes = mysqlTable("earthquakes", {
  id: int("id").autoincrement().primaryKey(),
  eventId: varchar("eventId", { length: 191 }).notNull().unique(),
  sourceId: int("sourceId").notNull(),
  originalEventId: varchar("originalEventId", { length: 191 }),
  sourceUrl: varchar("sourceUrl", { length: 1024 }).notNull(),
  originTimeUtc: timestamp("originTimeUtc").notNull(),
  localTimeJapan: varchar("localTimeJapan", { length: 64 }),
  latitude: double("latitude").notNull(),
  longitude: double("longitude").notNull(),
  depthKm: double("depthKm"),
  magnitude: double("magnitude"),
  magnitudeType: varchar("magnitudeType", { length: 24 }),
  region: varchar("region", { length: 64 }),
  prefecture: varchar("prefecture", { length: 64 }),
  nearestCity: varchar("nearestCity", { length: 160 }),
  eventType: varchar("eventType", { length: 64 }),
  rawPayload: text("rawPayload").notNull(),
  normalizedPayload: text("normalizedPayload").notNull(),
  parserVersion: varchar("parserVersion", { length: 32 }).notNull(),
  dataQuality: mysqlEnum("dataQuality", ["validated", "incomplete", "rejected"]).notNull(),
  duplicateStatus: mysqlEnum("duplicateStatus", ["accepted", "duplicate", "rejected"]).notNull(),
  collectedAt: timestamp("collectedAt").defaultNow().notNull(),
});

export const collectionRuns = mysqlTable("collectionRuns", {
  id: int("id").autoincrement().primaryKey(),
  sourceId: int("sourceId").notNull(),
  status: mysqlEnum("status", ["running", "succeeded", "failed", "skipped"]).notNull(),
  recordsCollected: int("recordsCollected").default(0).notNull(),
  recordsAccepted: int("recordsAccepted").default(0).notNull(),
  duplicatesRejected: int("duplicatesRejected").default(0).notNull(),
  invalidRejected: int("invalidRejected").default(0).notNull(),
  message: text("message"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export const modelVersions = mysqlTable("modelVersions", {
  id: int("id").autoincrement().primaryKey(),
  modelVersion: varchar("modelVersion", { length: 32 }).notNull().unique(),
  targetDefinition: varchar("targetDefinition", { length: 160 }).notNull(),
  algorithm: varchar("algorithm", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["candidate", "production", "retired", "failed", "demo"]).notNull(),
  datasetVersion: varchar("datasetVersion", { length: 64 }).notNull(),
  featureVersion: varchar("featureVersion", { length: 64 }).notNull(),
  trainingRecords: int("trainingRecords").notNull(),
  testRecords: int("testRecords").notNull(),
  accuracy: double("accuracy"),
  precision: double("precision"),
  recall: double("recall"),
  f1: double("f1"),
  rocAuc: double("rocAuc"),
  prAuc: double("prAuc"),
  brierScore: double("brierScore"),
  metricsJson: text("metricsJson"),
  trainedAt: timestamp("trainedAt").defaultNow().notNull(),
});

export const predictions = mysqlTable("predictions", {
  id: int("id").autoincrement().primaryKey(),
  modelVersionId: int("modelVersionId").notNull(),
  region: varchar("region", { length: 64 }).notNull(),
  targetDefinition: varchar("targetDefinition", { length: 160 }).notNull(),
  probability: double("probability").notNull(),
  riskLevel: mysqlEnum("riskLevel", ["LOW", "MODERATE", "ELEVATED", "HIGH"]).notNull(),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
});

export const systemLogs = mysqlTable("systemLogs", {
  id: int("id").autoincrement().primaryKey(),
  component: varchar("component", { length: 64 }).notNull(),
  severity: mysqlEnum("severity", ["info", "warning", "error"]).notNull(),
  message: text("message").notNull(),
  contextJson: text("contextJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
