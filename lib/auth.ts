import "server-only";

import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { promisify } from "node:util";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { db, must, mustCount, type Role, type Status, type UserRow } from "./db";
import { DEMO_SELLER_ID } from "./listings";
import { parseProfile, type DriverDetails, type Profile } from "./driver-profile";
import { MIN_PASSWORD_LENGTH } from "./password-rules";

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number, options: object) => Promise<Buffer>;

export const SESSION_COOKIE = "trucost_session";
const SESSION_DAYS = 30;
const SCRYPT = { N: 16384, r: 8, p: 1 };

export type User = {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: Role;
  status: Status;
  createdAt: string;
  lastLoginAt: string | null;
  profile: Profile | null;
};

// ---- Passwords ----

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64, SCRYPT);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string) {
  const [scheme, saltHex, keyHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length, SCRYPT);
  return timingSafeEqual(actual, expected);
}

// Used when no account matches, so a wrong email takes as long as a wrong password.
let dummyHash: Promise<string> | null = null;

export function passwordProblem(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`;
  if (password.length > 200) return "That password is too long.";
  return null;
}

// ---- Admins ----

// Anyone whose email is in ADMIN_EMAILS becomes an admin when they sign up or log in.
function isConfiguredAdmin(email: string) {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

// ---- Users ----

function toUser(row: UserRow): User {
  let profile: Profile | null = null;
  try {
    const values: Record<string, unknown> = { ...row.details, name: row.name, email: row.email, phone: row.phone };
    const result = parseProfile((key) => {
      const value = values[key];
      if (typeof value === "boolean") return value ? "yes" : "no";
      return value == null ? "" : String(value);
    });
    if ("profile" in result) profile = result.profile;
  } catch {
    // Leave profile empty; the user can fill it in again.
  }
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    profile,
  };
}

// Users are soft-deleted (deleted_at). Queries skip deleted users unless noted.
function users() {
  return db().from("users").select("*").is("deleted_at", null);
}

// Emails are case-insensitive (citext column). Skips deleted users.
export async function findUserByEmail(email: string) {
  return must(await users().eq("email", email).maybeSingle<UserRow>());
}

// Whether another account already has this email. Includes deleted accounts:
// users.email is UNIQUE, so a deleted account's email can't be reused.
export async function emailInUse(email: string, exceptUserId?: string) {
  const row = must(await db().from("users").select("id").eq("email", email).maybeSingle<{ id: string }>());
  return row != null && row.id !== exceptUserId;
}

export async function createUser(profile: Profile, password: string) {
  const { name, email, phone, ...details } = profile;
  const now = new Date().toISOString();
  const row = must(
    await db()
      .from("users")
      .insert({
        email,
        name,
        phone,
        password_hash: await hashPassword(password),
        role: isConfiguredAdmin(email) ? "admin" : "user",
        details,
        created_at: now,
        last_login_at: now,
      })
      .select("id")
      .single<{ id: string }>(),
  );
  return row.id;
}

export async function updateUserProfile(userId: string, profile: Profile) {
  const { name, email, phone, ...details } = profile;
  must(
    await db()
      .from("users")
      .update({ name, email, phone, details: details satisfies DriverDetails })
      .eq("id", userId),
  );
}

export async function changePassword(userId: string, current: string, next: string) {
  const row = must(
    await db().from("users").select("password_hash").eq("id", userId).maybeSingle<{ password_hash: string }>(),
  );
  if (!row || !(await verifyPassword(current, row.password_hash))) return "Your current password isn't right.";
  const problem = passwordProblem(next);
  if (problem) return problem;
  must(await db().from("users").update({ password_hash: await hashPassword(next) }).eq("id", userId));
  // Sign out every other device.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  must(
    await db()
      .from("sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("revoked_at", null)
      .neq("token_hash", token ? hashToken(token) : ""),
  );
  return null;
}

// ---- Log in ----

const failedLogins = new Map<string, { count: number; lockedUntil: number }>();
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

export async function checkCredentials(email: string, password: string): Promise<{ userId: string } | { error: string }> {
  const key = email.toLowerCase();
  const attempts = failedLogins.get(key);
  if (attempts && attempts.lockedUntil > Date.now()) {
    return { error: `Too many attempts. Try again in ${LOCK_MINUTES} minutes.` };
  }

  const row = await findUserByEmail(email);
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  const valid = await verifyPassword(password, row?.password_hash ?? (await dummyHash));

  if (!row || !valid) {
    const count = (attempts?.count ?? 0) + 1;
    failedLogins.set(key, {
      count: count >= MAX_FAILED_LOGINS ? 0 : count,
      lockedUntil: count >= MAX_FAILED_LOGINS ? Date.now() + LOCK_MINUTES * 60_000 : 0,
    });
    return { error: "That email and password don't match an account." };
  }
  failedLogins.delete(key);
  if (row.status === "suspended") return { error: "This account has been suspended. Contact support." };

  const role = row.role === "admin" || isConfiguredAdmin(row.email) ? "admin" : "user";
  must(await db().from("users").update({ last_login_at: new Date().toISOString(), role }).eq("id", row.id));
  return { userId: row.id };
}

// ---- Sessions ----

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// The visitor's IP address, if the request carries a valid one (sessions.ip is inet).
function clientIp(requestHeaders: Headers) {
  const ip = (requestHeaders.get("x-forwarded-for")?.split(",")[0] ?? requestHeaders.get("x-real-ip") ?? "").trim();
  return isIP(ip) ? ip : null;
}

export async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86_400_000);
  const requestHeaders = await headers();
  must(
    await db().from("sessions").insert({
      token_hash: hashToken(token),
      user_id: userId,
      created_at: now.toISOString(),
      expires_at: expires.toISOString(),
      user_agent: requestHeaders.get("user-agent")?.slice(0, 500) ?? null,
      ip: clientIp(requestHeaders),
    }),
  );
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function endSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    must(
      await db()
        .from("sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("token_hash", hashToken(token))
        .is("revoked_at", null),
    );
  }
  cookieStore.delete(SESSION_COOKIE);
}

// The signed-in user for this request, or null. Cached per request.
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = must(
    await db()
      .from("sessions")
      .select("users!inner(*)")
      .eq("token_hash", hashToken(token))
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .eq("users.status", "active")
      .is("users.deleted_at", null)
      .maybeSingle<{ users: UserRow }>(),
  );
  return session ? toUser(session.users) : null;
});

export async function requireAdmin() {
  const user = await getCurrentUser();
  return user?.role === "admin" ? user : null;
}

// ---- Admin ----

// Every user, newest first, optionally matching name, email or phone.
// Leaves out deleted users and the demo listings' owner.
export async function listUsers(query = "") {
  const rows = must(
    await users().neq("id", DEMO_SELLER_ID).order("created_at", { ascending: false }),
  ) as UserRow[];
  const q = query.trim().toLowerCase();
  const matches = q ? rows.filter((row) => `${row.email} ${row.name} ${row.phone}`.toLowerCase().includes(q)) : rows;
  return matches.map(toUser);
}

export async function getUserById(userId: string) {
  const row = must(await users().eq("id", userId).maybeSingle<UserRow>());
  return row ? toUser(row) : null;
}

export async function activeSessionCount(userId: string) {
  return mustCount(
    await db()
      .from("sessions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString()),
  );
}

export async function signOutEverywhere(userId: string) {
  must(
    await db()
      .from("sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("revoked_at", null),
  );
}

// Sets a new password without the old one, and signs the user out everywhere.
export async function setPasswordAsAdmin(userId: string, password: string) {
  const problem = passwordProblem(password);
  if (problem) return problem;
  must(await db().from("users").update({ password_hash: await hashPassword(password) }).eq("id", userId));
  await signOutEverywhere(userId);
  return null;
}

export async function userStats() {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const count = () =>
    db().from("users").select("*", { count: "exact", head: true }).is("deleted_at", null).neq("id", DEMO_SELLER_ID);
  const [total, newThisWeek, activeThisWeek, suspended] = await Promise.all([
    count(),
    count().gt("created_at", weekAgo),
    count().gt("last_login_at", weekAgo),
    count().eq("status", "suspended"),
  ]);
  return {
    total: mustCount(total),
    newThisWeek: mustCount(newThisWeek),
    activeThisWeek: mustCount(activeThisWeek),
    suspended: mustCount(suspended),
  };
}

export async function setUserStatus(userId: string, status: Status) {
  must(await db().from("users").update({ status }).eq("id", userId));
  if (status === "suspended") await signOutEverywhere(userId);
}

export async function setUserRole(userId: string, role: Role) {
  must(await db().from("users").update({ role }).eq("id", userId));
}

// Soft delete: the account can't log in or be found, and their listings are
// soft-deleted too. Rows (and their conversations) are kept for records.
export async function deleteUser(userId: string) {
  const now = new Date().toISOString();
  must(await db().from("users").update({ deleted_at: now }).eq("id", userId).is("deleted_at", null));
  await signOutEverywhere(userId);
  must(
    await db()
      .from("listings")
      .update({ deleted_at: now, status: "removed" })
      .eq("seller_id", userId)
      .is("deleted_at", null),
  );
}
