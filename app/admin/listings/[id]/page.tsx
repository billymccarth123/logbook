import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUserById, requireAdmin } from "@/lib/auth";
import { getListing } from "@/lib/listings";
import { PHOTOS } from "@/lib/photos";
import { inputClass, labelClass } from "../../../components/form";
import { SellForm } from "../../../sell/SellForm";
import { removeListing, updateListingAsAdmin } from "../../actions";
import { ConfirmDelete, formatDate } from "../../ui";

export const metadata: Metadata = { title: "Edit listing · Admin · TRUCOST" };

export default async function AdminListingPage(props: PageProps<"/admin/listings/[id]">) {
  const admin = await requireAdmin();
  if (!admin) notFound();
  const { id } = await props.params;
  const listing = await getListing(id);
  if (!listing) notFound();
  const seller = listing.sellerId ? await getUserById(listing.sellerId) : null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <Link
        href={seller ? `/admin/users/${seller.id}` : "/admin/listings"}
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        ← {seller ? seller.name : "All listings"}
      </Link>

      <div className="mt-3 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Edit listing #{listing.id}: {listing.year} {listing.make} {listing.model}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Listed {formatDate(listing.createdAt)} ·{" "}
            <Link href={`/cars/${listing.id}`} className="underline">
              View live
            </Link>
          </p>
        </div>
        <ConfirmDelete
          action={removeListing}
          fields={{ listingId: listing.id, returnTo: seller ? `/admin/users/${seller.id}` : "/admin/listings" }}
          label="Delete listing"
          message="Delete this listing? This can't be undone."
        />
      </div>

      <SellForm
        action={updateListingAsAdmin}
        hidden={{ listingId: listing.id }}
        submitLabel="Save listing"
        photoRequired={false}
        currentPhotoUrl={listing.photoUrl ?? PHOTOS[listing.id]?.src}
        defaults={{
          make: listing.make,
          model: listing.model,
          year: String(listing.year),
          engine: String(listing.engineSizeLitres),
          km: String(listing.odometerKm),
          county: listing.location,
          colour: listing.colour,
          price: String(listing.price),
          description: listing.description,
        }}
      >
        <label className={labelClass}>
          Seller&apos;s email
          <input
            name="sellerEmail"
            type="email"
            defaultValue={seller?.email ?? ""}
            placeholder="Leave empty for no seller"
            className={inputClass}
          />
          <span className="mt-1 block text-xs font-normal text-zinc-500">
            Change it to move the listing to another account.
          </span>
        </label>
      </SellForm>
    </div>
  );
}
