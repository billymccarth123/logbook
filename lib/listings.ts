import "server-only";

import type { County } from "./costs";
import { isColour, type Colour } from "./colours";
import { isCounty } from "./counties";
import { db } from "./db";

export type Listing = {
  id: string;
  sellerId: string | null;
  make: string;
  model: string;
  year: number;
  engineSizeLitres: number;
  price: number;
  odometerKm: number;
  location: County;
  colour: Colour;
  description: string;
  createdAt: string;
  // The seller's uploaded photo, or null (demo listings use lib/photos.ts).
  photoUrl: string | null;
};

export type ListingInput = Omit<Listing, "id" | "sellerId" | "createdAt" | "photoUrl">;

export type ListingPhoto = { mime: string; data: Uint8Array };

type ListingRow = {
  id: number;
  seller_id: string | null;
  make: string;
  model: string;
  year: number;
  engine_size_litres: number;
  price: number;
  odometer_km: number;
  location: string;
  colour: string;
  description: string;
  created_at: string;
  photo_updated_at: string | null;
};

// Demo listings, added the first time the database is created.
const SEED: Omit<Listing, "sellerId" | "photoUrl">[] = [
  {
    id: "1",
    make: "Toyota",
    model: "Yaris",
    year: 2019,
    engineSizeLitres: 1.0,
    price: 13_950,
    odometerKm: 68_000,
    location: "Dublin",
    colour: "Blue",
    description: "One owner, full Toyota service history. Ideal first car, very cheap to run.",
    createdAt: "2026-09-20",
  },
  {
    id: "2",
    make: "Volkswagen",
    model: "Golf",
    year: 2017,
    engineSizeLitres: 1.4,
    price: 14_500,
    odometerKm: 112_000,
    location: "Cork",
    colour: "Grey",
    description: "TSI Highline, heated seats, new tyres and NCT until next year.",
    createdAt: "2026-09-18",
  },
  {
    id: "3",
    make: "Skoda",
    model: "Octavia",
    year: 2018,
    engineSizeLitres: 1.6,
    price: 13_750,
    odometerKm: 131_000,
    location: "Galway",
    colour: "White",
    description: "Huge boot, reliable family car. Cambelt done at 150k.",
    createdAt: "2026-09-22",
  },
  {
    id: "4",
    make: "Ford",
    model: "Fiesta",
    year: 2022,
    engineSizeLitres: 1.0,
    price: 17_450,
    odometerKm: 38_000,
    location: "Limerick",
    colour: "Black",
    description: "ST-Line EcoBoost, Bluetooth, two keys. Small scuff on rear bumper.",
    createdAt: "2026-09-15",
  },
  {
    id: "5",
    make: "Hyundai",
    model: "Tucson",
    year: 2021,
    engineSizeLitres: 1.6,
    price: 27_900,
    odometerKm: 54_000,
    location: "Kildare",
    colour: "Red",
    description: "Executive spec with panoramic roof and reversing camera. Balance of warranty.",
    createdAt: "2026-09-24",
  },
  {
    id: "6",
    make: "Nissan",
    model: "Qashqai",
    year: 2018,
    engineSizeLitres: 1.2,
    price: 16_450,
    odometerKm: 91_000,
    location: "Kilkenny",
    colour: "White",
    description: "SV model, sat nav, 360 camera. Serviced every year at main dealer.",
    createdAt: "2026-09-19",
  },
  {
    id: "7",
    make: "BMW",
    model: "3 Series",
    year: 2015,
    engineSizeLitres: 2.0,
    price: 13_250,
    odometerKm: 149_000,
    location: "Dublin",
    colour: "Red",
    description: "320i M Sport, leather interior, recently serviced.",
    createdAt: "2026-09-12",
  },
  {
    id: "8",
    make: "Mazda",
    model: "MX-5",
    year: 2012,
    engineSizeLitres: 1.8,
    price: 8_900,
    odometerKm: 121_000,
    location: "Wicklow",
    colour: "Red",
    description: "Roadster, new soft top, great summer car.",
    createdAt: "2026-09-10",
  },
  {
    id: "9",
    make: "Toyota",
    model: "Corolla",
    year: 2023,
    engineSizeLitres: 1.8,
    price: 27_950,
    odometerKm: 29_000,
    location: "Waterford",
    colour: "Black",
    description: "Luna trim, adaptive cruise, Apple CarPlay. Full history.",
    createdAt: "2026-09-25",
  },
  {
    id: "10",
    make: "Audi",
    model: "A6",
    year: 2013,
    engineSizeLitres: 3.0,
    price: 11_500,
    odometerKm: 187_000,
    location: "Louth",
    colour: "Silver",
    description: "Quattro, S line, very well kept. Timing chain replaced.",
    createdAt: "2026-09-08",
  },
  {
    id: "11",
    make: "Dacia",
    model: "Sandero",
    year: 2023,
    engineSizeLitres: 1.0,
    price: 15_750,
    odometerKm: 21_000,
    location: "Mayo",
    colour: "Silver",
    description: "Nearly new, Comfort trim, manufacturer warranty remaining.",
    createdAt: "2026-09-26",
  },
  {
    id: "12",
    make: "Ford",
    model: "Mustang",
    year: 2018,
    engineSizeLitres: 5.0,
    price: 39_000,
    odometerKm: 48_000,
    location: "Meath",
    colour: "Red",
    description: "GT V8 fastback, imported and registered. A weekend car with running costs to match.",
    createdAt: "2026-09-05",
  },
];

