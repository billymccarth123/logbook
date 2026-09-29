"use client";

import { useActionState, type ReactNode } from "react";
import { signUp, updateQuoteDetails, type FormState } from "../actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-rules";
import { COUNTIES } from "@/lib/counties";
import {
  COVER,
  EXCESS,
  LICENCE_TYPES,
  NAMED_DRIVERS,
  OCCUPATIONS,
  PARKING,
  USAGE,
  type Profile,
} from "@/lib/driver-profile";
import { buttonClass, inputClass, labelClass } from "./form";

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <legend className="px-1 text-lg font-semibold">{title}</legend>
      {hint && <p className="-mt-2 text-sm text-zinc-500">{hint}</p>}
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Select({ name, label, options, defaultValue }: {
  name: string;
  label: string;
  options: Record<string, string>;
  defaultValue?: string;
}) {
  return (
    <label className={labelClass}>
      {label}
      <select name={name} required defaultValue={defaultValue ?? ""} className={inputClass}>
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

type FormAction = (state: FormState, formData: FormData) => Promise<FormState>;

// With a profile it edits the signed-in account; without one it creates an account.
// Admins pass their own action and the userId of the account they're editing.
type Props = { profile?: Profile; returnTo?: string; submitLabel: string; action?: FormAction; userId?: string };

export function QuoteForm({ profile, returnTo = "/cars", submitLabel, action: customAction, userId }: Props) {
  const creating = !profile && !customAction;
  const [state, action, pending] = useActionState<FormState, FormData>(
    customAction ?? (profile ? updateQuoteDetails : signUp),
    {},
  );
  const counties = Object.fromEntries(COUNTIES.map((county) => [county, county]));
  const excess = Object.fromEntries(EXCESS.map((amount) => [amount, `€${amount}`]));

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="returnTo" value={returnTo} />
      {userId && <input type="hidden" name="userId" value={userId} />}

      <Section title={creating ? "Your account" : "About you"}>
        <label className={labelClass}>
          Full name
          <input name="name" required autoComplete="name" defaultValue={profile?.name} className={inputClass} />
        </label>
        <label className={labelClass}>
          Email
          <input name="email" type="email" required autoComplete="email" defaultValue={profile?.email} className={inputClass} />
        </label>
        {creating && (
          <label className={labelClass}>
            Password
            <input
              name="password"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              className={inputClass}
            />
            <span className="mt-1 block text-xs font-normal text-zinc-500">At least {MIN_PASSWORD_LENGTH} characters.</span>
          </label>
        )}
        <label className={labelClass}>
          Phone (optional)
          <input name="phone" type="tel" autoComplete="tel" defaultValue={profile?.phone} className={inputClass} />
        </label>
        <label className={labelClass}>
          Date of birth
          <input name="dateOfBirth" type="date" required autoComplete="bday" defaultValue={profile?.dateOfBirth} className={inputClass} />
        </label>
        <Select name="county" label="County where the car is kept overnight" options={counties} defaultValue={profile?.county} />
        <Select name="occupation" label="Occupation" options={OCCUPATIONS} defaultValue={profile?.occupation} />
      </Section>

      <Section title="Your licence">
        <Select name="licenceType" label="Licence type" options={LICENCE_TYPES} defaultValue={profile?.licenceType} />
        <label className={labelClass}>
          Date you got it
          <input name="licenceDate" type="date" required defaultValue={profile?.licenceDate} className={inputClass} />
        </label>
        <label className={labelClass}>
          Penalty points currently on your licence
          <input
            name="penaltyPoints"
            type="number"
            required
            min={0}
            max={12}
            defaultValue={profile?.penaltyPoints ?? 0}
            className={inputClass}
          />
        </label>
      </Section>

      <Section title="Driving history" hint="Count claim-free years on a policy in your own name, not years driving.">
        <label className={labelClass}>
          Years of no claims bonus
          <input
            name="noClaimsYears"
            type="number"
            required
            min={0}
            max={30}
            defaultValue={profile?.noClaimsYears ?? 0}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Years as a named driver on someone else&apos;s policy
          <input
            name="namedDriverYears"
            type="number"
            required
            min={0}
            max={30}
            defaultValue={profile?.namedDriverYears ?? 0}
            className={inputClass}
          />
          <span className="mt-1 block text-xs font-normal text-zinc-500">For example on a parent&apos;s policy. 0 if none.</span>
        </label>
        <Select
          name="claimsLast3Years"
          label="Claims or accidents in the last 3 years"
          options={{ 0: "None", 1: "1", 2: "2 or more" }}
          defaultValue={profile ? String(profile.claimsLast3Years) : "0"}
        />
        <Select
          name="convictions"
          label="Motoring convictions or disqualifications (not spent)"
          options={{ no: "No", yes: "Yes" }}
          defaultValue={profile ? (profile.convictions ? "yes" : "no") : "no"}
        />
      </Section>

      <Section title="How you'll use the car">
        <label className={labelClass}>
          Kilometres per year
          <input
            name="annualKm"
            type="number"
            required
            min={1000}
            max={100000}
            step={1000}
            defaultValue={profile?.annualKm ?? 17000}
            className={inputClass}
          />
        </label>
        <Select name="usage" label="Use" options={USAGE} defaultValue={profile?.usage ?? "commuting"} />
        <Select name="parking" label="Parked overnight" options={PARKING} defaultValue={profile?.parking ?? "driveway"} />
        <Select name="namedDriver" label="Anyone else driving it" options={NAMED_DRIVERS} defaultValue={profile?.namedDriver ?? "none"} />
      </Section>

      <Section title="Cover">
        <Select name="cover" label="Level of cover" options={COVER} defaultValue={profile?.cover ?? "comprehensive"} />
        <Select name="excess" label="Excess" options={excess} defaultValue={String(profile?.excess ?? 300)} />
      </Section>

      <p className="text-xs text-zinc-500">
        These are the questions Irish insurers ask before a quote. We don&apos;t ask your sex: EU law has banned
        insurers from pricing by it since 2012. Contact details are never used to price your quote.
      </p>
      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
          {state.message}
        </p>
      )}
      <button disabled={pending} className={`${buttonClass} w-full`}>
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
