import type { Metadata } from "next";
import Link from "next/link";
import { getQuotes } from "@/lib/ai-quotes";
import { COLOURS } from "@/lib/colours";
import { ENGINE_BANDS, engineBand, fixedRunningCosts } from "@/lib/costs";
import { driverDetails } from "@/lib/driver-profile";
import { formatEuro } from "@/lib/format";
import { getListings, getMakes } from "@/lib/listings";
import { getProfile } from "@/lib/profile";
import { ListingCard, listingGrid } from "../components/ListingCard";

export const metadata: Metadata = { title: "Browse cars · TRUCOST" };

const SORTS = {
  "cost-asc": "Cheapest to run",
  "price-asc": "Lowest price",
  "price-desc": "Highest price",
  newest: "Newest",
} as const;

type Sort = keyof typeof SORTS;

type Filters = {
  q: string;
  make: string;
  colour: string;
  maxPrice: number;
  minYear: number;
  engine: string;
  maxYearly: number;
  sort: Sort;
};

function param(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

// Builds a /cars link from the current filters, with some changed or removed.
function carsHref(filters: Filters, changes: Record<string, string | number>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, ...changes })) {
    if (value && !(key === "sort" && value === "cost-asc")) params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `/cars?${query}` : "/cars";
}

function matchesSearch(text: string, q: string) {
  const haystack = text.toLowerCase().replace(/-/g, " ");
  return q
    .toLowerCase()
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

const field =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-zinc-700 dark:bg-zinc-950";
const label = "block text-xs font-medium text-zinc-500";

function FilterForm({ filters }: { filters: Filters }) {
  return (
    <form action="/cars" className="space-y-4">
      <input type="hidden" name="sort" value={filters.sort} />
      <label className={label}>
        Search
        <input name="q" type="search" defaultValue={filters.q} placeholder="Make, model, county" className={field} />
      </label>
      <label className={label}>
        Make
        <select name="make" defaultValue={filters.make} className={field}>
          <option value="">Any</option>
          {getMakes().map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>
      <label className={label}>
        Colour
        <select name="colour" defaultValue={filters.colour} className={field}>
          <option value="">Any</option>
          {COLOURS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className={label}>
        Max price (€)
        <input
          name="maxPrice"
          type="number"
          min={0}
          step={500}
          placeholder="Any"
          defaultValue={filters.maxPrice || ""}
          className={field}
        />
      </label>
      <label className={label}>
        Min year
        <input
          name="minYear"
          type="number"
          min={1950}
          placeholder="Any"
          defaultValue={filters.minYear || ""}
          className={field}
        />
      </label>
      <label className={label}>
        Engine
        <select name="engine" defaultValue={filters.engine} className={field}>
          <option value="">Any</option>
          {ENGINE_BANDS.map((band) => (
            <option key={band.label}>{band.label}</option>
          ))}
        </select>
      </label>
      <label className={label}>
        Max running cost (€/yr)
        <input
          name="maxYearly"
          type="number"
          min={0}
          step={100}
          placeholder="Any"
          defaultValue={filters.maxYearly || ""}
          className={field}
        />
      </label>
      <button className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200">
        Show results
      </button>
    </form>
  );
}

export default async function CarsPage(props: PageProps<"/cars">) {
  const searchParams = await props.searchParams;
  const sortParam = param(searchParams.sort);
  const filters: Filters = {
    q: param(searchParams.q),
    make: param(searchParams.make),
    colour: param(searchParams.colour),
    maxPrice: Number(param(searchParams.maxPrice)) || 0,
    minYear: Number(param(searchParams.minYear)) || 0,
    engine: param(searchParams.engine),
    maxYearly: Number(param(searchParams.maxYearly)) || 0,
    sort: sortParam in SORTS ? (sortParam as Sort) : "cost-asc",
  };

  const profile = await getProfile();
  const listings = getListings();
  const quotes = profile ? await getQuotes(driverDetails(profile), listings) : null;

  const results = listings
    .map((listing) => {
      const quote = quotes?.get(listing.id) ?? null;
      const yearly = fixedRunningCosts(listing, profile?.annualKm).total + (quote?.premium ?? 0);
      return { listing, quote, yearly };
    })
    .filter(({ listing, yearly }) => {
      const { q, make, colour, maxPrice, minYear, engine, maxYearly } = filters;
      const text = `${listing.year} ${listing.make} ${listing.model} ${listing.colour} ${listing.location} ${listing.description}`;
      if (q && !matchesSearch(text, q)) return false;
      if (make && listing.make !== make) return false;
      if (colour && listing.colour !== colour) return false;
      if (maxPrice && listing.price > maxPrice) return false;
      if (minYear && listing.year < minYear) return false;
      if (engine && engineBand(listing.engineSizeLitres).label !== engine) return false;
      if (maxYearly && yearly > maxYearly) return false;
      return true;
    })
    .sort((a, b) => {
      switch (filters.sort) {
        case "price-asc":
          return a.listing.price - b.listing.price;
        case "price-desc":
          return b.listing.price - a.listing.price;
        case "newest":
          return b.listing.createdAt.localeCompare(a.listing.createdAt);
        default:
          return a.yearly - b.yearly;
      }
    });

  const active = [
    filters.q && { key: "q", label: `“${filters.q}”` },
    filters.make && { key: "make", label: filters.make },
    filters.colour && { key: "colour", label: filters.colour },
    filters.maxPrice && { key: "maxPrice", label: `Up to ${formatEuro(filters.maxPrice)}` },
    filters.minYear && { key: "minYear", label: `${filters.minYear} or newer` },
    filters.engine && { key: "engine", label: filters.engine },
    filters.maxYearly && { key: "maxYearly", label: `Under ${formatEuro(filters.maxYearly)}/yr to run` },
  ].filter((chip): chip is { key: keyof Filters; label: string } => Boolean(chip));

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {filters.make || "Cars for sale"}
          <span className="ml-2 text-base font-normal text-zinc-500">{results.length}</span>
        </h1>
        {!profile && (
          <p className="text-sm text-zinc-500">
            Showing petrol and NCT.{" "}
            <Link href="/signup?returnTo=/cars" className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">
              Add your insurance quote →
            </Link>
          </p>
        )}
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <FilterForm filters={filters} />
          </div>
        </aside>

        <div className="min-w-0">
          <details className="mb-4 rounded-xl border border-zinc-200 lg:hidden dark:border-zinc-800">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
              Filters{active.length > 0 && ` (${active.length})`}
            </summary>
            <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
              <FilterForm filters={filters} />
            </div>
          </details>

          <div className="flex flex-wrap items-center gap-2">
            {Object.entries(SORTS).map(([value, name]) => (
              <Link
                key={value}
                href={carsHref(filters, { sort: value })}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  filters.sort === value
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                {name}
              </Link>
            ))}
          </div>

          {active.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {active.map((chip) => (
                <Link
                  key={chip.key}
                  href={carsHref(filters, { [chip.key]: "" })}
                  className="rounded-full border border-zinc-300 px-3 py-1 text-sm hover:border-zinc-500 dark:border-zinc-700"
                  aria-label={`Remove filter ${chip.label}`}
                >
                  {chip.label} <span className="text-zinc-400">×</span>
                </Link>
              ))}
              <Link href="/cars" className="px-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                Clear all
              </Link>
            </div>
          )}

          {results.length ? (
            <div className={`mt-6 ${listingGrid} lg:grid-cols-3 xl:grid-cols-4`}>
              {results.map(({ listing, quote }) => (
                <ListingCard key={listing.id} listing={listing} quote={quote} annualKm={profile?.annualKm} />
              ))}
            </div>
          ) : (
            <div className="mt-16 text-center">
              <p className="font-medium">No cars match those filters</p>
              <Link href="/cars" className="mt-2 inline-block text-sm text-zinc-500 underline">
                Clear filters
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
