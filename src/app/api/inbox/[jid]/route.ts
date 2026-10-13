import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { messages, outboundMessages, whatsappInstances } from "@/db/schema";
import { and,eq,desc,inArray,ne,sql } from "drizzle-orm";
import { foldReactions } from "@/lib/message-reactions";
import { requireAuthAndTenant } from "@/lib/auth";
import { authenticationError } from "@/lib/api-error";
export async function GET(req:Request,{params}:{params:Promise<{jid:string}>}) {
 try {
  const {tenantId}=await requireAuthAndTenant(req.headers.get("Authorization")); const {jid}=await params;
  const instanceId=z.uuid().parse(new URL(req.url).searchParams.get("instanceId"));
  const instance=await db.query.whatsappInstances.findFirst({where:and(eq(whatsappInstances.id,instanceId),eq(whatsappInstances.tenantId,tenantId))});
  if(!instance)return NextResponse.json({error:"Connection not found."},{status:404});
  const scope=and(eq(messages.tenantId,tenantId),eq(messages.instanceId,instanceId),eq(messages.remoteJid,jid));
  const [history,pending]=await Promise.all([db.query.messages.findMany({where:and(scope,ne(messages.messageType,'reaction')),orderBy:[desc(messages.createdAt)],limit:100}),db.query.outboundMessages.findMany({where:and(eq(outboundMessages.tenantId,tenantId),eq(outboundMessages.instanceId,instanceId),eq(outboundMessages.remoteJid,jid),inArray(outboundMessages.status,["queued","sending","uncertain","failed"])),orderBy:[desc(outboundMessages.createdAt)],limit:20})]);
  const targets=history.map(row=>row.evolutionMessageId).filter((id):id is string=>!!id);
  const reactions=targets.length?await db.query.messages.findMany({where:and(scope,eq(messages.messageType,'reaction'),inArray(sql<string>`${messages.payload}->'key'->>'id'`,targets)),orderBy:[desc(messages.createdAt)]}):[];
  const combined=[...history.map(row=>({id:row.id,from:row.isFromMe?"us":"them",text:row.messageText,time:row.createdAt.toISOString(),status:row.status,messageId:row.evolutionMessageId,type:(row.payload as any)?.mediatype||row.messageType,fileName:(row.payload as any)?.fileName,reactions:foldReactions(reactions,row.evolutionMessageId||'')})),...pending.filter(row=>(row.payload as any).type!=='reaction'&&(!row.evolutionMessageId||!history.some(message=>message.evolutionMessageId===row.evolutionMessageId))).map(row=>({id:row.id,from:"us",text:row.messageText,time:row.createdAt.toISOString(),status:row.status,outboundId:row.id,type:(row.payload as any).mediatype||(row.payload as any).type,fileName:(row.payload as any).fileName}))].sort((a,b)=>new Date(a.time).getTime()-new Date(b.time).getTime());
  return NextResponse.json({messages:combined});
 }catch(error){const auth=authenticationError(error);if(auth)return auth;return NextResponse.json({error:"Choose a valid connection to load messages."},{status:error instanceof z.ZodError?400:500});}
}
