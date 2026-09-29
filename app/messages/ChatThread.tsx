"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useOptimistic, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { markConversationRead, sendReply } from "./actions";

export type ChatMessage = { id: number | string; mine: boolean; body: string; time: string; day: string; sending?: boolean };

const MAX_LENGTH = 2000;
const POLL_MS = 4000;

// Checks for new messages every few seconds while the tab is visible.
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}

export function ChatThread({ conversationId, messages, otherName }: {
  conversationId: string;
  messages: ChatMessage[];
  otherName: string;
}) {
  const [shown, addOptimistic] = useOptimistic(messages, (state, message: ChatMessage) => [...state, message]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const lastFromThem = [...messages].reverse().find((message) => !message.mine)?.id;

  // Mark read when the other person's latest message is on screen, then refresh
  // so the header badge and conversation list catch up.
  useEffect(() => {
    if (lastFromThem === undefined) return;
    markConversationRead(conversationId).then(() => router.refresh());
  }, [conversationId, lastFromThem, router]);

  // Keep the newest message in view.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [shown.length]);

  function send(event?: FormEvent) {
    event?.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText("");
    setError("");
    startTransition(async () => {
      addOptimistic({ id: `sending-${Date.now()}`, mine: true, body, time: "Sending…", day: "Today", sending: true });
      const result = await sendReply(conversationId, body);
      if (result.error) {
        setError(result.error);
        setText(body);
      }
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter adds a new line.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) send(event);
  }

  return (
    <>
      <AutoRefresh />
      <div className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
        {shown.map((message, i) => {
          const newDay = i === 0 || shown[i - 1].day !== message.day;
          const lastInRun = i === shown.length - 1 || shown[i + 1].mine !== message.mine || shown[i + 1].day !== message.day;
          return (
            <div key={message.id}>
              {newDay && <p className="py-3 text-center text-xs font-medium text-zinc-500">{message.day}</p>}
              <div className={`flex ${message.mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug break-words whitespace-pre-wrap sm:max-w-[65%] ${
                    message.mine
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                  } ${message.sending ? "opacity-70" : ""} ${lastInRun ? (message.mine ? "rounded-br-md" : "rounded-bl-md") : ""}`}
                >
                  {message.body}
                </div>
              </div>
              {lastInRun && (
                <p className={`mt-1 mb-2 px-1 text-[11px] text-zinc-400 ${message.mine ? "text-right" : "text-left"}`}>{message.time}</p>
              )}
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      <form onSubmit={send} className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        {error && <p className="mb-2 px-1 text-sm text-red-600">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={MAX_LENGTH}
            placeholder={`Message ${otherName}…`}
            aria-label={`Message ${otherName}`}
            className="max-h-40 min-h-11 flex-1 resize-none rounded-2xl border border-zinc-300 bg-white px-4 py-2.5 text-[15px] outline-none [field-sizing:content] focus:border-emerald-600 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            disabled={!text.trim()}
            className="h-11 rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </form>
    </>
  );
}
