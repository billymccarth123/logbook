export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 py-24 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      <p className="mt-6 text-lg font-semibold">Working out your insurance quotes…</p>
      <p className="mt-1 max-w-sm text-sm text-zinc-500">
        We price every car for your details. This takes a few seconds the first time, then it&apos;s instant.
      </p>
    </div>
  );
}
