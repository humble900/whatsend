import { pgTable, serial, text, timestamp, varchar, integer, boolean, uuid, index, uniqueIndex, jsonb } from "drizzle-orm/pg-core";

// 1. Tenants (SaaS Companies)
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  plan: varchar("plan", { length: 50 }).default("starter"), // starter, pro, enterprise
  // Official WhatsApp Cloud API credentials (Meta Business API)
  // Stored as JSONB: { phoneNumberId, accessToken, wabaId, appId, webhookVerifyToken }
  // NEVER returned raw to the frontend — only masked (last 4 chars shown)
  officialApiCredentials: jsonb("official_api_credentials"),
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

// 3. Optional provider proxies
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
  evolutionServerUrl: varchar("evolution_server_url", { length: 255 }).notNull(),
  phoneNumber: varchar("phone_number", { length: 50 }), // WhatsApp JID number (e.g. "2349064745087"), set when connected
  status: varchar("status", { length: 50 }).default("disconnected").notNull(),
  dailyLimit: integer("daily_limit").default(50).notNull(),
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
  // Scheduling fields
  dailyLimitPerAccount: integer("daily_limit_per_account").default(50).notNull(),
  delayMode: varchar("delay_mode", { length: 10 }).default("smart").notNull(), // 'smart' | 'custom'
  customDelayMin: integer("custom_delay_min").default(15).notNull(), // seconds
  customDelayMax: integer("custom_delay_max").default(45).notNull(), // seconds
  sendingWindows: jsonb("sending_windows").default([]).notNull(), // [{start:"09:00",end:"11:30"}, ...]
  // Variant / A/B testing fields
  variants: jsonb("variants").default([]).notNull(), // MessageVariant[]
  variantMode: varchar("variant_mode", { length: 20 }).default("round_robin").notNull(), // 'round_robin' | 'weighted' | 'account_locked'
  timezone: varchar("timezone", { length: 100 }).default("UTC").notNull(),
  consentConfirmedAt: timestamp("consent_confirmed_at"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_campaigns_tenant").on(table.tenantId)
]);

// 5b. Campaign ↔ WhatsApp Accounts (Junction Table)
export const campaignAccounts = pgTable("campaign_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }).notNull(),
  instanceId: uuid("instance_id").references(() => whatsappInstances.id, { onDelete: "cascade" }).notNull(),
  messagesSent: integer("messages_sent").default(0).notNull(),
}, (table) => [
  uniqueIndex("idx_campaign_accounts_unique").on(table.campaignId, table.instanceId),
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
  messageType: varchar("message_type", { length: 30 }).default("text").notNull(),
  payload: jsonb("payload"),
  status: varchar("status", { length: 50 }).default("sent").notNull(), // sent, delivered, read, received, failed
  evolutionMessageId: varchar("evolution_message_id", { length: 255 }), // To track receipts
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_messages_tenant").on(table.tenantId),
  index("idx_messages_remote_jid").on(table.remoteJid),
  index("idx_messages_evolution_id").on(table.evolutionMessageId),
]);

// 8. Workspace contacts
export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  instanceId: uuid("instance_id").references(() => whatsappInstances.id, { onDelete: "cascade" }).notNull(),
  remoteJid: varchar("remote_jid", { length: 50 }).notNull(),
  pushName: varchar("push_name", { length: 255 }), // WhatsApp profile name
  profilePicUrl: text("profile_pic_url"),
  isSaved: boolean("is_saved").default(false), // Imported into the workspace address book.
  metadata: jsonb("metadata"), // Dynamic data from CSVs (name, company, etc)
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_contacts_tenant_jid").on(table.tenantId, table.remoteJid),
]);

export const campaignLeads = pgTable("campaign_leads", {
  id: uuid("id").primaryKey().defaultRandom(), tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(), name: varchar("name", { length: 255 }), variables: jsonb("variables").default({}).notNull(), createdAt: timestamp("created_at").defaultNow().notNull(),
}, table => [uniqueIndex("campaign_leads_campaign_phone").on(table.campaignId, table.phone)]);
export const outboundMessages = pgTable("outbound_messages", {
  id: uuid("id").primaryKey().defaultRandom(), tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  instanceId: uuid("instance_id").references(() => whatsappInstances.id, { onDelete: "cascade" }).notNull(),
  campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }),
  requestKey: varchar("request_key", { length: 255 }).notNull(), requestHash: varchar("request_hash", { length: 64 }).notNull(),
  remoteJid: varchar("remote_jid", { length: 50 }).notNull(), payload: jsonb("payload").notNull(), messageText: text("message_text").notNull(),
  status: varchar("status", { length: 30 }).default("queued").notNull(), evolutionMessageId: varchar("evolution_message_id", { length: 255 }),
  attempts: integer("attempts").default(0).notNull(), lastError: text("last_error"), consentConfirmedBy: uuid("consent_confirmed_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().notNull(), sentAt: timestamp("sent_at"),
}, table => [uniqueIndex("outbound_tenant_request").on(table.tenantId, table.requestKey)]);
export const messageReceipts = pgTable("message_receipts", {
  id: uuid("id").primaryKey().defaultRandom(), tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  instanceId: uuid("instance_id").references(() => whatsappInstances.id, { onDelete: "cascade" }).notNull(),
  evolutionMessageId: varchar("evolution_message_id", { length: 255 }).notNull(), status: varchar("status", { length: 30 }).notNull(), updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, table => [uniqueIndex("receipts_tenant_instance_message").on(table.tenantId, table.instanceId, table.evolutionMessageId)]);
export const campaignWorkerHealth = pgTable("campaign_worker_health", {
  id: uuid("id").primaryKey(), lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
});
export const contactPhotos = pgTable("contact_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(()=>tenants.id,{onDelete:"cascade"}).notNull(),
  instanceId: uuid("instance_id").references(()=>whatsappInstances.id,{onDelete:"cascade"}).notNull(),
  remoteJid: varchar("remote_jid",{length:50}).notNull(), url:text("url"),
  checkedAt:timestamp("checked_at").notNull().defaultNow(), expiresAt:timestamp("expires_at").notNull(),
},table=>[uniqueIndex("contact_photos_account_recipient").on(table.tenantId,table.instanceId,table.remoteJid)]);
