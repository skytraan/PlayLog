import { useState, useRef, useEffect } from "react";
import { ChatMessage, Sport } from "@/types/playlog";
import { FeedbackText } from "@/lib/timestamps";

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSend: (content: string) => void;
  sport: Sport;
  disabled?: boolean;
  isSending?: boolean;
  presetPrompts?: string[];
  onSeek?: (seconds: number) => void;
  sendError?: string | null;
}

const SPORT_ICONS: Record<Sport, string> = {
  tennis: "🎾",
  golf: "⛳",
  basketball: "🏀",
};

export function ChatInterface({
  messages,
  onSend,
  sport,
  disabled = false,
  isSending = false,
  presetPrompts = [],
  onSeek,
  sendError,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isSending]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput("");
  };

  const sportIcon = SPORT_ICONS[sport] ?? "🏅";

  return (
    <div
      className="bg-card border border-border rounded-2xl flex flex-col"
      style={{ height: "calc(100vh - 11rem)", maxHeight: 720, minHeight: 400 }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-3 flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-base flex-shrink-0">
          {sportIcon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Coach</h3>
          <p className="text-[11px] text-muted-foreground">AI · trained on your sessions</p>
        </div>
        <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {messages.length === 0 && !isSending && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3 py-8">
            <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-2xl">
              {sportIcon}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Your AI coach is ready</p>
              <p className="text-xs text-muted-foreground mt-1">
                {disabled ? "Upload a video to start chatting" : "Ask anything about your technique"}
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div key={msg.id} className={`flex items-start gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
                  isUser ? "bg-secondary border border-border" : "bg-primary/15 border border-primary/30"
                }`}
              >
                {isUser ? "👤" : sportIcon}
              </div>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  isUser
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-secondary text-foreground rounded-tl-sm"
                }`}
              >
                {msg.role === "assistant"
                  ? <FeedbackText text={msg.content} onSeek={onSeek} />
                  : msg.content}
              </div>
            </div>
          );
        })}

        {/* Thinking dots */}
        {isSending && (
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-sm flex-shrink-0">
              {sportIcon}
            </div>
            <div className="bg-secondary rounded-2xl rounded-tl-sm px-3 py-2.5">
              <div className="flex gap-1 items-center h-4">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Preset prompts */}
      {presetPrompts.length > 0 && (
        <div className="px-4 py-3 border-t border-border flex-shrink-0">
          <div className="flex flex-col gap-1.5 overflow-y-auto" style={{ maxHeight: "6.5rem", scrollbarWidth: "thin" }}>
            {presetPrompts.map((p) => (
              <button
                key={p}
                onClick={() => onSend(p)}
                disabled={disabled}
                className="text-xs text-left px-3 py-2 rounded-lg bg-secondary border border-border text-foreground/80 hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-40 leading-snug"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-border flex-shrink-0">
        {sendError && <p className="text-xs text-destructive mb-2">{sendError}</p>}
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={disabled ? "Upload a video to start chatting…" : "Ask about your technique…"}
            disabled={disabled}
            className="flex-1 px-3 py-2 text-sm rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={disabled || !input.trim()}
            className="px-3 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-30"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
