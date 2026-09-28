import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { logOut } from "../actions";
import { QuoteForm } from "../components/QuoteForm";
import { PasswordForm } from "./PasswordForm";

export const metadata: Metadata = { title: "Your account · TRUCOST" };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?returnTo=/profile");

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 px-4 py-12">
      <div>
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight">Your account</h1>
          <form action={logOut}>
            <button className="text-sm text-zinc-500 underline hover:text-zinc-800 dark:hover:text-zinc-200">Log out</button>
          </form>
        </div>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Change your quote details here and every quote is worked out again.
        </p>
      </div>
      {user.profile ? (
        <QuoteForm profile={user.profile} submitLabel="Save and update my quotes" />
      ) : (
        <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
          Your quote details couldn&apos;t be loaded. Please contact support.
        </p>
      )}
      <PasswordForm />
    </div>
  );
}
