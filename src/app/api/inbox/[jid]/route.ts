import {NextResponse} from 'next/server';
import {z} from 'zod';
import {db} from '@/db';
import {whatsappInstances} from '@/db/schema';
import {and,eq} from 'drizzle-orm';
import {requireAuthAndTenant} from '@/lib/auth';
import {authenticationError} from '@/lib/api-error';
import {inboxHistory} from '@/lib/inbox-history';
export async function GET(req:Request,{params}:{params:Promise<{jid:string}>}){try{const {tenantId}=await requireAuthAndTenant(req.headers.get('Authorization'));const {jid}=await params;const instanceId=z.uuid().parse(new URL(req.url).searchParams.get('instanceId'));const instance=await db.query.whatsappInstances.findFirst({where:and(eq(whatsappInstances.id,instanceId),eq(whatsappInstances.tenantId,tenantId)),columns:{id:true}});if(!instance)return NextResponse.json({error:'Connection not found.'},{status:404});return NextResponse.json({messages:await inboxHistory(tenantId,instanceId,jid)});}catch(error){return authenticationError(error)||NextResponse.json({error:'Could not load messages.'},{status:error instanceof z.ZodError?400:500});}}
