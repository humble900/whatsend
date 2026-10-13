"use client";
import { useEffect,useRef,useState } from "react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
export default function InboxMedia({id,type,localSrc}:{id:string;type:string;localSrc?:string}){
 const [url,setUrl]=useState(''),[error,setError]=useState(false),root=useRef<HTMLDivElement>(null);
 useEffect(()=>{let alive=true,objectUrl='';const controller=new AbortController();
  if(localSrc){setUrl(localSrc);return()=>controller.abort();}
  const observer=new IntersectionObserver(entries=>{if(!entries.some(entry=>entry.isIntersecting))return;observer.disconnect();
   void authenticatedFetch(`/api/messages/${id}/media`,{signal:controller.signal}).then(response=>response.blob()).then(blob=>{if(alive){objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);}}).catch(()=>{if(alive)setError(true);});
  },{rootMargin:'60px'});if(root.current)observer.observe(root.current);
  return()=>{alive=false;controller.abort();observer.disconnect();if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[id,localSrc]);
 return <div className={`wa-message-media ${type==='sticker'?'wa-sticker-media':''}`} ref={root}>{url?(type==='audio'?<audio controls src={url}/>:type==='video'?<video controls src={url} preload="metadata"/>:<img src={url} alt={type==='sticker'?'Sticker':'Photo attachment'}/>):<span>{error?'Preview unavailable':'Loading attachment…'}</span>}</div>;
}
