import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export async function Header() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="text-xl font-bold tracking-tight">
          TRUCOST
        </Link>
        <nav className="flex items-center gap-3 text-sm font-medium sm:gap-6">
          <Link href="/cars" className="hover:text-emerald-600">
            Browse
          </Link>
          <Link href="/value" className="hover:text-emerald-600">
            <span className="sm:hidden">Value</span>
            <span className="hidden sm:inline">Value my car</span>
          </Link>
          <Link href="/sell" className="hover:text-emerald-600">
            Sell
          </Link>
          {user ? (
            <>
              {user.role === "admin" && (
                <Link href="/admin" className="hover:text-emerald-600">
                  Admin
                </Link>
              )}
              <Link href="/profile" className="hover:text-emerald-600">
                {user.name.split(" ")[0]}
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-emerald-600">
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
