import Link from "next/link";
import { fixedRunningCosts } from "@/lib/costs";
import { formatEngine, formatEuro, formatKm } from "@/lib/format";
import type { Quote } from "@/lib/ai-quotes";
import type { Listing } from "@/lib/listings";
import { CarImage } from "./CarImage";

// quote is null when the viewer hasn't signed up.
export function ListingCard({ listing, quote, annualKm }: { listing: Listing; quote: Quote | null; annualKm?: number }) {
  const fixed = fixedRunningCosts(listing, annualKm);

  return (
    <Link
      href={`/cars/${listing.id}`}
      className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white transition hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
    >
      <CarImage id={listing.id} make={listing.make} model={listing.model} />
      <div className="space-y-3 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-semibold group-hover:text-emerald-600">
            {listing.year} {listing.make} {listing.model}
          </h3>
          <span className="text-lg font-bold">{formatEuro(listing.price)}</span>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {formatEngine(listing.engineSizeLitres)} · {formatKm(listing.odometerKm)} · {listing.location}
        </p>
        {quote ? (
          <div className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
            <div className="flex items-center justify-between">
              <span className="text-sm">Your running costs</span>
              <span className="font-semibold">{formatEuro(fixed.total + quote.premium)}/yr</span>
            </div>
            <div className="text-xs opacity-80">Includes your insurance quote of {formatEuro(quote.premium)}</div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-emerald-300 px-3 py-2 dark:border-emerald-800">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Petrol + NCT</span>
              <span className="font-semibold">{formatEuro(fixed.total)}/yr</span>
            </div>
            <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Sign up to see your insurance quote</div>
          </div>
        )}
      </div>
    </Link>
  );
}
