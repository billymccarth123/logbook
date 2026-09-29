import Link from "next/link";
import { fixedRunningCosts } from "@/lib/costs";
import { formatEuro, formatKm } from "@/lib/format";
import type { Quote } from "@/lib/ai-quotes";
import type { Listing } from "@/lib/listings";
import { CarImage } from "./CarImage";

export const listingGrid = "grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4";

// quote is null when the viewer hasn't signed up.
export function ListingCard({ listing, quote, annualKm }: { listing: Listing; quote: Quote | null; annualKm?: number }) {
  const fixed = fixedRunningCosts(listing, annualKm);

  return (
    <Link href={`/cars/${listing.id}`} className="group block min-w-0">
      <CarImage id={listing.id} make={listing.make} model={listing.model} photoUrl={listing.photoUrl} />
      <div className="mt-3 space-y-0.5">
        <p className="text-lg font-semibold tabular-nums">{formatEuro(listing.price)}</p>
        <h3 className="truncate text-sm">
          {listing.year} {listing.make} {listing.model}
        </h3>
        <p className="truncate text-sm text-zinc-500">
          {formatKm(listing.odometerKm)} · {listing.location}
        </p>
        {quote ? (
          <p className="pt-1 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            {formatEuro(fixed.total + quote.premium)}/yr to run
            <span className="block text-xs font-normal text-zinc-500">
              incl. {formatEuro(quote.premium)} insurance for you
            </span>
          </p>
        ) : (
          <p className="pt-1 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            {formatEuro(fixed.total)}/yr petrol + NCT
            <span className="block text-xs font-normal text-zinc-500">Sign up to add your insurance quote</span>
          </p>
        )}
      </div>
    </Link>
  );
}

export function ListingGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={listingGrid} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-4/3 rounded-xl bg-zinc-100 dark:bg-zinc-900" />
          <div className="mt-3 h-5 w-20 rounded bg-zinc-100 dark:bg-zinc-900" />
          <div className="mt-2 h-4 w-32 rounded bg-zinc-100 dark:bg-zinc-900" />
        </div>
      ))}
    </div>
  );
}
