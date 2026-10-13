import { evolutionRequest } from "./evolution-request";
import { db } from "../db";
import { whatsappInstances } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { evolutionMessageRequest, outboundPayloadSchema, phoneSchema, type OutboundPayload } from "./messaging-contracts";

export class EvolutionError extends Error {
  constructor(message: string, public upstreamStatus = 502, public uncertain = false) { super(message); }
}
export async function evolutionApi(server: string, path: string, method = "GET", body?: unknown) {
  const key = process.env.EVOLUTION_GLOBAL_API_KEY;
  if (!key) throw new EvolutionError("WhatsApp provider is not configured.", 503);
  let response: Response;
  try { response = await evolutionRequest(`${server.replace(/\/$/, "")}${path}`, { method, headers: { apikey: key, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
  catch (cause) { throw new EvolutionError(cause instanceof Error ? cause.message : "WhatsApp provider is unavailable.", 503, method === "POST" && path.startsWith("/message/")); }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.response?.message || data?.message;
    const text = typeof detail === "string" ? detail.slice(0, 250) : Array.isArray(detail) ? detail.flat().filter((value: unknown) => typeof value === "string").join("; ").slice(0, 250) : "Request rejected";
    throw new EvolutionError(`WhatsApp provider (${response.status}): ${text}`, response.status, response.status >= 500 && path.startsWith("/message/"));
  }
  return data;
}
export async function getEvolutionInstance(id: string) {
  const instance = await db.query.whatsappInstances.findFirst({ where: eq(whatsappInstances.evolutionInstanceId, id) });
  if (!instance) throw new EvolutionError("WhatsApp connection was not found.", 404);
  return instance;
}
export async function getEvolutionState(server: string, id: string) {
  const data = await evolutionApi(server, `/instance/connectionState/${encodeURIComponent(id)}`);
  const rawState = data?.instance?.state || data?.state;
  const state = rawState === "refused" ? "close" : rawState;
  if (!["open", "close", "connecting"].includes(state)) throw new EvolutionError("Provider returned an unknown connection state.");
  return state as "open" | "close" | "connecting";
}
export function webhookConfiguration(appUrl: string, secret: string) {
  const url = new URL(appUrl);
  if (url.protocol !== "https:" || /^(localhost|127\.|.*\.internal$)/i.test(url.hostname)) throw new EvolutionError("Inbound messages require the public HTTPS application URL.", 503);
  if (!secret) throw new EvolutionError("Webhook authentication is not configured.", 503);
  return { webhook: { enabled: true, url: `${appUrl.replace(/\/$/, "")}/api/webhook/evolution`, byEvents: false, base64: false, headers: { "x-whatsend-webhook-secret": secret }, events: ["QRCODE_UPDATED", "CONNECTION_UPDATE", "MESSAGES_UPSERT", "MESSAGES_UPDATE", "SEND_MESSAGE", "CONTACTS_UPSERT", "CONTACTS_UPDATE"] } };
}
export async function configureEvolutionWebhook(server: string, id: string) {
  const body = webhookConfiguration(process.env.APP_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || "", process.env.EVOLUTION_WEBHOOK_SECRET || "");
  return evolutionApi(server, `/webhook/set/${encodeURIComponent(id)}`, "POST", body);
}
export async function createEvolutionInstance(tenantId: string, name: string, phoneNumber?: string) {
  const existing = await db.query.whatsappInstances.findFirst({ where: and(eq(whatsappInstances.tenantId, tenantId), eq(whatsappInstances.name, name)) });
  if (existing) {
    const state = await getEvolutionState(existing.evolutionServerUrl, existing.evolutionInstanceId);
    await configureEvolutionWebhook(existing.evolutionServerUrl, existing.evolutionInstanceId);
    if (state === "open") return { dbId: existing.id, evolutionInstanceId: existing.evolutionInstanceId, connected: true, qrcode: undefined, pairingCode: undefined };
    const data = await evolutionApi(existing.evolutionServerUrl, `/instance/connect/${encodeURIComponent(existing.evolutionInstanceId)}${phoneNumber ? `?number=${phoneSchema.parse(phoneNumber)}` : ""}`);
    return { dbId: existing.id, evolutionInstanceId: existing.evolutionInstanceId, connected: false, qrcode: data?.base64 || data?.qrcode?.base64, pairingCode: data?.pairingCode };
  }
  const servers = (process.env.EVOLUTION_API_URLS || "").split(",").map(value => value.trim()).filter(Boolean);
  if (!servers.length) throw new EvolutionError("No WhatsApp provider is configured.", 503);
  const server = servers[0];
  const id = `${createHash("sha256").update(tenantId).digest("hex").slice(0, 8)}_${name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 20)}_${randomBytes(3).toString("hex")}`;
  // Validate webhook requirements before creating a remote instance.
  webhookConfiguration(process.env.APP_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || "", process.env.EVOLUTION_WEBHOOK_SECRET || "");
  const data = await evolutionApi(server, "/instance/create", "POST", { instanceName: id, integration: "WHATSAPP-BAILEYS", qrcode: !phoneNumber, ...(phoneNumber ? { number: phoneSchema.parse(phoneNumber) } : {}) });
  const [saved] = await db.insert(whatsappInstances).values({ tenantId, name, evolutionInstanceId: id, evolutionServerUrl: server, status: "disconnected", dailyLimit: 50 }).returning();
  await configureEvolutionWebhook(server, id);
  return { dbId: saved.id, evolutionInstanceId: id, connected: false, qrcode: data?.qrcode?.base64 || data?.base64, pairingCode: data?.qrcode?.pairingCode || data?.pairingCode };
}
export async function connectEvolutionInstance(id: string) {
  const inst = await getEvolutionInstance(id);
  const data = await evolutionApi(inst.evolutionServerUrl, `/instance/connect/${encodeURIComponent(id)}`);
  return data?.base64 || data?.qrcode?.base64;
}
export async function sendEvolutionPayload(id: string, phone: string, input: OutboundPayload) {
  const inst = await getEvolutionInstance(id);
  if (inst.status !== "connected") throw new EvolutionError("Connect your WhatsApp number before sending.", 409);
  const payload = outboundPayloadSchema.parse(input);
  const { path, body } = evolutionMessageRequest(phone, payload);
  const result = await evolutionApi(inst.evolutionServerUrl, `/message/${path}/${encodeURIComponent(id)}`, "POST", body);
  if (!result?.key?.id) throw new EvolutionError("Provider did not acknowledge this message. Check history before retrying.", 502, true);
  return result;
}
export async function sendEvolutionMessage(id: string, phone: string, text: string) { return sendEvolutionPayload(id, phone, { type: "text", text }); }
export async function markEvolutionMessageAsRead(id: string, phone: string, messageId: string) {
  const inst = await getEvolutionInstance(id);
  await evolutionApi(inst.evolutionServerUrl, `/chat/markMessageAsRead/${encodeURIComponent(id)}`, "POST", { readMessages: [{ remoteJid: `${phoneSchema.parse(phone)}@s.whatsapp.net`, id: messageId, fromMe: false }] });
  return true;
}
export async function checkWhatsAppNumbers(id: string, phones: string[]) {
  const inst = await getEvolutionInstance(id);
  if (inst.status !== "connected") throw new EvolutionError("Connect your WhatsApp number before verifying contacts.", 409);
  const results = new Map<string, { exists: boolean; jid?: string }>();
  for (let offset = 0; offset < phones.length; offset += 50) {
    const numbers = phones.slice(offset, offset + 50).map(phone => phoneSchema.parse(phone));
    const data = await evolutionApi(inst.evolutionServerUrl, `/chat/whatsappNumbers/${encodeURIComponent(id)}`, "POST", { numbers });
    if (!Array.isArray(data)) throw new EvolutionError("Provider returned invalid verification results.");
    for (const item of data) results.set(item.number, { exists: item.exists === true, jid: item.jid });
  }
  return results;
}
export async function sendEvolutionMedia(id: string, phone: string, mediatype: "image" | "video" | "audio" | "document", media: string, caption?: string, fileName?: string) {
  return mediatype === "audio" ? sendEvolutionPayload(id, phone, { type: "audio", audio: media, encoding: true }) : sendEvolutionPayload(id, phone, { type: "media", mediatype, media, caption, fileName });
}
export async function sendEvolutionPoll(id: string, phone: string, name: string, values: string[], selectableCount = 1) { return sendEvolutionPayload(id, phone, { type: "poll", name, values, selectableCount }); }
export async function sendEvolutionButtons(id: string, phone: string, description: string, buttons: Extract<OutboundPayload, { type: "buttons" }>["buttons"], title = "Options", footer?: string) { return sendEvolutionPayload(id, phone, { type: "buttons", title, description, footer, buttons }); }
export async function sendEvolutionList(id: string, phone: string, title: string, description: string, buttonText: string, sections: Extract<OutboundPayload, { type: "list" }>["sections"], footerText = "") { return sendEvolutionPayload(id, phone, { type: "list", title, description, buttonText, sections, footerText }); }
export async function sendEvolutionLocation(id: string, phone: string, name: string, address: string, latitude: number, longitude: number) { return sendEvolutionPayload(id, phone, { type: "location", name, address, latitude, longitude }); }
export async function sendEvolutionReaction(id: string, key: { id: string; remoteJid: string; fromMe: boolean }, reaction: string) { return sendEvolutionPayload(id, key.remoteJid, { type: "reaction", key, reaction }); }
export async function fetchContactProfile(id: string, phone: string) { const inst = await getEvolutionInstance(id); return evolutionApi(inst.evolutionServerUrl, `/chat/fetchProfile/${encodeURIComponent(id)}`, "POST", { number: phoneSchema.parse(phone) }); }
export async function findEvolutionChats(id: string) { const inst = await getEvolutionInstance(id); const data = await evolutionApi(inst.evolutionServerUrl, `/chat/findChats/${encodeURIComponent(id)}`, "POST", {}); if (!Array.isArray(data)) throw new EvolutionError("Provider returned invalid conversations."); return data; }
export async function findEvolutionMessages(id: string, remoteJid: string, limit = 30) { const inst = await getEvolutionInstance(id); const data = await evolutionApi(inst.evolutionServerUrl, `/chat/findMessages/${encodeURIComponent(id)}`, "POST", { where: { key: { remoteJid } }, page: 1, offset: Math.min(100, limit) }); if (!Array.isArray(data?.messages?.records)) throw new EvolutionError("Provider returned invalid message history."); return data.messages.records; }
