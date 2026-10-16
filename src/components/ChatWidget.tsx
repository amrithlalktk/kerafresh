"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, X } from "lucide-react";

type Message = { role: "user" | "assistant"; text: string };

const GREETING: Message = {
  role: "assistant",
  text: `Hi! I'm the Kerafresh assistant. Ask me about a party (e.g. "Ravi Traders"), a bill (e.g. "sale #3"), or type "help" to see what I can do.`,
};

// A simple rule-based assistant, not a real AI — see /api/chatbot. Floats
// on every page (mounted once in AppShell) so a lookup is never more than
// a click away, regardless of which page you're on.
export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setSending(true);
    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        { role: "assistant", text: data.reply ?? "Sorry, something went wrong." },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "Sorry, something went wrong reaching the assistant." },
      ]);
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open assistant"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#1baf7a] text-white shadow-lg transition-transform hover:scale-105 print:hidden"
      >
        <Bot size={24} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex h-[32rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-white/50 bg-white/90 shadow-2xl backdrop-blur-xl print:hidden dark:border-white/10 dark:bg-[#1e2231]/95">
      <div className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-[#1baf7a]" />
          <p className="text-sm font-medium">Kerafresh Assistant</p>
        </div>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close assistant"
          className="text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white"
        >
          <X size={18} />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {messages.map((m, i) => (
          <div key={i} className={`mb-3 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-[#1baf7a] text-white"
                  : "bg-black/5 text-black dark:bg-white/10 dark:text-white"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {sending && (
          <div className="mb-3 flex justify-start">
            <div className="rounded-2xl bg-black/5 px-3 py-2 text-sm text-black/50 dark:bg-white/10 dark:text-white/50">
              …
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-black/10 p-3 dark:border-white/10">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          placeholder="Ask about a party or bill…"
          className="flex-1 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm focus:outline-none dark:border-white/15"
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          aria-label="Send"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1baf7a] text-white disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
