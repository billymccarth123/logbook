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

const globalForDb = globalThis as unknown as { trucostDb?: DatabaseSync; trucostSchema?: string };

const SCHEMA = `
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

    -- seller_id is null for the demo listings. Deleting a user deletes their listings.
    CREATE TABLE IF NOT EXISTS listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      make TEXT NOT NULL,
      model TEXT NOT NULL,
      year INTEGER NOT NULL,
      engine_size_litres REAL NOT NULL,
      price INTEGER NOT NULL,
      odometer_km INTEGER NOT NULL,
      location TEXT NOT NULL,
      colour TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS listings_seller ON listings(seller_id);

    -- One photo per listing, uploaded by the seller. Deleted with the listing.
    CREATE TABLE IF NOT EXISTS listing_photos (
      listing_id INTEGER PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
      mime TEXT NOT NULL,
      data BLOB NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Buyer and seller chat, one conversation per listing and buyer. The read
    -- times mark how far each side has read. Deleted with the listing or either user.
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      buyer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      last_message_at TEXT NOT NULL,
      buyer_read_at TEXT NOT NULL,
      seller_read_at TEXT NOT NULL,
      UNIQUE (listing_id, buyer_id)
    );
    CREATE INDEX IF NOT EXISTS conversations_buyer ON conversations(buyer_id, last_message_at);
    CREATE INDEX IF NOT EXISTS conversations_seller ON conversations(seller_id, last_message_at);

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS messages_conversation ON messages(conversation_id, id);
`;

function open() {
  mkdirSync(path.dirname(FILE), { recursive: true });
  const db = new DatabaseSync(FILE);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  return db;
}

// CREATE TABLE IF NOT EXISTS doesn't touch existing tables, so columns added
// later are added here.
function addMissingColumns(db: DatabaseSync) {
  const columns = (db.prepare("PRAGMA table_info(listings)").all() as { name: string }[]).map((c) => c.name);
  if (!columns.includes("colour")) db.exec("ALTER TABLE listings ADD COLUMN colour TEXT NOT NULL DEFAULT ''");
}

// Reuse one connection across hot reloads in development. The schema is
// re-applied whenever it changes, so new tables appear without a restart.
export function db() {
  globalForDb.trucostDb ??= open();
  if (globalForDb.trucostSchema !== SCHEMA) {
    globalForDb.trucostDb.exec(SCHEMA);
    addMissingColumns(globalForDb.trucostDb);
    globalForDb.trucostSchema = SCHEMA;
  }
  return globalForDb.trucostDb;
}
