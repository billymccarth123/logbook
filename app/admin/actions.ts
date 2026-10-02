"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  deleteUser,
  emailInUse,
  findUserByEmail,
  requireAdmin,
  setPasswordAsAdmin,
  setUserRole,
  setUserStatus,
  signOutEverywhere,
  updateUserProfile,
} from "@/lib/auth";
import { parseProfile } from "@/lib/driver-profile";
import { deleteListing, getListing, parseListing, parsePhoto, savePhoto, setListingSeller, updateListing } from "@/lib/listings";
import type { FormState } from "../actions";

async function adminOnly() {
  const admin = await requireAdmin();
  if (!admin) throw new Error("Not allowed");
  return admin;
}

// Every admin action re-checks the caller is an admin, and admins can't
// suspend, demote, delete or lock out themselves (so there's always one admin left).
async function targetFrom(formData: FormData) {
  const admin = await adminOnly();
  const userId = String(formData.get("userId") ?? "");
  if (!userId || userId === admin.id) throw new Error("You can't change your own account here.");
  return userId;
}

function reader(formData: FormData) {
  return (key: string) => String(formData.get(key) ?? "").trim();
}

function refresh() {
  revalidatePath("/admin", "layout");
}

export async function suspendUser(formData: FormData) {
  await setUserStatus(await targetFrom(formData), "suspended");
  refresh();
}

export async function reactivateUser(formData: FormData) {
  await setUserStatus(await targetFrom(formData), "active");
  refresh();
}

export async function makeAdmin(formData: FormData) {
  await setUserRole(await targetFrom(formData), "admin");
  refresh();
}

export async function removeAdmin(formData: FormData) {
  await setUserRole(await targetFrom(formData), "user");
  refresh();
}

export async function signOutUser(formData: FormData) {
  await signOutEverywhere(await targetFrom(formData));
  refresh();
}

// Soft-deletes the account and their listings (see deleteUser).
export async function removeUser(formData: FormData) {
  await deleteUser(await targetFrom(formData));
  refresh();
  revalidatePath("/cars");
  redirect("/admin");
}

export async function updateUserDetails(_state: FormState, formData: FormData): Promise<FormState> {
  await adminOnly();
  const userId = reader(formData)("userId");
  const result = parseProfile(reader(formData));
  if ("error" in result) return { error: result.error };
  if (await emailInUse(result.profile.email, userId)) return { error: "Another account already uses that email." };

  await updateUserProfile(userId, result.profile);
  refresh();
  return { message: "Details saved. Their quotes will be worked out again." };
}

export async function setUserPassword(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await targetFrom(formData);
  const error = await setPasswordAsAdmin(userId, String(formData.get("password") ?? ""));
  if (error) return { error };
  refresh();
  return { message: "Password set. They've been signed out on every device." };
}

export async function updateListingAsAdmin(_state: FormState, formData: FormData): Promise<FormState> {
  await adminOnly();
  const text = reader(formData);
  const id = text("listingId");
  if (!(await getListing(id))) return { error: "That listing no longer exists." };
  const result = parseListing(text);
  if ("error" in result) return { error: result.error };

  const sellerEmail = text("sellerEmail");
  const seller = sellerEmail ? await findUserByEmail(sellerEmail) : null;
  if (sellerEmail && !seller) return { error: "No account uses that seller email." };
  // Optional here: a new photo replaces the current one.
  const upload = await parsePhoto(formData.get("photo"));
  if ("error" in upload) return { error: upload.error };

  await updateListing(id, result.listing);
  await setListingSeller(id, seller?.id ?? null);
  if (upload.photo) await savePhoto(id, upload.photo);
  refresh();
  revalidatePath("/cars", "layout");
  revalidatePath("/");
  return { message: "Listing saved." };
}

export async function removeListing(formData: FormData) {
  await adminOnly();
  await deleteListing(String(formData.get("listingId") ?? ""));
  refresh();
  revalidatePath("/cars", "layout");
  revalidatePath("/");
  const returnTo = String(formData.get("returnTo") ?? "");
  if (returnTo.startsWith("/admin")) redirect(returnTo);
}
