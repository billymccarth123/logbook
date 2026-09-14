export default function Home() {
  return (
    <main className="flex flex-col flex-1 items-center justify-center gap-6 bg-zinc-50 px-6 text-center font-sans dark:bg-black">
      <span className="rounded-full border border-zinc-200 px-4 py-1 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        Coming soon
      </span>
      <h1 className="text-5xl font-bold tracking-tight text-zinc-900 sm:text-6xl dark:text-zinc-50">
        Logbook
      </h1>
      <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
        The car marketplace — buy and sell with confidence.
      </p>
    </main>
  );
}
