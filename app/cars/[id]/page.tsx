import Link from "next/link";
import { notFound } from "next/navigation";
import { getQuote } from "@/lib/ai-quotes";
import { driverDetails } from "@/lib/driver-profile";
import { formatEngine, formatEuro, formatKm } from "@/lib/format";
import { getListing } from "@/lib/listings";
import { getCurrentUser, getUserById } from "@/lib/auth";
import { findConversation } from "@/lib/messages";
import { getProfile } from "@/lib/profile";
import { CarImage, PhotoCredit } from "../../components/CarImage";
import { CostBreakdown } from "../../components/CostBreakdown";
import { MessageSeller } from "../../messages/MessageSeller";

export async function generateMetadata(props: PageProps<"/cars/[id]">) {
  const { id } = await props.params;
  const listing = await getListing(id);
  return {
    title: listing ? `${listing.year} ${listing.make} ${listing.model} · TRUCOST` : "Car not found · TRUCOST",
  };
}

export default async function ListingPage(props: PageProps<"/cars/[id]">) {
  const { id } = await props.params;
  const listing = await getListing(id);
  if (!listing) notFound();

  const profile = await getProfile();
  const quote = profile ? await getQuote(driverDetails(profile), listing) : null;
  const user = await getCurrentUser();
  const seller = listing.sellerId ? await getUserById(listing.sellerId) : null;
  const conversationId = user && seller && user.id !== seller.id ? await findConversation(listing.id, user.id) : null;
  const listed = new Date(listing.createdAt).toLocaleDateString("en-IE", { day: "numeric", month: "long" });

  const specs = [
    ["Year", String(listing.year)],
    ["Mileage", formatKm(listing.odometerKm)],
    ["Engine", formatEngine(listing.engineSizeLitres)],
    ["Colour", listing.colour],
    ["Location", listing.location],
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <nav className="flex gap-2 text-sm text-zinc-500">
        <Link href="/cars" className="hover:text-zinc-900 dark:hover:text-zinc-100">
          Cars
        </Link>
        <span>/</span>
        <Link
          href={`/cars?make=${encodeURIComponent(listing.make)}`}
          className="hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          {listing.make}
        </Link>
      </nav>

      <div className="mt-4 grid gap-x-10 gap-y-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-2">
          <CarImage id={listing.id} make={listing.make} model={listing.model} photoUrl={listing.photoUrl} large />
          <PhotoCredit id={listing.id} photoUrl={listing.photoUrl} />
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {listing.year} {listing.make} {listing.model}
            </h1>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{formatEuro(listing.price)}</p>
            <p className="mt-1 text-sm text-zinc-500">
              Listed {listed} in {listing.location}
            </p>
          </div>
          <Contact
            listingId={listing.id}
            seller={seller}
            viewerId={user?.id ?? null}
            conversationId={conversationId}
          />
          <CostBreakdown
            engineSizeLitres={listing.engineSizeLitres}
            year={listing.year}
            quote={quote}
            initialKm={profile?.annualKm}
            signUpHref={`/signup?returnTo=/cars/${listing.id}`}
          />
        </aside>

        <div className="space-y-8">
          <section>
            <h2 className="font-semibold">Details</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-8 sm:grid-cols-3">
              {specs.map(([label, value]) => (
                <div key={label} className="border-b border-zinc-100 py-3 dark:border-zinc-900">
                  <dt className="text-xs text-zinc-500">{label}</dt>
                  <dd className="mt-0.5 font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          {listing.description && (
            <section>
              <h2 className="font-semibold">Seller&apos;s description</h2>
              <p className="mt-3 whitespace-pre-line leading-relaxed text-zinc-700 dark:text-zinc-300">
                {listing.description}
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

const contactButton =
  "block w-full rounded-full bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-emerald-700";

function Contact({ listingId, seller, viewerId, conversationId }: {
  listingId: string;
  seller: { id: string; name: string; createdAt: string } | null;
  viewerId: string | null;
  conversationId: string | null;
}) {
  if (!seller) {
    return <p className="text-sm text-zinc-500">This is a demo listing, so there&apos;s no seller to message.</p>;
  }
  const sellerName = seller.name.split(" ")[0];
  const since = new Date(seller.createdAt).toLocaleDateString("en-IE", { month: "long", year: "numeric" });

  let action;
  if (seller.id === viewerId) {
    action = (
      <Link href="/messages" className={contactButton}>
        This is your listing · See your messages
      </Link>
    );
  } else if (!viewerId) {
    action = (
      <Link href={`/login?returnTo=${encodeURIComponent(`/cars/${listingId}`)}`} className={contactButton}>
        Log in to message {sellerName}
      </Link>
    );
  } else if (conversationId) {
    action = (
      <Link href={`/messages/${conversationId}`} className={contactButton}>
        Continue your chat with {sellerName}
      </Link>
    );
  } else {
    return (
      <div className="space-y-2">
        <p className="text-sm text-zinc-500">
          Sold by <span className="font-medium text-zinc-900 dark:text-zinc-100">{sellerName}</span> · on TRUCOST since {since}
        </p>
        <MessageSeller listingId={listingId} sellerName={sellerName} />
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-zinc-500">
        Sold by <span className="font-medium text-zinc-900 dark:text-zinc-100">{sellerName}</span> · on TRUCOST since {since}
      </p>
      {action}
    </div>
  );
}
