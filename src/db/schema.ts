import { pgTable, serial, text, timestamp, varchar, integer, boolean, uuid, index, uniqueIndex, jsonb } from "drizzle-orm/pg-core";

// 1. Tenants (SaaS Companies)
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  plan: varchar("plan", { length: 50 }).default("starter"), // starter, pro, enterprise
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 2. Users (RBAC)
export const users = pgTable("users", {
  id: uuid("id").primaryKey(), // Maps to Supabase Auth UUID
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  role: varchar("role", { length: 50 }).default("member").notNull(), // admin, member
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_users_tenant_id").on(table.tenantId)
]);

// 3. Proxies (1-to-1 Mapping for Anti-Ban)
export const proxies = pgTable("proxies", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  ipAddress: varchar("ip_address", { length: 50 }).notNull(),
  port: integer("port").notNull(),
  username: varchar("username", { length: 100 }),
  password: varchar("password", { length: 255 }), // Encrypted
  isActive: boolean("is_active").default(true),
  lastTestedAt: timestamp("last_tested_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 4. WhatsApp Instances (Evolution API Nodes)
export const whatsappInstances = pgTable("whatsapp_instances", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  proxyId: uuid("proxy_id").references(() => proxies.id, { onDelete: "set null" }),
  name: varchar("name", { length: 255 }).notNull(),
  evolutionInstanceId: varchar("evolution_instance_id", { length: 255 }).notNull().unique(),
  evolutionServerUrl: varchar("evolution_server_url", { length: 255 }).notNull(), // Stores which Railway Pod this instance lives on
  status: varchar("status", { length: 50 }).default("disconnected").notNull(), // connected, disconnected, banned, syncing
  dailyLimit: integer("daily_limit").default(50).notNull(), // Warm-up limits
  messagesSentToday: integer("messages_sent_today").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_wa_instances_tenant").on(table.tenantId),
  index("idx_wa_instances_status").on(table.status)
]);

// 5. Campaigns (Bulk Outreach)
export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }).default("draft").notNull(), // draft, queued, running, paused, completed
  spintaxTemplate: text("spintax_template").notNull(),
  totalContacts: integer("total_contacts").default(0).notNull(),
  contactsProcessed: integer("contacts_processed").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_campaigns_tenant").on(table.tenantId)
]);

// 6. Global Blacklist (Auto-Opt-Out)
export const blacklist = pgTable("blacklist", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  phoneNumber: varchar("phone_number", { length: 50 }).notNull(),
  reason: varchar("reason", { length: 100 }), // e.g. "Replied STOP"
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_blacklist_tenant_phone").on(table.tenantId, table.phoneNumber)
]);

// 7. Messages (Inbox & History)
export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  instanceId: uuid("instance_id").references(() => whatsappInstances.id, { onDelete: "cascade" }).notNull(),
  remoteJid: varchar("remote_jid", { length: 50 }).notNull(), // The contact's phone number
  isFromMe: boolean("is_from_me").notNull(),
  messageText: text("message_text"),
  status: varchar("status", { length: 50 }).default("sent").notNull(), // sent, delivered, read, received, failed
  evolutionMessageId: varchar("evolution_message_id", { length: 255 }), // To track receipts
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_messages_tenant").on(table.tenantId),
  index("idx_messages_remote_jid").on(table.remoteJid),
  index("idx_messages_evolution_id").on(table.evolutionMessageId),
]);

// 8. Contacts (Anti-Ban Sync & CRM)
export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  instanceId: uuid("instance_id").references(() => whatsappInstances.id, { onDelete: "cascade" }).notNull(),
  remoteJid: varchar("remote_jid", { length: 50 }).notNull(),
  pushName: varchar("push_name", { length: 255 }), // WhatsApp profile name
  profilePicUrl: text("profile_pic_url"),
  isSaved: boolean("is_saved").default(false), // Did we explicitly save them to avoid ban?
  metadata: jsonb("metadata"), // Dynamic data from CSVs (name, company, etc)
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_contacts_tenant_jid").on(table.tenantId, table.remoteJid),
]);
