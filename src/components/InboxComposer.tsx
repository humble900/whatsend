"use client";
import dynamic from "next/dynamic";
import { useEffect,useRef,useState } from "react";
import { Paperclip,Smile,Sticker,Send,Image as ImageIcon,FileText,Music,X,Loader2,BarChart3,ContactRound,MapPin } from "lucide-react";
import { outboundPayloadSchema,type OutboundPayload } from "@/lib/messaging-contracts";
import MessageFields from "./MessageFields";
const EmojiPicker=dynamic(()=>import("emoji-picker-react"),{ssr:false,loading:()=> <p className="composer-loading">Loading emoji…</p>});
type Mode="media"|"document"|"audio"|"sticker";
export default function InboxComposer({text,payload,onText,onPayload,onSend,onError,busy}:{text:string;payload:OutboundPayload;onText:(value:string)=>void;onPayload:(value:OutboundPayload)=>void;onSend:()=>void;onError:(error:string)=>void;busy:boolean}) {
 const [menu,setMenu]=useState<"attach"|"emoji"|null>(null),[reading,setReading]=useState(false);
 const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState("");
 const input=useRef<HTMLInputElement>(null),mode=useRef<Mode>("media"),textarea=useRef<HTMLTextAreaElement>(null),root=useRef<HTMLDivElement>(null);
 const generation=useRef(0);
 const caption=payload.type==="media"?payload.caption||"":text;
 useEffect(()=>{if(!['media','audio','sticker'].includes(payload.type)){generation.current++;setFile(null);setReading(false);setMenu(null);}},[payload.type]);
 useEffect(()=>()=>{generation.current++;},[]);
 useEffect(()=>{if(!file){setPreview("");return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
 useEffect(()=>{if(textarea.current){textarea.current.style.height="auto";textarea.current.style.height=Math.min(textarea.current.scrollHeight,110)+"px";}},[caption]);
 useEffect(()=>{if(!menu)return;const outside=(event:MouseEvent)=>{if(!root.current?.contains(event.target as Node))setMenu(null);};document.addEventListener("click",outside);return()=>document.removeEventListener("click",outside);},[menu]);
 const changeText=(value:string)=>payload.type==="media"?onPayload({...payload,caption:value}):onText(value);
 const choose=(kind:Mode)=>{mode.current=kind;if(input.current){input.current.accept=kind==="media"?"image/*,video/*":kind==="audio"?"audio/*":kind==="sticker"?"image/png,image/webp":"*/*";input.current.click();}setMenu(null);};
 const attach=async(picked:File,kind:Mode)=>{
  if(!picked.size||picked.size>8*1024*1024){onError("Choose a non-empty file up to 8 MB.");return;}
  if(kind==="sticker"&&!['image/png','image/webp'].includes(picked.type)){onError("Choose a PNG or WebP sticker.");return;}
  if(kind==="media"&&!/^(image|video)\//.test(picked.type)){onError("Choose a photo or video, or use Document for other files.");return;}
  if(kind==="audio"&&!picked.type.startsWith("audio/")){onError("Choose an audio file.");return;}
  setReading(true);onError("");
  const current=++generation.current;
  try {
   const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error("Could not read this file."));reader.readAsDataURL(picked);});
   if(current!==generation.current)return;
   if(kind==="sticker")onPayload({type:"sticker",sticker:data});
   else if(kind==="audio")onPayload({type:"audio",audio:data,encoding:true});
   else {onPayload({type:"media",mediatype:kind==="document"?"document":picked.type.startsWith("video/")?"video":"image",media:data,caption:text,fileName:picked.name,mimetype:picked.type||"application/octet-stream"});onText("");}
   setFile(picked);setMenu(null);
  }catch(error){if(current===generation.current)onError(error instanceof Error?error.message:"Could not attach this file.");}finally{if(current===generation.current)setReading(false);}
 };
 const remove=()=>{if(payload.type==="media")onText(payload.caption||"");onPayload({type:"text",text:""});setFile(null);};
 const canSend=payload.type==="text"?Boolean(text.trim()):payload.type==="media"?Boolean(payload.media):payload.type==="audio"?Boolean(payload.audio):payload.type==="sticker"?Boolean(payload.sticker):outboundPayloadSchema.safeParse(payload).success;
 return <div className={`wa-composer ${file&&payload.type!=='text'?'has-attachment':''}`} ref={root} onKeyDown={event=>{if(event.key==="Escape"){if(file)remove();else setMenu(null);}}} onDragOver={event=>{if(event.dataTransfer.types.includes("Files"))event.preventDefault();}} onDrop={event=>{event.preventDefault();const picked=event.dataTransfer.files[0];if(picked&&!busy)void attach(picked,/^(image|video)\//.test(picked.type)?"media":"document");}}>
  {file&&payload.type!=="text"&&<div className="wa-upload-view" role="dialog" aria-label="Attachment preview">
   <header><button type="button" className="wa-icon-button" disabled={busy} aria-label="Remove attachment" onClick={remove}><X size={22}/></button><div><strong>{file.name}</strong><small>{file.size<1024?file.size+' B':file.size<1024*1024?(file.size/1024).toFixed(1)+' KB':(file.size/1024/1024).toFixed(2)+' MB'}</small></div></header>
   <div className="wa-upload-stage">
    {preview&&file.type.startsWith('image/')?<img src={preview} alt="Attachment preview"/>:preview&&file.type.startsWith('video/')?<video src={preview} controls preload="metadata"/>:preview&&file.type.startsWith('audio/')?<div className="wa-document-preview"><Music size={56}/><strong>{file.name}</strong><audio src={preview} controls/></div>:preview&&file.type==='application/pdf'?<iframe sandbox="allow-same-origin" src={preview} title={`Preview ${file.name}`}/>:<div className="wa-document-preview"><FileText size={64}/><strong>{file.name}</strong><span>{file.name.split('.').pop()?.toUpperCase()} document</span></div>}
   </div>
   <div className="wa-upload-tray"><div className="wa-upload-thumbnail">{preview&&file.type.startsWith('image/')?<img src={preview} alt="Selected attachment"/>:<FileText size={25}/>}</div><span>1 attachment</span></div>
  </div>}
  {!['text','media','audio','sticker','reaction'].includes(payload.type)&&<div className="wa-structured-fields"><MessageFields compact value={payload} onChange={onPayload}/></div>}
  {menu==="emoji"&&<div className="wa-emoji-popover"><EmojiPicker emojiStyle="native" theme="light" width="100%" height={340} previewConfig={{showPreview:false}} onEmojiClick={emoji=>{const field=textarea.current;const start=field?.selectionStart??caption.length,end=field?.selectionEnd??caption.length;changeText(caption.slice(0,start)+emoji.emoji+caption.slice(end));requestAnimationFrame(()=>{field?.focus();field?.setSelectionRange(start+emoji.emoji.length,start+emoji.emoji.length);});}}/></div>}
  {menu==="attach"&&<div className="wa-attachment-menu" role="dialog" aria-label="Attach content">
   <button type="button" onClick={()=>choose("media")}><ImageIcon size={20}/><span>Photos & videos</span></button>
   <button type="button" onClick={()=>choose("document")}><FileText size={20}/><span>Document</span></button>
   <button type="button" onClick={()=>choose("audio")}><Music size={20}/><span>Audio</span></button>
   <button type="button" onClick={()=>choose("sticker")}><Sticker size={20}/><span>Sticker</span></button>
   <button type="button" onClick={()=>{onPayload({type:'poll',name:'',values:['',''],selectableCount:1});setMenu(null);}}><BarChart3 size={20}/><span>Poll</span></button>
   <button type="button" onClick={()=>{onPayload({type:'contacts',contact:[{fullName:'',phoneNumber:''}]});setMenu(null);}}><ContactRound size={20}/><span>Contact</span></button>
   <button type="button" onClick={()=>{onPayload({type:'location',name:'',address:'',latitude:0,longitude:0});setMenu(null);}}><MapPin size={20}/><span>Location</span></button>
  </div>}
  <input ref={input} hidden type="file" aria-label="Upload attachment" onChange={event=>{const picked=event.target.files?.[0];event.target.value="";if(picked)void attach(picked,mode.current);}}/>
  <div className="wa-composer-row">
   <button type="button" className="wa-icon-button" aria-label="Emoji" aria-expanded={menu==="emoji"} disabled={busy||reading||(payload.type!=="text"&&payload.type!=="media")} onClick={()=>setMenu(menu==="emoji"?null:"emoji")}><Smile size={22}/></button>
   <button type="button" className="wa-icon-button" aria-label="Attach file" aria-expanded={menu==="attach"} disabled={busy||reading} onClick={()=>setMenu(menu==="attach"?null:"attach")}><Paperclip size={22}/></button>
   {payload.type==="text"||payload.type==="media"?<textarea ref={textarea} aria-label={payload.type==="media"?"Attachment caption":"Message"} placeholder={payload.type==="media"?"Add a caption…":"Type a message"} rows={1} maxLength={4096} disabled={busy||reading} value={caption} onChange={event=>changeText(event.target.value)} onPaste={event=>{const picked=event.clipboardData.files[0];if(picked){event.preventDefault();void attach(picked,picked.type.startsWith('image/')?'media':'document');}}} onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();if(canSend&&!busy&&!reading)onSend();}}}/>:<span className="wa-composer-ready">{payload.type==="sticker"?"Sticker ready":payload.type==="audio"?"Audio ready":"Ready to send"}</span>}
   <button type="button" className="wa-icon-button wa-sticker-button" aria-label="Upload sticker" disabled={busy||reading} onClick={()=>choose("sticker")}><Sticker size={21}/></button>
   <button type="button" className="wa-send-button" aria-label="Send message" disabled={busy||reading||!canSend} onClick={onSend}>{busy||reading?<Loader2 size={20} className="animate-spin"/>:<Send size={20}/>}</button>
  </div>
 </div>;
}
