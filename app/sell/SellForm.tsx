"use client";

import { useActionState, useState } from "react";
import { createListing, type FormState } from "../actions";
import { COUNTIES } from "@/lib/counties";
import { buttonClass, inputClass, labelClass } from "../components/form";
import { CostBreakdown } from "../components/CostBreakdown";

export type SellDefaults = Partial<Record<"make" | "model" | "year" | "engine" | "km" | "county" | "price", string>>;

export function SellForm({ defaults = {} }: { defaults?: SellDefaults }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createListing, {});
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(Number(defaults.year) || currentYear - 5);
  const [engine, setEngine] = useState(Number(defaults.engine) || 1.4);
  const previewReady = year >= 1950 && year <= currentYear + 1 && engine >= 0.6 && engine <= 8;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <form action={action} className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className={labelClass}>
            Make
            <input name="make" required placeholder="Toyota" defaultValue={defaults.make} className={inputClass} />
          </label>
          <label className={labelClass}>
            Model
            <input name="model" required placeholder="Corolla" defaultValue={defaults.model} className={inputClass} />
          </label>
          <label className={labelClass}>
            Year
            <input
              name="year"
              type="number"
              required
              min={1950}
              max={currentYear + 1}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Engine size (litres)
            <input
              name="engineSizeLitres"
              type="number"
              required
              min={0.6}
              max={8}
              step={0.1}
              value={engine}
              onChange={(e) => setEngine(Number(e.target.value))}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Price (€)
            <input name="price" type="number" required min={1} step={50} placeholder="12500" defaultValue={defaults.price} className={inputClass} />
          </label>
          <label className={labelClass}>
            Odometer (km)
            <input name="odometerKm" type="number" required min={0} step={1000} placeholder="95000" defaultValue={defaults.km} className={inputClass} />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            County
            <select name="location" required defaultValue={defaults.county ?? ""} className={inputClass}>
              <option value="" disabled>
                Choose a county
              </option>
              {COUNTIES.map((county) => (
                <option key={county}>{county}</option>
              ))}
            </select>
          </label>
        </div>
        <label className={labelClass}>
          Description
          <textarea
            name="description"
            rows={4}
            placeholder="Service history, extras, condition…"
            className={inputClass}
          />
        </label>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button disabled={pending} className={buttonClass}>
          {pending ? "Listing…" : "List my car"}
        </button>
      </form>

      <aside className="space-y-2 lg:sticky lg:top-6 lg:self-start">
        <p className="text-sm font-medium text-zinc-500">Preview: what buyers will see</p>
        {previewReady ? (
          <CostBreakdown engineSizeLitres={engine} year={year} />
        ) : (
          <p className="rounded-2xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700">
            Enter a valid year and engine size to preview running costs.
          </p>
        )}
      </aside>
    </div>
  );
}