// Validates the sell form (also used by the admin listing editor).
export function parseListing(get: (key: string) => string): { error: string } | { listing: ListingInput } {
  const make = get("make");
  const model = get("model");
  const year = Number(get("year"));
  const engineSizeLitres = Number(get("engineSizeLitres"));
  const price = Number(get("price"));
  const odometerKm = Number(get("odometerKm"));
  const location = get("location");
  const colour = get("colour");
  const currentYear = new Date().getFullYear();

  if (!make || !model) return { error: "Enter the make and model." };
  if (!Number.isInteger(year) || year < 1950 || year > currentYear + 1) return { error: "Enter a valid year." };
  if (!(engineSizeLitres >= 0.6 && engineSizeLitres <= 8)) {
    return { error: "Engine size should be between 0.6L and 8.0L." };
  }
  if (!(price > 0)) return { error: "Enter a price." };
  if (!(odometerKm >= 0)) return { error: "Enter the odometer reading." };
  if (!isCounty(location)) return { error: "Choose the car's county." };
  if (!isColour(colour)) return { error: "Choose the car's colour." };

  return {
    listing: { make, model, year, engineSizeLitres, price, odometerKm, location, colour, description: get("description") },
  };
}

function toListing(row: ListingRow): Listing {
  return {
    id: String(row.id),
    sellerId: row.seller_id,
    make: row.make,
    model: row.model,
    year: row.year,
    engineSizeLitres: row.engine_size_litres,
    price: row.price,
    odometerKm: row.odometer_km,
    location: row.location as County,
    colour: isColour(row.colour) ? row.colour : "Other",
    description: row.description,
    createdAt: row.created_at,
    // The version in the URL lets browsers cache a photo until it's replaced.
    photoUrl: row.photo_updated_at ? `/listing-photos/${row.id}?v=${encodeURIComponent(row.photo_updated_at)}` : null,
  };
}

// ---- Photos ----

export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

