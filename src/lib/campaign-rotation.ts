import { z } from 'zod';
import { outboundPayloadSchema, type OutboundPayload } from './messaging-contracts';
import { leadVariables, missingVariables, type PersonalizationLead } from './campaign-personalization';
import { injectVariables, parseSpintax } from './spintax';

export const MAX_CAMPAIGN_ACCOUNTS = 1000;
export const senderIdsSchema = z.array(z.uuid()).max(MAX_CAMPAIGN_ACCOUNTS).refine(ids => new Set(ids).size === ids.length, 'Select each sending account only once.');
export type RotationVariant = { id: string; spintaxTemplate: string; payload?: OutboundPayload; weight?: number; enabled?: boolean };
export type RotationAccount = { id: string; availableToday?: number };
export type RotationMode = 'round_robin' | 'weighted' | 'account_locked';

// Smooth weighted rotation spreads each variant throughout the cycle instead of grouping it.
export function weightedVariantCycle(variants: RotationVariant[]): number[] {
  const weights = variants.map(variant => Math.max(1, Math.min(100, Math.trunc(variant.weight || 1))));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const current = weights.map(() => 0);
  const cycle: number[] = [];
  for (let position = 0; position < total; position++) {
    let chosen = 0;
    for (let index = 0; index < weights.length; index++) { current[index] += weights[index]; if (current[index] > current[chosen]) chosen = index; }
    current[chosen] -= total; cycle.push(chosen);
  }
  return cycle;
}

export function prepareCampaignPlan<A extends RotationAccount, L extends PersonalizationLead>(accounts: A[], leads: L[], savedVariants: RotationVariant[], mode: string, defaultText = '') {
  if (!accounts.length || accounts.length > MAX_CAMPAIGN_ACCOUNTS) throw new Error('Choose between 1 and 1,000 connected sending accounts.');
  if (new Set(accounts.map(account => account.id)).size !== accounts.length) throw new Error('Sending accounts must be unique.');
  if (new Set(leads.map(lead => lead.phone)).size !== leads.length) throw new Error('Campaign recipients must be unique.');
  const variants = savedVariants.length ? savedVariants.filter(variant => variant.enabled !== false) : [{ id: 'default', spintaxTemplate: defaultText }];
  if (!variants.length) throw new Error('Enable at least one message variant before launching.');
  if (new Set(variants.map(variant => variant.id)).size !== variants.length) throw new Error('Message variant IDs must be unique.');
  const payloads = variants.map(variant => outboundPayloadSchema.parse(variant.payload || { type: 'text', text: variant.spintaxTemplate }));
  const cycle = mode === 'weighted' ? weightedVariantCycle(variants) : [];
  const remaining = accounts.map(account => Math.max(0, Math.floor(account.availableToday ?? Infinity)));
  const eligible = accounts.map((_,index)=>index).filter(index=>remaining[index]>0);
  const turns = accounts.map(()=>0);
  let pointer = 0, futurePointer = 0;
  return leads.map((lead, index) => {
    let accountIndex:number;
    if(eligible.length){
      accountIndex=eligible[pointer];remaining[accountIndex]--;
      if(remaining[accountIndex]===0){eligible.splice(pointer,1);pointer=eligible.length?pointer%eligible.length:0;}
      else pointer=(pointer+1)%eligible.length;
    }else accountIndex=futurePointer++%accounts.length;
    const accountTurn = turns[accountIndex]++;
    const variantIndex = mode === 'account_locked' ? accountIndex % variants.length : mode === 'weighted' ? cycle[(accountIndex + accountTurn) % cycle.length] : (accountIndex + accountTurn) % variants.length;
    const base = payloads[variantIndex];
    const variables = leadVariables(lead);
    const render = (text: string) => {
      const missing = missingVariables(text, variables);
      if (missing.length) throw new Error(`A recipient is missing values for ${missing.map(key => '{{' + key + '}}').join(', ')}. Complete those lead columns or remove the variables before launching.`);
      return parseSpintax(injectVariables(text, variables));
    };
    const payload: OutboundPayload = base.type === 'text' ? { ...base, text: z.string().trim().min(1).max(4096).parse(render(base.text)) } : base.type === 'media' ? { ...base, caption: z.string().max(4096).parse(render(base.caption || '')) } : base;
    return { inst: accounts[accountIndex], lead, variantId: variants[variantIndex].id, accountTurn, payload };
  });
}

export function campaignAllowance(accountLimit: number, campaignLimit: number, accountUsed: number, campaignUsed: number) {
  return Math.max(0, Math.min(accountLimit - accountUsed, campaignLimit - campaignUsed));
}
