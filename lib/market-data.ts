import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { canonicalMake, canonicalModel, MARKET_ENTRY_MAX_AGE_DAYS, marketKey, type MarketEntry } from "./valuation";

// The market database: one researched value per make, model, year and fuel.
// Stored as a JSON file so it grows across restarts. Replace with a real
// database before deploying (serverless hosts don't keep written files).
const FILE = path.join(process.cwd(), "data", "market-values.json");

let entries: Map<string, MarketEntry> | null = null;
let writeQueue = Promise.resolve();

async function load() {
  if (!entries) {
    try {
      const rows = JSON.parse(await readFile(FILE, "utf8")) as MarketEntry[];
      // Recompute keys so edited or hand-written rows always match lookups.
      entries = new Map(rows.map((row) => {
        const entry = { ...row, key: marketKey(row.make, row.model, row.year, row.fuel) };
        return [entry.key, entry];
      }));
    } catch {
      entries = new Map();
    }
  }
  return entries;
}

export async function getMarketEntry(key: string) {
  return (await load()).get(key) ?? null;
}

export function isFresh(entry: MarketEntry) {
  const ageDays = (Date.now() - new Date(entry.updatedAt).getTime()) / 86_400_000;
  return ageDays <= MARKET_ENTRY_MAX_AGE_DAYS;
}

export async function saveMarketEntry(entry: MarketEntry) {
  const map = await load();
  map.set(entry.key, entry);
  const rows = [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  writeQueue = writeQueue.then(async () => {
    await mkdir(path.dirname(FILE), { recursive: true });
    await writeFile(FILE, JSON.stringify(rows, null, 2));
  });
  await writeQueue;
}

export async function listMarketEntries() {
  return [...(await load()).values()].sort(
    (a, b) => a.make.localeCompare(b.make) || a.model.localeCompare(b.model) || b.year - a.year,
  );
}

export async function getModelEntries(make: string, model: string) {
  const makeKey = canonicalMake(make);
  const modelKey = canonicalModel(model);
  return [...(await load()).values()].filter(
    (entry) => canonicalMake(entry.make) === makeKey && canonicalModel(entry.model) === modelKey,
  );
}
