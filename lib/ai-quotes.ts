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
  // Likely spread of quotes across Irish insurers.
  low: number;
  high: number;
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
      // Many insurers would refuse to quote this driver for this car.
      declineLikely: z.boolean(),
    }),
  ),
});

const SYSTEM_PROMPT = `You are a senior Irish private motor insurance underwriter. You price annual comprehensive or third party, fire and theft premiums in euro for drivers in the Republic of Ireland, as the market would quote them in 2026.

How the Irish market prices (Central Bank of Ireland NCID Report 7, data to 2024; NCID mid-year 2025; Chill Car Insurance Pricing Index, July 2026):
- Average premium €655 (H1 2025); comprehensive €648. 93% of policies are comprehensive.
- About 68% of a premium is expected claims (€397 per policy in 2024): injury €205, third party damage €70, accidental (own) damage €100, fire and theft €12, windscreen €10. The rest is administration and claims handling (~23%), broker commission (~13% where sold through brokers), the MIBI levy (~3.6%), the 3% government levy, the 1% ICF levy, and a thin profit (~4–5%).
- Injury claims dominate and are driven by the driver: age, experience and history. Car value and repair cost drive own damage and theft only.
- Damage claim costs are rising fast (average damage claim +18% in 2024) because of parts, labour and ADAS sensor calibration, so cars that are expensive or slow to repair cost more to insure.
- Chill average premiums by model: Hyundai Tucson €569, Nissan Qashqai €584, Skoda Octavia €585, Toyota Corolla €602, Toyota Yaris €608, Ford Fiesta €636, Ford Focus €659, VW Passat €683, VW Golf €725, BMW 3 Series €783. EVs such as the Kia Niro EV (€447) and Nissan Leaf (€489) are among the cheapest.

For every car you receive a baseline premium from a rating model. It already prices the driver (age curve, county, licence years and named-driver experience, no claims bonus, penalty points, claims, convictions, licence type, occupation, mileage, use, parking, named drivers), cover and excess, engine size band, car value, and the model averages above at half weight. Its factors are listed with each car.

Adjust each baseline only for what the rating model can't see about the specific car and how it fits this driver:
- the car's insurance group: power output, performance versions, repair cost, parts prices and availability, ADAS repair costs
- theft and break-in risk for that model in Ireland (keyless models, sought-after parts)
- imports (e.g. US-spec or grey imports): harder to repair and value, often loaded or declined
- safety equipment typical for that model and year (autonomous emergency braking lowers accident claims)
- interactions: a powerful or high-group car with a young or newly licensed driver is loaded heavily, and many insurers refuse to quote under-25s on high-performance cars

Rules:
- Stay within 25% below and 30% above the baseline. Most adjustments are under 10%; don't re-price factors the baseline already covers.
- Set declineLikely to true only when many Irish insurers would refuse to quote this driver for this car.
- Give one to three short reasons per car (under 12 words each), written for the buyer, about the car rather than restating the driver's details.
- Return one quote for every listingId you are given.`;

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
    `Named driver experience on another policy: ${driver.namedDriverYears} years`,
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
    low: rated.low,
    high: rated.high,
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
      const cars = listings.map((listing) => {
        const quote = rated.get(listing.id)!;
        return {
          listingId: listing.id,
          car: `${listing.year} ${listing.make} ${listing.model}, ${listing.engineSizeLitres.toFixed(1)}L petrol`,
          marketValue: listing.price,
          odometerKm: listing.odometerKm,
          baselinePremium: Math.round(quote.premium),
          baselineFactors: quote.factors.map(
            (factor) => `${factor.label}: ${factor.multiplier >= 1 ? "+" : ""}${Math.round((factor.multiplier - 1) * 100)}%`,
          ),
        };
      });

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
        const scale = premium / quote.ratingModelPremium;
        const notes = aiQuote.reasons.slice(0, 3);
        if (aiQuote.declineLikely) notes.unshift("Many insurers may refuse to quote you for this car.");
        rated.set(aiQuote.listingId, {
          ...quote,
          premium,
          low: quote.low * scale,
          high: quote.high * scale,
          notes,
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
