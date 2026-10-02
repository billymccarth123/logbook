import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listUsers, requireAdmin } from "@/lib/auth";
import { formatEuro, formatKm } from "@/lib/format";
import { getListings } from "@/lib/listings";
import { removeListing } from "../actions";
import { AdminTabs, ConfirmDelete, formatDate, searchInput, table, tableWrap, td, th, thead } from "../ui";

export const metadata: Metadata = { title: "Listings · Admin · TRUCOST" };

export default async function AdminListingsPage(props: PageProps<"/admin/listings">) {
  const admin = await requireAdmin();
  if (!admin) notFound();

  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q.trim().toLowerCase() : "";
  const sellers = new Map((await listUsers()).map((user) => [user.id, user]));
  const listings = (await getListings({ includeInactive: true }))
    .filter((listing) => {
      if (!query) return true;
      const seller = listing.sellerId ? sellers.get(listing.sellerId) : undefined;
      return `${listing.id} ${listing.year} ${listing.make} ${listing.model} ${listing.location} ${seller?.name ?? ""} ${seller?.email ?? ""}`
        .toLowerCase()
        .includes(query);
    })
    .reverse();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
      <div className="mt-6">
        <AdminTabs current="listings" />
      </div>

      <form className="mt-4">
        <input
          name="q"
          type="search"
          defaultValue={typeof q === "string" ? q : ""}
          placeholder="Search car, county or seller"
          className={searchInput}
          aria-label="Search listings"
        />
      </form>

      {listings.length ? (
        <div className={`mt-4 ${tableWrap}`}>
          <table className={table}>
            <thead className={thead}>
              <tr>
                <th className={th}>#</th>
                <th className={th}>Car</th>
                <th className={th}>Price</th>
                <th className={th}>Km</th>
                <th className={th}>Seller</th>
                <th className={th}>Listed</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {listings.map((listing) => {
                const seller = listing.sellerId ? sellers.get(listing.sellerId) : undefined;
                return (
                  <tr key={listing.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                    <td className={`${td} text-zinc-500 tabular-nums`}>{listing.id}</td>
                    <td className={`${td} whitespace-nowrap`}>
                      <Link href={`/cars/${listing.id}`} className="font-medium hover:underline">
                        {listing.year} {listing.make} {listing.model}
                      </Link>
                      <div className="text-xs text-zinc-500">{listing.location}</div>
                    </td>
                    <td className={`${td} tabular-nums`}>{formatEuro(listing.price)}</td>
                    <td className={`${td} whitespace-nowrap tabular-nums`}>{formatKm(listing.odometerKm)}</td>
                    <td className={td}>
                      {seller ? (
                        <Link href={`/admin/users/${seller.id}`} className="hover:underline">
                          {seller.name}
                          <div className="text-xs text-zinc-500">{seller.email}</div>
                        </Link>
                      ) : (
                        <span className="text-zinc-400">Demo listing</span>
                      )}
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{formatDate(listing.createdAt)}</td>
                    <td className={td}>
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/admin/listings/${listing.id}`}
                          className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                        >
                          Edit
                        </Link>
                        <ConfirmDelete
                          action={removeListing}
                          fields={{ listingId: listing.id, returnTo: "/admin/listings" }}
                          label="Delete"
                          message="Delete this listing? This can't be undone."
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-12 text-center text-zinc-500">{query ? "No listings match that search." : "No listings yet."}</p>
      )}
    </div>
  );
}
