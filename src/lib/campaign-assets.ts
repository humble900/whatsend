import {createHash} from 'node:crypto';
import {z} from 'zod';
import {db} from '@/db';
import {messageAssets,campaignWorkerHealth} from '@/db/schema';
import {and,eq,sql} from 'drizzle-orm';
import {outboundPayloadSchema,type OutboundPayload} from './messaging-contracts';
export type StoredPayload=OutboundPayload&{_assetId?:string;_variantId?:string};
type AssetDatabase=Pick<typeof db,'insert'|'query'>;
export async function sharedCampaignMediaReady(){
 const workers=await db.query.campaignWorkerHealth.findMany({where:sql`${campaignWorkerHealth.lastSeenAt}>now()-interval '30 seconds'`,columns:{sharedMediaReady:true}});
 return workers.length>0&&workers.every(worker=>worker.sharedMediaReady);
}
export async function storeCampaignAsset(tenantId:string,payload:OutboundPayload,database:AssetDatabase=db):Promise<StoredPayload>{
 const field=payload.type==='media'?'media':payload.type==='audio'?'audio':payload.type==='sticker'?'sticker':null;
 if(!field)return payload;
 const data=(payload as unknown as Record<string,string>)[field];
 if(data.startsWith('https://')||data.length<4096)return payload;
 const digest=createHash('sha256').update(data).digest('hex');
 const [asset]=await database.insert(messageAssets).values({tenantId,contentHash:digest,data}).onConflictDoUpdate({target:[messageAssets.tenantId,messageAssets.contentHash],set:{contentHash:digest}}).returning({id:messageAssets.id});
 return {...payload,[field]:`asset:${asset.id}`,_assetId:asset.id};
}
export async function resolveStoredPayload(tenantId:string,value:unknown,database:AssetDatabase=db):Promise<OutboundPayload>{
 const stored=value as StoredPayload;
 if(!stored._assetId)return outboundPayloadSchema.parse(value);
 const assetId=z.uuid().parse(stored._assetId);
 const asset=await database.query.messageAssets.findFirst({where:and(eq(messageAssets.id,assetId),eq(messageAssets.tenantId,tenantId)),columns:{data:true}});
 if(!asset)throw Error('The campaign attachment is unavailable in this workspace.');
 const field=stored.type==='media'?'media':stored.type==='audio'?'audio':stored.type==='sticker'?'sticker':null;
 if(!field)throw Error('Invalid stored attachment type.');
 return outboundPayloadSchema.parse({...stored,[field]:asset.data});
}
