import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listUsers, requireAdmin, userStats } from "@/lib/auth";
import { ageFromDob } from "@/lib/driver-profile";
import { countListings, listingCountsBySeller } from "@/lib/listings";
import { makeAdmin, reactivateUser, removeAdmin, removeUser, suspendUser } from "./actions";
import { ActionButton, AdminTabs, Badge, ConfirmDelete, formatDate, searchInput, table, tableWrap, td, th, thead } from "./ui";

export const metadata: Metadata = { title: "Admin · TRUCOST" };

export default async function AdminPage(props: PageProps<"/admin">) {
  const admin = await requireAdmin();
  if (!admin) notFound();

  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q : "";
  const [users, stats, listingCounts, listingTotal] = await Promise.all([
    listUsers(query),
    userStats(),
    listingCountsBySeller(),
    countListings(),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <a
          href="/admin/users.csv"
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Download users CSV
        </a>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Users", stats.total],
          ["New this week", stats.newThisWeek],
          ["Active this week", stats.activeThisWeek],
          ["Suspended", stats.suspended],
          ["Listings", listingTotal],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <dt className="text-xs text-zinc-500">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8">
        <AdminTabs current="users" />
      </div>

      <form className="mt-4">
        <input
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Search by name, email or phone"
          className={searchInput}
          aria-label="Search users"
        />
      </form>

      {users.length ? (
        <div className={`mt-4 ${tableWrap}`}>
          <table className={table}>
            <thead className={thead}>
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Contact</th>
                <th className={th}>Age · County</th>
                <th className={th}>Listings</th>
                <th className={th}>Signed up</th>
                <th className={th}>Last login</th>
                <th className={th}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {users.map((user) => {
                const self = user.id === admin.id;
                const fields = { userId: user.id };
                return (
                  <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                    <td className={`${td} whitespace-nowrap`}>
                      <Link href={`/admin/users/${user.id}`} className="font-medium hover:underline">
                        {user.name}
                      </Link>
                      <span className="ml-2 inline-flex gap-1">
                        {user.role === "admin" && <Badge tone="emerald">admin</Badge>}
                        {user.status === "suspended" && <Badge tone="red">suspended</Badge>}
                      </span>
                    </td>
                    <td className={td}>
                      <div>{user.email}</div>
                      {user.phone && <div className="text-xs text-zinc-500">{user.phone}</div>}
                    </td>
                    <td className={`${td} whitespace-nowrap`}>
                      {user.profile ? `${ageFromDob(user.profile.dateOfBirth)} · ${user.profile.county}` : "—"}
                    </td>
                    <td className={`${td} tabular-nums`}>{listingCounts.get(user.id) ?? 0}</td>
                    <td className={`${td} whitespace-nowrap`}>{formatDate(user.createdAt)}</td>
                    <td className={`${td} whitespace-nowrap`}>{formatDate(user.lastLoginAt)}</td>
                    <td className={td}>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                        >
                          Manage
                        </Link>
                        {!self && (
                          <>
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
                            <ConfirmDelete
                              action={removeUser}
                              fields={fields}
                              label="Delete"
                              message={`Delete ${user.name}'s account and their listings? They'll be hidden and the account can't log in. The records are kept.`}
                            />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-12 text-center text-zinc-500">{query ? "No users match that search." : "No users yet."}</p>
      )}
    </div>
  );
}
