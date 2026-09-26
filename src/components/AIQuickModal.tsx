"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import MarkdownContent from "@/components/MarkdownContent";
import {
  Bot,
  Sparkles,
  Database,
  Send,
  X,
  Maximize2,
  RotateCcw,
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  sourceIndicator?: string;
}

const QUICK_PROMPTS = [
  { label: "India Distributors", prompt: "Who are our India (IND) distributors?" },
  { label: "AED Distributors", prompt: "Who are our AED distributors?" },
  { label: "Customer Balances", prompt: "List all customers and their outstanding balances" },
  { label: "SARABU IND vs AED", prompt: "Explain the difference between SARABU IND and SARABU AED" },
  { label: "Neon DB Overview", prompt: "Show Neon database overview and table counts" },
  { label: "Today's Summary", prompt: "What is today's business summary?" },
];

export default function AIQuickModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello! I am your **Petti AI Assistant**, connected live to **Neon PostgreSQL**.\n\nAsk me anything about your remittance orders, Dubai customer balances, India distributors (IND), AED distributors (AED), or live database records.",
      timestamp: "Just now",
      sourceIndicator: "Neon PostgreSQL Live",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = async (queryText?: string) => {
    const textToSend = (queryText || input).trim();
    if (!textToSend || isLoading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const historyPayload = messages.slice(-4).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          history: historyPayload,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }

      const data = await res.json();
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        sourceIndicator: data.sourceIndicator,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `⚠ Unable to complete query: ${err.message || "Please check network or database connection."}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          sourceIndicator: "System Error",
        },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      {/* Slide-in Drawer */}
      <div className="w-full max-w-xl lg:max-w-2xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-250">
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-md">
              <Bot className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">AI Assistant</h3>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Neon Linked
                </span>
              </div>
              <p className="text-[11px] text-slate-400">PostgreSQL Ground Truth Engine</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Link
              href="/ai-assistant"
              onClick={onClose}
              title="Expand to Full Page"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
            </Link>
            <button
              onClick={() =>
                setMessages([
                  {
                    id: "reset",
                    role: "assistant",
                    content: "Conversation cleared. Ready for your questions!",
                    timestamp: "Just now",
                  },
                ])
              }
              title="Clear Chat"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              title="Close"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Prompts Bar */}
        <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 shrink-0 overflow-x-auto">
          <div className="flex items-center gap-1.5 whitespace-nowrap text-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">Ask:</span>
            {QUICK_PROMPTS.map((qp) => (
              <button
                key={qp.label}
                type="button"
                onClick={() => handleSend(qp.prompt)}
                disabled={isLoading}
                className="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-700 hover:border-emerald-500 hover:text-emerald-700 text-[11px] font-medium transition-all shadow-2xs hover:shadow-xs disabled:opacity-50"
              >
                {qp.label}
              </button>
            ))}
          </div>
        </div>

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`w-full max-w-[95%] rounded-2xl px-4 py-3 ${
                  m.role === "user"
                    ? "bg-emerald-600 text-white rounded-br-xs shadow-xs text-xs leading-relaxed"
                    : "bg-white text-slate-800 rounded-bl-xs border border-slate-200 shadow-xs"
                }`}
              >
                {m.role === "user" ? (
                  <div className="whitespace-pre-wrap font-sans text-xs">{m.content}</div>
                ) : (
                  <MarkdownContent content={m.content} theme="light" />
                )}
                {m.sourceIndicator && (
                  <div className="mt-2 pt-1.5 border-t border-slate-100 text-[10px] text-emerald-700 font-medium flex items-center gap-1">
                    <Database className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span className="truncate">{m.sourceIndicator.replace(/\n.*/g, "")}</span>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 px-1">{m.timestamp}</span>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-start">
              <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-xs px-4 py-3 shadow-xs">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  <span className="font-medium text-emerald-700">Querying Neon PostgreSQL...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-slate-200 bg-white shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about distributors, customers, Neon data..."
              disabled={isLoading}
              className="flex-1 text-xs border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-slate-50 focus:bg-white transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 px-1">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Neon DB connected & verified
            </span>
            <Link href="/ai-assistant" onClick={onClose} className="hover:underline text-emerald-700 font-semibold">
              Open Full AI Page →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
