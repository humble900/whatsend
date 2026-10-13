import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prepareCampaignPlan,weightedVariantCycle,campaignAllowance,senderIdsSchema} from '../src/lib/campaign-rotation';
const accounts=Array.from({length:1000},()=>({id:randomUUID()}));
const leads=Array.from({length:10000},(_,index)=>({phone:`1555${String(index).padStart(7,'0')}`,name:`Lead ${index}`,variables:{company:`Company ${index}`}}));
const variants=[{id:'A',weight:70,spintaxTemplate:'Hi {{first_name}} at {{company}}'},{id:'B',weight:30,spintaxTemplate:'Hello {{name}}'}];
test('10,000 recipients use 1,000 accounts exactly ten times; variants rotate per account',()=>{
 const plan=prepareCampaignPlan(accounts,leads,variants,'round_robin');const counts=new Map<string,number>();const perAccount=new Map<string,string[]>();
 for(const item of plan){counts.set(item.inst.id,(counts.get(item.inst.id)||0)+1);perAccount.set(item.inst.id,[...(perAccount.get(item.inst.id)||[]),item.variantId]);assert.equal(item.payload.type,'text');if(item.payload.type==='text')assert(!item.payload.text.includes('{{'));}
 assert.equal(plan.length,10000);assert.equal(counts.size,1000);assert([...counts.values()].every(count=>count===10));assert([...perAccount.values()].every(ids=>ids.filter(id=>id==='A').length===5&&ids.filter(id=>id==='B').length===5));
 const repeat=prepareCampaignPlan(accounts,leads,variants,'round_robin');assert.deepEqual(repeat.map(item=>[item.inst.id,item.variantId]),plan.map(item=>[item.inst.id,item.variantId]));
});
test('weighted rotation gives 70/30 across the complete plan without locking accounts to one variant',()=>{
 const plan=prepareCampaignPlan(accounts,leads,variants,'weighted');assert.equal(plan.filter(item=>item.variantId==='A').length,7000);assert.equal(plan.filter(item=>item.variantId==='B').length,3000);
 const cycle=weightedVariantCycle(variants);assert.equal(cycle.length,100);assert.equal(cycle.filter(index=>index===0).length,70);
 assert(new Set(plan.filter(item=>item.inst.id===accounts[0].id).map(item=>item.variantId)).size===2);
});
test('account-locked mode remains stable while disabled variants are excluded',()=>{
 const plan=prepareCampaignPlan(accounts,leads,variants,'account_locked');for(const item of plan)assert.equal(item.variantId,Number(accounts.findIndex(account=>account.id===item.inst.id))%2?'B':'A');
 assert(prepareCampaignPlan(accounts,leads,[...variants,{id:'OFF',enabled:false,spintaxTemplate:''}],'round_robin').every(item=>item.variantId!=='OFF'));
 assert.throws(()=>prepareCampaignPlan(accounts,leads,variants.map(item=>({...item,enabled:false})),'round_robin'));
});
test('sender selection accepts 1,000 unique accounts and rejects duplicates or 1,001',()=>{
 assert.equal(senderIdsSchema.parse(accounts.map(account=>account.id)).length,1000);assert.deepEqual(senderIdsSchema.parse([]),[]);
 assert.throws(()=>senderIdsSchema.parse([accounts[0].id,accounts[0].id]));assert.throws(()=>senderIdsSchema.parse([...accounts.map(account=>account.id),randomUUID()]));
 assert.throws(()=>prepareCampaignPlan([accounts[0],accounts[0]],leads,variants,'round_robin'));assert.throws(()=>prepareCampaignPlan(accounts,[leads[0],leads[0]],variants,'round_robin'));
});
test('account-wide use and per-campaign use enforce independent limits',()=>{
 assert.equal(campaignAllowance(50,10,20,0),10);assert.equal(campaignAllowance(50,10,49,0),1);assert.equal(campaignAllowance(50,10,50,0),0);assert.equal(campaignAllowance(50,10,0,10),0);assert.equal(campaignAllowance(5,10,0,0),5);
});
test('rotation uses remaining capacity before queuing next-day allocations',()=>{
 const pool=accounts.slice(0,3).map((account,index)=>({...account,availableToday:index===0?1:10}));
 const plan=prepareCampaignPlan(pool,leads.slice(0,12),variants,'round_robin');
 const count=(id:string)=>plan.filter(item=>item.inst.id===id).length;
 assert.equal(count(pool[0].id),1);assert.equal(count(pool[1].id),6);assert.equal(count(pool[2].id),5);
 const exhausted=prepareCampaignPlan(pool.map(account=>({...account,availableToday:0})),leads.slice(0,6),variants,'round_robin');
 assert(pool.every(account=>exhausted.filter(item=>item.inst.id===account.id).length===2));
});
