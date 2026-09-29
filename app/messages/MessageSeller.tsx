"use client";

import { useActionState, useState } from "react";
import type { FormState } from "../actions";
import { messageSeller } from "./actions";

const QUICK = ["Is this still available?", "Can I view it this week?", "Is the price negotiable?", "Does it have a full service history?"];

// The "Message seller" box on a listing page.
export function MessageSeller({ listingId, sellerName }: { listingId: string; sellerName: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(messageSeller, {});
  const [body, setBody] = useState("Hi, is this still available?");

  return (
    <form action={action} className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
      <input type="hidden" name="listingId" value={listingId} />
      <h2 className="font-semibold">Message {sellerName}</h2>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {QUICK.map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => setBody(text)}
            className={`rounded-full border px-3 py-1 text-xs ${
              body === text
                ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "border-zinc-300 text-zinc-600 hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
            }`}
          >
            {text}
          </button>
        ))}
      </div>
      <textarea
        name="body"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        maxLength={2000}
        required
        aria-label={`Message ${sellerName}`}
        className="mt-3 w-full resize-none rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600 dark:border-zinc-700 dark:bg-zinc-950"
      />
      {state.error && <p className="mt-1 text-sm text-red-600">{state.error}</p>}
      <button
        disabled={pending || !body.trim()}
        className="mt-2 w-full rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
