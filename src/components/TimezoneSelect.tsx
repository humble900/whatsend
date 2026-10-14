"use client";
import {useEffect,useMemo,useState} from 'react';

export default function TimezoneSelect({value,onChange}:{value:string;onChange:(zone:string)=>void}){
 const [search,setSearch]=useState('');const [now,setNow]=useState<Date|null>(null);
 useEffect(()=>{setNow(new Date());const timer=setInterval(()=>setNow(new Date()),60000);return()=>clearInterval(timer);},[]);
 const zones=useMemo(()=>Array.from(new Set(['UTC',value,...Intl.supportedValuesOf('timeZone')])).sort(),[value]);
 const filtered=zones.filter(zone=>zone===value||zone.replaceAll('_',' ').toLowerCase().includes(search.toLowerCase()));
 return <div className="timezone-selection"><label className="profile-field"><span>Campaign time zone</span><input type="search" aria-label="Search time zones" placeholder="Search city or region" value={search} onChange={event=>setSearch(event.target.value)}/><select value={value} onChange={event=>onChange(event.target.value)} aria-describedby="campaign-zone-help">{filtered.map(zone=><option key={zone} value={zone}>{zone.replaceAll('_',' ')}</option>)}</select></label><p id="campaign-zone-help">{now?new Intl.DateTimeFormat('en',{timeZone:value,weekday:'short',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(now):'Loading local time…'} · Sending hours and campaign daily limits use this zone. Daylight saving changes apply automatically.</p><button type="button" className="campaign-editor-button" onClick={()=>{onChange(Intl.DateTimeFormat().resolvedOptions().timeZone);setSearch('');}}>Use my time zone</button></div>;
}
