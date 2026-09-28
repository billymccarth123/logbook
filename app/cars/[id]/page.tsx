import Link from "next/link";
import { notFound } from "next/navigation";
import { getQuote } from "@/lib/ai-quotes";
import { driverDetails } from "@/lib/driver-profile";
import { formatEngine, formatEuro, formatKm } from "@/lib/format";
import { getListing } from "@/lib/listings";
import { getProfile } from "@/lib/profile";
import { CarImage, PhotoCredit } from "../../components/CarImage";
import { CostBreakdown } from "../../components/CostBreakdown";

export async function generateMetadata(props: PageProps<"/cars/[id]">) {
  const { id } = await props.params;
  const listing = getListing(id);
  return {
    title: listing ? `${listing.year} ${listing.make} ${listing.model} · TRUCOST` : "Car not found · TRUCOST",
  };
}

export default async function ListingPage(props: PageProps<"/cars/[id]">) {
  const { id } = await props.params;
  const listing = getListing(id);
  if (!listing) notFound();

  const profile = await getProfile();
  const quote = profile ? await getQuote(driverDetails(profile), listing) : null;

  const specs = [
    ["Year", String(listing.year)],
    ["Engine", formatEngine(listing.engineSizeLitres)],
    ["Odometer", formatKm(listing.odometerKm)],
    ["Location", listing.location],
    [
      "Listed",
      new Date(listing.createdAt).toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" }),
    ],
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <Link href="/cars" className="text-sm text-zinc-500 hover:text-emerald-600">
        ← Back to all cars
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <div className="space-y-2">
            <CarImage id={listing.id} make={listing.make} model={listing.model} large />
            <PhotoCredit id={listing.id} />
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h1 className="text-3xl font-bold tracking-tight">
              {listing.year} {listing.make} {listing.model}
            </h1>
            <span className="text-3xl font-bold">{formatEuro(listing.price)}</span>
          </div>
          <dl className="grid grid-cols-2 gap-4 rounded-2xl border border-zinc-200 bg-white p-6 sm:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-900">
            {specs.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs tracking-wide text-zinc-500 uppercase">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          {listing.description && (
            <div>
              <h2 className="text-lg font-semibold">About this car</h2>
              <p className="mt-2 whitespace-pre-line text-zinc-700 dark:text-zinc-300">{listing.description}</p>
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <CostBreakdown
            engineSizeLitres={listing.engineSizeLitres}
            year={listing.year}
            quote={quote}
            initialKm={profile?.annualKm}
            signUpHref={`/signup?returnTo=/cars/${listing.id}`}
          />
        </aside>
      </div>
    </div>
  );
}
