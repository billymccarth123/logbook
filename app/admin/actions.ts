"use server";

import { revalidatePath } from "next/cache";
import { deleteUser, requireAdmin, setUserRole, setUserStatus } from "@/lib/auth";

// Every admin action re-checks the caller is an admin, and admins can't
// suspend, demote or delete themselves (so there's always one admin left).
async function targetFrom(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) throw new Error("Not allowed");
  const userId = String(formData.get("userId") ?? "");
  if (!userId || userId === admin.id) throw new Error("You can't change your own account here.");
  return userId;
}

export async function suspendUser(formData: FormData) {
  setUserStatus(await targetFrom(formData), "suspended");
  revalidatePath("/admin");
}

export async function reactivateUser(formData: FormData) {
  setUserStatus(await targetFrom(formData), "active");
  revalidatePath("/admin");
}

export async function makeAdmin(formData: FormData) {
  setUserRole(await targetFrom(formData), "admin");
  revalidatePath("/admin");
}

export async function removeAdmin(formData: FormData) {
  setUserRole(await targetFrom(formData), "user");
  revalidatePath("/admin");
}

export async function removeUser(formData: FormData) {
  deleteUser(await targetFrom(formData));
  revalidatePath("/admin");
}
