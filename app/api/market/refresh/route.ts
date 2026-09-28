import { timingSafeEqual } from "node:crypto";
import { refreshMarketEntry } from "@/lib/ai-valuation";
import { getMarketEntry, isFresh } from "@/lib/market-data";
import { POPULAR_MODELS } from "@/lib/popular-models";
import { marketKey } from "@/lib/valuation";

// Fills the market database for popular models, a chunk at a time.
//
//   curl -X POST "http://localhost:3000/api/market/refresh?limit=5&from=2016&to=2024" \
//     -H "Authorization: Bearer $MARKET_REFRESH_TOKEN"
//
// Each entry is one Claude call with web search, so this costs money: run it in
// small chunks. Entries that are still fresh are skipped.

export const maxDuration = 800;

function authorised(request: Request) {
  const token = process.env.MARKET_REFRESH_TOKEN;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!token || given.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(token));
}

export async function POST(request: Request) {
  if (!authorised(request)) return Response.json({ error: "Unauthorised" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const currentYear = new Date().getFullYear();
  const limit = Math.min(20, Math.max(1, Number(params.get("limit")) || 5));
  const from = Math.max(1990, Number(params.get("from")) || currentYear - 10);
  const to = Math.min(currentYear, Number(params.get("to")) || currentYear - 1);

  const todo = [];
  for (const { make, model, fuel } of POPULAR_MODELS) {
    for (let year = to; year >= from; year--) {
      const entry = await getMarketEntry(marketKey(make, model, year, fuel));
      if (!entry || !isFresh(entry)) todo.push({ make, model, fuel, year });
    }
  }

  const batch = todo.slice(0, limit);
  const results: ({ car: string; value: number; comparables: number } | { car: string; error: string })[] = [];
  // A few at a time keeps within API rate limits.
  for (let i = 0; i < batch.length; i += 3) {
    const settled = await Promise.allSettled(
      batch.slice(i, i + 3).map((car) => refreshMarketEntry(car.make, car.model, car.year, car.fuel)),
    );
    settled.forEach((result, j) => {
      const car = batch[i + j];
      const label = `${car.year} ${car.make} ${car.model} (${car.fuel})`;
      results.push(
        result.status === "fulfilled"
          ? { car: label, value: result.value.referenceValue, comparables: result.value.comparables.length }
          : { car: label, error: String(result.reason) },
      );
    });
  }

  return Response.json({ done: results, remaining: todo.length - batch.length });
}
