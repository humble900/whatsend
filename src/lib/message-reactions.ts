type Row={isFromMe:boolean;messageType:string;payload:unknown;createdAt:Date};
export function foldReactions(rows:Row[],targetId:string) {
 const actors=new Map<string,{emoji:string;fromMe:boolean;actor:string}>();
 for(const row of [...rows].sort((a,b)=>a.createdAt.getTime()-b.createdAt.getTime())) {
  const payload=row.payload as {key?:{id?:string};reaction?:string;actor?:string}|null;
  if(row.messageType!=='reaction'||payload?.key?.id!==targetId)continue;
  const actor=row.isFromMe?'me':payload.actor||'customer';
  if(payload.reaction)actors.set(actor,{emoji:payload.reaction,fromMe:row.isFromMe,actor});else actors.delete(actor);
 }
 return [...actors.values()];
}
