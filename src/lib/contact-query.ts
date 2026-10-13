import {db} from '@/db';
import {sql} from 'drizzle-orm';
import {z} from 'zod';
export const contactQuerySchema=z.object({page:z.coerce.number().int().min(1).optional(),limit:z.coerce.number().int().min(1).max(500).default(50),q:z.string().trim().max(120).default(''),filter:z.enum(['all','saved','blacklisted']).default('all'),list:z.string().max(200).optional(),unchecked:z.enum(['true','false']).default('false')});
export async function contactPage(tenantId:string,input:z.infer<typeof contactQuerySchema>){
 const search=input.q?`%${input.q.replace(/[\\%_]/g,'\\$&')}%`:'';
 const blacklisted=sql`exists(select 1 from blacklist b where b.tenant_id=${tenantId} and b.phone_number=c.remote_jid)`;
 const scope=sql`c.tenant_id=${tenantId} ${input.list?sql`and c.metadata->>'_listName'=${input.list}`:sql``} ${input.filter==='saved'?sql`and c.is_saved=true`:input.filter==='blacklisted'?sql`and ${blacklisted}`:sql``} ${input.unchecked==='true'?sql`and coalesce(c.metadata->>'_waStatus','unchecked')='unchecked'`:sql``} ${input.q?sql`and (coalesce(c.push_name,'') ilike ${search} or c.remote_jid ilike ${`%${input.q.replace(/[+()\s-]/g,'').replace(/[\\%_]/g,'\\$&')}%`})`:sql``}`;
 const [rows,counts]=await Promise.all([
  db.execute(sql`select c.id,c.remote_jid,c.push_name,c.is_saved,c.metadata,c.created_at,${blacklisted} as blacklisted,count(*) over()::int as total from contacts c where ${scope} order by c.created_at desc,c.id ${input.page?sql`limit ${input.limit} offset ${(input.page-1)*input.limit}`:sql``}`),
  input.page?db.execute(sql`select count(*)::int as total,count(*) filter(where c.is_saved)::int as saved,count(*) filter(where ${blacklisted})::int as blacklisted,count(*) filter(where coalesce(c.metadata->>'_waStatus','unchecked')='unchecked' and ${scope})::int as unverified from contacts c where c.tenant_id=${tenantId}`):Promise.resolve([]),
 ]);
 let total=Number(rows[0]?.total||0);
 if(input.page&&input.page>1&&!rows.length){const result=await db.execute(sql`select count(*)::int as total from contacts c where ${scope}`);total=Number(result[0].total);}
 return {contacts:rows.map(row=>({id:String(row.id),remoteJid:String(row.remote_jid),pushName:row.push_name,isSaved:Boolean(row.is_saved),isBlacklisted:Boolean(row.blacklisted),metadata:row.metadata,waStatus:(row.metadata as {_waStatus?:string}|null)?._waStatus,createdAt:row.created_at})),total,page:input.page||1,pageSize:input.limit,hasMore:input.page?input.page*input.limit<total:false,counts:counts[0]||{total,saved:0,blacklisted:0,unverified:0}};
}
export async function contactLists(tenantId:string){
 const rows=await db.execute(sql`with ranked as (
  select metadata->>'_listName' as name,metadata->>'_importedAt' as imported_at,coalesce(nullif(push_name,''),'+'||replace(remote_jid,'@s.whatsapp.net','')) as display_name,
  row_number() over(partition by metadata->>'_listName' order by created_at desc,id) as position
  from contacts where tenant_id=${tenantId} and coalesce(metadata->>'_listName','')<>''
 ) select name,count(*)::int as count,max(imported_at) as imported_at,array_agg(display_name order by position) filter(where position<=3) as samples from ranked group by name order by max(imported_at) desc nulls last,name`);
 return rows.map(row=>({name:String(row.name),count:Number(row.count),importedAt:row.imported_at||null,samples:row.samples||[]}));
}
