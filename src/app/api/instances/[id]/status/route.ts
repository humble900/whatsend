import { evolutionApi, getEvolutionState } from "@/lib/evolution";
import { authenticationError } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { whatsappInstances } from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { requireAuthAndTenant } from "@/lib/auth";

/**
 * GET /api/instances/[id]/status
 * Polls Evolution API directly to check real-time connection status.
 * When connected, stores the phone number and checks for duplicates.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireAuthAndTenant(req.headers.get("Authorization"));
    const { id: instanceId } = await params;

    const instance = await db.query.whatsappInstances.findFirst({
      where: and(eq(whatsappInstances.id, instanceId), eq(whatsappInstances.tenantId, tenantId))
    });

    if (!instance) return NextResponse.json({ error: "Instance not found" }, { status: 404 });

    const EVOLUTION_GLOBAL_API_KEY = process.env.EVOLUTION_GLOBAL_API_KEY || "";
    
    let connectionStatus = "unknown";
    let profileName: string | null = null;
    let profilePicUrl: string | null = null;
    let ownerJid: string | null = null;
    let phoneNumber: string | null = null;

    try {
      connectionStatus = await getEvolutionState(instance.evolutionServerUrl, instance.evolutionInstanceId);

      // Fetch instance info for profile data + phone number
      const infoData = await evolutionApi(instance.evolutionServerUrl, `/instance/fetchInstances?instanceName=${encodeURIComponent(instance.evolutionInstanceId)}`);
      {
        const instanceInfo = Array.isArray(infoData) ? infoData[0] : infoData;
        if (instanceInfo) {
          ownerJid = instanceInfo.ownerJid || null;
          profileName = instanceInfo.profileName || null;
          profilePicUrl = instanceInfo.profilePicUrl || null;
          // Metadata can retain an old state after the socket closes. The live
          // connectionState response is the source of truth for connectivity.
          
          // Extract the phone number from ownerJid (format: "2349064745087@s.whatsapp.net")
          if (ownerJid) {
            phoneNumber = ownerJid.split("@")[0].split(":")[0];
          }
        }
      }
    } catch (err) {
      return NextResponse.json({ error: "WhatsApp provider is unavailable. Last known state has been preserved.", status: instance.status }, { status: 502 });
    }

    const mappedStatus = connectionStatus === "open" ? "connected" : connectionStatus === "connecting" ? "connecting" : "disconnected";

    // Sync database if status changed
    if (mappedStatus !== instance.status || (phoneNumber && phoneNumber !== instance.phoneNumber)) {
      const updateData: any = { status: mappedStatus };
      
      // Store phone number when connected
      if (mappedStatus === "connected" && phoneNumber) {
        updateData.phoneNumber = phoneNumber;
      }
      
      await db.update(whatsappInstances)
        .set(updateData)
        .where(eq(whatsappInstances.id, instanceId));
    }

    return NextResponse.json({
      status: mappedStatus,
      evolutionStatus: connectionStatus,
      profileName,
      profilePicUrl,
      phoneNumber,
    });
  } catch (error: any) {
    const authFailure = authenticationError(error);
    if (authFailure) return authFailure;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
