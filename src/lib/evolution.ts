import { getAndAssignProxy } from "./proxy";
import { db } from "../db";
import { whatsappInstances } from "../db/schema";
import { eq } from "drizzle-orm";

// Support comma-separated URLs for load balancing across multiple Railway Pods
const EVOLUTION_API_URLS = (process.env.EVOLUTION_API_URLS || "").split(",");
const EVOLUTION_GLOBAL_API_KEY = process.env.EVOLUTION_GLOBAL_API_KEY!;

/**
 * Creates a new WhatsApp instance on the Evolution API server hosted on Railway.
 * Includes Proxy injection and Pod Load Balancing.
 */
export async function createEvolutionInstance(tenantId: string, instanceName: string, phoneNumber?: string) {
  // 1. Fetch an unused proxy for this instance
  const proxyConfig = await getAndAssignProxy(tenantId);
  const evolutionInstanceId = `${tenantId}_${instanceName.replace(/[^a-zA-Z0-9]/g, "")}`;

  // Load Balancer: Pick a random Evolution API server cluster (Pod Sharding)
  const targetServerUrl = EVOLUTION_API_URLS[Math.floor(Math.random() * EVOLUTION_API_URLS.length)];
  if (!targetServerUrl) throw new Error("No Evolution API servers configured.");

  // 2. Instruct Evolution API to create the instance with the Proxy
  const response = await fetch(`${targetServerUrl}/instance/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": EVOLUTION_GLOBAL_API_KEY,
    },
    body: JSON.stringify({
      instanceName: evolutionInstanceId,
      qrcode: !phoneNumber,
      number: phoneNumber, // Enables Pairing Code generation if provided
      integration: "WHATSAPP-BAILEYS",
      proxy: proxyConfig, // Injecting the residential proxy
      webhook: process.env.NEXT_PUBLIC_APP_URL + "/api/webhook/evolution", // Webhook for QR code / Messages
      webhook_events: ["QRCODE_UPDATED", "MESSAGES_UPSERT", "CONNECTION_UPDATE"],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to create Evolution instance: ${errorBody}`);
  }

  const data = await response.json();

  // 3. Persist the instance in our PostgreSQL database
  await db.insert(whatsappInstances).values({
    tenantId,
    name: instanceName,
    evolutionInstanceId: evolutionInstanceId,
    evolutionServerUrl: targetServerUrl, // Save the specific pod this instance lives on
    status: "disconnected",
    dailyLimit: 25, // Start with tier-1 warm-up limits
  });

  return {
    evolutionInstanceId,
    hash: data.hash,
    qrcode: data.qrcode, // Base64 QR Code to display to the user
    pairingCode: data.pairingCode, // 8-digit pairing code
  };
}

/**
 * Requests the current QR code for an existing disconnected instance.
 */
export async function connectEvolutionInstance(evolutionInstanceId: string) {
  // We must lookup which specific Evolution API Pod holds this instance's WebSocket
  const instanceRecord = await db.query.whatsappInstances.findFirst({
    where: eq(whatsappInstances.evolutionInstanceId, evolutionInstanceId)
  });

  if (!instanceRecord) throw new Error("Instance not found in database");

  const response = await fetch(`${instanceRecord.evolutionServerUrl}/instance/connect/${evolutionInstanceId}`, {
    method: "GET",
    headers: {
      "apikey": EVOLUTION_GLOBAL_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch QR Code for instance.");
  }

  const data = await response.json();
  return data.base64; // The QR code image data
}

/**
 * Sends a text message via a specific Evolution API instance.
 */
export async function sendEvolutionMessage(evolutionInstanceId: string, targetPhone: string, messageText: string) {
  const instanceRecord = await db.query.whatsappInstances.findFirst({
    where: eq(whatsappInstances.evolutionInstanceId, evolutionInstanceId)
  });

  if (!instanceRecord) throw new Error("Instance not found in database");
  if (instanceRecord.status !== "connected") throw new Error("Instance is not connected");

  // Format phone (Evolution API expects JID or pure numbers without +)
  const cleanPhone = targetPhone.replace(/[^0-9]/g, "");

  const response = await fetch(`${instanceRecord.evolutionServerUrl}/message/sendText/${evolutionInstanceId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": EVOLUTION_GLOBAL_API_KEY,
    },
    body: JSON.stringify({
      number: cleanPhone,
      options: {
        delay: 1000,
        presence: "composing", // Shows "typing..." before sending for human realism
      },
      textMessage: {
        text: messageText
      }
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to send message: ${errText}`);
  }

  return await response.json();
}

/**
 * Marks a specific message as read on WhatsApp (triggers Blue Ticks for the sender).
 */
export async function markEvolutionMessageAsRead(evolutionInstanceId: string, targetPhone: string, messageId: string) {
  const instanceRecord = await db.query.whatsappInstances.findFirst({
    where: eq(whatsappInstances.evolutionInstanceId, evolutionInstanceId)
  });

  if (!instanceRecord) throw new Error("Instance not found in database");
  if (instanceRecord.status !== "connected") throw new Error("Instance is not connected");

  const cleanPhone = targetPhone.replace(/[^0-9]/g, "");
  // Note: Evolution API expects the exact remoteJid format, usually appending @s.whatsapp.net
  const jid = `${cleanPhone}@s.whatsapp.net`;

  const response = await fetch(`${instanceRecord.evolutionServerUrl}/chat/markMessageAsRead/${evolutionInstanceId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": EVOLUTION_GLOBAL_API_KEY,
    },
    body: JSON.stringify({
      readMessages: [
        {
          remoteJid: jid,
          id: messageId,
          fromMe: false
        }
      ]
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`Failed to mark message as read: ${errText}`);
    // Don't throw to avoid crashing normal flows, just log
    return false;
  }

  return true;
}
