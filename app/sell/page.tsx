import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SellForm, type SellDefaults } from "./SellForm";

export const metadata: Metadata = { title: "Sell your car · TRUCOST" };

const PREFILL = ["make", "model", "year", "engine", "km", "county", "colour", "price"] as const;

// Accepts prefilled values from a valuation ("List it at €X").
export default async function SellPage(props: PageProps<"/sell">) {
  const searchParams = await props.searchParams;
  if (!(await getCurrentUser())) {
    const query = new URLSearchParams(
      Object.entries(searchParams).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    ).toString();
    redirect(`/login?returnTo=${encodeURIComponent(`/sell${query ? `?${query}` : ""}`)}`);
  }
  const defaults: SellDefaults = {};
  for (const key of PREFILL) {
    const value = searchParams[key];
    if (typeof value === "string") defaults[key] = value;
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">Sell your car</h1>
      <p className="mt-1 mb-6 text-zinc-600 dark:text-zinc-400">
        Buyers see the yearly running costs next to your price, including their own insurance quote. Cheap-to-run cars stand out.
        Not sure what to ask?{" "}
        <Link href="/value" className="text-emerald-600 underline">
          Get a free valuation
        </Link>
        .
      </p>
      <SellForm defaults={defaults} />
    </div>
  );
}
