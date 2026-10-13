import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireAuthAndTenant} from '@/lib/auth';
import {authenticationError} from '@/lib/api-error';
import {contactPage,contactQuerySchema} from '@/lib/contact-query';
export async function GET(req:Request){try{const {tenantId}=await requireAuthAndTenant(req.headers.get('Authorization'));const query=contactQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));return NextResponse.json(await contactPage(tenantId,query));}catch(error){return authenticationError(error)||NextResponse.json({error:'Could not load contacts.'},{status:error instanceof z.ZodError?400:500});}}
