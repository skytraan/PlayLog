import { useState, useRef, useEffect } from "react";
import { ChatMessage, Sport } from "@/types/playlog";
import { Send } from "lucide-react";

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSend: (content: string) => void;
  sport: Sport;
}

const presetPrompts: Record<Sport, string[]> = {
  tennis: [
    "What should I work on next?",
    "Analyze my forehand technique",
    "Compare my last two sessions",
    "How has my serve improved?",
  ],
  golf: [
    "What should I work on next?",
    "Analyze my driving accuracy",
    "Compare my last two sessions",
    "How is my short game progressing?",
  ],
};

export function ChatInterface({ messages, onSend, sport }: ChatInterfaceProps) {
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

      {messages.length === 0 && (
        <div className="px-4 py-4">
          <div className="flex flex-wrap gap-2">
            {presetPrompts[sport].map((prompt) => (
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
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] text-sm leading-relaxed rounded-lg px-3 py-2 ${
                  msg.role === "user"
                    ? "bg-foreground text-primary-foreground"
                    : "bg-secondary text-foreground"
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      <div className="border-t border-border px-4 py-3">
        {messages.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {presetPrompts[sport].slice(0, 3).map((prompt) => (
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
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your gameplay..."
            className="flex-1 bg-secondary rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="p-2 rounded-md bg-foreground text-primary-foreground disabled:opacity-30 hover:opacity-90 transition-opacity"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
