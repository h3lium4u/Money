"use client";

import { useState, useRef, useEffect } from "react";
import MarkdownContent from "@/components/MarkdownContent";
import {
  Bot,
  Send,
  User,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  AlertCircle,
  Database,
  ArrowRight,
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  provider?: string;
  model?: string;
  isFallback?: boolean;
  sourceIndicator?: string;
  executionTimeMs?: number;
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = input.trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      // Build conversation history payload
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          history: historyPayload,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${res.status}`);
      }

      const data = await res.json();
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        provider: data.provider,
        model: data.model,
        isFallback: data.isFallback,
        sourceIndicator: data.sourceIndicator,
        executionTimeMs: data.executionTimeMs,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `⚠ Unable to complete request: ${err.message || "The AI assistant is temporarily unavailable. Please try again."}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        sourceIndicator: "System Error Handler",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleClear = () => {
    setMessages([]);
    setInput("");
    inputRef.current?.focus();
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] max-w-5xl mx-auto p-4 md:p-6 space-y-4">
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-md">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-tight">AI Business Assistant</h1>
              <span className="px-2 py-0.5 text-[11px] font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Read-Only
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Ask questions about remittances, profit, customer receivables, and India distributions.
            </p>
          </div>
        </div>

        {/* Status Indicator & Reset */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-[11px] text-slate-300">
            <Database className="w-3.5 h-3.5 text-teal-400" />
            <span>Neon PostgreSQL Ground Truth</span>
          </div>

          {messages.length > 0 && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
              title="Clear conversation"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Chat Messages Container */}
      <div className="flex-1 bg-slate-900/60 border border-slate-800 rounded-xl p-4 md:p-6 overflow-y-auto space-y-5">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 max-w-md mx-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mb-2">
              <Sparkles className="w-7 h-7" />
            </div>
            <h2 className="text-base font-semibold text-white">How can I assist your business today?</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Type any question below to inspect daily orders, customer balances, outstanding receivables, or India distribution splits.
            </p>
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-800 text-[11px] text-slate-400 text-left w-full space-y-1">
              <div className="flex items-center gap-1.5 text-teal-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Financial Ground Truth Protection</span>
              </div>
              <p className="text-slate-400 leading-tight">
                All totals, margins, and balances are retrieved directly from verified database calculations.
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 md:gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-teal-400 shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] md:max-w-[75%] rounded-xl p-4 shadow-sm text-sm space-y-2 ${
                  msg.role === "user"
                    ? "bg-teal-700 text-white rounded-br-none ml-10"
                    : "bg-slate-800/90 border border-slate-700/80 text-slate-200 rounded-bl-none"
                }`}
              >
                {/* Message Header */}
                <div className="flex items-center justify-between text-[11px] opacity-70 border-b border-white/10 pb-1 mb-2">
                  <span className="font-medium">{msg.role === "user" ? "You" : "Business Assistant"}</span>
                  <span>{msg.timestamp}</span>
                </div>

                {/* Message Body with Markdown styling */}
                {msg.role === "user" ? (
                  <div className="whitespace-pre-wrap font-sans text-sm">{msg.content}</div>
                ) : (
                  <MarkdownContent content={msg.content} theme="dark" />
                )}

                {/* Assistant Footer: Verified Database Badge */}
                {msg.role === "assistant" && (
                  <div className="pt-2.5 mt-2 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                    <div className="flex items-center gap-1.5 text-teal-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{msg.sourceIndicator || "✓ Based on verified database data"}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      {msg.executionTimeMs && (
                        <span className="text-slate-400">{(msg.executionTimeMs / 1000).toFixed(1)}s</span>
                      )}
                      <button
                        onClick={() => copyToClipboard(msg.id, msg.content)}
                        className="text-slate-400 hover:text-white transition-colors"
                        title="Copy to clipboard"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-teal-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-lg bg-teal-800 flex items-center justify-center text-white shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex gap-3 items-center">
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-teal-400 shrink-0">
              <Bot className="w-4 h-4 animate-bounce" />
            </div>
            <div className="bg-slate-800/80 border border-slate-700 px-4 py-3 rounded-xl rounded-bl-none text-xs text-slate-300 flex items-center gap-2 shadow-sm">
              <div className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
              <span>Consulting verified financial records in Neon PostgreSQL...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0 text-xs text-slate-400">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1 shrink-0">Quick Neon Queries:</span>
        {[
          "Who are our India distributors?",
          "Who are our AED distributors?",
          "List all customers & balances",
          "SARABU IND vs AED status",
          "Neon database overview",
          "Today's business summary",
        ].map((q) => (
          <button
            key={q}
            type="button"
            disabled={isLoading}
            onClick={() => {
              setInput(q);
              setTimeout(() => {
                const btn = document.getElementById("ai-page-send-btn");
                btn?.click();
              }, 50);
            }}
            className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] whitespace-nowrap transition-colors disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input Box Form */}
      <form
        onSubmit={handleSend}
        className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex items-center gap-2 shadow-lg focus-within:border-teal-500/50 transition-colors"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about your business data (connected directly to Neon PostgreSQL)..."
          disabled={isLoading}
          className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none disabled:opacity-50"
        />

        <button
          id="ai-page-send-btn"
          type="submit"
          disabled={!input.trim() || isLoading}
          className="p-2.5 rounded-lg bg-teal-700 hover:bg-teal-500 text-white font-medium disabled:opacity-40 disabled:hover:bg-teal-700 transition-colors flex items-center justify-center shrink-0 shadow-sm"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
