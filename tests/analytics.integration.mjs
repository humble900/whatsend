import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {db} from '../src/db/index.ts';
import {tenants,whatsappInstances,campaigns,outboundMessages,messages} from '../src/db/schema.ts';
import {campaignAnalytics} from '../src/lib/campaign-service.ts';
import {dashboardSummary} from '../src/lib/dashboard-service.ts';
import {storeReceipt} from '../src/lib/store-message.ts';
try{await db.transaction(async tx=>{
 const [tenant]=await tx.insert(tenants).values({name:'Analytics rollback fixture'}).returning();
 const [instance]=await tx.insert(whatsappInstances).values({tenantId:tenant.id,name:'Fixture',evolutionInstanceId:randomUUID(),evolutionServerUrl:'https://example.com',status:'connected'}).returning();
 const [campaign]=await tx.insert(campaigns).values({tenantId:tenant.id,name:'Fixture',spintaxTemplate:'Hi',timezone:'Africa/Lagos',contactsProcessed:99}).returning();
 const statuses=['queued','sent','delivered','read','failed','skipped','cancelled','uncertain'];
 const sentAt=new Date(Date.now()-60000);
 await tx.insert(outboundMessages).values(statuses.map((status,index)=>({tenantId:tenant.id,instanceId:instance.id,campaignId:campaign.id,status,requestKey:randomUUID(),requestHash:'fixture',remoteJid:`1555000000${index}@s.whatsapp.net`,payload:{type:'text',text:'Hi'},messageText:'Hi',evolutionMessageId:`fixture-${index}`,sentAt:['sent','delivered','read'].includes(status)?sentAt:null})));
 await tx.insert(messages).values([{tenantId:tenant.id,instanceId:instance.id,remoteJid:'15550000001@s.whatsapp.net',isFromMe:false,messageText:'Interested',messageType:'text',status:'received'},{tenantId:tenant.id,instanceId:instance.id,remoteJid:'15550000002@s.whatsapp.net',isFromMe:false,messageText:'👍',messageType:'reaction',status:'received'}]);
 let analytics=await campaignAnalytics(campaign.id,tenant.id,tx);
 assert.equal(analytics.total,8);assert.equal(analytics.sent,3);assert.equal(analytics.delivered,2);assert.equal(analytics.read,1);assert.equal(analytics.replied,1);assert.equal(analytics.processed,6);assert.equal(analytics.uncertain,1);
 await storeReceipt(tenant.id,instance.id,'fixture-1','read',tx);
 await storeReceipt(tenant.id,instance.id,'fixture-1','delivered',tx);
 analytics=await campaignAnalytics(campaign.id,tenant.id,tx);assert.equal(analytics.read,2);assert.equal(analytics.delivered,3);
 const dashboard=await dashboardSummary(tenant.id,new Date(),tx);
 assert.equal(dashboard.stats.totalMessagesSent,3);assert.equal(dashboard.stats.messagesSent24h,3);assert.equal(dashboard.stats.failed24h,1);assert.equal(dashboard.stats.deliveryRate,'100.0%');assert.equal(dashboard.hourlyActivity.reduce((sum,hour)=>sum+hour.count,0),3);
 console.log('PASS: receipts → durable outbox → campaign analytics → dashboard; reactions excluded; failed/skipped/cancelled never counted as sent; duplicate/out-of-order receipts do not regress.');
 throw Error('ANALYTICS_ROLLBACK');
});}catch(error){if(error.message!=='ANALYTICS_ROLLBACK')throw error;}
console.log('All fixtures rolled back. No WhatsApp messages sent.');process.exit(0);
