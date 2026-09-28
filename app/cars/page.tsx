import type { Metadata } from "next";
import Link from "next/link";
import { getQuotes } from "@/lib/ai-quotes";
import { ENGINE_BANDS, engineBand, fixedRunningCosts } from "@/lib/costs";
import { driverDetails } from "@/lib/driver-profile";
import { getListings, getMakes } from "@/lib/listings";
import { getProfile } from "@/lib/profile";
import { ListingCard } from "../components/ListingCard";

export const metadata: Metadata = { title: "Browse cars · TRUCOST" };

const SORTS = {
  "cost-asc": "Lowest running costs",
  "price-asc": "Lowest price",
  "price-desc": "Highest price",
  newest: "Newest listings",
} as const;

type Sort = keyof typeof SORTS;

function param(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

const field =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

export default async function CarsPage(props: PageProps<"/cars">) {
  const searchParams = await props.searchParams;
  const make = param(searchParams.make);
  const maxPrice = Number(param(searchParams.maxPrice)) || 0;
  const minYear = Number(param(searchParams.minYear)) || 0;
  const engine = param(searchParams.engine);
  const maxYearly = Number(param(searchParams.maxYearly)) || 0;
  const sortParam = param(searchParams.sort);
  const sort: Sort = sortParam in SORTS ? (sortParam as Sort) : "cost-asc";

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
      if (make && listing.make !== make) return false;
      if (maxPrice && listing.price > maxPrice) return false;
      if (minYear && listing.year < minYear) return false;
      if (engine && engineBand(listing.engineSizeLitres).label !== engine) return false;
      if (maxYearly && yearly > maxYearly) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sort) {
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

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      {!profile && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-emerald-600 px-6 py-5 text-white">
          <div>
            <p className="text-lg font-semibold">See what insurance would cost you on every car</p>
            <p className="text-sm text-emerald-50">
              Sign up once with your driving details and we&apos;ll quote each car for you.
            </p>
          </div>
          <Link
            href="/signup?returnTo=/cars"
            className="rounded-full bg-white px-5 py-2.5 font-medium text-emerald-700 hover:bg-emerald-50"
          >
            Get my quotes
          </Link>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Browse cars</h1>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            {profile
              ? `Running costs include insurance quoted for you, ${profile.name.split(" ")[0]}.`
              : "Showing petrol and NCT. Sign up to add your insurance quote."}
          </p>
        </div>
        <p className="text-sm text-zinc-500">
          {results.length} {results.length === 1 ? "car" : "cars"}
        </p>
      </div>

      <form className="mt-6 grid grid-cols-2 gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:grid-cols-3 lg:grid-cols-6 dark:border-zinc-800 dark:bg-zinc-900">
        <select name="make" defaultValue={make} className={field} aria-label="Make">
          <option value="">Any make</option>
          {getMakes().map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <input
          name="maxPrice"
          type="number"
          min={0}
          step={500}
          placeholder="Max price €"
          defaultValue={maxPrice || ""}
          className={field}
          aria-label="Maximum price"
        />
        <input
          name="minYear"
          type="number"
          min={1950}
          placeholder="Min year"
          defaultValue={minYear || ""}
          className={field}
          aria-label="Minimum year"
        />
        <select name="engine" defaultValue={engine} className={field} aria-label="Engine size">
          <option value="">Any engine</option>
          {ENGINE_BANDS.map((band) => (
            <option key={band.label}>{band.label}</option>
          ))}
        </select>
        <input
          name="maxYearly"
          type="number"
          min={0}
          step={100}
          placeholder="Max running €/yr"
          defaultValue={maxYearly || ""}
          className={field}
          aria-label="Maximum running cost per year"
        />
        <select name="sort" defaultValue={sort} className={field} aria-label="Sort by">
          {Object.entries(SORTS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <div className="col-span-full flex gap-3">
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
            Apply filters
          </button>
          <Link
            href="/cars"
            className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Clear
          </Link>
        </div>
      </form>

      {results.length ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {results.map(({ listing, quote }) => (
            <ListingCard key={listing.id} listing={listing} quote={quote} annualKm={profile?.annualKm} />
          ))}
        </div>
      ) : (
        <p className="mt-12 text-center text-zinc-500">No cars match those filters.</p>
      )}
    </div>
  );
}
