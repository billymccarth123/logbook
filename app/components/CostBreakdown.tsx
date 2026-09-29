"use client";

import Link from "next/link";
import { useState } from "react";
import { DEFAULT_KM_PER_YEAR, engineBand, fixedRunningCosts, PETROL_PRICE_PER_LITRE } from "@/lib/costs";
import { formatEngine, formatEuro } from "@/lib/format";
import type { Quote } from "@/lib/ai-quotes";

type Props = {
  engineSizeLitres: number;
  year: number;
  // null: viewer hasn't signed up. undefined: insurance isn't shown (sell preview).
  quote?: Quote | null;
  initialKm?: number;
  signUpHref?: string;
};

export function CostBreakdown({ engineSizeLitres, year, quote, initialKm = DEFAULT_KM_PER_YEAR, signUpHref = "/signup" }: Props) {
  const [km, setKm] = useState(initialKm);
  const fixed = fixedRunningCosts({ engineSizeLitres, year }, km);
  const band = engineBand(engineSizeLitres);
  const carAge = new Date().getFullYear() - year;
  const total = fixed.total + (quote?.premium ?? 0);

  const rows = [
    {
      label: "Petrol",
      amount: fixed.petrol,
      detail: `${band.litresPer100Km} L/100 km for a ${formatEngine(engineSizeLitres)} engine at €${PETROL_PRICE_PER_LITRE.toFixed(2)}/L`,
    },
    {
      label: "NCT",
      amount: fixed.nct,
      detail:
        carAge < 4
          ? "Not due until the car is 4 years old"
          : carAge < 10
            ? "Tested every 2 years (€55 test)"
            : "Tested every year (€55 test)",
    },
  ];

  return (
    <section className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
      <h2 className="font-semibold">Yearly running costs</h2>

      <label className="mt-4 block text-sm text-zinc-600 dark:text-zinc-400">
        Kilometres per year:{" "}
        <strong className="text-zinc-900 dark:text-zinc-100">{km.toLocaleString("en-IE")}</strong>
        <input
          type="range"
          min={2000}
          max={50000}
          step={1000}
          value={km}
          onChange={(e) => setKm(Number(e.target.value))}
          className="mt-2 w-full accent-emerald-600"
        />
      </label>

      <dl className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-4 py-3">
            <div>
              <dt className="font-medium">{row.label}</dt>
              <dd className="text-xs text-zinc-500 dark:text-zinc-400">{row.detail}</dd>
            </div>
            <dd className="font-semibold tabular-nums">{formatEuro(row.amount)}</dd>
          </div>
        ))}

        {quote && (
          <div className="py-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <dt className="font-medium">Insurance</dt>
                <dd className="text-xs text-zinc-500 dark:text-zinc-400">
                  {quote.source === "ai" ? "Your AI-priced quote" : "Your estimated quote"}
                </dd>
              </div>
              <dd className="font-semibold tabular-nums">{formatEuro(quote.premium)}</dd>
            </div>
            <details className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
              <summary className="cursor-pointer text-emerald-700 dark:text-emerald-400">How we priced this</summary>
              {quote.notes.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {quote.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              )}
              <ul className="mt-2 space-y-1">
                {quote.factors.map((factor) => (
                  <li key={factor.label} className="flex justify-between gap-2">
                    <span>{factor.label}</span>
                    <span className={`tabular-nums ${factor.multiplier > 1 ? "text-red-600" : "text-emerald-600"}`}>
                      {factor.multiplier > 1 ? "+" : "−"}
                      {Math.round(Math.abs(factor.multiplier - 1) * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        )}

        {quote === null && (
          <div className="py-3">
            <div className="flex items-center justify-between gap-4">
              <dt className="font-medium">Insurance</dt>
              <dd className="rounded bg-zinc-100 px-2 py-0.5 text-sm text-zinc-400 blur-[3px] select-none dark:bg-zinc-800" aria-hidden>
                €888
              </dd>
            </div>
            <Link
              href={signUpHref}
              className="mt-3 block rounded-lg bg-emerald-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-emerald-700"
            >
              Sign up to see your insurance quote
            </Link>
          </div>
        )}

        <div className="flex items-center justify-between py-3">
          <dt className="text-lg font-bold">{quote === null ? "Petrol + NCT" : "Total per year"}</dt>
          <dd className="text-2xl font-bold text-emerald-600 tabular-nums">{formatEuro(total)}</dd>
        </div>
      </dl>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">About {formatEuro(total / 12)} a month.</p>

      {quote && (
        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
          Insurance is an estimate from your quote details, not a binding quote from an insurer. Driver averages
          from the{" "}
          <a
            href="https://www.chill.ie/blog/car-insurance-pricing-index/"
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            Chill Car Insurance Pricing Index
          </a>
          .
        </p>
      )}
      {quote === undefined && (
        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
          Each signed-up buyer also sees their own insurance quote for this car.
        </p>
      )}
    </section>
  );
}
