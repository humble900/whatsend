/**
 * Meta WhatsApp Cloud API — Official Sender
 *
 * Used when a tenant provides their own Meta Business API credentials.
 * This completely replaces Evolution API for that tenant's messages.
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/messages
 * Version: Graph API v21.0 (latest stable, 2026)
 */

const GRAPH_API_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export interface MetaApiCredentials {
  phoneNumberId: string;   // From Meta Business Manager → WhatsApp → Phone Numbers
  accessToken: string;     // System User token (permanent) or page access token
  wabaId: string;          // WhatsApp Business Account ID
  appId?: string;          // Meta App ID (optional, for webhook validation)
  webhookVerifyToken?: string; // We generate this for the tenant's webhook config
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send a plain text message via Meta Cloud API.
 * This is the primary sender for tenants using Official API mode.
 */
export async function sendMetaTextMessage(
  creds: MetaApiCredentials,
  toPhone: string, // E.164 without '+', e.g. "2348012345678"
  text: string,
): Promise<SendResult> {
  const cleanPhone = toPhone.replace(/[^0-9]/g, "");

  try {
    const res = await fetch(`${GRAPH_BASE}/${creds.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${creds.accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
        type: "text",
        text: { body: text, preview_url: false },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      const errMsg = data?.error?.message || `HTTP ${res.status}`;
      console.error(`[MetaAPI] Send failed to ${cleanPhone}:`, errMsg);
      return { success: false, error: errMsg };
    }

    const messageId = data?.messages?.[0]?.id;
    return { success: true, messageId };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Check if a phone number has a WhatsApp account via the Contacts API.
 * Used during contact import to pre-validate numbers.
 * 
 * Note: Meta's Contacts API has strict rate limits — use in small batches
 * and cache results. Each check counts toward your monthly conversation quota.
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers
 */
export async function checkMetaPhoneExists(
  creds: MetaApiCredentials,
  phone: string,
): Promise<{ valid: boolean; waId?: string }> {
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  try {
    // The Contacts endpoint: validates if phone is registered on WA
    const res = await fetch(`${GRAPH_BASE}/${creds.phoneNumberId}/contacts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${creds.accessToken}`,
      },
      body: JSON.stringify({
        blocking: "wait",
        contacts: [`+${cleanPhone}`],
        force_check: true,
      }),
    });

    if (!res.ok) return { valid: true }; // Fail-open: don't block on API errors

    const data = await res.json();
    const contact = data?.contacts?.[0];
    if (!contact) return { valid: false };

    return {
      valid: contact.status === "valid",
      waId: contact.wa_id,
    };
  } catch {
    return { valid: true }; // Fail-open
  }
}

/**
 * Validate that the provided credentials actually work by fetching
 * the phone number details from the Graph API.
 * Returns phone number display name on success.
 */
export async function validateMetaCredentials(
  creds: MetaApiCredentials,
): Promise<{ valid: boolean; displayPhoneNumber?: string; verifiedName?: string; error?: string }> {
  try {
    const res = await fetch(
      `${GRAPH_BASE}/${creds.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,account_mode`,
      {
        headers: { Authorization: `Bearer ${creds.accessToken}` },
      },
    );

    const data = await res.json();

    if (!res.ok || data.error) {
      return { valid: false, error: data?.error?.message || "Invalid credentials" };
    }

    return {
      valid: true,
      displayPhoneNumber: data.display_phone_number,
      verifiedName: data.verified_name,
    };
  } catch (err: any) {
    return { valid: false, error: err.message };
  }
}

/**
 * Mask a sensitive credential string for safe display in the UI.
 * e.g. "EAABc...xyz123" → "••••••••••••xyz1"
 */
export function maskCredential(value: string): string {
  if (!value || value.length < 6) return "••••••••";
  return "•".repeat(Math.min(12, value.length - 4)) + value.slice(-4);
}
