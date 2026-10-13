import {db} from '@/db';
import {messages,outboundMessages} from '@/db/schema';
import {and,eq,desc,ne,inArray,sql} from 'drizzle-orm';
import {foldReactions} from './message-reactions';
export async function inboxHistory(tenantId:string,instanceId:string,jid:string){
 const scope=and(eq(messages.tenantId,tenantId),eq(messages.instanceId,instanceId),eq(messages.remoteJid,jid));
 const [history,pending]=await Promise.all([
  db.select({id:messages.id,fromMe:messages.isFromMe,text:messages.messageText,time:messages.createdAt,status:messages.status,messageId:messages.evolutionMessageId,type:sql<string>`coalesce(${messages.payload}->>'mediatype',${messages.messageType})`,fileName:sql<string|null>`${messages.payload}->>'fileName'`}).from(messages).where(and(scope,ne(messages.messageType,'reaction'))).orderBy(desc(messages.createdAt)).limit(100),
  db.select({id:outboundMessages.id,text:outboundMessages.messageText,time:outboundMessages.createdAt,status:outboundMessages.status,messageId:outboundMessages.evolutionMessageId,type:sql<string>`coalesce(${outboundMessages.payload}->>'mediatype',${outboundMessages.payload}->>'type')`,fileName:sql<string|null>`${outboundMessages.payload}->>'fileName'`}).from(outboundMessages).where(and(eq(outboundMessages.tenantId,tenantId),eq(outboundMessages.instanceId,instanceId),eq(outboundMessages.remoteJid,jid),ne(sql<string>`${outboundMessages.payload}->>'type'`,'reaction'),inArray(outboundMessages.status,['queued','sending','uncertain','failed']))).orderBy(desc(outboundMessages.createdAt)).limit(20),
 ]);
 const targets=history.map(row=>row.messageId).filter((id):id is string=>!!id);
 const reactions=targets.length?await db.query.messages.findMany({where:and(scope,eq(messages.messageType,'reaction'),inArray(sql<string>`${messages.payload}->'key'->>'id'`,targets)),columns:{isFromMe:true,messageType:true,payload:true,createdAt:true},orderBy:[desc(messages.createdAt)]}):[];
 return [...history.map(row=>({id:row.id,from:row.fromMe?'us':'them',text:row.text,time:row.time.toISOString(),status:row.status,messageId:row.messageId,type:row.type,fileName:row.fileName,reactions:foldReactions(reactions,row.messageId||'')})),...pending.filter(row=>!row.messageId||!history.some(message=>message.messageId===row.messageId)).map(row=>({id:row.id,from:'us',text:row.text,time:row.time.toISOString(),status:row.status,outboundId:row.id,messageId:row.messageId,type:row.type,fileName:row.fileName}))].sort((a,b)=>new Date(a.time).getTime()-new Date(b.time).getTime());
}
