import test from 'node:test';
import assert from 'node:assert/strict';
import type {Queue} from 'bullmq';
import {recoverQueuedJobs} from '../src/lib/queue-recovery';
import {contactQuerySchema} from '../src/lib/contact-query';
test('queue recovery preserves order, retries failed jobs only, and bulk-adds missing jobs',async()=>{
 const retried:string[]=[];let added:any[]=[];
 const queue={getJob:async(id:string)=>id==='missing-a'||id==='missing-b'?undefined:{getState:async()=>id==='failed'?'failed':'active',retry:async()=>{retried.push(id);}},addBulk:async(jobs:any[])=>{added=jobs;}};
 await recoverQueuedJobs(queue as unknown as Queue,['missing-b','active','failed','missing-a']);
 assert.deepEqual(retried,['failed']);assert.deepEqual(added.map(job=>job.opts.jobId),['missing-b','missing-a']);assert.deepEqual(added.map(job=>job.data.outboundId),['missing-b','missing-a']);
});
test('contact pagination is bounded and rejects invalid filters',()=>{assert.equal(contactQuerySchema.parse({page:1}).limit,50);assert.throws(()=>contactQuerySchema.parse({page:0}));assert.throws(()=>contactQuerySchema.parse({limit:501}));assert.throws(()=>contactQuerySchema.parse({filter:'other'}));});
