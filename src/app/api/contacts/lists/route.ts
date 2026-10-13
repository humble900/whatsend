import {NextResponse} from 'next/server';
import {requireAuthAndTenant} from '@/lib/auth';
import {authenticationError} from '@/lib/api-error';
import {contactLists} from '@/lib/contact-query';
export async function GET(req:Request){try{const {tenantId}=await requireAuthAndTenant(req.headers.get('Authorization'));return NextResponse.json({lists:await contactLists(tenantId)});}catch(error){return authenticationError(error)||NextResponse.json({error:'Could not load lists.'},{status:500});}}
