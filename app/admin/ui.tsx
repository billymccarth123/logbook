import Link from "next/link";
import type { ReactNode } from "react";

export function formatDate(iso: string | null, withTime = false) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime && { hour: "2-digit", minute: "2-digit" }),
  });
}

export function AdminTabs({ current }: { current: "users" | "listings" }) {
  const tabs = [
    { key: "users", href: "/admin", label: "Users" },
    { key: "listings", href: "/admin/listings", label: "Listings" },
  ];
  return (
    <nav className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
            current === tab.key
              ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
              : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export function Badge({ children, tone = "zinc" }: { children: ReactNode; tone?: "zinc" | "emerald" | "red" }) {
  const tones = {
    zinc: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    red: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  };
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

type Action = (formData: FormData) => Promise<void>;

export function ActionButton({ action, fields, label, danger = false }: {
  action: Action;
  fields: Record<string, string>;
  label: string;
  danger?: boolean;
}) {
  return (
    <form action={action}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button
        className={`rounded-md border px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
          danger
            ? "border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
            : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        }`}
      >
        {label}
      </button>
    </form>
  );
}

// A delete button that asks for confirmation first.
export function ConfirmDelete({ action, fields, label, message }: {
  action: Action;
  fields: Record<string, string>;
  label: string;
  message: string;
}) {
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-red-700 dark:border-red-800 dark:text-red-400">
        {label}
      </summary>
      <div className="absolute right-0 z-10 mt-1 w-64 rounded-lg border border-zinc-200 bg-white p-3 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
        <p className="mb-2">{message}</p>
        <ActionButton action={action} fields={fields} label="Yes, delete" danger />
      </div>
    </details>
  );
}

export const tableWrap = "overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800";
export const table = "w-full text-left text-sm";
export const thead = "border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900";
export const th = "px-4 py-2.5 font-medium";
export const td = "px-4 py-3";
export const searchInput =
  "w-full max-w-sm rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";
