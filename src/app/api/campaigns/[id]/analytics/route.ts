import {NextResponse} from 'next/server';
import {requireAuthAndTenant} from '@/lib/auth';
import {authenticationError} from '@/lib/api-error';
import {campaignAnalytics,getCampaignContext} from '@/lib/campaign-service';
import {MessagingError} from '@/lib/outbound-service';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 try{const {tenantId}=await requireAuthAndTenant(req.headers.get('Authorization'));const {id}=await params;const campaign=await getCampaignContext(id,tenantId);return NextResponse.json({analytics:await campaignAnalytics(id,tenantId),status:campaign.status},{headers:{'Cache-Control':'no-store'}});}
 catch(error){return authenticationError(error)||NextResponse.json({error:'Could not load campaign results.'},{status:error instanceof MessagingError?error.status:500});}
}
