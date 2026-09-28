import "server-only";

import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

// Accounts database: a single SQLite file using Node's built-in driver.
// Fine for one server; move to a hosted database (e.g. Postgres) before
// running more than one instance or deploying to serverless hosting.
const FILE = path.join(process.cwd(), "data", "trucost.db");

export type Role = "user" | "admin";
export type Status = "active" | "suspended";

export type UserRow = {
  id: string;
  email: string;
  name: string;
  phone: string;
  password_hash: string;
  role: Role;
  status: Status;
  details_json: string;
  created_at: string;
  last_login_at: string | null;
};

const globalForDb = globalThis as unknown as { trucostDb?: DatabaseSync };

function open() {
  mkdirSync(path.dirname(FILE), { recursive: true });
  const db = new DatabaseSync(FILE);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
      details_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
  `);
  return db;
}

// Reuse one connection across hot reloads in development.
export function db() {
  globalForDb.trucostDb ??= open();
  return globalForDb.trucostDb;
}
