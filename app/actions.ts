"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getQuotes } from "@/lib/ai-quotes";
import {
  changePassword,
  checkCredentials,
  createUser,
  endSession,
  findUserByEmail,
  getCurrentUser,
  passwordProblem,
  startSession,
  updateUserProfile,
} from "@/lib/auth";
import { isCounty } from "@/lib/counties";
import { driverDetails, parseProfile, type Profile } from "@/lib/driver-profile";
import { addListing, getListings } from "@/lib/listings";

export type FormState = { error?: string; message?: string };

function reader(formData: FormData) {
  return (key: string) => String(formData.get(key) ?? "").trim();
}

function safeReturnPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/cars";
}

// Start pricing every car so quotes are ready by the time the user browses.
function warmQuotes(profile: Profile) {
  after(() => getQuotes(driverDetails(profile), getListings()));
}

export async function signUp(_state: FormState, formData: FormData): Promise<FormState> {
  const result = parseProfile(reader(formData));
  if ("error" in result) return { error: result.error };
  const password = String(formData.get("password") ?? "");
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  if (findUserByEmail(result.profile.email)) {
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
  const existing = findUserByEmail(result.profile.email);
  if (existing && existing.id !== user.id) return { error: "Another account already uses that email." };

  updateUserProfile(user.id, result.profile);
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
  if (!(await getCurrentUser())) redirect("/login?returnTo=/sell");
  const text = reader(formData);
  const make = text("make");
  const model = text("model");
  const year = Number(text("year"));
  const engineSizeLitres = Number(text("engineSizeLitres"));
  const price = Number(text("price"));
  const odometerKm = Number(text("odometerKm"));
  const location = text("location");
  const description = text("description");
  const currentYear = new Date().getFullYear();

  if (!make || !model) return { error: "Enter the make and model." };
  if (!Number.isInteger(year) || year < 1950 || year > currentYear + 1) {
    return { error: "Enter a valid year." };
  }
  if (!(engineSizeLitres >= 0.6 && engineSizeLitres <= 8)) {
    return { error: "Engine size should be between 0.6L and 8.0L." };
  }
  if (!(price > 0)) return { error: "Enter a price." };
  if (!(odometerKm >= 0)) return { error: "Enter the odometer reading." };
  if (!isCounty(location)) return { error: "Choose the car's county." };

  const listing = addListing({
    make,
    model,
    year,
    engineSizeLitres,
    price,
    odometerKm,
    location,
    description,
  });
  revalidatePath("/cars");
  redirect(`/cars/${listing.id}`);
}
