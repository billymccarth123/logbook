import "server-only";

import { db, must } from "./db";
import { getListing, type Listing } from "./listings";

export const MAX_MESSAGE_LENGTH = 2000;

export type Message = { id: number; senderId: string; body: string; createdAt: string };

export type ConversationSummary = {
  id: string;
  listing: Listing;
  otherName: string;
  // Whether the viewer is the seller in this conversation.
  selling: boolean;
  lastMessage: Message | null;
  unread: number;
  lastMessageAt: string;
};

type ConversationRow = {
  id: string;
  listing_id: number;
  buyer_id: string;
  seller_id: string;
};

// A row from the conversation_list() database function (supabase/schema.sql).
type SummaryRow = {
  id: string;
  listing_id: number;
  seller_id: string;
  last_message_at: string;
  unread: number;
  other_name: string | null;
  last_id: number | null;
  last_sender_id: string | null;
  last_body: string | null;
  last_created_at: string | null;
};

type MessageRow = { id: number; sender_id: string; body: string; created_at: string };

function toMessage(row: MessageRow): Message {
  return { id: row.id, senderId: row.sender_id, body: row.body, createdAt: row.created_at };
}

export function messageProblem(body: string) {
  if (!body) return "Write a message first.";
  if (body.length > MAX_MESSAGE_LENGTH) return `Keep messages under ${MAX_MESSAGE_LENGTH.toLocaleString("en-IE")} characters.`;
  return null;
}

// ---- Rate limit ----

// Stops one account flooding sellers: 20 messages a minute (in memory).
const recentSends = new Map<string, number[]>();

export function allowSend(userId: string) {
  const now = Date.now();
  const recent = (recentSends.get(userId) ?? []).filter((time) => now - time < 60_000);
  if (recent.length >= 20) return false;
  recent.push(now);
  recentSends.set(userId, recent);
  return true;
}

// ---- Conversations ----

export async function findConversation(listingId: string, buyerId: string) {
  const row = must(
    await db()
      .from("conversations")
      .select("id")
      .eq("listing_id", listingId)
      .eq("buyer_id", buyerId)
      .maybeSingle<{ id: string }>(),
  );
  return row?.id ?? null;
}

async function insertMessage(conversationId: string, senderId: string, body: string, isBuyer: boolean) {
  const now = new Date().toISOString();
  must(
    await db().from("messages").insert({ conversation_id: conversationId, sender_id: senderId, body, created_at: now }),
  );
  // Sending a message means you've read everything before it.
  must(
    await db()
      .from("conversations")
      .update({ last_message_at: now, [isBuyer ? "buyer_read_at" : "seller_read_at"]: now })
      .eq("id", conversationId),
  );
}

// Opens (or reuses) the buyer's conversation about a listing and sends the first message.
export async function startConversation(listing: Listing, buyerId: string, body: string) {
  if (!listing.sellerId) throw new Error("This listing has no seller to message.");
  const now = new Date().toISOString();
  // The seller's read time starts empty: they haven't read anything yet.
  must(
    await db().from("conversations").upsert(
      {
        listing_id: Number(listing.id),
        buyer_id: buyerId,
        seller_id: listing.sellerId,
        created_at: now,
        last_message_at: now,
        buyer_read_at: now,
      },
      { onConflict: "listing_id,buyer_id", ignoreDuplicates: true },
    ),
  );
  const id = (await findConversation(listing.id, buyerId))!;
  await insertMessage(id, buyerId, body, true);
  return id;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function conversationRow(conversationId: string) {
  if (!UUID.test(conversationId)) return null;
  return must(
    await db()
      .from("conversations")
      .select("id, listing_id, buyer_id, seller_id")
      .eq("id", conversationId)
      .maybeSingle<ConversationRow>(),
  );
}

// The conversation if this user is the buyer or seller in it, otherwise null.
export async function getConversation(conversationId: string, userId: string) {
  const row = await conversationRow(conversationId);
  if (!row || (row.buyer_id !== userId && row.seller_id !== userId)) return null;
  const listing = await getListing(String(row.listing_id));
  if (!listing) return null;
  const selling = row.seller_id === userId;
  const other = must(
    await db()
      .from("users")
      .select("name, created_at")
      .eq("id", selling ? row.buyer_id : row.seller_id)
      .maybeSingle<{ name: string; created_at: string }>(),
  );
  return {
    id: row.id,
    listing,
    selling,
    otherName: other?.name.split(" ")[0] ?? "Deleted user",
    otherSince: other?.created_at ?? null,
  };
}

export async function getMessages(conversationId: string) {
  const rows = must(
    await db().from("messages").select("id, sender_id, body, created_at").eq("conversation_id", conversationId).order("id"),
  ) as MessageRow[];
  return rows.map(toMessage);
}

// Sends a message if this user is in the conversation. Returns false otherwise.
export async function sendMessage(conversationId: string, senderId: string, body: string) {
  const row = await conversationRow(conversationId);
  if (!row || (row.buyer_id !== senderId && row.seller_id !== senderId)) return false;
  await insertMessage(conversationId, senderId, body, row.buyer_id === senderId);
  return true;
}

export async function markRead(conversationId: string, userId: string) {
  if (!UUID.test(conversationId)) return;
  const now = new Date().toISOString();
  await Promise.all([
    db().from("conversations").update({ buyer_read_at: now }).eq("id", conversationId).eq("buyer_id", userId).then(must),
    db().from("conversations").update({ seller_read_at: now }).eq("id", conversationId).eq("seller_id", userId).then(must),
  ]);
}

async function summaryRows(userId: string) {
  return must(await db().rpc("conversation_list", { p_user: userId })) as SummaryRow[];
}

export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  const rows = await summaryRows(userId);
  const listings = await Promise.all(rows.map((row) => getListing(String(row.listing_id))));

  return rows.flatMap((row, i) => {
    const listing = listings[i];
    if (!listing) return [];
    return [
      {
        id: row.id,
        listing,
        otherName: row.other_name?.split(" ")[0] ?? "Deleted user",
        selling: row.seller_id === userId,
        lastMessage:
          row.last_id != null
            ? toMessage({ id: row.last_id, sender_id: row.last_sender_id!, body: row.last_body!, created_at: row.last_created_at! })
            : null,
        unread: Number(row.unread),
        lastMessageAt: row.last_message_at,
      },
    ];
  });
}

// Conversations with unread messages, for the header badge.
export async function unreadConversationCount(userId: string) {
  return (await summaryRows(userId)).filter((row) => Number(row.unread) > 0).length;
}
