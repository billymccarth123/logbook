"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getQuotes } from "@/lib/ai-quotes";
import {
  changePassword,
  checkCredentials,
  createUser,
  emailInUse,
  endSession,
  getCurrentUser,
  passwordProblem,
  startSession,
  updateUserProfile,
} from "@/lib/auth";
import { driverDetails, parseProfile, type Profile } from "@/lib/driver-profile";
import { addListing, getListings, parseListing, parsePhoto } from "@/lib/listings";

export type FormState = { error?: string; message?: string };

function reader(formData: FormData) {
  return (key: string) => String(formData.get(key) ?? "").trim();
}

function safeReturnPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/cars";
}

// Start pricing every car so quotes are ready by the time the user browses.
function warmQuotes(profile: Profile) {
  after(async () => getQuotes(driverDetails(profile), await getListings()));
}

export async function signUp(_state: FormState, formData: FormData): Promise<FormState> {
  const result = parseProfile(reader(formData));
  if ("error" in result) return { error: result.error };
  const password = String(formData.get("password") ?? "");
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  if (await emailInUse(result.profile.email)) {
    return { error: "An account with that email already exists. Log in instead." };
  }

  const userId = await createUser(result.profile, password);
  await startSession(userId);
  warmQuotes(result.profile);
  redirect(safeReturnPath(reader(formData)("returnTo")));
}

export async function logIn(_state: FormState, formData: FormData): Promise<FormState> {
  const email = reader(formData)("email");
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const result = await checkCredentials(email, password);
  if ("error" in result) return { error: result.error };
  await startSession(result.userId);
  redirect(safeReturnPath(reader(formData)("returnTo")));
}

export async function logOut() {
  await endSession();
  redirect("/");
}

export async function updateQuoteDetails(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?returnTo=/profile");
  const result = parseProfile(reader(formData));
  if ("error" in result) return { error: result.error };
  if (await emailInUse(result.profile.email, user.id)) return { error: "Another account already uses that email." };

  await updateUserProfile(user.id, result.profile);
  warmQuotes(result.profile);
  redirect(safeReturnPath(reader(formData)("returnTo")));
}

export async function changePasswordAction(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?returnTo=/profile");
  const error = await changePassword(
    user.id,
    String(formData.get("currentPassword") ?? ""),
    String(formData.get("newPassword") ?? ""),
  );
  return error ? { error } : { message: "Password changed. Other devices have been signed out." };
}

export async function createListing(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?returnTo=/sell");
  const result = parseListing(reader(formData));
  if ("error" in result) return { error: result.error };
  const upload = await parsePhoto(formData.get("photo"));
  if ("error" in upload) return { error: upload.error };
  if (!upload.photo) return { error: "Add a photo of your car before listing it." };

  const listing = await addListing(result.listing, user.id, upload.photo);
  revalidatePath("/cars");
  redirect(`/cars/${listing.id}`);
}
