import Link from "next/link";
import { Suspense } from "react";
import { getQuotes } from "@/lib/ai-quotes";
import { fixedRunningCosts } from "@/lib/costs";
import { driverDetails } from "@/lib/driver-profile";
import { getListings } from "@/lib/listings";
import { getProfile } from "@/lib/profile";
import { ListingCard } from "./components/ListingCard";

const STEPS = [
  {
    title: "Petrol",
    body: "Worked out from the engine size and how far you drive in a year.",
  },
  {
    title: "NCT",
    body: "Based on the car's age: none until year 4, every 2 years until 10, then every year.",
  },
  {
    title: "Insurance",
    body: "Answer an insurer's questions once, and every car gets a quote priced for you.",
  },
];

async function Featured() {
  const profile = await getProfile();
  const listings = getListings();
  const quotes = profile ? await getQuotes(driverDetails(profile), listings) : null;
  const featured = listings
    .map((listing) => {
      const quote = quotes?.get(listing.id) ?? null;
      return { listing, quote, yearly: fixedRunningCosts(listing, profile?.annualKm).total + (quote?.premium ?? 0) };
    })
    .sort((a, b) => a.yearly - b.yearly)
    .slice(0, 3);

  return (
    <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {featured.map(({ listing, quote }) => (
        <ListingCard key={listing.id} listing={listing} quote={quote} annualKm={profile?.annualKm} />
      ))}
    </div>
  );
}

export default async function Home() {
  const profile = await getProfile();

  return (
    <>
      <section className="bg-linear-to-b from-emerald-50 to-transparent px-4 py-20 text-center dark:from-emerald-950/40">
        <h1 className="mx-auto max-w-3xl text-5xl font-bold tracking-tight sm:text-6xl">
          Know what a car really costs <span className="text-emerald-600">before</span> you buy it
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
          Every car on TRUCOST shows its yearly petrol, NCT and insurance costs, with an insurance quote priced for
          you.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={profile ? "/cars" : "/signup"}
            className="rounded-full bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-700"
          >
            {profile ? "Browse cars" : "Get my quotes"}
          </Link>
          <Link
            href={profile ? "/sell" : "/cars"}
            className="rounded-full border border-zinc-300 px-6 py-3 font-medium hover:bg-white dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            {profile ? "Sell your car" : "Just browse"}
          </Link>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-12 sm:grid-cols-3">
        {STEPS.map((step) => (
          <div
            key={step.title}
            className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <h2 className="text-lg font-semibold">{step.title}</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{step.body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-16">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl font-bold tracking-tight">
            {profile ? "Cheapest for you to run" : "Cheapest to run right now"}
          </h2>
          <Link href="/cars" className="text-sm text-emerald-600 hover:underline">
            See all →
          </Link>
        </div>
        <Suspense fallback={<p className="mt-6 text-sm text-zinc-500">Working out your quotes…</p>}>
          <Featured />
        </Suspense>
      </section>
    </>
  );
}
