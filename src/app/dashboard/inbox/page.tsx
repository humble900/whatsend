"use client";
import InboxComposer from "@/components/InboxComposer";
import ContactAvatar from "@/components/ContactAvatar";
import InboxMedia from "@/components/InboxMedia";
import MessageReceipt from "@/components/MessageReceipt";
import MessageReactions,{type Reaction} from "@/components/MessageReactions";
import InboxFilterPicker, { type InboxFilterOption } from "@/components/InboxFilterPicker";
import { outboundPayloadSchema, type OutboundPayload } from "@/lib/messaging-contracts";
import { authenticatedFetch, AuthenticatedRequestError } from "@/lib/authenticated-fetch";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MessageSquare, ChevronLeft, Phone, Clock, Loader2,SlidersHorizontal,X,SmilePlus,Check,CheckCheck } from "lucide-react";

interface Conversation {
  id: string; // The JID
  name: string;
  phone: string;
  lastMessage: string;
  time: string;
  unread: number;
  instanceId: string;
  accountName?: string;
  photoUrl?: string|null;
}

interface Message {
  id: string;
  from: "them" | "us";
  text: string;
  time: string;
  status: string;
  messageId?: string;
  outboundId?: string;
  type?: string;
  fileName?: string;
  localMedia?: string;
  reactions?: Reaction[];
}

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newChat, setNewChat] = useState(false);
  const [targetPhone, setTargetPhone] = useState("");
  const [connections, setConnections] = useState<{ id: string; name: string }[]>([]);
  const [connectionId, setConnectionId] = useState("");
  const [starting, setStarting] = useState(false);
  const openNewChat = async () => {
    setNewChat(true); setStarting(true); setRequestError("");
    try {
      const response = await authenticatedFetch("/api/instances");
      const data = await response.json();
      const available = data.instances.filter((item: { status: string }) => item.status === "connected");
      setConnections(available); setConnectionId(available.find((item:{id:string})=>item.id===accountFilter?.id)?.id || available[0]?.id || "");
      if (!available.length) setRequestError("Connect a WhatsApp number before starting a message.");
    } catch (error) { setRequestError(error instanceof Error ? error.message : "Couldn’t load connected numbers."); }
    finally { setStarting(false); }
  };
  const startChat = (event: React.FormEvent) => {
    event.preventDefault();
    const phone = targetPhone.replace(/[+()\s-]/g, "");
    if (!/^\d{7,15}$/.test(phone) || !connectionId) { setRequestError("Enter a phone number with country code and choose a connected number."); return; }
    const jid = `${phone}@s.whatsapp.net`;
    setSelected({ id: jid, phone, name: `+${phone}`, instanceId: connectionId, accountName:connections.find(item=>item.id===connectionId)?.name, lastMessage: "", time: "", unread: 0 });
    setReply(""); setNewChat(false); setRequestError("");
  };
  const [search, setSearch] = useState("");
  const [searchQuery,setSearchQuery]=useState("");
  const [campaignFilter,setCampaignFilter]=useState<InboxFilterOption|null>(null);
  const [accountFilter,setAccountFilter]=useState<InboxFilterOption|null>(null);
  const [unreadOnly,setUnreadOnly]=useState(false);
  const [page,setPage]=useState(0);
  const [hasMore,setHasMore]=useState(false);
  const [filtersOpen,setFiltersOpen]=useState(false);
  const filterPanel=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(!filtersOpen)return;const outside=(event:PointerEvent)=>{if(!filterPanel.current?.contains(event.target as Node))setFiltersOpen(false);};document.addEventListener("pointerdown",outside);return()=>document.removeEventListener("pointerdown",outside);},[filtersOpen]);
  useEffect(()=>{const timer=setTimeout(()=>{setSearchQuery(search.trim());setPage(0);},250);return()=>clearTimeout(timer);},[search]);
  const [reply, setReply] = useState("");
  const [draftPayload, setDraftPayload] = useState<OutboundPayload>({type:"text",text:""});
  const [advanced, setAdvanced] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [inboxLoadError, setInboxLoadError] = useState("");
  const [messageLoadError, setMessageLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const requestRef = useRef<{id:string;signature:string}|null>(null);
  const pendingSends=useRef(new Map<string,{conversation:string;instanceId:string;message:Message;lastCheck:number}>());
  const applyHistory=(history:Message[],conversation:Conversation)=>{
    const pending:Message[]=[],hidden=new Set<string>();
    for(const [id,item] of pendingSends.current){
      if(item.conversation!==conversation.id||item.instanceId!==conversation.instanceId)continue;
      if(history.some(message=>!!message.messageId&&message.messageId===item.message.messageId||message.id===item.message.outboundId&&message.status==='failed')){pendingSends.current.delete(id);continue;}
      if(item.message.outboundId)hidden.add(item.message.outboundId);
      pending.push(item.message);
    }
    setMessages([...history.filter(message=>!hidden.has(message.id)).map(message=>reactionOverlay.current.has(message.id)?{...message,reactions:reactionOverlay.current.get(message.id)}:message),...pending].sort((a,b)=>new Date(a.time).getTime()-new Date(b.time).getTime()));
  };
  const [reacting,setReacting]=useState<string|null>(null);
  const reactionOverlay=useRef(new Map<string,Reaction[]>());
  const sendReaction=async(message:Message,emoji:string)=>{
    if(!selected||!message.messageId||reacting)return;
    const conversation=selected;setReacting(message.id);setRequestError('');
    const previousReactions=message.reactions||[];
    const nextReactions=[...previousReactions.filter(r=>!r.fromMe),...(emoji?[{emoji,fromMe:true,actor:'me'}]:[])];
    reactionOverlay.current.set(message.id,nextReactions);
    setMessages(previous=>previous.map(item=>item.id===message.id?{...item,reactions:nextReactions}:item));
    try{
      await authenticatedFetch('/api/messages/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID(),instanceId:conversation.instanceId,targetPhone:conversation.phone,payload:{type:'reaction',key:{id:message.messageId,remoteJid:conversation.id,fromMe:message.from==='us'},reaction:emoji}})});
      setMessages(previous=>previous.map(item=>item.id===message.id?{...item,reactions:[...(item.reactions||[]).filter(r=>!r.fromMe),...(emoji?[{emoji,fromMe:true,actor:'me'}]:[])]}:item));
    }catch(error){setMessages(previous=>previous.map(item=>item.id===message.id?{...item,reactions:previousReactions}:item));setRequestError(error instanceof Error?error.message:'Could not react to this message.');}
    finally{reactionOverlay.current.delete(message.id);setReacting(null);}
  };
  const historyScroll=useRef<HTMLDivElement>(null),historyContent=useRef<HTMLDivElement>(null),followLatest=useRef(true);
  useEffect(()=>{followLatest.current=true;},[selected?.id,selected?.instanceId]);
  useEffect(()=>{if(followLatest.current&&historyScroll.current)historyScroll.current.scrollTop=historyScroll.current.scrollHeight;},[messages]);
  useEffect(()=>{const observer=new ResizeObserver(()=>{if(followLatest.current&&historyScroll.current)historyScroll.current.scrollTop=historyScroll.current.scrollHeight;});if(historyContent.current)observer.observe(historyContent.current);return()=>observer.disconnect();},[selected?.id,selected?.instanceId]);
  const [isSending, setIsSending] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const changeFilter = (kind:"campaign"|"account",option:InboxFilterOption|null) => {
    if(isSending)return false;
    if(kind==="account"&&accountFilter?.id===option?.id)return true;
    if(kind==="campaign"&&campaignFilter?.id===option?.id&&!accountFilter)return true;
    if(selected&&(reply.trim()||draftPayload.type!=="text")&&!window.confirm("Discard your unsent reply and change the inbox filter?"))return false;
    if(kind==="campaign"){setCampaignFilter(option);setAccountFilter(null);}else setAccountFilter(option);
    setPage(0);setSelected(null);setReply("");setDraftPayload({type:"text",text:""});setAdvanced(false);setNewChat(false);setRequestError("");setMessageLoadError("");
    return true;
  };
  const downloadMedia = async (message: Message) => {
    try {
      const response = await authenticatedFetch(`/api/messages/${message.id}/media`);
      const blob = await response.blob(); const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href=url;
      link.download=response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1]||"attachment";
      link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch (error) {setRequestError(error instanceof Error?error.message:"Could not download attachment.");}
  };
  const syncHistory = async () => {
    if (!selected || isSyncing) return;
    setIsSyncing(true); setRequestError("");
    try {
      await authenticatedFetch(`/api/instances/${selected.instanceId}/sync`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone:selected.phone})});
      const history = await authenticatedFetch(`/api/inbox/${encodeURIComponent(selected.id)}?instanceId=${selected.instanceId}`);
      setMessages((await history.json()).messages);
    } catch (error) { setRequestError(error instanceof Error ? error.message : "Could not sync messages."); }
    finally { setIsSyncing(false); }
  };

  // Fetch all conversations on mount
  useEffect(() => {
    let alive = true;
    let fetching = false;
    const controller=new AbortController();
    setIsLoading(true);setConversations([]);setInboxLoadError("");setHasMore(false);
    const fetchConversations = async (initial = false) => {
      if (fetching || (!initial && document.hidden)) return;
      fetching = true;
      try {
        const params=new URLSearchParams({q:searchQuery,offset:String(page*50),unread:String(unreadOnly)});
        if(campaignFilter)params.set("campaignId",campaignFilter.id);
        if(accountFilter)params.set("instanceId",accountFilter.id);
        const res = await authenticatedFetch(`/api/inbox?${params}`, {
          signal:controller.signal
        });
        const data = await res.json();
        if (alive && data.conversations) {
          setConversations(data.conversations);
          setInboxLoadError("");
          setHasMore(data.hasMore);
        }
      } catch (err) {
        if (alive) setInboxLoadError(err instanceof Error ? err.message : "Couldn’t load your inbox.");
      } finally {
        fetching = false;
        if(alive)setIsLoading(false);
      }
    };
    fetchConversations(true);
    const interval = setInterval(fetchConversations, 5000);
    return () => { alive = false; clearInterval(interval);controller.abort(); };
  }, [campaignFilter,accountFilter,searchQuery,page,unreadOnly]);

  // Fetch messages when a conversation is selected
  useEffect(() => {
    if (!selected) return;
    let alive = true;
    let fetching = false;
    let markingRead = false;
    const fetchMessages = async (initial = false) => {
      if (fetching || (!initial && document.hidden)) return;
      fetching = true;
      try {
        const res = await authenticatedFetch(`/api/inbox/${encodeURIComponent(selected.id)}?instanceId=${selected.instanceId}`, {
          headers: { }
        });
        const data = await res.json();
        if (alive && data.messages) {
          applyHistory(data.messages,selected);
          setMessageLoadError("");
          if (!markingRead && data.messages.some((message: Message) => message.from === "them" && message.status !== "read")) {
            markingRead = true;
            void authenticatedFetch(`/api/inbox/${encodeURIComponent(selected.id)}/read`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instanceId: selected.instanceId }) })
              .catch(() => { /* Retry on the next history poll; keep incoming messages visible. */ })
              .finally(() => { markingRead = false; });
          }
        }
      } catch (err) {
        if (alive) setMessageLoadError(err instanceof Error ? err.message : "Couldn’t load messages.");
      } finally { fetching = false; }
    };
    setMessages([]);
    setMessageLoadError("");
    fetchMessages(true);
    const interval = setInterval(fetchMessages, 3000);
    return () => { alive = false; clearInterval(interval); };
  }, [selected]);

  // Delivery lookups never block loading the conversation or receiving replies.
  useEffect(()=>{
    if(!selected)return;let alive=true,busy=false;const controller=new AbortController();
    const checkSends=async()=>{
      if(busy)return;const batch=[...pendingSends.current.entries()].filter(([,item])=>item.conversation===selected.id&&item.instanceId===selected.instanceId&&item.message.status!=='failed'&&Date.now()-item.lastCheck>=5000).slice(0,2);
      if(!batch.length)return;busy=true;
      await Promise.allSettled(batch.map(async([id,item])=>{
        item.lastCheck=Date.now();
        try{
          const response=await authenticatedFetch('/api/messages/request/'+id,{signal:controller.signal}),status=await response.json();
          if(!alive)return;
          item.message={...item.message,status:status.status,messageId:status.messageId||undefined,outboundId:status.id};
          setMessages(previous=>previous.map(message=>message.id===id?item.message:message));
          if(status.status==='uncertain'&&status.messageId)await authenticatedFetch('/api/messages/'+status.id+'/reconcile',{method:'POST',signal:controller.signal});
        }catch{/* Read-only verification continues later, without resending. */}
      }));busy=false;
    };
    const timer=setInterval(()=>void checkSends(),3000);return()=>{alive=false;clearInterval(timer);controller.abort();};
  },[selected]);

  const handleSendReply = async () => {
    if (!selected || isSending) return;
    const checked=outboundPayloadSchema.safeParse(draftPayload.type==='text'?{type:'text',text:reply}:draftPayload);
    if(!checked.success){setRequestError(checked.error.issues[0]?.message||'Complete your message.');return;}
    const conversation=selected,payload=checked.data,requestId=crypto.randomUUID();
    const type=payload.type==='media'?payload.mediatype:payload.type;
    const original=draftPayload;
    const message:Message={id:requestId,from:'us',text:payload.type==='text'?payload.text:payload.type==='media'?payload.caption||'':payload.type==='audio'?'':payload.type==='sticker'?'':'['+payload.type+']',time:new Date().toISOString(),status:'sending',type,fileName:payload.type==='media'?payload.fileName:undefined,localMedia:original.type==='media'?original.media:original.type==='audio'?original.audio:original.type==='sticker'?original.sticker:undefined};
    pendingSends.current.set(requestId,{conversation:conversation.id,instanceId:conversation.instanceId,message,lastCheck:Date.now()});
    followLatest.current=true;
    setMessages(previous=>[...previous,message]);
    setDraftPayload({type:'text',text:''});setReply('');setAdvanced(false);setRequestError('');setIsSending(true);
    try{
      const response=await authenticatedFetch('/api/messages/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId,instanceId:conversation.instanceId,targetPhone:conversation.phone,payload})});
      const result=await response.json();
      const pending=pendingSends.current.get(requestId);
      if(pending)pending.message={...pending.message,status:result.status||'sent',messageId:result.messageId,outboundId:result.outboundId};
      setMessages(previous=>previous.map(item=>item.id===requestId?{...item,status:result.status||'sent',messageId:result.messageId,outboundId:result.outboundId}:item));
    }catch(error){
      const failed=error instanceof AuthenticatedRequestError&&[400,401,403,404,409,422].includes(error.status)&&!(error.status===409&&error.data.outboundId);
      const pending=pendingSends.current.get(requestId);
      if(pending)pending.message={...pending.message,status:failed?'failed':'uncertain'};
      setMessages(previous=>previous.map(item=>item.id===requestId?{...item,status:failed?'failed':'uncertain'}:item));
      if(failed)setRequestError(error instanceof Error?error.message:'Message could not be sent.');
    }finally{setIsSending(false);}
  };

  const filtered = conversations;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="inbox-page"
    >
      <div className="inbox-toolbar flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm sm:text-lg">
          All customer conversations, in one inbox.
        </p>
        <button type="button" disabled={isSending} className="profile-button shrink-0" onClick={() => void openNewChat()}>New message</button>
      </div>


      {(requestError || messageLoadError || inboxLoadError) && <p className="app-error" role="alert">{requestError || messageLoadError || inboxLoadError}</p>}
      {newChat && <form onSubmit={startChat} className="profile-card">
        <h2>New message</h2>
        <div className="profile-field"><label htmlFor="message-connection">Send from</label><select id="message-connection" value={connectionId} onChange={event => setConnectionId(event.target.value)} required disabled={starting} className="min-h-11 border border-border rounded-lg px-3"><option value="">Choose a connected number</option>{connections.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        <div className="profile-field"><label htmlFor="message-recipient">Recipient phone number</label><input id="message-recipient" type="tel" value={targetPhone} onChange={event => setTargetPhone(event.target.value)} placeholder="Include country code" required /></div>
        <div className="flex gap-3"><button className="profile-button" disabled={starting || !connectionId}>Open conversation</button><button type="button" className="profile-button profile-secondary" onClick={() => setNewChat(false)}>Cancel</button></div>
      </form>}
      <div className="glass-panel app-inbox rounded-2xl overflow-hidden flex flex-col md:flex-row">
        {/* Conversation List — hidden on mobile when a chat is selected */}
        <div className={`${selected && "hidden md:flex"} wa-conversation-list w-full border-r border-border/50 flex flex-col`}>
          <div className="p-3 sm:p-4 border-b border-border/50">
            <div className="wa-conversation-tools" ref={filterPanel} onKeyDown={event=>{if(event.key==='Escape')setFiltersOpen(false);}}>
             <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search contacts..."
                aria-label="Search conversations"
                maxLength={120}
                className="w-full bg-secondary/50 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:outline-none transition-all"
              />
             </div>
             <button type="button" className="wa-icon-button wa-filter-toggle" aria-label="Filter conversations" aria-expanded={filtersOpen} data-active={Boolean(campaignFilter||accountFilter||unreadOnly)} onClick={()=>setFiltersOpen(previous=>!previous)}><SlidersHorizontal size={19}/></button>
             {filtersOpen&&<div className="wa-filter-panel" role="dialog" aria-label="Inbox filters">
              <div className="wa-filter-panel-title"><strong>Filter conversations</strong><button type="button" className="wa-icon-button" aria-label="Close filters" onClick={()=>setFiltersOpen(false)}><X size={16}/></button></div>
              <InboxFilterPicker kind="campaign" value={campaignFilter} disabled={isSending} onChange={option=>changeFilter("campaign",option)}/>
              <InboxFilterPicker kind="account" value={accountFilter} disabled={isSending} campaignId={campaignFilter?.id} onChange={option=>changeFilter("account",option)}/>
              <div className="wa-filter-actions"><button type="button" disabled={isSending} className="inbox-unread-filter" aria-pressed={unreadOnly} onClick={()=>{setUnreadOnly(previous=>!previous);setPage(0);}}>Unread only</button><button type="button" disabled={isSending} className="inbox-reset-filters" onClick={()=>{if(changeFilter('campaign',null))setUnreadOnly(false);}}>Reset</button></div>
             </div>}
            </div>
            {(campaignFilter||accountFilter||unreadOnly)&&<div className="wa-active-scope"><span title={[campaignFilter?.name,accountFilter?.name,unreadOnly?'Unread':null].filter(Boolean).join(' · ')}>{[campaignFilter?.name,accountFilter?.name,unreadOnly?'Unread':null].filter(Boolean).join(' · ')}</span><button type="button" aria-label="Clear inbox filters" disabled={isSending} onClick={()=>{if(changeFilter('campaign',null))setUnreadOnly(false);}}><X size={13}/></button></div>}
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                {searchQuery?"No conversations match your search.":unreadOnly?"No unread conversations in this selection.":campaignFilter?"No conversations for this campaign yet.":accountFilter?"No conversations for this account yet.":"No conversations found."}
              </div>
            ) : (
              filtered.map((convo) => (
                <button
                  key={`${convo.instanceId}:${convo.id}`}
                  disabled={isSending}
                  onClick={() => setSelected(convo)}
                  className={`wa-conversation-card w-full text-left p-3 sm:p-4 border-b border-border/30 transition-colors ${
                    selected?.id === convo.id && selected?.instanceId === convo.instanceId ? "bg-primary/10" : "hover:bg-secondary/30"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <ContactAvatar instanceId={convo.instanceId} jid={convo.id} name={convo.name} initialUrl={convo.photoUrl}/>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm truncate">{convo.name}</p>
                        <span className="text-xs text-muted-foreground flex-shrink-0">{convo.time ? new Date(convo.time).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : ""}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{convo.lastMessage}</p>
                      <p className="inbox-account-name">{convo.accountName||convo.phone}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {convo.unread > 0 && (
                          <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold">
                            {convo.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
          {(page>0||hasMore)&&<div className="inbox-pagination"><button type="button" disabled={page===0||isLoading} onClick={()=>setPage(previous=>previous-1)}>Previous</button><span>Page {page+1}</span><button type="button" disabled={!hasMore||isLoading} onClick={()=>setPage(previous=>previous+1)}>Next</button></div>}
        </div>

        {/* Chat Area — full width on mobile when selected */}
        <div className={`${!selected && "hidden md:flex"} wa-chat-panel flex-1 min-h-0 min-w-0 flex flex-col`}>
          {selected ? (
            <>
              {/* Chat Header */}
              <div className="shrink-0 p-3 sm:p-4 border-b border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    aria-label="Back to conversations"
                    disabled={isSending}
                    onClick={() => setSelected(null)}
                    className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary/50 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <ContactAvatar instanceId={selected.instanceId} jid={selected.id} name={selected.name} initialUrl={conversations.find(item=>item.id===selected.id&&item.instanceId===selected.instanceId)?.photoUrl||selected.photoUrl}/>
                  <div>
                    <p className="font-semibold text-sm sm:text-base">{selected.name}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {selected.phone}
                    </p>
                    {selected.accountName&&<p className="inbox-account-name">Via {selected.accountName}</p>}
                  </div>
                </div>
                <button type="button" disabled={isSyncing} onClick={()=>void syncHistory()} className="text-xs px-3 py-2 rounded-lg border border-border">{isSyncing ? "Syncing…" : "Sync WhatsApp"}</button>
              </div>

              {/* Messages */}
              <div ref={historyScroll} onScroll={event=>{const element=event.currentTarget;followLatest.current=element.scrollHeight-element.scrollTop-element.clientHeight<100;}} className="wa-message-history flex-1 min-h-0 overflow-y-auto p-3">
               <div ref={historyContent} className="space-y-2">
                <AnimatePresence>
                  {messages.map((msg, i) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${msg.from === "us" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`wa-message-bubble max-w-[85%] sm:max-w-md px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl ${
                          msg.from === "us"
                            ? "bg-primary text-white rounded-br-md"
                            : "bg-secondary/50 rounded-bl-md"
                        }`}
                      >
                        {(msg.messageId||msg.localMedia)&&['image','video','audio','sticker'].includes(msg.type||'')&&<InboxMedia id={msg.id} type={msg.type!} localSrc={msg.localMedia}/>}{msg.type==='document'&&<div className='wa-document-bubble'><span>▤</span><strong>{msg.fileName||'Document'}</strong></div>}
                        {!(msg.type==='sticker'||msg.type==='image'&&msg.text==='[image]'||msg.type==='audio'&&msg.text==='[audio]')&&<p className="text-sm whitespace-pre-wrap">{msg.text}</p>}
                        {msg.messageId && ["media","image","video","document","audio","sticker"].includes(msg.type||"") && <button type="button" className="text-xs underline mt-1 mr-3" onClick={()=>void downloadMedia(msg)}>Download attachment</button>}
                        {msg.messageId&&<MessageReactions reactions={msg.reactions} disabled={!!reacting} onReact={emoji=>void sendReaction(msg,emoji)}/>}
                        <p className="wa-message-meta"><time>{new Date(msg.time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</time>{msg.from==='us'&&<MessageReceipt status={msg.status}/>}</p>

                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
               </div>
              </div>

              <InboxComposer text={reply} payload={draftPayload} onText={setReply} onPayload={setDraftPayload} onSend={()=>void handleSendReply()} onError={setRequestError} busy={isSending}/>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>Select a conversation to view messages</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
