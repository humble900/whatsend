import { db } from "@/db";
import { contactPhotos,whatsappInstances } from "@/db/schema";
import { and,eq,sql } from "drizzle-orm";
import { evolutionApi } from "./evolution";
export function validContactPhoto(value:unknown):string|null {
 if(typeof value!=="string")return null;
 try {const url=new URL(value);return url.protocol==="https:"&&!url.username&&!url.password&&/(^|\.)(whatsapp\.net|fbcdn\.net)$/.test(url.hostname)?url.toString():null;}catch{return null;}
}
export async function saveContactPhoto(tenantId:string,instanceId:string,remoteJid:string,value:unknown) {
 const url=validContactPhoto(value),checkedAt=new Date(),expiresAt=new Date(Date.now()+(url?60:30)*60000);
 await db.insert(contactPhotos).values({tenantId,instanceId,remoteJid,url,checkedAt,expiresAt}).onConflictDoUpdate({target:[contactPhotos.tenantId,contactPhotos.instanceId,contactPhotos.remoteJid],set:{url,checkedAt,expiresAt}});
 return {url,expiresAt:expiresAt.toISOString()};
}
export async function getContactPhoto(tenantId:string,instanceId:string,jid:string,refresh=false) {
 const instance=await db.query.whatsappInstances.findFirst({where:and(eq(whatsappInstances.id,instanceId),eq(whatsappInstances.tenantId,tenantId))});
 if(!instance)return null;
 const [known]=await db.execute(sql`select exists(select 1 from messages where tenant_id=${tenantId} and instance_id=${instanceId} and remote_jid=${jid}) or exists(select 1 from outbound_messages where tenant_id=${tenantId} and instance_id=${instanceId} and remote_jid=${jid}) or exists(select 1 from contacts where tenant_id=${tenantId} and instance_id=${instanceId} and remote_jid=${jid}) as known`);
 if(!known?.known)return null;
 const cached=await db.query.contactPhotos.findFirst({where:and(eq(contactPhotos.tenantId,tenantId),eq(contactPhotos.instanceId,instanceId),eq(contactPhotos.remoteJid,jid))});
 if(cached&&cached.expiresAt.getTime()>Date.now()&&(!refresh||Date.now()-cached.checkedAt.getTime()<60000))return{url:cached.url,expiresAt:cached.expiresAt.toISOString()};
 if(instance.status!=="connected")return{url:null,expiresAt:new Date(Date.now()+60000).toISOString()};
 const data=await evolutionApi(instance.evolutionServerUrl,`/chat/fetchProfilePictureUrl/${encodeURIComponent(instance.evolutionInstanceId)}`,"POST",{number:jid.replace('@s.whatsapp.net','')});
 return saveContactPhoto(tenantId,instanceId,jid,data?.profilePictureUrl);
}
