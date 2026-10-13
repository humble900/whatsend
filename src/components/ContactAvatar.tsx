"use client";
import { useEffect,useRef,useState } from "react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
const cache=new Map<string,{url:string|null;expires:number}>(),pending=new Map<string,Promise<string|null>>();
const queue:(()=>void)[]=[];let active=0;
function pump(){while(active<2&&queue.length){active++;queue.shift()?.();}}
function photo(instanceId:string,jid:string,refresh=false){
 const key=instanceId+':'+jid,known=cache.get(key);
 if(!refresh&&known&&known.expires>Date.now())return Promise.resolve(known.url);
 if(pending.has(key))return pending.get(key)!;
 const request=new Promise<string|null>(resolve=>{queue.push(async()=>{try{
  const response=await authenticatedFetch(`/api/inbox/${encodeURIComponent(jid)}/photo?instanceId=${instanceId}${refresh?'&refresh=true':''}`);
  const data=await response.json();cache.set(key,{url:data.url,expires:new Date(data.expiresAt).getTime()});resolve(data.url);
 }catch{cache.set(key,{url:null,expires:Date.now()+60000});resolve(null);}finally{active--;pending.delete(key);pump();}});pump();});
 pending.set(key,request);return request;
}
export default function ContactAvatar({instanceId,jid,name,initialUrl}:{instanceId:string;jid:string;name:string;initialUrl?:string|null}){
 const [url,setUrl]=useState(initialUrl||null),root=useRef<HTMLSpanElement>(null),retried=useRef(false);
 useEffect(()=>{let alive=true;setUrl(initialUrl||null);retried.current=false;
  if(initialUrl)return;
  const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();void photo(instanceId,jid).then(value=>{if(alive)setUrl(value);});}},{rootMargin:'80px'});
  if(root.current)observer.observe(root.current);
  return()=>{alive=false;observer.disconnect();};
 },[instanceId,jid,initialUrl]);
 const words=name.match(/[\p{L}\p{N}]+/gu)||[];
 const initials=(words.length>1?words.slice(0,2).map(word=>Array.from(word)[0]).join(''):Array.from(words[0]||'?').slice(0,2).join('')).toUpperCase();
 return <span className="wa-avatar" ref={root}>{url?<img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={()=>{setUrl(null);if(!retried.current){retried.current=true;void photo(instanceId,jid,true).then(value=>setUrl(value));}}}/>:initials}</span>;
}
