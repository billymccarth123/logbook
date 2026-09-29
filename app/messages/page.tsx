import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listConversations } from "@/lib/messages";
import { AutoRefresh } from "./ChatThread";
import { ConversationList } from "./ConversationList";

export const metadata: Metadata = { title: "Messages · TRUCOST" };

export default async function MessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?returnTo=/messages");
  const conversations = listConversations(user.id);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <AutoRefresh />
      <div className="grid overflow-hidden rounded-2xl border border-zinc-200 grid-cols-[minmax(0,1fr)] lg:h-[calc(100dvh-9rem)] lg:grid-cols-[360px_minmax(0,1fr)] dark:border-zinc-800">
        <section className="overflow-y-auto lg:border-r lg:border-zinc-200 dark:lg:border-zinc-800">
          <h1 className="border-b border-zinc-200 px-4 py-3 text-lg font-semibold dark:border-zinc-800">Messages</h1>
          <ConversationList conversations={conversations} userId={user.id} />
        </section>
        <div className="hidden items-center justify-center text-sm text-zinc-500 lg:flex">
          {conversations.length ? "Choose a conversation" : "Your conversations with buyers and sellers will appear here"}
        </div>
      </div>
    </div>
  );
}
