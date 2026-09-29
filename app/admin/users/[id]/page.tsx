import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { activeSessionCount, getUserById, requireAdmin } from "@/lib/auth";
import { ageFromDob, COVER, LICENCE_TYPES, OCCUPATIONS } from "@/lib/driver-profile";
import { formatEuro, formatKm } from "@/lib/format";
import { getListingsBySeller } from "@/lib/listings";
import { QuoteForm } from "../../../components/QuoteForm";
import {
  makeAdmin,
  reactivateUser,
  removeAdmin,
  removeListing,
  removeUser,
  signOutUser,
  suspendUser,
  updateUserDetails,
} from "../../actions";
import { ActionButton, Badge, ConfirmDelete, formatDate, table, tableWrap, td, th, thead } from "../../ui";
import { SetPasswordForm } from "./SetPasswordForm";

export const metadata: Metadata = { title: "Manage user · Admin · TRUCOST" };

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function AdminUserPage(props: PageProps<"/admin/users/[id]">) {
  const admin = await requireAdmin();
  if (!admin) notFound();
  const { id } = await props.params;
  const user = getUserById(id);
  if (!user) notFound();

  const self = user.id === admin.id;
  const listings = getListingsBySeller(user.id);
  const p = user.profile;
  const fields = { userId: user.id };
  const here = `/admin/users/${user.id}`;

  const info: [string, ReactNode][] = [
    ["Email", <a key="email" href={`mailto:${user.email}`} className="hover:underline">{user.email}</a>],
    ["Phone", user.phone ? <a key="phone" href={`tel:${user.phone}`} className="hover:underline">{user.phone}</a> : "—"],
    ["Date of birth", p ? `${formatDate(p.dateOfBirth)} (age ${ageFromDob(p.dateOfBirth)})` : "—"],
    ["County", p?.county ?? "—"],
    ["Occupation", p ? OCCUPATIONS[p.occupation] : "—"],
    ["Licence", p ? `${LICENCE_TYPES[p.licenceType]}, since ${formatDate(p.licenceDate)}` : "—"],
    ["No claims · Points", p ? `${p.noClaimsYears} years · ${p.penaltyPoints} points` : "—"],
    ["Cover", p ? `${COVER[p.cover]}, €${p.excess} excess` : "—"],
    ["Signed up", formatDate(user.createdAt, true)],
    ["Last login", formatDate(user.lastLoginAt, true)],
    ["Signed in on", `${activeSessionCount(user.id)} device(s)`],
    ["User ID", <code key="id" className="text-xs">{user.id}</code>],
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
        ← All users
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{user.name}</h1>
        {user.role === "admin" && <Badge tone="emerald">admin</Badge>}
        <Badge tone={user.status === "suspended" ? "red" : "zinc"}>{user.status}</Badge>
        {self && <Badge>you</Badge>}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Panel title="Personal info">
            <dl className="grid gap-x-8 sm:grid-cols-2">
              {info.map(([label, value]) => (
                <div key={label} className="border-b border-zinc-100 py-2.5 dark:border-zinc-900">
                  <dt className="text-xs text-zinc-500">{label}</dt>
                  <dd className="mt-0.5 text-sm break-words">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title={`Listings (${listings.length})`}>
            {listings.length ? (
              <div className={tableWrap}>
                <table className={table}>
                  <thead className={thead}>
                    <tr>
                      <th className={th}>Car</th>
                      <th className={th}>Price</th>
                      <th className={th}>Km</th>
                      <th className={th}>Listed</th>
                      <th className={th} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {listings.map((listing) => (
                      <tr key={listing.id}>
                        <td className={`${td} whitespace-nowrap`}>
                          <Link href={`/cars/${listing.id}`} className="font-medium hover:underline">
                            {listing.year} {listing.make} {listing.model}
                          </Link>
                          <div className="text-xs text-zinc-500">{listing.location}</div>
                        </td>
                        <td className={`${td} tabular-nums`}>{formatEuro(listing.price)}</td>
                        <td className={`${td} whitespace-nowrap tabular-nums`}>{formatKm(listing.odometerKm)}</td>
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
                              fields={{ listingId: listing.id, returnTo: here }}
                              label="Delete"
                              message="Delete this listing? This can't be undone."
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No listings.</p>
            )}
          </Panel>

          <section>
            <h2 className="mb-1 font-semibold">Edit details</h2>
            <p className="mb-4 text-sm text-zinc-500">
              Every field on their account. Saving re-prices their insurance quotes.
            </p>
            {!p && (
              <p className="mb-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                Their saved quote details couldn&apos;t be read. Fill in the form to repair them.
              </p>
            )}
            <QuoteForm
              key={user.email + user.name}
              profile={p ?? undefined}
              action={updateUserDetails}
              userId={user.id}
              submitLabel="Save details"
            />
          </section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          {self ? (
            <Panel title="Your account">
              <p className="text-sm text-zinc-500">
                You can edit your own details here, but can&apos;t suspend, demote or delete yourself. Change your
                password on{" "}
                <Link href="/profile" className="underline">
                  your profile
                </Link>
                .
              </p>
            </Panel>
          ) : (
            <>
              <Panel title="Account">
                <div className="flex flex-wrap gap-2">
                  {user.status === "active" ? (
                    <ActionButton action={suspendUser} fields={fields} label="Suspend" />
                  ) : (
                    <ActionButton action={reactivateUser} fields={fields} label="Reactivate" />
                  )}
                  {user.role === "admin" ? (
                    <ActionButton action={removeAdmin} fields={fields} label="Remove admin" />
                  ) : (
                    <ActionButton action={makeAdmin} fields={fields} label="Make admin" />
                  )}
                  <ActionButton action={signOutUser} fields={fields} label="Sign out everywhere" />
                  <ConfirmDelete
                    action={removeUser}
                    fields={fields}
                    label="Delete account"
                    message={`Permanently delete ${user.name}'s account and their ${listings.length} listing(s)? This can't be undone.`}
                  />
                </div>
                <p className="mt-3 text-xs text-zinc-500">Suspending signs them out and blocks logging in.</p>
              </Panel>
              <Panel title="Password">
                <SetPasswordForm userId={user.id} />
              </Panel>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
