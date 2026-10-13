import type {Queue} from 'bullmq';
export async function recoverQueuedJobs(queue:Queue,ids:string[]){
 const missing:string[]=[];
 // Redis lookups run in small parallel groups, then missing jobs are pipelined.
 for(let offset=0;offset<ids.length;offset+=20){
  await Promise.all(ids.slice(offset,offset+20).map(async id=>{const existing=await queue.getJob(id);if(!existing)missing.push(id);else if(await existing.getState()==='failed')await existing.retry();}));
 }
 if(missing.length)await queue.addBulk(ids.filter(id=>missing.includes(id)).map(id=>({name:'dispatch-message',data:{outboundId:id},opts:{jobId:id}})));
}
