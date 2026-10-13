import {NextResponse} from 'next/server';
import {requireAuthAndTenant} from '@/lib/auth';
import {authenticationError} from '@/lib/api-error';
import {dashboardSummary} from '@/lib/dashboard-service';
export async function GET(req:Request){
 try{const {tenantId}=await requireAuthAndTenant(req.headers.get('Authorization'));return NextResponse.json(await dashboardSummary(tenantId));}
 catch(error){return authenticationError(error)||NextResponse.json({error:'Failed to load stats'},{status:500});}
}
