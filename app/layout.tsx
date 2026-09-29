import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Header } from "./components/Header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TRUCOST",
  description: "The Irish car marketplace that shows what every car costs to run each year.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <Header />
        <main className="flex flex-1 flex-col">{children}</main>
        <footer className="border-t border-zinc-200 dark:border-zinc-800">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
            <nav className="flex flex-wrap gap-x-5 gap-y-2">
              <Link href="/cars" className="hover:text-zinc-900 dark:hover:text-zinc-100">
                Browse
              </Link>
              <Link href="/sell" className="hover:text-zinc-900 dark:hover:text-zinc-100">
                Sell
              </Link>
              <Link href="/value" className="hover:text-zinc-900 dark:hover:text-zinc-100">
                Value my car
              </Link>
              <Link href="/values" className="hover:text-zinc-900 dark:hover:text-zinc-100">
                Market prices
              </Link>
            </nav>
            <p className="text-xs">
              Running costs are estimates, not quotes. Insurance averages from the{" "}
              <a
                href="https://www.chill.ie/blog/car-insurance-pricing-index/"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Chill Car Insurance Pricing Index
              </a>{" "}
              (July 2026).
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
