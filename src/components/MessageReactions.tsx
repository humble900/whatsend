"use client";
import dynamic from 'next/dynamic';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {SmilePlus,Plus} from 'lucide-react';
const EmojiPicker=dynamic(()=>import('emoji-picker-react'),{ssr:false});
export type Reaction={emoji:string;fromMe:boolean;actor:string};
export default function MessageReactions({reactions=[],onReact,disabled}:{reactions?:Reaction[];onReact:(emoji:string)=>void;disabled:boolean}) {
 const [open,setOpen]=useState(false),[all,setAll]=useState(false),[anchor,setAnchor]=useState({top:0,left:0}); const root=useRef<HTMLDivElement>(null),popup=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!open)return;const close=(e:MouseEvent)=>{if(!root.current?.contains(e.target as Node)&&!popup.current?.contains(e.target as Node)){setOpen(false);setAll(false);}};document.addEventListener('click',close);return()=>document.removeEventListener('click',close);},[open]);
 const choose=(emoji:string)=>{setOpen(false);setAll(false);onReact(reactions.some(r=>r.fromMe&&r.emoji===emoji)?'':emoji);};
 const grouped=[...new Set(reactions.map(r=>r.emoji))];
 return <div ref={root} className="wa-reactions" onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);setAll(false);}}}>
  <button type="button" className="wa-message-reaction" aria-label="React to message" aria-expanded={open} disabled={disabled} onClick={event=>{const rect=event.currentTarget.getBoundingClientRect();setAnchor({left:Math.max(8,Math.min(rect.right-280,window.innerWidth-328)),top:Math.max(8,Math.min(rect.top-60,window.innerHeight-340))});setOpen(!open);setAll(false);}}><SmilePlus size={16}/></button>
  {open&&createPortal(<div ref={popup} style={{position:'fixed',top:anchor.top,left:anchor.left,right:'auto',bottom:'auto',transform:'none',zIndex:90}} className={`wa-reaction-picker ${all?'is-expanded':''}`} role="dialog" aria-label="Choose reaction">{all?<EmojiPicker emojiStyle="native" theme="light" width="100%" height={320} previewConfig={{showPreview:false}} onEmojiClick={e=>choose(e.emoji)}/>:<><div className="wa-quick-reactions">{['👍','❤️','😂','😮','😢','🙏'].map(emoji=><button type="button" key={emoji} aria-label={`React ${emoji}`} onClick={()=>choose(emoji)}>{emoji}</button>)}<button type="button" aria-label="More reaction emoji" onClick={()=>setAll(true)}><Plus size={20}/></button></div>{reactions.some(r=>r.fromMe)&&<button type="button" className="wa-remove-reaction" onClick={()=>{setOpen(false);onReact('');}}>Remove my reaction</button>}</>}</div>,document.body)}
  {grouped.length>0&&<div className="wa-reaction-chips">{grouped.map(emoji=><button type="button" key={emoji} disabled={disabled} className={reactions.some(r=>r.fromMe&&r.emoji===emoji)?'is-mine':''} aria-label={`${emoji}, ${reactions.filter(r=>r.emoji===emoji).length} reaction${reactions.some(r=>r.fromMe&&r.emoji===emoji)?', remove yours':''}`} onClick={()=>choose(emoji)}>{emoji}{reactions.filter(r=>r.emoji===emoji).length>1&&<small>{reactions.filter(r=>r.emoji===emoji).length}</small>}</button>)}</div>}
 </div>;
}
