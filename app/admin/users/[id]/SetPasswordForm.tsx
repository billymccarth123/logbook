"use client";

import { useActionState } from "react";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-rules";
import type { FormState } from "../../../actions";
import { inputClass, labelClass } from "../../../components/form";
import { setUserPassword } from "../../actions";

export function SetPasswordForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setUserPassword, {});

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="userId" value={userId} />
      <label className={labelClass}>
        New password
        <input
          name="password"
          type="text"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="off"
          className={inputClass}
        />
        <span className="mt-1 block text-xs font-normal text-zinc-500">
          At least {MIN_PASSWORD_LENGTH} characters. They&apos;ll be signed out everywhere and need this to log in.
        </span>
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.message && <p className="text-sm text-emerald-700 dark:text-emerald-400">{state.message}</p>}
      <button
        disabled={pending}
        className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {pending ? "Saving…" : "Set password"}
      </button>
    </form>
  );
}
