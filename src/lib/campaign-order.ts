import { db } from '@/db';
import { outboundMessages } from '@/db/schema';
import { and, eq, inArray, lt } from 'drizzle-orm';
export async function hasEarlierCampaignRequest(tenantId:string,campaignId:string,instanceId:string,sequence:number,database:Pick<typeof db,'query'>=db){
  return Boolean(await database.query.outboundMessages.findFirst({where:and(eq(outboundMessages.tenantId,tenantId),eq(outboundMessages.campaignId,campaignId),eq(outboundMessages.instanceId,instanceId),lt(outboundMessages.campaignSequence,sequence),inArray(outboundMessages.status,['queued','sending','uncertain'])),columns:{id:true}}));
}
