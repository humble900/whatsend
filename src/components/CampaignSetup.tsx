"use client";
import {useEffect,useState,useRef} from "react";
import {authenticatedFetch} from "@/lib/authenticated-fetch";
import TimezoneSelect from "./TimezoneSelect";
import CampaignMessageEditor, {type CampaignVariant} from "./CampaignMessageEditor";
export default function CampaignSetup({campaign,mode,onSaved,onDirtyChange}:{campaign:any;mode:"message"|"schedule"|"launch";onSaved:()=>Promise<void>;onDirtyChange?:(dirty:boolean)=>void}) {
 const [variants,setVariants]=useState<CampaignVariant[]>(()=>campaign.variants?.length?campaign.variants.map((item:any)=>({...item,payload:item.payload||{type:"text",text:item.spintaxTemplate}})):[{id:crypto.randomUUID(),label:"Variant A",weight:100,spintaxTemplate:campaign.spintaxTemplate||"",payload:{type:"text",text:campaign.spintaxTemplate||""}}]);
 const [timezone,setTimezone]=useState(campaign.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone);
 const [start,setStart]=useState(campaign.sendingWindows?.[0]?.start||"09:00");const [end,setEnd]=useState(campaign.sendingWindows?.[0]?.end||"17:00");
 const [min,setMin]=useState(campaign.customDelayMin||15);const [max,setMax]=useState(campaign.customDelayMax||45);
 const [consent,setConsent]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [saved,setSaved]=useState(false);
 const [variantMode,setVariantMode]=useState(campaign.variantMode||"round_robin");
 const [preparingAttachment,setPreparingAttachment]=useState(false);
 const snapshot={variants,variantMode,timezone,start,end,min,max};
 const baseline=useRef(snapshot);
 const dirty=mode==='message'?(variants!==baseline.current.variants||variantMode!==baseline.current.variantMode):mode==='schedule'?[timezone,start,end,min,max].some((value,index)=>value!==[baseline.current.timezone,baseline.current.start,baseline.current.end,baseline.current.min,baseline.current.max][index]):false;
 useEffect(()=>onDirtyChange?.(dirty||preparingAttachment),[dirty,preparingAttachment,onDirtyChange]);
 const discard=()=>{const stored=baseline.current;if(mode==='message'){setVariants(stored.variants);setVariantMode(stored.variantMode);}else{setTimezone(stored.timezone);setStart(stored.start);setEnd(stored.end);setMin(stored.min);setMax(stored.max);}setError('');setSaved(false);};
 useEffect(()=>setSaved(false),[variants,variantMode]);
 const submit=async(event:React.FormEvent)=>{event.preventDefault();setBusy(true);setError("");setSaved(false);try {
  if(mode==="launch")await authenticatedFetch(`/api/campaigns/${campaign.id}/launch`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({consentConfirmed:consent})});
  else await authenticatedFetch(`/api/campaigns/${campaign.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(mode==="message"?{variants:variants.map(item=>({...item,spintaxTemplate:item.payload.type==="text"?item.payload.text:""})),spintaxTemplate:variants[0]?.payload.type==="text"?variants[0].payload.text:"",variantMode}:{timezone,sendingWindows:[{start,end}],delayMode:"custom",customDelayMin:min,customDelayMax:max})});
  await onSaved();baseline.current=snapshot;onDirtyChange?.(false);setSaved(true);
 }catch(error){setError(error instanceof Error?error.message:"Could not save setup.");}finally{setBusy(false);}};
 return <form onSubmit={submit} className={mode==="message"?"campaign-message-form":"profile-card"}>
  {mode==="message"&&<fieldset disabled={busy}><CampaignMessageEditor campaignId={campaign.id} variants={variants} onChange={setVariants} distribution={variantMode} onDistributionChange={setVariantMode} onPreparingAttachment={setPreparingAttachment}/></fieldset>}
  {mode==="schedule"&&<fieldset disabled={busy} className="min-w-0"><TimezoneSelect value={timezone} onChange={setTimezone}/><div className="profile-fields"><label className="profile-field"><span>Window start</span><input type="time" value={start} onChange={event=>setStart(event.target.value)} required/></label><label className="profile-field"><span>Window end</span><input type="time" value={end} onChange={event=>setEnd(event.target.value)} required/></label></div><div className="profile-fields"><label className="profile-field"><span>Minimum interval (seconds)</span><input type="number" min={1} max={300} value={min} onChange={event=>setMin(Number(event.target.value))}/></label><label className="profile-field"><span>Maximum interval (seconds)</span><input type="number" min={1} max={300} value={max} onChange={event=>setMax(Number(event.target.value))}/></label></div><p className="text-sm text-muted-foreground mb-4">These settings apply to campaigns. Direct inbox replies are sent immediately.</p></fieldset>}
  {mode==="launch"&&<><h2>Launch campaign</h2><p className="text-sm text-muted-foreground my-4">{campaign.totalContacts} recipients. Messages follow the saved schedule and per-account campaign limits.</p><label className="flex items-start gap-3 mb-5 text-sm"><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)} required className="mt-1"/>I confirm that every recipient opted in to these messages and that opt-out requests will be honored.</label></>}
  <button className="profile-button" disabled={busy||preparingAttachment||campaign.status!=="draft"||(mode==="launch"&&!consent)}>{busy?"Saving…":mode==="launch"?"Launch campaign":"Save changes"}</button>
  {dirty&&<button type="button" disabled={busy||preparingAttachment} className="campaign-editor-button ml-3" onClick={discard}>Discard changes</button>}
  {error&&<p role="alert" className="app-error mt-4">{error}</p>}{saved&&<p role="status" className="profile-feedback">{mode==="launch"?"Campaign queued for the worker.":"Changes saved."}</p>}
 </form>;
}
