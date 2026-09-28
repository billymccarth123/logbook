"use client";

import { useActionState } from "react";
import { logIn, type FormState } from "../actions";
import { buttonClass, inputClass, labelClass } from "../components/form";

export function LoginForm({ returnTo }: { returnTo: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(logIn, {});

  return (
    <form action={action} className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <input type="hidden" name="returnTo" value={returnTo} />
      <label className={labelClass}>
        Email
        <input name="email" type="email" required autoComplete="email" className={inputClass} />
      </label>
      <label className={labelClass}>
        Password
        <input name="password" type="password" required autoComplete="current-password" className={inputClass} />
      </label>
      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {state.error}
        </p>
      )}
      <button disabled={pending} className={`${buttonClass} w-full`}>
        {pending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
