import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listUsers, requireAdmin, userStats } from "@/lib/auth";
import { ageFromDob } from "@/lib/driver-profile";
import { makeAdmin, reactivateUser, removeAdmin, removeUser, suspendUser } from "./actions";

export const metadata: Metadata = { title: "Admin · TRUCOST" };

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" }) : "Never";
}

function ActionButton({ action, userId, label, danger = false }: {
  action: (formData: FormData) => Promise<void>;
  userId: string;
  label: string;
  danger?: boolean;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <button
        className={`rounded-md border px-2 py-1 text-xs ${danger ? "border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400" : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"}`}
      >
        {label}
      </button>
    </form>
  );
}

export default async function AdminPage(props: PageProps<"/admin">) {
  const admin = await requireAdmin();
  if (!admin) notFound();

  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q : "";
  const users = listUsers(query);
  const stats = userStats();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
        <a
          href="/admin/users.csv"
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-white dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Download CSV
        </a>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ["Total users", stats.total],
          ["New this week", stats.newThisWeek],
          ["Active this week", stats.activeThisWeek],
          ["Suspended", stats.suspended],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <dt className="text-xs text-zinc-500">{label}</dt>
            <dd className="text-2xl font-bold">{value}</dd>
          </div>
        ))}
      </dl>

      <form className="mt-6">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search by name or email"
          className="w-full max-w-sm rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          aria-label="Search users"
        />
      </form>

      {users.length ? (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs text-zinc-500 uppercase dark:border-zinc-800">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Age · County</th>
                <th className="px-4 py-3">Signed up</th>
                <th className="px-4 py-3">Last login</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {users.map((user) => {
                const self = user.id === admin.id;
                return (
                  <tr key={user.id} className={user.status === "suspended" ? "opacity-60" : undefined}>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      {user.name}
                      {user.role === "admin" && (
                        <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                          admin
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {user.profile ? `${ageFromDob(user.profile.dateOfBirth)} · ${user.profile.county}` : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(user.lastLoginAt)}</td>
                    <td className="px-4 py-3 capitalize">{user.status}</td>
                    <td className="px-4 py-3">
                      {self ? (
                        <span className="text-xs text-zinc-500">You</span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {user.status === "active" ? (
                            <ActionButton action={suspendUser} userId={user.id} label="Suspend" />
                          ) : (
                            <ActionButton action={reactivateUser} userId={user.id} label="Reactivate" />
                          )}
                          {user.role === "admin" ? (
                            <ActionButton action={removeAdmin} userId={user.id} label="Remove admin" />
                          ) : (
                            <ActionButton action={makeAdmin} userId={user.id} label="Make admin" />
                          )}
                          <details className="relative">
                            <summary className="cursor-pointer list-none rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 dark:border-red-800 dark:text-red-400">
                              Delete
                            </summary>
                            <div className="absolute right-0 z-10 mt-1 w-56 rounded-lg border border-zinc-200 bg-white p-3 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                              <p className="mb-2">Permanently delete {user.name}&apos;s account? This can&apos;t be undone.</p>
                              <ActionButton action={removeUser} userId={user.id} label="Yes, delete" danger />
                            </div>
                          </details>
                        </div>
                      )}
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
