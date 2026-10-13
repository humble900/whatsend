import { z } from "zod";

export const phoneSchema = z.string().transform(value => value.replace(/@s\.whatsapp\.net$/, "").replace(/[+()\s-]/g, "")).pipe(z.string().regex(/^\d{7,15}$/, "Enter a phone number with country code."));
const shortText = z.string().trim().min(1).max(4096);
const asset = z.string().min(1).max(16 * 1024 * 1024).refine(value => {
  if (!value.startsWith("http")) return /^(?:data:[\w/+.-]+;base64,)?[A-Za-z0-9+/=\s]+$/.test(value);
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password && !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[|.*\.internal$)/i.test(url.hostname); } catch { return false; }
}, "Use a public HTTPS media URL or base64 file.").transform(value => value.replace(/^data:[\w/+.-]+;base64,/, ""));
const replyButton = z.object({ type: z.literal("reply"), displayText: z.string().min(1).max(80), id: z.string().min(1).max(100) });
const actionButton = z.discriminatedUnion("type", [
  z.object({ type: z.literal("url"), displayText: shortText, url: z.url() }),
  z.object({ type: z.literal("copy"), displayText: shortText, copyCode: shortText }),
  z.object({ type: z.literal("call"), displayText: shortText, phoneNumber: phoneSchema }),
]);

export const outboundPayloadSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: shortText }),
  z.object({ type: z.literal("media"), mediatype: z.enum(["image", "video", "document"]), media: asset, caption: z.string().max(4096).optional(), fileName: z.string().max(255).optional(), mimetype: z.string().max(100).optional() }),
  z.object({ type: z.literal("audio"), audio: asset, encoding: z.boolean().default(true) }),
  z.object({ type: z.literal("sticker"), sticker: asset }),
  z.object({ type: z.literal("poll"), name: shortText, values: z.array(z.string().trim().min(1).max(100)).min(2).max(10), selectableCount: z.number().int().min(1).max(10).default(1) }).refine(value => value.selectableCount <= value.values.length, "Selectable count exceeds poll options."),
  z.object({ type: z.literal("buttons"), title: shortText, description: z.string().max(4096).optional(), footer: z.string().max(80).optional(), buttons: z.union([z.array(replyButton).min(1).max(3), z.array(actionButton).min(1).max(10)]) }),
  z.object({ type: z.literal("list"), title: shortText, description: z.string().max(4096).optional(), footerText: z.string().max(80).default(""), buttonText: z.string().min(1).max(20), sections: z.array(z.object({ title: shortText, rows: z.array(z.object({ title: shortText, description: z.string().max(200).optional(), rowId: z.string().min(1).max(200) })).min(1).max(10) })).min(1).max(10) }),
  z.object({ type: z.literal("location"), name: shortText, address: shortText, latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }),
  z.object({ type: z.literal("reaction"), key: z.object({ id: z.string().min(1).max(255), remoteJid: z.string().regex(/^\d+@s\.whatsapp\.net$/), fromMe: z.boolean() }), reaction: z.string().max(20) }),
  z.object({ type: z.literal("contacts"), contact: z.array(z.object({ fullName: shortText, phoneNumber: phoneSchema, organization: z.string().max(255).optional(), email: z.email().optional(), url: z.url().optional() })).min(1).max(50) }),
]);
export type OutboundPayload = z.infer<typeof outboundPayloadSchema>;

export function evolutionMessageRequest(phone: string, payload: OutboundPayload) {
  const number = phoneSchema.parse(phone);
  const { type, ...content } = payload;
  const paths = { text: "sendText", media: "sendMedia", audio: "sendWhatsAppAudio", sticker: "sendSticker", poll: "sendPoll", buttons: "sendButtons", list: "sendList", location: "sendLocation", reaction: "sendReaction", contacts: "sendContact" };
  // Replies and already-scheduled campaign jobs never wait for typing/presence.
  return { path: paths[type], body: type === "reaction" ? content : { number, ...content, delay: 0, linkPreview: false } };
}
export function payloadPreview(payload: OutboundPayload): string {
  if (payload.type === "text") return payload.text;
  if (payload.type === "media") return payload.caption || `[${payload.mediatype}]`;
  if (payload.type === "poll") return `[Poll] ${payload.name}`;
  if (payload.type === "buttons" || payload.type === "list") return payload.title;
  if (payload.type === "location") return `[Location] ${payload.name}`;
  if (payload.type === "contacts") return `[Contact] ${payload.contact.map(value => value.fullName).join(", ")}`;
  if (payload.type === "reaction") return payload.reaction;
  return `[${payload.type}]`;
}
export function isOptOut(text: string) { return /^(stop|unsubscribe|quit|cancel|opt[ -]?out)(\s|$)/i.test(text.trim()); }
export function advanceReceipt(current: string, next: string) {
  if (next === "failed" && !["delivered", "read"].includes(current)) return "failed";
  const ranks: Record<string, number> = { queued: 0, sending: 1, uncertain: 1, failed: 1, sent: 2, delivered: 3, read: 4 };
  if (next === "failed") return ["delivered", "read"].includes(current) ? current : next;
  return (ranks[next] ?? -1) >= (ranks[current] ?? -1) ? next : current;
}
