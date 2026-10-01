import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { getQuotes } from "@/lib/ai-quotes";
import { MAX_QUERY_LENGTH, searchListings, type SearchHit } from "@/lib/ai-search";
import { getCurrentUser } from "@/lib/auth";
import { fixedRunningCosts } from "@/lib/costs";
import { driverDetails } from "@/lib/driver-profile";
import { getListings } from "@/lib/listings";
import { ListingCard, ListingGridSkeleton, listingGrid } from "../components/ListingCard";

export const metadata: Metadata = { title: "Search · TRUCOST" };

const EXAMPLES = [
  "A blue car for €15,000",
  "Cheap to run first car",
  "Family SUV with a big boot",
  "Something fun for weekends",
  "Anything in Dublin under €14k",
];

function SearchBox({ query }: { query: string }) {
  return (
    <form action="/search" role="search" className="flex gap-2">
      <input
        name="q"
        type="search"
        defaultValue={query}
        maxLength={MAX_QUERY_LENGTH}
        placeholder="Describe the car you want, e.g. “a blue car for €15,000”"
        aria-label="Describe the car you want"
        autoFocus={!query}
        className="min-w-0 flex-1 rounded-full border border-zinc-300 bg-white px-5 py-3 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-zinc-700 dark:bg-zinc-950"
      />
      <button className="rounded-full bg-zinc-900 px-6 py-3 font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200">
        Search
      </button>
    </form>
  );
}

async function Results({ query }: { query: string }) {
  const user = await getCurrentUser();
  const profile = user?.profile ?? null;
  const listings = await getListings();
  const quotes = profile ? await getQuotes(driverDetails(profile), listings) : null;
  const cars = listings.map((listing) => {
    const quote = quotes?.get(listing.id) ?? null;
    return {
      listing,
      quote,
      yearly: fixedRunningCosts(listing, profile?.annualKm).total + (quote?.premium ?? 0),
      includesInsurance: Boolean(quote),
    };
  });

  const requestHeaders = await headers();
  const visitor = user?.id ?? requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const result = await searchListings(query, cars, visitor);
  const byId = new Map(cars.map((car) => [car.listing.id, car]));

  const grid = (hits: SearchHit[]) => (
    <div className={listingGrid}>
      {hits.map((hit) => {
        const car = byId.get(hit.listingId)!;
        return (
          <div key={hit.listingId}>
            <ListingCard listing={car.listing} quote={car.quote} annualKm={profile?.annualKm} />
            <p className="mt-2 border-l-2 border-emerald-600 pl-2 text-sm text-zinc-600 dark:text-zinc-400">{hit.reason}</p>
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-lg font-medium">{result.summary}</p>
        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          {result.source === "ai" ? "AI search" : "Keyword search"}
        </span>
      </div>
      {result.matches.length > 0 && <div className="mt-6">{grid(result.matches)}</div>}
      {result.alternatives.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 font-semibold">{result.matches.length ? "Also worth a look" : "Closest matches"}</h2>
          {grid(result.alternatives)}
        </section>
      )}
      <p className="mt-12 text-sm text-zinc-500">
        {result.source === "ai" ? "AI can make mistakes, so check the listing before you buy. " : ""}
        Prefer exact filters?{" "}
        <Link href="/cars" className="underline">
          Browse all cars
        </Link>
        .
      </p>
    </>
  );
}

export default async function SearchPage(props: PageProps<"/search">) {
  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, MAX_QUERY_LENGTH) : "";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Find a car</h1>
        <p className="mt-1 mb-5 text-zinc-500">
          Say what you&apos;re after in your own words. We&apos;ll check every car for sale.
        </p>
        <SearchBox query={query} />
        {!query && (
          <div className="mt-4 flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <Link
                key={example}
                href={`/search?q=${encodeURIComponent(example)}`}
                className="rounded-full border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-100"
              >
                {example}
              </Link>
            ))}
          </div>
        )}
      </div>

      {query && (
        <Suspense
          key={query}
          fallback={
            <div className="mt-8">
              <p className="mb-6 animate-pulse text-lg font-medium text-zinc-500">Searching every listing…</p>
              <ListingGridSkeleton />
            </div>
          }
        >
          <Results query={query} />
        </Suspense>
      )}
    </div>
  );
}
