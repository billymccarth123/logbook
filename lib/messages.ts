import "server-only";

import { randomUUID } from "node:crypto";
import { db } from "./db";
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
  created_at: string;
  last_message_at: string;
  buyer_read_at: string;
  seller_read_at: string;
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

export function findConversation(listingId: string, buyerId: string) {
  const row = db()
    .prepare("SELECT id FROM conversations WHERE listing_id = ? AND buyer_id = ?")
    .get(listingId, buyerId) as { id: string } | undefined;
  return row?.id ?? null;
}

function insertMessage(conversationId: string, senderId: string, body: string, isBuyer: boolean) {
  const now = new Date().toISOString();
  db()
    .prepare("INSERT INTO messages (conversation_id, sender_id, body, created_at) VALUES (?, ?, ?, ?)")
    .run(conversationId, senderId, body, now);
  // Sending a message means you've read everything before it.
  db()
    .prepare(`UPDATE conversations SET last_message_at = ?, ${isBuyer ? "buyer_read_at" : "seller_read_at"} = ? WHERE id = ?`)
    .run(now, now, conversationId);
}

// Opens (or reuses) the buyer's conversation about a listing and sends the first message.
export function startConversation(listing: Listing, buyerId: string, body: string) {
  if (!listing.sellerId) throw new Error("This listing has no seller to message.");
  const existing = findConversation(listing.id, buyerId);
  if (existing) {
    insertMessage(existing, buyerId, body, true);
    return existing;
  }
  const id = randomUUID();
  const now = new Date().toISOString();
  const database = db();
  database.exec("BEGIN");
  try {
    database
      .prepare(
        `INSERT INTO conversations (id, listing_id, buyer_id, seller_id, created_at, last_message_at, buyer_read_at, seller_read_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      // The seller hasn't read anything yet, so their read time starts before the first message.
      .run(id, listing.id, buyerId, listing.sellerId, now, now, now, "");
    insertMessage(id, buyerId, body, true);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return id;
}

// The conversation if this user is the buyer or seller in it, otherwise null.
export function getConversation(conversationId: string, userId: string) {
  const row = db()
    .prepare("SELECT * FROM conversations WHERE id = ? AND (buyer_id = ? OR seller_id = ?)")
    .get(conversationId, userId, userId) as ConversationRow | undefined;
  if (!row) return null;
  const listing = getListing(String(row.listing_id));
  if (!listing) return null;
  const selling = row.seller_id === userId;
  const other = db()
    .prepare("SELECT name, created_at FROM users WHERE id = ?")
    .get(selling ? row.buyer_id : row.seller_id) as { name: string; created_at: string } | undefined;
  return {
    id: row.id,
    listing,
    selling,
    otherName: other?.name.split(" ")[0] ?? "Deleted user",
    otherSince: other?.created_at ?? null,
  };
}

export function getMessages(conversationId: string) {
  return (
    db().prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY id").all(conversationId) as MessageRow[]
  ).map(toMessage);
}

// Sends a message if this user is in the conversation. Returns false otherwise.
export function sendMessage(conversationId: string, senderId: string, body: string) {
  const row = db()
    .prepare("SELECT buyer_id, seller_id FROM conversations WHERE id = ?")
    .get(conversationId) as { buyer_id: string; seller_id: string } | undefined;
  if (!row || (row.buyer_id !== senderId && row.seller_id !== senderId)) return false;
  insertMessage(conversationId, senderId, body, row.buyer_id === senderId);
  return true;
}

export function markRead(conversationId: string, userId: string) {
  const now = new Date().toISOString();
  db()
    .prepare(
      `UPDATE conversations SET
         buyer_read_at = CASE WHEN buyer_id = ? THEN ? ELSE buyer_read_at END,
         seller_read_at = CASE WHEN seller_id = ? THEN ? ELSE seller_read_at END
       WHERE id = ?`,
    )
    .run(userId, now, userId, now, conversationId);
}

// Unread = messages from the other person sent after this user last read.
const UNREAD = `(SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id != ?
  AND m.created_at > CASE WHEN c.buyer_id = ? THEN c.buyer_read_at ELSE c.seller_read_at END)`;

export function listConversations(userId: string): ConversationSummary[] {
  const rows = db()
    .prepare(
      `SELECT c.*, ${UNREAD} AS unread, u.name AS other_name
       FROM conversations c
       LEFT JOIN users u ON u.id = CASE WHEN c.buyer_id = ? THEN c.seller_id ELSE c.buyer_id END
       WHERE c.buyer_id = ? OR c.seller_id = ?
       ORDER BY c.last_message_at DESC`,
    )
    .all(userId, userId, userId, userId, userId) as (ConversationRow & { unread: number; other_name: string | null })[];
  const lastMessage = db().prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 1");

  return rows.flatMap((row) => {
    const listing = getListing(String(row.listing_id));
    if (!listing) return [];
    const last = lastMessage.get(row.id) as MessageRow | undefined;
    return [
      {
        id: row.id,
        listing,
        otherName: row.other_name?.split(" ")[0] ?? "Deleted user",
        selling: row.seller_id === userId,
        lastMessage: last ? toMessage(last) : null,
        unread: row.unread,
        lastMessageAt: row.last_message_at,
      },
    ];
  });
}

// Conversations with unread messages, for the header badge.
export function unreadConversationCount(userId: string) {
  const row = db()
    .prepare(`SELECT COUNT(*) AS n FROM conversations c WHERE (c.buyer_id = ? OR c.seller_id = ?) AND ${UNREAD} > 0`)
    .get(userId, userId, userId, userId) as { n: number };
  return row.n;
}
