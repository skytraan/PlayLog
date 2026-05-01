import { useState, useRef, useEffect } from "react";
import { ChatMessage, Sport } from "@/types/playlog";
import { Send } from "lucide-react";
import { FeedbackText } from "@/lib/timestamps";

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSend: (content: string) => void;
  sport: Sport;
  disabled?: boolean;
  presetPrompts?: string[];
  /** When provided, timestamp tokens (m:ss) inside assistant replies become
   *  buttons that seek the active video. */
  onSeek?: (seconds: number) => void;
  sendError?: string | null;
}

export function ChatInterface({ messages, onSend, sport: _sport, disabled = false, presetPrompts = [], onSeek, sendError }: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div className="border border-border rounded-lg bg-card">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Ask your coach</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Ask questions about your gameplay across any session
        </p>
      </div>

      {messages.length === 0 && presetPrompts.length > 0 && (
        <div className="px-4 py-4">
          <div className="flex flex-wrap gap-2">
            {presetPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => onSend(prompt)}
                className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-secondary rounded-full hover:text-foreground transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.length > 0 && (
        <div className="max-h-96 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex items-end gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center text-sm">
                  🎾
                </div>
              )}
              <div
                className={`max-w-[80%] text-sm leading-relaxed rounded-2xl px-4 py-2.5 ${
                  msg.role === "user"
                    ? "bg-foreground text-background rounded-br-sm"
                    : "bg-secondary text-foreground rounded-bl-sm"
                }`}
              >
                {msg.role === "assistant" && (
                  <p className="text-[10px] font-semibold text-primary uppercase tracking-wide mb-1">Coach</p>
                )}
                <div className="whitespace-pre-wrap">
                  {msg.role === "assistant"
                    ? <FeedbackText text={msg.content} onSeek={onSeek} />
                    : msg.content}
                </div>
              </div>
              {msg.role === "user" && (
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-foreground border border-border flex items-center justify-center text-sm">
                  👤
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      <div className="border-t border-border px-4 py-3">
        {messages.length > 0 && presetPrompts.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {presetPrompts.slice(0, 3).map((prompt) => (
              <button
                key={prompt}
                onClick={() => onSend(prompt)}
                className="px-2.5 py-1 text-xs text-muted-foreground bg-secondary rounded-full hover:text-foreground transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
        {sendError && (
          <p className="text-xs text-destructive mb-2">{sendError}</p>
        )}
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={disabled ? "Upload a video to start chatting…" : "Ask about your gameplay..."}
            disabled={disabled}
            className="flex-1 bg-secondary rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={disabled || !input.trim()}
            className="p-2 rounded-md bg-foreground text-background disabled:opacity-30 hover:opacity-90 transition-opacity"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
