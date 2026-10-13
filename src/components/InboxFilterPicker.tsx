"use client";
import { useEffect,useRef,useState } from "react";
import { Check,ChevronDown,Search } from "lucide-react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

export interface InboxFilterOption { id: string; name: string; detail?: string }
export default function InboxFilterPicker({kind,value,campaignId,onChange,disabled=false}:{kind:"campaign"|"account";value:InboxFilterOption|null;campaignId?:string;disabled?:boolean;onChange:(option:InboxFilterOption|null)=>void}) {
 const [open,setOpen]=useState(false),[query,setQuery]=useState(""),[offset,setOffset]=useState(0);
 const [options,setOptions]=useState<InboxFilterOption[]>([]),[more,setMore]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState("");
 const root=useRef<HTMLDivElement>(null),button=useRef<HTMLButtonElement>(null);
 const label=kind==="campaign"?"Campaign":"WhatsApp account";
 const all=kind==="campaign"?"All campaigns":"All WhatsApp accounts";
 const close=()=>{setOpen(false);button.current?.focus();};
 useEffect(()=>{
  if(!open)return;
  const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
  document.addEventListener("pointerdown",outside);
  return()=>document.removeEventListener("pointerdown",outside);
 },[open]);
 useEffect(()=>{
  if(!open)return;
  const controller=new AbortController();let alive=true;
  setLoading(true);setError("");
  const timer=setTimeout(async()=>{
   try {
    const params=new URLSearchParams({kind,q:query,offset:String(offset)});
    if(kind==="account"&&campaignId)params.set("campaignId",campaignId);
    const response=await authenticatedFetch(`/api/inbox/filters?${params}`,{signal:controller.signal});
    const data=await response.json();
    if(alive){setOptions(previous=>offset?[...previous,...data.options]:data.options);setMore(data.hasMore);}
   }catch(cause){if(alive)setError(cause instanceof Error?cause.message:"Could not load options.");}
   finally{if(alive)setLoading(false);}
  },query?250:0);
  return()=>{alive=false;clearTimeout(timer);controller.abort();};
 },[open,query,offset,kind,campaignId]);
 const choose=(option:InboxFilterOption|null)=>{onChange(option);close();};
 return <div className="inbox-filter-picker" ref={root} onKeyDown={event=>{if(event.key==="Escape")close();}}>
  <span className="inbox-filter-label">{label}</span>
  <button ref={button} type="button" disabled={disabled} className="inbox-filter-trigger" aria-label={`${label}: ${value?.name||all}`} aria-expanded={open} aria-haspopup="dialog" onClick={()=>{setOpen(!open);setQuery("");setOffset(0);setOptions([]);}}><span>{value?.name||all}</span><ChevronDown size={16}/></button>
  {open&&<div role="dialog" aria-label={`Choose ${label.toLowerCase()}`} className="inbox-filter-popover">
   <div className="inbox-option-search"><Search size={16}/><input autoFocus aria-label={`Search ${kind==="campaign"?"campaigns":"WhatsApp accounts"}`} placeholder={kind==="campaign"?"Search campaigns…":"Search name or phone…"} maxLength={120} value={query} onChange={event=>{setQuery(event.target.value);setOffset(0);setOptions([]);}}/></div>
   <div className="inbox-filter-options">
    <button type="button" className="inbox-filter-option" aria-pressed={!value} onClick={()=>choose(null)}><span>{all}</span>{!value&&<Check size={16}/>}</button>
    {options.map(option=><button type="button" key={option.id} className="inbox-filter-option" aria-pressed={value?.id===option.id} onClick={()=>choose(option)}><span><strong>{option.name}</strong><small>{option.detail}</small></span>{value?.id===option.id&&<Check size={16}/>}</button>)}
    {loading&&<p role="status" className="inbox-options-note">Loading…</p>}
    {!loading&&!error&&!options.length&&<p className="inbox-options-note">{query?"No matches found.":kind==="campaign"?"No campaigns yet.":"No accounts in this selection."}</p>}
    {error&&<p role="alert" className="inbox-options-note">{error}<button type="button" onClick={()=>{setOpen(false);setTimeout(()=>setOpen(true),0);}}>Retry</button></p>}
    {more&&!loading&&<button type="button" className="inbox-options-more" onClick={()=>setOffset(previous=>previous+50)}>Load more</button>}
   </div>
  </div>}
 </div>;
}
