import { useRef, KeyboardEvent } from "react";
import { Button } from "../ui/button";

interface ChatInputProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSubmit, disabled, placeholder = "Type a message..." }: ChatInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      const text = ref.current?.value.trim();
      if (text) {
        onSubmit(text);
        if (ref.current) ref.current.value = "";
      }
    }
  };

  return (
    <div className="flex gap-2 p-4 border-t border-[hsl(var(--border))]">
      <textarea
        ref={ref}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        rows={2}
        className="flex-1 resize-none rounded border border-[hsl(var(--border))] p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
      />
      <Button
        size="sm"
        onClick={() => {
          const text = ref.current?.value.trim();
          if (text) {
            onSubmit(text);
            if (ref.current) ref.current.value = "";
          }
        }}
        disabled={disabled}
      >
        Send
      </Button>
    </div>
  );
}
