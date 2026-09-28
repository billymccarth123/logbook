// Rating engine: a multiplicative model, the same shape insurers use.
// premium = age average × county factor × one multiplier per rating factor.
//
// Researched inputs (Chill Car Insurance Pricing Index, July 2026): averages by
// age, county and years of licence. NCD and penalty point loadings follow the
// ranges Irish insurers and brokers publish (NCD ~20% at 1 year up to ~60%;
// points +10% at 2–5, +20–30% at 6+, +50% at 9+). Every other multiplier is an
// assumption and marked as such.

import { COUNTY_AVERAGES, COUNTY_BASELINE } from "./counties";
import { engineBand } from "./costs";
import { ageFromDob, yearsSince, type DriverDetails, type Occupation } from "./driver-profile";

export const AGE_BANDS = [
  { label: "17–19", max: 19, average: 2212 },
  { label: "20–29", max: 29, average: 1091 },
  { label: "30–39", max: 39, average: 689 },
  { label: "40–49", max: 49, average: 596 },
  { label: "50–59", max: 59, average: 567 },
  { label: "60–69", max: 69, average: 494 },
  { label: "70–74", max: 74, average: 505 },
  { label: "75+", max: Infinity, average: 632 },
];

// Average premium by years the licence has been held.
const EXPERIENCE_BANDS = [
  { maxYears: 0, average: 1421 },
  { maxYears: 2, average: 1124 },
  { maxYears: 5, average: 899 },
  { maxYears: 10, average: 704 },
  { maxYears: 20, average: 585 },
  { maxYears: 30, average: 547 },
  { maxYears: Infinity, average: 533 },
];

// Discount by years of no claims bonus (capped at 6).
const NCD_DISCOUNT = [0, 0.2, 0.3, 0.4, 0.5, 0.55, 0.6];

// Assumption: small loadings by occupation (Chill reports office, education and legal jobs pay least).
const OCCUPATION_FACTOR: Record<Occupation, number> = {
  "office-admin": 0.92,
  education: 0.92,
  "legal-finance": 0.93,
  healthcare: 0.97,
  "it-engineering": 0.97,
  "trades-construction": 1.05,
  "hospitality-retail": 1.05,
  "driving-delivery": 1.12,
  student: 1.1,
  retired: 0.95,
  "not-employed": 1.03,
  other: 1.0,
};

const MIN_PREMIUM = 300;

export type Car = { make: string; model: string; year: number; engineSizeLitres: number; price: number };

export type Factor = { label: string; multiplier: number };

export type RatedQuote = { premium: number; base: number; factors: Factor[] };

export function ageBand(age: number) {
  return AGE_BANDS.find((band) => age <= band.max) ?? AGE_BANDS[0];
}

function experienceAverage(years: number) {
  return EXPERIENCE_BANDS.find((band) => years <= band.maxYears)!.average;
}

function ncdMultiplier(years: number) {
  return 1 - NCD_DISCOUNT[Math.min(Math.max(years, 0), NCD_DISCOUNT.length - 1)];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function rateQuote(driver: DriverDetails, car: Car): RatedQuote {
  const age = ageFromDob(driver.dateOfBirth);
  const licenceYears = yearsSince(driver.licenceDate);
  const base = ageBand(age).average * (COUNTY_AVERAGES[driver.county] / COUNTY_BASELINE);
  const factors: Factor[] = [];
  const add = (label: string, multiplier: number) => {
    if (Math.abs(multiplier - 1) > 0.005) factors.push({ label, multiplier });
  };

  // The age averages already assume typical experience and NCD for that age,
  // so only the difference from typical is priced.
  const typicalYears = Math.max(0, age - 18);
  add(
    `${licenceYears} ${licenceYears === 1 ? "year" : "years"} licensed`,
    clamp(experienceAverage(licenceYears) / experienceAverage(typicalYears), 0.85, 2.0),
  );
  const typicalNcd = clamp(age - 19, 0, 6);
  add(
    `${driver.noClaimsYears} ${driver.noClaimsYears === 1 ? "year" : "years"} no claims bonus`,
    clamp(ncdMultiplier(driver.noClaimsYears) / ncdMultiplier(typicalNcd), 0.7, 2.5),
  );

  // Assumptions from here on unless noted.
  if (driver.licenceType === "learner") add("Learner permit", 1.5);
  if (driver.licenceType === "full-other") add("Non-EU licence", 1.25);
  if (driver.licenceType === "full-eu-uk") add("EU or UK licence", 1.05);

  // Published ranges for penalty points.
  const points = driver.penaltyPoints;
  add(`${points} penalty points`, points >= 9 ? 1.5 : points >= 6 ? 1.25 : points >= 2 ? 1.1 : 1);

  add(driver.claimsLast3Years === 1 ? "1 claim in 3 years" : "2+ claims in 3 years", [1, 1.3, 1.6][driver.claimsLast3Years]);
  if (driver.convictions) add("Motoring conviction", 1.5);
  add("Occupation", OCCUPATION_FACTOR[driver.occupation]);

  const km = driver.annualKm;
  add(`${km.toLocaleString("en-IE")} km a year`, km < 10_000 ? 0.9 : km <= 20_000 ? 1 : km <= 30_000 ? 1.1 : 1.2);
  if (driver.usage === "business") add("Business use", 1.15);
  if (driver.usage === "social") add("No commuting", 0.95);
  if (driver.parking === "garage") add("Garaged overnight", 0.95);
  if (driver.parking === "street") add("Parked on street", 1.1);
  if (driver.cover === "tpft") add("Third party, fire and theft", 0.9);
  add(`€${driver.excess} excess`, { 125: 1.08, 300: 1, 600: 0.93 }[driver.excess]);
  if (driver.namedDriver === "young") add("Young named driver", 1.35);

  add(`${car.engineSizeLitres.toFixed(1)}L engine`, engineBand(car.engineSizeLitres).insuranceMultiplier);
  if (driver.cover === "comprehensive") {
    // More valuable cars cost more to repair or replace.
    add(`€${Math.round(car.price / 1000)}k car value`, clamp(1 + 0.15 * Math.log2(car.price / 15_000), 0.85, 1.3));
  }

  const premium = Math.max(
    MIN_PREMIUM,
    factors.reduce((total, factor) => total * factor.multiplier, base),
  );
  return { premium, base, factors };
}
