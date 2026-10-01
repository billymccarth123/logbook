import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { unreadConversationCount } from "@/lib/messages";

const navLink =
  "rounded-full px-2 py-2 text-zinc-600 sm:px-3 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100";

export async function Header() {
  const user = await getCurrentUser();
  const unread = user ? await unreadConversationCount(user.id) : 0;

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/90 backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/90">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          TRU<span className="text-emerald-600">COST</span>
        </Link>

        <form action="/search" className="hidden max-w-md flex-1 md:block" role="search">
          <input
            name="q"
            type="search"
            placeholder="Describe the car you want"
            aria-label="Search cars"
            className="w-full rounded-full bg-zinc-100 px-4 py-2 text-sm outline-none placeholder:text-zinc-500 focus:bg-white focus:ring-2 focus:ring-emerald-600 dark:bg-zinc-900 dark:focus:bg-zinc-950"
          />
        </form>

        <nav className="ml-auto flex items-center gap-0.5 text-sm font-medium">
          <Link href="/cars" className={navLink}>
            Browse
          </Link>
          <Link href="/value" className={`${navLink} hidden sm:block`}>
            Value my car
          </Link>
          {user?.role === "admin" && (
            <Link href="/admin" className={`${navLink} hidden sm:block`}>
              Admin
            </Link>
          )}
          {user && (
            <Link href="/messages" className={`${navLink} relative`}>
              Messages
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4.5 rounded-full bg-emerald-600 px-1 text-center text-[11px] leading-4.5 font-semibold text-white">
                  {unread}
                </span>
              )}
            </Link>
          )}
          <Link href={user ? "/profile" : "/login"} className={navLink}>
            {user ? user.name.split(" ")[0] : "Log in"}
          </Link>
          <Link
            href="/sell"
            className="ml-1 rounded-full bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Sell
          </Link>
        </nav>
      </div>
    </header>
  );
}
