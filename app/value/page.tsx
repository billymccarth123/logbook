import type { Metadata } from "next";
import Link from "next/link";
import { ValueForm } from "./ValueForm";

export const metadata: Metadata = { title: "Value my car · TRUCOST" };

// Market research can take up to a minute on a new model and year.
export const maxDuration = 120;

export default function ValuePage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">What&apos;s my car worth?</h1>
      <p className="mt-1 mb-6 text-zinc-600 dark:text-zinc-400">
        A free AI valuation based on what similar cars are advertised for in Ireland right now.{" "}
        <Link href="/values" className="text-emerald-600 underline">
          Browse market values
        </Link>
      </p>
      <ValueForm />
    </div>
  );
}
