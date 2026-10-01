"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getListing } from "@/lib/listings";
import { allowSend, markRead, messageProblem, sendMessage, startConversation } from "@/lib/messages";
import type { FormState } from "../actions";

const TOO_FAST = "You're sending messages too quickly. Wait a minute and try again.";

// From the "Message seller" box on a listing.
export async function messageSeller(_state: FormState, formData: FormData): Promise<FormState> {
  const listingId = String(formData.get("listingId") ?? "");
  const user = await getCurrentUser();
  if (!user) redirect(`/login?returnTo=${encodeURIComponent(`/cars/${listingId}`)}`);

  const listing = await getListing(listingId);
  if (!listing?.sellerId) return { error: "This listing can't be messaged." };
  if (listing.sellerId === user.id) return { error: "This is your own listing." };
  const body = String(formData.get("body") ?? "").trim();
  const problem = messageProblem(body);
  if (problem) return { error: problem };
  if (!allowSend(user.id)) return { error: TOO_FAST };

  const conversationId = await startConversation(listing, user.id, body);
  revalidatePath("/messages", "layout");
  redirect(`/messages/${conversationId}`);
}

// Called by the chat once messages are on screen, so unread badges clear.
export async function markConversationRead(conversationId: string) {
  const user = await getCurrentUser();
  if (user) await markRead(conversationId, user.id);
}

// From the chat box in a conversation.
export async function sendReply(conversationId: string, body: string): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Log in again to send messages." };
  const text = body.trim();
  const problem = messageProblem(text);
  if (problem) return { error: problem };
  if (!allowSend(user.id)) return { error: TOO_FAST };
  if (!(await sendMessage(conversationId, user.id, text))) return { error: "This conversation no longer exists." };

  revalidatePath("/messages", "layout");
  return {};
}
