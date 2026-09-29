import "server-only";

import { createHash } from "node:crypto";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { Anthropic, getAnthropic } from "./anthropic";
import { ageFromDob, COVER, LICENCE_TYPES, NAMED_DRIVERS, OCCUPATIONS, PARKING, USAGE, yearsSince, type DriverDetails } from "./driver-profile";
import { rateQuote, type Factor } from "./insurance";
import type { Listing } from "./listings";

export type Quote = {
  premium: number;
  ratingModelPremium: number;
  factors: Factor[];
  // Car-specific reasons from the AI, empty when the rating model was used on its own.
  notes: string[];
  source: "ai" | "rating-model";
};

// The AI may move a price at most this far from the rating model.
const MIN_ADJUSTMENT = 0.75;
const MAX_ADJUSTMENT = 1.3;

const QuotesSchema = z.object({
  quotes: z.array(
    z.object({
      listingId: z.string(),
      annualPremium: z.number(),
      reasons: z.array(z.string()),
    }),
  ),
});

const SYSTEM_PROMPT = `You are a senior Irish private motor insurance underwriter. You price annual comprehensive or third party, fire and theft premiums in euro for drivers in the Republic of Ireland.

For every car you receive a baseline premium from a rating model. The rating model already prices the driver: age, county, licence experience, no claims bonus, penalty points, claims, convictions, occupation, mileage, usage, parking, cover, excess and named drivers. It prices the car only by engine size band and market value.

Your job is to adjust each baseline for what the rating model cannot see about the specific car and how it interacts with this driver:
- insurance group, performance and power output of that make and model
- theft and break-in risk, and how sought-after its parts are
- repair costs, parts availability and whether it is an import (for example US-spec cars)
- safety equipment typical for that model and year
- interactions, such as a powerful car with a young or inexperienced driver

Stay within 25% below or 30% above the baseline. Most adjustments should be under 10%. Give one to three short reasons per car (under 12 words each), written for the buyer, about the car rather than restating the driver's details. Return one quote for every listingId you are given.`;

const cache = new Map<string, Quote>();
const inFlight = new Map<string, Promise<void>>();

function driverKey(driver: DriverDetails) {
  return createHash("sha256").update(JSON.stringify(driver)).digest("hex").slice(0, 16);
}

function cacheKey(driverHash: string, listing: Listing) {
  return `${driverHash}:${listing.id}:${listing.make}:${listing.model}:${listing.year}:${listing.engineSizeLitres}:${listing.price}`;
}

function describeDriver(driver: DriverDetails) {
  return [
    `Age: ${ageFromDob(driver.dateOfBirth)}`,
    `County (car kept overnight): ${driver.county}`,
    `Occupation: ${OCCUPATIONS[driver.occupation]}`,
    `Licence: ${LICENCE_TYPES[driver.licenceType]}, held ${yearsSince(driver.licenceDate)} years`,
    `No claims bonus: ${driver.noClaimsYears} years`,
    `Penalty points: ${driver.penaltyPoints}`,
    `Claims in last 3 years: ${driver.claimsLast3Years === 2 ? "2 or more" : driver.claimsLast3Years}`,
    `Motoring convictions or disqualification: ${driver.convictions ? "yes" : "no"}`,
    `Annual mileage: ${driver.annualKm} km`,
    `Use: ${USAGE[driver.usage]}`,
    `Overnight parking: ${PARKING[driver.parking]}`,
    `Cover: ${COVER[driver.cover]}, €${driver.excess} excess`,
    `Other drivers: ${NAMED_DRIVERS[driver.namedDriver]}`,
  ].join("\n");
}

function ratingModelQuote(driver: DriverDetails, listing: Listing): Quote {
  const rated = rateQuote(driver, listing);
  return {
    premium: rated.premium,
    ratingModelPremium: rated.premium,
    factors: rated.factors,
    notes: [],
    source: "rating-model",
  };
}

async function priceWithAI(driver: DriverDetails, listings: Listing[], driverHash: string) {
  const anthropic = getAnthropic();
  const rated = new Map(listings.map((listing) => [listing.id, ratingModelQuote(driver, listing)]));

  if (anthropic) {
    try {
      const cars = listings.map((listing) => ({
        listingId: listing.id,
        car: `${listing.year} ${listing.make} ${listing.model}, ${listing.engineSizeLitres.toFixed(1)}L petrol`,
        marketValue: listing.price,
        odometerKm: listing.odometerKm,
        baselinePremium: Math.round(rated.get(listing.id)!.premium),
      }));

      const response = await anthropic.beta.messages.parse({
        model: "claude-opus-5",
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: { effort: "medium", format: betaZodOutputFormat(QuotesSchema) },
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Driver:\n${describeDriver(driver)}\n\nCars to price:\n${JSON.stringify(cars, null, 2)}`,
          },
        ],
      });

      if (response.stop_reason === "refusal" || !response.parsed_output) {
        throw new Error(`No quotes returned (stop reason: ${response.stop_reason})`);
      }

      for (const aiQuote of response.parsed_output.quotes) {
        const quote = rated.get(aiQuote.listingId);
        if (!quote || !Number.isFinite(aiQuote.annualPremium)) continue;
        const premium = Math.min(
          quote.ratingModelPremium * MAX_ADJUSTMENT,
          Math.max(quote.ratingModelPremium * MIN_ADJUSTMENT, aiQuote.annualPremium),
        );
        rated.set(aiQuote.listingId, {
          ...quote,
          premium,
          notes: aiQuote.reasons.slice(0, 3),
          source: "ai",
        });
      }
    } catch (error) {
      // The rating model's price is still a sound estimate, so fall back to it.
      if (error instanceof Anthropic.APIError) {
        console.error(`AI quotes failed (${error.status}): ${error.message}`);
      } else {
        console.error("AI quotes failed:", error);
      }
    }
  }

  for (const listing of listings) {
    cache.set(cacheKey(driverHash, listing), rated.get(listing.id)!);
  }
}

export function aiQuotesEnabled() {
  return getAnthropic() !== null;
}

// Returns a quote for every listing, pricing any that aren't cached in one AI call.
export async function getQuotes(driver: DriverDetails, listings: Listing[]): Promise<Map<string, Quote>> {
  const driverHash = driverKey(driver);
  const keys = listings.map((listing) => cacheKey(driverHash, listing));
  const missing = listings.filter((_, i) => !cache.has(keys[i]) && !inFlight.has(keys[i]));

  if (missing.length) {
    const missingKeys = missing.map((listing) => cacheKey(driverHash, listing));
    const batch = priceWithAI(driver, missing, driverHash).finally(() => {
      for (const key of missingKeys) inFlight.delete(key);
    });
    for (const key of missingKeys) inFlight.set(key, batch);
  }

  await Promise.all(keys.map((key) => inFlight.get(key)));

  return new Map(listings.map((listing) => [listing.id, cache.get(cacheKey(driverHash, listing))!]));
}

export async function getQuote(driver: DriverDetails, listing: Listing) {
  return (await getQuotes(driver, [listing])).get(listing.id)!;
}
