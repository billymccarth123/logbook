"use client";

import { useActionState } from "react";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-rules";
import { changePasswordAction, type FormState } from "../actions";
import { buttonClass, inputClass, labelClass } from "../components/form";

export function PasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changePasswordAction, {});

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold">Change password</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Current password
          <input name="currentPassword" type="password" required autoComplete="current-password" className={inputClass} />
        </label>
        <label className={labelClass}>
          New password
          <input
            name="newPassword"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            className={inputClass}
          />
        </label>
      </div>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state.message && <p className="text-sm text-emerald-700 dark:text-emerald-400">{state.message}</p>}
      <button disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
