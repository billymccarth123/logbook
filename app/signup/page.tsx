import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { QuoteForm } from "../components/QuoteForm";

export const metadata: Metadata = { title: "Create an account · TRUCOST" };

export default async function SignUpPage(props: PageProps<"/signup">) {
  if (await getCurrentUser()) redirect("/profile");
  const { returnTo } = await props.searchParams;
  const target = typeof returnTo === "string" ? returnTo : undefined;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Create your TRUCOST account</h1>
      <p className="mt-2 mb-8 text-zinc-600 dark:text-zinc-400">
        Answer the same questions an insurer would ask, once. Every car on TRUCOST then shows an insurance quote
        worked out for you, plus petrol and NCT, so you see the true yearly cost before you buy. Already have an
        account?{" "}
        <Link href={`/login${target ? `?returnTo=${encodeURIComponent(target)}` : ""}`} className="text-emerald-600 underline">
          Log in
        </Link>
      </p>
      <QuoteForm returnTo={target} submitLabel="Create account and see my quotes" />
    </div>
  );
}
