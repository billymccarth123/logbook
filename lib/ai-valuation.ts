import "server-only";

import { z } from "zod";
import type { BetaContentBlock, BetaMessageParam, BetaTool } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { Anthropic, getAnthropic } from "./anthropic";
import { getMarketEntry, getModelEntries, isFresh, saveMarketEntry } from "./market-data";
import {
  estimateFromNearby,
  FUELS,
  marketKey,
  typicalKmFor,
  valueCar,
  type CarForValuation,
  type Fuel,
  type MarketEntry,
  type Valuation,
} from "./valuation";

const RecordSchema = z.object({
  referenceValue: z.number(),
  low: z.number(),
  high: z.number(),
  confidence: z.enum(["high", "medium", "low"]),
  notes: z.string(),
  comparables: z.array(
    z.object({
      title: z.string(),
      askingPrice: z.number(),
      year: z.number(),
      odometerKm: z.number().nullable(),
      source: z.string(),
      url: z.string(),
    }),
  ),
});

const RECORD_TOOL: BetaTool = {
  name: "record_market_value",
  description:
    "Record the market value you found for this car. Call this exactly once, after searching, as your final step.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      referenceValue: {
        type: "number",
        description: "Typical private asking price in euro for this car at the typical mileage given, in good condition.",
      },
      low: { type: "number", description: "Low end of realistic asking prices in euro." },
      high: { type: "number", description: "High end of realistic asking prices in euro." },
      confidence: {
        type: "string",
        enum: ["high", "medium", "low"],
        description: "high: 5+ close comparables. medium: 2-4, or close years only. low: little direct evidence.",
      },
      notes: { type: "string", description: "One or two sentences for the seller on what drives this car's value." },
      comparables: {
        type: "array",
        description: "Real listings you saw in search results. Never invent one. Up to 8.",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            askingPrice: { type: "number" },
            year: { type: "integer" },
            odometerKm: { type: ["number", "null"] },
            source: { type: "string", description: "Site name, e.g. DoneDeal, Carzone." },
            url: { type: "string", description: "Exact URL from the search results." },
          },
          required: ["title", "askingPrice", "year", "odometerKm", "source", "url"],
          additionalProperties: false,
        },
      },
    },
    required: ["referenceValue", "low", "high", "confidence", "notes", "comparables"],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `You are a used car valuer for the Irish market. You value cars in euro using current asking prices on Irish marketplaces such as DoneDeal, Carzone and CarsIreland, and dealer sites.

Search the web for current listings of the car you're given in the Republic of Ireland. Look at the same model and year first, then the year either side if there are few results. Prefer listings with similar mileage. Ignore UK prices in pounds, and cars that are damaged, crashed or sold for parts.

Work out the typical private asking price for a car of that year at the typical mileage you're given, in good condition with full service history. Only list comparables you actually saw in search results, with their exact URL. If the evidence is thin, say so with a low confidence rather than guessing precisely.

When you're done, call record_market_value once.`;

const MAX_TURNS = 5;
const inFlight = new Map<string, Promise<MarketEntry>>();

function searchResultUrls(content: BetaContentBlock[]) {
  const urls = new Set<string>();
  for (const block of content) {
    if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const result of block.content) urls.add(result.url);
    }
  }
  return urls;
}

async function researchMarket(
  anthropic: Anthropic,
  car: { make: string; model: string; year: number; fuel: Fuel; key: string },
): Promise<MarketEntry> {
  const typicalKm = typicalKmFor(car.year);
  const messages: BetaMessageParam[] = [
    {
      role: "user",
      content: `Value this car for the Irish market:\n${car.year} ${car.make} ${car.model}, ${FUELS[car.fuel].toLowerCase()}.\nTypical mileage for its age: ${typicalKm.toLocaleString("en-IE")} km.`,
    },
  ];
  const seenUrls = new Set<string>();

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await anthropic.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: SYSTEM_PROMPT,
      tools: [
        {
          type: "web_search_20260209",
          name: "web_search",
          max_uses: 6,
          user_location: { type: "approximate", country: "IE", timezone: "Europe/Dublin" },
        },
        RECORD_TOOL,
      ],
      messages,
    });

    if (response.stop_reason === "refusal") throw new Error("The valuation request was declined.");
    for (const url of searchResultUrls(response.content)) seenUrls.add(url);

    const record = response.content.find(
      (block) => block.type === "tool_use" && block.name === RECORD_TOOL.name,
    );
    if (record && record.type === "tool_use") {
      const found = RecordSchema.parse(record.input);
      // Drop any comparable that didn't come from a real search result.
      const comparables = found.comparables.filter((c) => seenUrls.has(c.url) && c.askingPrice > 0).slice(0, 8);
      if (!(found.referenceValue > 0)) throw new Error("No market value found.");
      return {
        key: car.key,
        make: car.make,
        model: car.model,
        year: car.year,
        fuel: car.fuel,
        referenceValue: Math.round(found.referenceValue),
        low: Math.round(Math.min(found.low, found.referenceValue)),
        high: Math.round(Math.max(found.high, found.referenceValue)),
        typicalKm,
        comparables,
        confidence: comparables.length === 0 ? "low" : found.confidence,
        notes: found.notes,
        updatedAt: new Date().toISOString(),
      };
    }

    // Keep the transcript append-only: add Claude's turn, then continue.
    messages.push({ role: "assistant", content: response.content });
    if (response.stop_reason !== "pause_turn") {
      messages.push({ role: "user", content: "Call record_market_value now with what you found." });
    }
  }
  throw new Error("The valuation didn't finish.");
}

// 1. A fresh researched entry for this exact car type.
// 2. With an API key: research the market now and save it.
// 3. Otherwise: an older entry, or an estimate from nearby researched years.
async function marketEntryFor(car: CarForValuation): Promise<{ entry: MarketEntry } | { error: string }> {
  const key = marketKey(car.make, car.model, car.year, car.fuel);
  const stored = await getMarketEntry(key);
  if (stored && isFresh(stored)) return { entry: stored };

  const fallback = async () => {
    if (stored) return { entry: stored };
    const estimate = estimateFromNearby(await getModelEntries(car.make, car.model), car.year, car.fuel);
    if (estimate) return { entry: estimate };
    return {
      error: `We don't have market data for the ${car.make} ${car.model} around ${car.year} yet. Try a popular model, or check back soon.`,
    };
  };

  const anthropic = getAnthropic();
  if (!anthropic) return fallback();

  let pending = inFlight.get(key);
  if (!pending) {
    pending = researchMarket(anthropic, { make: car.make, model: car.model, year: car.year, fuel: car.fuel, key })
      .then(async (entry) => {
        await saveMarketEntry(entry);
        return entry;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }

  try {
    return { entry: await pending };
  } catch (error) {
    console.error("Market research failed:", error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : error);
    return fallback();
  }
}

export async function getValuation(car: CarForValuation): Promise<{ valuation: Valuation } | { error: string }> {
  const result = await marketEntryFor(car);
  if ("error" in result) return { error: result.error };
  return { valuation: valueCar(car, result.entry) };
}

export async function refreshMarketEntry(make: string, model: string, year: number, fuel: Fuel) {
  const anthropic = getAnthropic();
  if (!anthropic) throw new Error("ANTHROPIC_API_KEY is not set.");
  const key = marketKey(make, model, year, fuel);
  const entry = await researchMarket(anthropic, { make, model, year, fuel, key });
  await saveMarketEntry(entry);
  return entry;
}
