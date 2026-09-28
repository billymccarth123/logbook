import type { Metadata } from "next";
import Link from "next/link";
import { formatEuro, formatKm } from "@/lib/format";
import { listMarketEntries } from "@/lib/market-data";
import { FUELS } from "@/lib/valuation";

export const metadata: Metadata = { title: "Market values · TRUCOST" };

export default async function ValuesPage(props: PageProps<"/values">) {
  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q.trim().toLowerCase() : "";
  const entries = (await listMarketEntries()).filter(
    (entry) => !query || `${entry.make} ${entry.model} ${entry.year}`.toLowerCase().includes(query),
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Market values</h1>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            Typical Irish asking prices by model and year, at typical mileage and in good condition. Every valuation
            adds to this list.
          </p>
        </div>
        <Link href="/value" className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700">
          Value my car
        </Link>
      </div>

      <form className="mt-6">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search, e.g. Golf 2019"
          className="w-full max-w-sm rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          aria-label="Search market values"
        />
      </form>

      {entries.length ? (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs text-zinc-500 uppercase dark:border-zinc-800">
              <tr>
                <th className="px-4 py-3">Car</th>
                <th className="px-4 py-3">Fuel</th>
                <th className="px-4 py-3">Typical km</th>
                <th className="px-4 py-3 text-right">Typical price</th>
                <th className="px-4 py-3 text-right">Range</th>
                <th className="px-4 py-3">Evidence</th>
                <th className="px-4 py-3">Checked</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {entries.map((entry) => (
                <tr key={entry.key}>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">
                    {entry.year} {entry.make} {entry.model}
                  </td>
                  <td className="px-4 py-3">{FUELS[entry.fuel]}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatKm(entry.typicalKm)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatEuro(entry.referenceValue)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap text-zinc-500">
                    {formatEuro(entry.low)}–{formatEuro(entry.high)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {entry.comparables.length} listings · {entry.confidence}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-500">
                    {new Date(entry.updatedAt).toLocaleDateString("en-IE", { day: "numeric", month: "short" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-12 text-center text-zinc-500">
          {query ? "No market values match that search yet." : "No market values yet."}{" "}
          <Link href="/value" className="text-emerald-600 underline">
            Value a car
          </Link>{" "}
          to add the first.
        </p>
      )}
    </div>
  );
}
