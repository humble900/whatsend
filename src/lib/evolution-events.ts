/** Evolution sends single objects as well as batched event payloads. */
export function eventItems(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.messages)) return data.messages;
  return [data];
}
export function receiptStatus(update: any): string | undefined {
  const status = update.update?.status ?? update.status;
  const map: Record<string, string> = { "0": "failed", "1": "sent", "2": "sent", "3": "delivered", "4": "read", ERROR: "failed", PENDING: "sent", SERVER_ACK: "sent", DELIVERY_ACK: "delivered", READ: "read", PLAYED: "read" };
  return map[String(status)];
}
export function phoneJid(key: any): string | null {
  const raw = key?.remoteJid?.endsWith("@lid") ? key.remoteJidAlt : key?.remoteJid;
  if (typeof raw !== "string") return null;
  const jid = raw.includes("@") ? raw : `${raw}@s.whatsapp.net`;
  return /^\d+@s\.whatsapp\.net$/.test(jid) ? jid : null;
}
