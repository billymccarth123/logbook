import Link from "next/link";
import { Suspense } from "react";
import { getQuotes } from "@/lib/ai-quotes";
import { fixedRunningCosts } from "@/lib/costs";
import { driverDetails } from "@/lib/driver-profile";
import { getListings, getMakes } from "@/lib/listings";
import { getProfile } from "@/lib/profile";
import { ListingCard, ListingGridSkeleton, listingGrid } from "./components/ListingCard";

const STEPS = [
  { title: "Petrol", body: "From the engine size and how far you drive in a year." },
  { title: "NCT", body: "From the car's age: none until year 4, every 2 years until 10, then yearly." },
  { title: "Insurance", body: "Answer an insurer's questions once and every car gets a quote priced for you." },
];

async function Rows() {
  const profile = await getProfile();
  const listings = await getListings();
  const quotes = profile ? await getQuotes(driverDetails(profile), listings) : null;
  const rows = listings.map((listing) => {
    const quote = quotes?.get(listing.id) ?? null;
    return { listing, quote, yearly: fixedRunningCosts(listing, profile?.annualKm).total + (quote?.premium ?? 0) };
  });

  const sections = [
    {
      title: profile ? "Cheapest for you to run" : "Cheapest to run",
      href: "/cars?sort=cost-asc",
      items: [...rows].sort((a, b) => a.yearly - b.yearly).slice(0, 4),
    },
    {
      title: "Just listed",
      href: "/cars?sort=newest",
      items: [...rows].sort((a, b) => b.listing.createdAt.localeCompare(a.listing.createdAt)).slice(0, 4),
    },
  ];

  return sections.map((section) => (
    <section key={section.title} className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
        <Link href={section.href} className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          See all
        </Link>
      </div>
      <div className={listingGrid}>
        {section.items.map(({ listing, quote }) => (
          <ListingCard key={listing.id} listing={listing} quote={quote} annualKm={profile?.annualKm} />
        ))}
      </div>
    </section>
  ));
}

export default async function Home() {
  const profile = await getProfile();

  return (
    <>
      <section className="mx-auto w-full max-w-7xl px-4 pt-12 pb-6 sm:pt-20">
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Cars for sale in Ireland, <span className="text-zinc-400 dark:text-zinc-500">with what they really cost to run.</span>
        </h1>

        <form action="/search" role="search" className="mt-8 flex max-w-xl gap-2">
          <input
            name="q"
            type="search"
            placeholder="Try “a blue car for €15,000”"
            aria-label="Describe the car you want"
            className="min-w-0 flex-1 rounded-full border border-zinc-300 bg-white px-5 py-3 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button className="rounded-full bg-zinc-900 px-6 py-3 font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200">
            Search
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {(await getMakes()).map((make) => (
            <Link
              key={make}
              href={`/cars?make=${encodeURIComponent(make)}`}
              className="rounded-full border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-100"
            >
              {make}
            </Link>
          ))}
        </div>

        {!profile && (
          <p className="mt-6 text-sm text-zinc-500">
            Every listing shows yearly petrol and NCT.{" "}
            <Link href="/signup" className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">
              Sign up to add your own insurance quote →
            </Link>
          </p>
        )}
      </section>

      <Suspense
        fallback={
          <div className="mx-auto w-full max-w-7xl px-4 py-8">
            <div className="mb-4 h-6 w-40 rounded bg-zinc-100 dark:bg-zinc-900" />
            <ListingGridSkeleton />
          </div>
        }
      >
        <Rows />
      </Suspense>

      <section className="mx-auto mt-8 w-full max-w-7xl border-t border-zinc-200 px-4 py-12 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-500">How running costs are worked out</h2>
        <div className="mt-6 grid gap-8 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title}>
              <p className="text-sm text-zinc-400 tabular-nums">0{i + 1}</p>
              <h3 className="mt-1 font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{step.body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
