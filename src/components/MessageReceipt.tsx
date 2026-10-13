import { Check, CheckCheck, Clock, CircleAlert } from "lucide-react";
export default function MessageReceipt({status}:{status:string}) {
 const label=status==='read'?'Read':status==='delivered'?'Delivered':status==='sent'?'Sent':status==='failed'?'Failed':status==='uncertain'?'Awaiting confirmation':'Sending';
 const Icon=status==='read'||status==='delivered'?CheckCheck:status==='sent'?Check:status==='failed'?CircleAlert:Clock;
 return <span className={`wa-receipt ${status==='read'?'is-read':''} ${status==='failed'?'is-failed':''}`} role="img" aria-label={label} title={label}><Icon size={16} strokeWidth={2}/></span>;
}
