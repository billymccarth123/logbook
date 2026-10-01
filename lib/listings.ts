import "server-only";

import type { County } from "./costs";
import { isColour, type Colour } from "./colours";
import { isCounty } from "./counties";
import { db, must, mustCount } from "./db";

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
  listing_photos: { updated_at: string } | null;
};

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
    engineSizeLitres: Number(row.engine_size_litres),
    price: row.price,
    odometerKm: row.odometer_km,
    location: row.location as County,
    colour: isColour(row.colour) ? row.colour : "Other",
    description: row.description,
    createdAt: row.created_at,
    // The version in the URL lets browsers cache a photo until it's replaced.
    photoUrl: row.listing_photos
      ? `/listing-photos/${row.id}?v=${encodeURIComponent(row.listing_photos.updated_at)}`
      : null,
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

// Photos are stored base64-encoded in listing_photos.data.
export async function savePhoto(listingId: string, photo: ListingPhoto) {
  must(
    await db()
      .from("listing_photos")
      .upsert({
        listing_id: Number(listingId),
        mime: photo.mime,
        data: Buffer.from(photo.data).toString("base64"),
        updated_at: new Date().toISOString(),
      }),
  );
}

export async function getPhoto(listingId: string): Promise<ListingPhoto | null> {
  if (!/^\d+$/.test(listingId)) return null;
  const row = must(
    await db()
      .from("listing_photos")
      .select("mime, data")
      .eq("listing_id", listingId)
      .maybeSingle<{ mime: string; data: string }>(),
  );
  return row ? { mime: row.mime, data: new Uint8Array(Buffer.from(row.data, "base64")) } : null;
}

// Every listing column plus the photo's version, if it has one.
const SELECT = "*, listing_photos(updated_at)";

export async function getListings() {
  const rows = must(await db().from("listings").select(SELECT).order("id")) as ListingRow[];
  return rows.map(toListing);
}

export async function getListing(id: string) {
  if (!/^\d+$/.test(id)) return undefined;
  const row = must(await db().from("listings").select(SELECT).eq("id", id).maybeSingle<ListingRow>());
  return row ? toListing(row) : undefined;
}

export async function getListingsBySeller(sellerId: string) {
  const rows = must(
    await db()
      .from("listings")
      .select(SELECT)
      .eq("seller_id", sellerId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false }),
  ) as ListingRow[];
  return rows.map(toListing);
}

export async function getMakes() {
  const rows = must(await db().from("listings").select("make")) as { make: string }[];
  return [...new Set(rows.map((row) => row.make))].sort();
}

// Saves the listing and its photo together. If the photo can't be saved the
// listing is removed again, so a listing never exists without one.
export async function addListing(data: ListingInput, sellerId: string, photo: ListingPhoto) {
  const id = await insertListing(data, sellerId);
  try {
    await savePhoto(id, photo);
  } catch (error) {
    await deleteListing(id);
    throw error;
  }
  return (await getListing(id))!;
}

async function insertListing(data: ListingInput, sellerId: string) {
  const row = must(
    await db()
      .from("listings")
      .insert({ seller_id: sellerId, ...columns(data), created_at: new Date().toISOString().slice(0, 10) })
      .select("id")
      .single<{ id: number }>(),
  );
  return String(row.id);
}

function columns(data: ListingInput) {
  return {
    make: data.make,
    model: data.model,
    year: data.year,
    engine_size_litres: data.engineSizeLitres,
    price: data.price,
    odometer_km: data.odometerKm,
    location: data.location,
    colour: data.colour,
    description: data.description,
  };
}

export async function updateListing(id: string, data: ListingInput) {
  must(await db().from("listings").update(columns(data)).eq("id", id));
}

// sellerId null makes it an unowned listing.
export async function setListingSeller(id: string, sellerId: string | null) {
  must(await db().from("listings").update({ seller_id: sellerId }).eq("id", id));
}

export async function deleteListing(id: string) {
  if (!/^\d+$/.test(id)) return;
  must(await db().from("listings").delete().eq("id", id));
}

export async function countListings() {
  return mustCount(await db().from("listings").select("*", { count: "exact", head: true }));
}

// Listing counts per seller, for the admin users table.
export async function listingCountsBySeller() {
  const rows = must(await db().from("listings").select("seller_id").not("seller_id", "is", null)) as {
    seller_id: string;
  }[];
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.seller_id, (counts.get(row.seller_id) ?? 0) + 1);
  return counts;
}
