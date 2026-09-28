"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { COUNTIES } from "@/lib/counties";
import { formatEuro, formatKm } from "@/lib/format";
import { POPULAR_MAKES, POPULAR_MODEL_NAMES } from "@/lib/popular-models";
import { CONDITIONS, FUELS, SERVICE_HISTORY, TRANSMISSIONS, type Valuation } from "@/lib/valuation";
import { buttonClass, inputClass, labelClass } from "../components/form";
import { valueCarAction, type ValueState } from "./actions";

function Select({ name, label, options, defaultValue, onChange }: {
  name: string;
  label: string;
  options: Record<string, string>;
  defaultValue?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label className={labelClass}>
      {label}
      <select
        name={name}
        required
        defaultValue={defaultValue ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        className={inputClass}
      >
        <option value="" disabled>
          Choose…
        </option>
        {Object.entries(options).map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function Result({ valuation }: { valuation: Valuation }) {
  const { car, market } = valuation;
  const sellHref =
    `/sell?make=${encodeURIComponent(car.make)}&model=${encodeURIComponent(car.model)}` +
    `&year=${car.year}&engine=${car.engineSizeLitres}&km=${car.odometerKm}&county=${car.county}&price=${valuation.privateAsking}`;

  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-emerald-600 p-6 text-white">
        <p className="text-sm text-emerald-100">
          {car.year} {car.make} {car.model} · {formatKm(car.odometerKm)}
        </p>
        <p className="mt-2 text-sm">Suggested private asking price</p>
        <p className="text-5xl font-bold tracking-tight">{formatEuro(valuation.privateAsking)}</p>
        <p className="mt-2 text-emerald-50">
          Likely to sell for {formatEuro(valuation.range.low)}–{formatEuro(valuation.range.high)}
        </p>
        <Link
          href={sellHref}
          className="mt-4 inline-block rounded-full bg-white px-5 py-2.5 font-medium text-emerald-700 hover:bg-emerald-50"
        >
          List it at {formatEuro(valuation.privateAsking)}
        </Link>
      </div>

      <dl className="grid gap-4 sm:grid-cols-3">
        {[
          ["Private sale (after haggling)", valuation.privateSale],
          ["Dealer trade-in (rough)", valuation.tradeIn],
          [`Typical ${car.year} ${car.model}`, market.referenceValue],
        ].map(([label, amount]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <dt className="text-xs text-zinc-500">{label}</dt>
            <dd className="text-2xl font-bold">{formatEuro(amount as number)}</dd>
          </div>
        ))}
      </dl>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-semibold">How we got there</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          A typical {car.year} {car.make} {car.model} with {formatKm(market.typicalKm)} is advertised at about{" "}
          {formatEuro(market.referenceValue)} (range {formatEuro(market.low)}–{formatEuro(market.high)}). {market.notes}
        </p>
        {valuation.adjustments.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm">
            {valuation.adjustments.map((adjustment) => (
              <li key={adjustment.label} className="flex justify-between gap-4">
                <span>{adjustment.label}</span>
                <span className={adjustment.multiplier > 1 ? "text-emerald-600" : "text-red-600"}>
                  {adjustment.multiplier > 1 ? "+" : "−"}
                  {Math.round(Math.abs(adjustment.multiplier - 1) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-zinc-500">
          Confidence: <strong>{market.confidence}</strong> · Market checked{" "}
          {new Date(market.updatedAt).toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {market.comparables.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="font-semibold">Similar cars for sale</h2>
          <ul className="mt-3 divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
            {market.comparables.map((comparable) => (
              <li key={comparable.url} className="flex items-baseline justify-between gap-4 py-2">
                <a href={comparable.url} target="_blank" rel="noreferrer" className="hover:text-emerald-600 hover:underline">
                  {comparable.title}
                  <span className="text-zinc-500">
                    {" "}
                    · {comparable.year}
                    {comparable.odometerKm != null && ` · ${formatKm(comparable.odometerKm)}`} · {comparable.source}
                  </span>
                </a>
                <span className="font-semibold whitespace-nowrap">{formatEuro(comparable.askingPrice)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-zinc-500">
        An estimate from current asking prices, not a guaranteed offer. Condition, spec and history checks can move
        the real price either way.
      </p>
    </section>
  );
}

export function ValueForm() {
  const [state, action, pending] = useActionState<ValueState, FormData>(valueCarAction, {});
  const [fuel, setFuel] = useState("petrol");
  const currentYear = new Date().getFullYear();
  const counties = Object.fromEntries(COUNTIES.map((county) => [county, county]));

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      <form action={action} className="space-y-5 self-start rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <datalist id="makes">
          {POPULAR_MAKES.map((make) => (
            <option key={make} value={make} />
          ))}
        </datalist>
        <datalist id="models">
          {POPULAR_MODEL_NAMES.map((model) => (
            <option key={model} value={model} />
          ))}
        </datalist>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Make
            <input name="make" required list="makes" placeholder="Toyota" className={inputClass} />
          </label>
          <label className={labelClass}>
            Model
            <input name="model" required list="models" placeholder="Corolla" className={inputClass} />
          </label>
          <label className={labelClass}>
            Year
            <input name="year" type="number" required min={1980} max={currentYear} defaultValue={currentYear - 5} className={inputClass} />
          </label>
          <Select name="fuel" label="Fuel" options={FUELS} defaultValue="petrol" onChange={setFuel} />
          {fuel !== "electric" && (
            <label className={labelClass}>
              Engine size (litres)
              <input name="engineSizeLitres" type="number" required min={0.6} max={8} step={0.1} defaultValue={1.4} className={inputClass} />
            </label>
          )}
          <Select name="transmission" label="Gearbox" options={TRANSMISSIONS} defaultValue="manual" />
          <label className={labelClass}>
            Odometer (km)
            <input name="odometerKm" type="number" required min={0} step={1000} placeholder="85000" className={inputClass} />
          </label>
          <label className={labelClass}>
            Number of owners
            <input name="owners" type="number" required min={1} max={20} defaultValue={2} className={inputClass} />
          </label>
          <Select name="condition" label="Condition" options={CONDITIONS} defaultValue="good" />
          <Select name="serviceHistory" label="Service history" options={SERVICE_HISTORY} defaultValue="full" />
          <Select name="nctValid" label="Valid NCT" options={{ yes: "Yes", no: "No or expired" }} defaultValue="yes" />
          <Select name="county" label="County" options={counties} />
        </div>
        {state.error && (
          <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
            {state.error}
          </p>
        )}
        <button disabled={pending} className={`${buttonClass} w-full`}>
          {pending ? "Checking the market…" : "Get my valuation"}
        </button>
      </form>

      <div>
        {pending ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
            <p className="mt-6 font-semibold">Searching Irish listings for similar cars…</p>
            <p className="mt-1 text-sm text-zinc-500">
              The first valuation of a model and year takes up to a minute. After that it&apos;s instant.
            </p>
          </div>
        ) : state.valuation ? (
          <Result valuation={state.valuation} />
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-sm text-zinc-500 dark:border-zinc-700">
            <p className="font-medium text-zinc-700 dark:text-zinc-300">How it works</p>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              <li>We find what cars like yours are advertised for right now on Irish marketplaces.</li>
              <li>We adjust for your car&apos;s mileage, condition, history, owners and NCT.</li>
              <li>You get an asking price, a realistic selling range and a trade-in estimate, with the listings we used.</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
