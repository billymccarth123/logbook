import Link from "next/link";
import { formatEuro } from "@/lib/format";
import type { ConversationSummary } from "@/lib/messages";
import { CarImage } from "../components/CarImage";
import { listTime } from "./format";

export function ConversationList({ conversations, userId, activeId }: {
  conversations: ConversationSummary[];
  userId: string;
  activeId?: string;
}) {
  if (!conversations.length) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="font-medium">No messages yet</p>
        <p className="mt-1 text-sm text-zinc-500">
          Find a car you like and tap <span className="font-medium">Message seller</span>.
        </p>
        <Link href="/cars" className="mt-4 inline-block text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400">
          Browse cars →
        </Link>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
      {conversations.map((c) => {
        const { listing } = c;
        const preview = c.lastMessage ? `${c.lastMessage.senderId === userId ? "You: " : ""}${c.lastMessage.body}` : "";
        return (
          <li key={c.id}>
            <Link
              href={`/messages/${c.id}`}
              className={`flex gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 ${c.id === activeId ? "bg-zinc-100 dark:bg-zinc-900" : ""}`}
            >
              <div className="w-16 shrink-0">
                <CarImage id={listing.id} make={listing.make} model={listing.model} photoUrl={listing.photoUrl} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={`truncate ${c.unread ? "font-semibold" : "font-medium"}`}>{c.otherName}</p>
                  <span className={`shrink-0 text-xs ${c.unread ? "font-semibold text-emerald-700 dark:text-emerald-400" : "text-zinc-500"}`}>
                    {listTime(c.lastMessageAt)}
                  </span>
                </div>
                <p className="truncate text-xs text-zinc-500">
                  {c.selling ? "Your" : ""} {listing.year} {listing.make} {listing.model} · {formatEuro(listing.price)}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  <p className={`min-w-0 flex-1 truncate text-sm ${c.unread ? "font-medium text-zinc-900 dark:text-zinc-100" : "text-zinc-500"}`}>
                    {preview}
                  </p>
                  {c.unread > 0 && (
                    <span className="shrink-0 rounded-full bg-emerald-600 px-1.5 text-xs font-semibold text-white tabular-nums">
                      {c.unread}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
