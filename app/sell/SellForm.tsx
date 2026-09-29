"use client";

import { startTransition, useActionState, useState, type FormEvent, type ReactNode } from "react";
import { createListing, type FormState } from "../actions";
import { COLOURS } from "@/lib/colours";
import { COUNTIES } from "@/lib/counties";
import { buttonClass, inputClass, labelClass } from "../components/form";
import { CostBreakdown } from "../components/CostBreakdown";
import { PhotoPicker } from "./PhotoPicker";

export type SellDefaults = Partial<
  Record<"make" | "model" | "year" | "engine" | "km" | "county" | "colour" | "price" | "description", string>
>;

type Props = {
  defaults?: SellDefaults;
  // Admins edit listings with their own action, hidden fields and extra fields.
  action?: (state: FormState, formData: FormData) => Promise<FormState>;
  hidden?: Record<string, string>;
  submitLabel?: string;
  children?: ReactNode;
  // A photo is required to list a car; admins editing a listing can keep the current one.
  photoRequired?: boolean;
  currentPhotoUrl?: string | null;
};

export function SellForm({
  defaults = {},
  action: customAction,
  hidden = {},
  submitLabel = "List my car",
  children,
  photoRequired = true,
  currentPhotoUrl,
}: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(customAction ?? createListing, {});
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(Number(defaults.year) || currentYear - 5);
  const [engine, setEngine] = useState(Number(defaults.engine) || 1.4);
  const previewReady = year >= 1950 && year <= currentYear + 1 && engine >= 0.6 && engine <= 8;
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState("");

  // Submitted by hand (not the form's action) so the resized photo is sent, and
  // the form keeps what was typed if the server returns an error.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (photoRequired && !photo) {
      setPhotoError("Add a photo of your car before listing it.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    if (photo) formData.set("photo", photo);
    startTransition(() => action(formData));
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <PhotoPicker
          photo={photo}
          onChange={(file) => {
            setPhoto(file);
            setPhotoError("");
          }}
          currentPhotoUrl={currentPhotoUrl}
          required={photoRequired}
          error={photoError}
        />
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
            <input name="price" type="number" required min={1} placeholder="12500" defaultValue={defaults.price} className={inputClass} />
          </label>
          <label className={labelClass}>
            Odometer (km)
            <input name="odometerKm" type="number" required min={0} placeholder="95000" defaultValue={defaults.km} className={inputClass} />
          </label>
          <label className={labelClass}>
            Colour
            <select name="colour" required defaultValue={defaults.colour ?? ""} className={inputClass}>
              <option value="" disabled>
                Choose a colour
              </option>
              {COLOURS.map((colour) => (
                <option key={colour}>{colour}</option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
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
            defaultValue={defaults.description}
            className={inputClass}
          />
        </label>
        {children}
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.message && <p className="text-sm text-emerald-700 dark:text-emerald-400">{state.message}</p>}
        <button disabled={pending} className={buttonClass}>
          {pending ? (customAction ? "Saving…" : "Listing…") : submitLabel}
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