// Checks the file's first bytes rather than trusting its name or type.
function photoType(bytes: Uint8Array) {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (ascii(0, 8) === "\x89PNG\r\n\x1a\n") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function parsePhoto(value: FormDataEntryValue | null): Promise<{ error: string } | { photo: ListingPhoto | null }> {
  if (!(value instanceof File) || value.size === 0) return { photo: null };
  if (value.size > MAX_PHOTO_BYTES) return { error: "That photo is too big. Use one under 4 MB." };
  const data = new Uint8Array(await value.arrayBuffer());
  const mime = photoType(data);
  if (!mime) return { error: "Use a JPEG, PNG or WebP photo." };
  return { photo: { mime, data } };
}

export function savePhoto(listingId: string, photo: ListingPhoto) {
  listings()
    .prepare(
      `INSERT INTO listing_photos (listing_id, mime, data, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (listing_id) DO UPDATE SET mime = excluded.mime, data = excluded.data, updated_at = excluded.updated_at`,
    )
    .run(listingId, photo.mime, photo.data, new Date().toISOString());
}

export function getPhoto(listingId: string) {
  const row = listings().prepare("SELECT mime, data FROM listing_photos WHERE listing_id = ?").get(listingId) as
    | ListingPhoto
    | undefined;
  return row ?? null;
}

let seeded = false;

// Data changes, run once each and recorded in PRAGMA user_version, so deleting
// every listing later doesn't bring the demos back.
function listings() {
  if (!seeded) {
    const { user_version } = db().prepare("PRAGMA user_version").get() as { user_version: number };
    if (user_version < 1) {
      // 1: add the demo listings.
      const insert = db().prepare(
        `INSERT OR IGNORE INTO listings (id, make, model, year, engine_size_litres, price, odometer_km, location, colour, description, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const l of SEED) {
        insert.run(Number(l.id), l.make, l.model, l.year, l.engineSizeLitres, l.price, l.odometerKm, l.location, l.colour, l.description, l.createdAt);
      }
    }
    if (user_version < 2) {
      // 2: colours for demo listings added before the colour column existed.
      const update = db().prepare("UPDATE listings SET colour = ? WHERE id = ? AND seller_id IS NULL AND colour = ''");
      for (const l of SEED) update.run(l.colour, Number(l.id));
      db().exec("PRAGMA user_version = 2");
    }
    seeded = true;
  }
  return db();
}

const SELECT = `SELECT listings.*, listing_photos.updated_at AS photo_updated_at
  FROM listings LEFT JOIN listing_photos ON listing_photos.listing_id = listings.id`;

export function getListings() {
  return (listings().prepare(`${SELECT} ORDER BY listings.id`).all() as ListingRow[]).map(toListing);
}

export function getListing(id: string) {
  const row = listings().prepare(`${SELECT} WHERE listings.id = ?`).get(id) as ListingRow | undefined;
  return row ? toListing(row) : undefined;
}

export function getListingsBySeller(sellerId: string) {
  return (
    listings()
      .prepare(`${SELECT} WHERE listings.seller_id = ? ORDER BY listings.created_at DESC, listings.id DESC`)
      .all(sellerId) as ListingRow[]
  ).map(toListing);
}

export function getMakes() {
  return (listings().prepare("SELECT DISTINCT make FROM listings ORDER BY make").all() as { make: string }[]).map((r) => r.make);
}

// Saves the listing and its photo together, so a listing never exists without one.
export function addListing(data: ListingInput, sellerId: string, photo: ListingPhoto) {
  const database = listings();
  database.exec("BEGIN");
  try {
    const id = insertListing(data, sellerId);
    savePhoto(id, photo);
    database.exec("COMMIT");
    return getListing(id)!;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function insertListing(data: ListingInput, sellerId: string) {
  const result = listings()
    .prepare(
      `INSERT INTO listings (seller_id, make, model, year, engine_size_litres, price, odometer_km, location, colour, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      sellerId,
      data.make,
      data.model,
      data.year,
      data.engineSizeLitres,
      data.price,
      data.odometerKm,
      data.location,
      data.colour,
      data.description,
      new Date().toISOString().slice(0, 10),
    );
  return String(result.lastInsertRowid);
}

export function updateListing(id: string, data: ListingInput) {
  listings()
    .prepare(
      `UPDATE listings SET make = ?, model = ?, year = ?, engine_size_litres = ?, price = ?, odometer_km = ?,
       location = ?, colour = ?, description = ? WHERE id = ?`,
    )
    .run(data.make, data.model, data.year, data.engineSizeLitres, data.price, data.odometerKm, data.location, data.colour, data.description, id);
}

// sellerId null makes it an unowned listing.
export function setListingSeller(id: string, sellerId: string | null) {
  listings().prepare("UPDATE listings SET seller_id = ? WHERE id = ?").run(sellerId, id);
}

export function deleteListing(id: string) {
  listings().prepare("DELETE FROM listings WHERE id = ?").run(id);
}

export function countListings() {
  return (listings().prepare("SELECT COUNT(*) AS n FROM listings").get() as { n: number }).n;
}

// Listing counts per seller, for the admin users table.
export function listingCountsBySeller() {
  const rows = listings()
    .prepare("SELECT seller_id, COUNT(*) AS n FROM listings WHERE seller_id IS NOT NULL GROUP BY seller_id")
    .all() as { seller_id: string; n: number }[];
  return new Map(rows.map((row) => [row.seller_id, row.n]));
}
