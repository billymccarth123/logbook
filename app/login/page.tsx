import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Log in · TRUCOST" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { returnTo } = await props.searchParams;
  const target = typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/cars";
  if (await getCurrentUser()) redirect(target);

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Log in</h1>
      <p className="mt-2 mb-8 text-zinc-600 dark:text-zinc-400">
        New to TRUCOST?{" "}
        <Link href={`/signup?returnTo=${encodeURIComponent(target)}`} className="text-emerald-600 underline">
          Create an account
        </Link>
      </p>
      <LoginForm returnTo={target} />
    </div>
  );
}
