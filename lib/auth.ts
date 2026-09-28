import "server-only";

import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { cache } from "react";
import { db, type Role, type Status, type UserRow } from "./db";
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
    const details = JSON.parse(row.details_json) as Record<string, unknown>;
    const values: Record<string, unknown> = { ...details, name: row.name, email: row.email, phone: row.phone };
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
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    profile,
  };
}

export function findUserByEmail(email: string) {
  const row = db().prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
  return row ?? null;
}

export async function createUser(profile: Profile, password: string) {
  const { name, email, phone, ...details } = profile;
  const id = randomUUID();
  const now = new Date().toISOString();
  db()
    .prepare(
      `INSERT INTO users (id, email, name, phone, password_hash, role, details_json, created_at, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, email, name, phone, await hashPassword(password), isConfiguredAdmin(email) ? "admin" : "user", JSON.stringify(details), now, now);
  return id;
}

export function updateUserProfile(userId: string, profile: Profile) {
  const { name, email, phone, ...details } = profile;
  db()
    .prepare("UPDATE users SET name = ?, email = ?, phone = ?, details_json = ? WHERE id = ?")
    .run(name, email, phone, JSON.stringify(details satisfies DriverDetails), userId);
}

export async function changePassword(userId: string, current: string, next: string) {
  const row = db().prepare("SELECT password_hash FROM users WHERE id = ?").get(userId) as { password_hash: string } | undefined;
  if (!row || !(await verifyPassword(current, row.password_hash))) return "Your current password isn't right.";
  const problem = passwordProblem(next);
  if (problem) return problem;
  db().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(await hashPassword(next), userId);
  // Sign out every other device.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  db()
    .prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?")
    .run(userId, token ? hashToken(token) : "");
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

  const row = findUserByEmail(email);
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
  db().prepare("UPDATE users SET last_login_at = ?, role = ? WHERE id = ?").run(new Date().toISOString(), role, row.id);
  return { userId: row.id };
}

// ---- Sessions ----

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86_400_000);
  db()
    .prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .run(hashToken(token), userId, now.toISOString(), expires.toISOString());
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
  if (token) db().prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
  cookieStore.delete(SESSION_COOKIE);
}

// The signed-in user for this request, or null. Cached per request.
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = db()
    .prepare(
      `SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ? AND sessions.expires_at > ? AND users.status = 'active'`,
    )
    .get(hashToken(token), new Date().toISOString()) as UserRow | undefined;
  return row ? toUser(row) : null;
});

export async function requireAdmin() {
  const user = await getCurrentUser();
  return user?.role === "admin" ? user : null;
}

// ---- Admin ----

export function listUsers(query = "") {
  const like = `%${query.trim()}%`;
  const rows = db()
    .prepare("SELECT * FROM users WHERE email LIKE ? OR name LIKE ? ORDER BY created_at DESC")
    .all(like, like) as UserRow[];
  return rows.map(toUser);
}

export function userStats() {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const count = (sql: string, ...params: string[]) =>
    (db().prepare(sql).get(...params) as { n: number }).n;
  return {
    total: count("SELECT COUNT(*) AS n FROM users"),
    newThisWeek: count("SELECT COUNT(*) AS n FROM users WHERE created_at > ?", weekAgo),
    activeThisWeek: count("SELECT COUNT(*) AS n FROM users WHERE last_login_at > ?", weekAgo),
    suspended: count("SELECT COUNT(*) AS n FROM users WHERE status = 'suspended'"),
  };
}

export function setUserStatus(userId: string, status: Status) {
  db().prepare("UPDATE users SET status = ? WHERE id = ?").run(status, userId);
  if (status === "suspended") db().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

export function setUserRole(userId: string, role: Role) {
  db().prepare("UPDATE users SET role = ? WHERE id = ?").run(role, userId);
}

export function deleteUser(userId: string) {
  db().prepare("DELETE FROM users WHERE id = ?").run(userId);
}
