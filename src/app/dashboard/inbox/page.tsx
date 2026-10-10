"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MessageSquare, Send, ChevronLeft, Phone, Clock, Loader2 } from "lucide-react";

interface Conversation {
  id: string; // The JID
  name: string;
  phone: string;
  lastMessage: string;
  time: string;
  unread: number;
  instanceId: string;
}

interface Message {
  id: string;
  from: "them" | "us";
  text: string;
  time: string;
  status: string;
}

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState("");
  const [reply, setReply] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  // Fetch all conversations on mount
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const token = localStorage.getItem("token") || "mock-token";
        const res = await fetch("/api/inbox", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.conversations) {
          setConversations(data.conversations);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchConversations();
    // In production, use SWR or a WebSocket for real-time updates
  }, []);

  // Fetch messages when a conversation is selected
  useEffect(() => {
    if (!selected) return;
    const fetchMessages = async () => {
      try {
        const token = localStorage.getItem("token") || "mock-token";
        const res = await fetch(`/api/inbox/${selected.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.messages) {
          setMessages(data.messages);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchMessages();
  }, [selected]);

  // Mark as read when conversation is opened
  useEffect(() => {
    if (!selected || selected.unread === 0) return;

    const markAsRead = async () => {
      try {
        const token = localStorage.getItem("token") || "mock-token";
        await fetch(`/api/inbox/${selected.id}/read`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ instanceId: selected.instanceId })
        });
        
        // Optimistically update the conversation list unread count
        setConversations(prev => 
          prev.map(c => c.id === selected.id ? { ...c, unread: 0 } : c)
        );
      } catch (err) {
        console.error("Failed to mark as read:", err);
      }
    };
    markAsRead();
  }, [selected]);

  const handleSendReply = async () => {
    if (!reply.trim() || !selected || isSending) return;
    
    setIsSending(true);
    const textToSend = reply;
    setReply("");

    // Optimistic UI update
    const optimisticMsg: Message = {
      id: Date.now().toString(),
      from: "us",
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: "sending"
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const token = localStorage.getItem("token") || "mock-token";
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          instanceId: selected.instanceId,
          targetPhone: selected.phone,
          messageText: textToSend
        })
      });

      if (!res.ok) {
        throw new Error("Failed to send");
      }
    } catch (err) {
      console.error(err);
      // Revert optimistic or mark as failed
    } finally {
      setIsSending(false);
    }
  };

  const filtered = conversations.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl sm:text-4xl font-bold tracking-tight mb-2">Unified Inbox</h1>
        <p className="text-muted-foreground text-sm sm:text-lg">
          All replies from every instance, in one place.
        </p>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden flex flex-col md:flex-row" style={{ height: "calc(100vh - 200px)" }}>
        {/* Conversation List — hidden on mobile when a chat is selected */}
        <div className={`${selected && "hidden md:flex"} w-full md:w-96 border-r border-border/50 flex flex-col`}>
          <div className="p-3 sm:p-4 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search contacts..."
                className="w-full bg-secondary/50 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:outline-none transition-all"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No conversations found.
              </div>
            ) : (
              filtered.map((convo) => (
                <button
                  key={convo.id}
                  onClick={() => setSelected(convo)}
                  className={`w-full text-left p-3 sm:p-4 border-b border-border/30 transition-colors ${
                    selected?.id === convo.id ? "bg-primary/10" : "hover:bg-secondary/30"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {convo.name.substring(0,2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm truncate">{convo.name}</p>
                        <span className="text-xs text-muted-foreground flex-shrink-0">{convo.time}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{convo.lastMessage}</p>
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
        </div>

        {/* Chat Area — full width on mobile when selected */}
        <div className={`${!selected && "hidden md:flex"} flex-1 flex flex-col`}>
          {selected ? (
            <>
              {/* Chat Header */}
              <div className="p-3 sm:p-4 border-b border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelected(null)}
                    className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary/50 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                    {selected.name.substring(0,2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-sm sm:text-base">{selected.name}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {selected.phone}
                    </p>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 sm:space-y-4">
                <AnimatePresence>
                  {messages.map((msg, i) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${msg.from === "us" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] sm:max-w-md px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl ${
                          msg.from === "us"
                            ? "bg-primary text-white rounded-br-md"
                            : "bg-secondary/50 rounded-bl-md"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                        <p className={`text-[10px] mt-1 ${
                          msg.from === "us" ? "text-white/60" : "text-muted-foreground"
                        }`}>
                          <Clock className="w-3 h-3 inline mr-0.5" />
                          {msg.time} {msg.status === "sending" && "• Sending..."}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Reply Bar */}
              <div className="p-3 sm:p-4 border-t border-border/50">
                <div className="flex items-center gap-2 sm:gap-3">
                  <input
                    type="text"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                    placeholder="Type a reply..."
                    className="flex-1 bg-secondary/50 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSendReply}
                    disabled={isSending || !reply.trim()}
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </motion.button>
                </div>
              </div>
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
