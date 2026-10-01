import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { formatEuro } from "@/lib/format";
import { getConversation, getMessages, listConversations } from "@/lib/messages";
import { CarImage } from "../../components/CarImage";
import { ChatThread } from "../ChatThread";
import { ConversationList } from "../ConversationList";
import { messageDay, messageTime } from "../format";

export const metadata: Metadata = { title: "Messages · TRUCOST" };

export default async function ConversationPage(props: PageProps<"/messages/[id]">) {
  const { id } = await props.params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?returnTo=${encodeURIComponent(`/messages/${id}`)}`);
  const conversation = await getConversation(id, user.id);
  if (!conversation) notFound();

  const { listing, otherName, selling, otherSince } = conversation;
  const [conversations, allMessages] = await Promise.all([listConversations(user.id), getMessages(id)]);
  const messages = allMessages.map((message) => ({
    id: message.id,
    mine: message.senderId === user.id,
    body: message.body,
    time: messageTime(message.createdAt),
    day: messageDay(message.createdAt),
  }));
  const since = otherSince
    ? new Date(otherSince).toLocaleDateString("en-IE", { month: "long", year: "numeric", timeZone: "Europe/Dublin" })
    : null;

  return (
    <div className="mx-auto w-full max-w-7xl px-0 py-0 sm:px-4 sm:py-6">
      <div className="grid h-[calc(100dvh-4rem)] overflow-hidden border-zinc-200 grid-cols-[minmax(0,1fr)] sm:h-[calc(100dvh-7rem)] sm:rounded-2xl sm:border lg:grid-cols-[360px_minmax(0,1fr)] dark:border-zinc-800">
        <section className="hidden overflow-y-auto border-r border-zinc-200 lg:block dark:border-zinc-800">
          <h1 className="border-b border-zinc-200 px-4 py-3 text-lg font-semibold dark:border-zinc-800">Messages</h1>
          <ConversationList conversations={conversations} userId={user.id} activeId={id} />
        </section>

        <section className="flex min-h-0 flex-col">
          <header className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <Link href="/messages" className="-ml-1 px-1 text-xl text-zinc-500 lg:hidden" aria-label="All messages">
              ←
            </Link>
            <Link href={`/cars/${listing.id}`} className="w-14 shrink-0">
              <CarImage id={listing.id} make={listing.make} model={listing.model} photoUrl={listing.photoUrl} />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">
                {otherName}
                <span className="ml-2 text-xs font-normal text-zinc-500">
                  {selling ? "Interested buyer" : "Seller"}
                  {since && ` · on TRUCOST since ${since}`}
                </span>
              </p>
              <Link href={`/cars/${listing.id}`} className="block truncate text-sm text-zinc-500 hover:underline">
                {listing.year} {listing.make} {listing.model} · {formatEuro(listing.price)} · {listing.location}
              </Link>
            </div>
          </header>

          <ChatThread conversationId={id} messages={messages} otherName={otherName} />

          <p className="border-t border-zinc-100 px-4 py-2 text-center text-[11px] text-zinc-400 dark:border-zinc-900">
            Stay safe: see the car in person before paying, and never send money for a car you haven&apos;t viewed.
          </p>
        </section>
      </div>
    </div>
  );
}
