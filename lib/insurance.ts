// Rating engine for Irish private car insurance.
//
// Insurers price with generalised linear models: expected claim cost per claim
// type (how often × how much), each multiplied by rating-factor relativities,
// plus expenses, commission, levies and profit. This model follows that shape,
// calibrated to published Irish data:
//
// - Premium structure, Central Bank of Ireland NCID Private Motor Insurance
//   Report 7 (Oct 2025, data to 2024): average premium €623, of which expected
//   claims €397 (68%): injury €205, third party damage €70, accidental (own)
//   damage €100, fire and theft €12, windscreen €10. Management expenses ~17%
//   of premium, MIBI ~3.6%, broker commission ~13% on the 46% sold through
//   brokers, profit ~4–5%. Plus the 3% government levy and 1% ICF levy (2026).
// - Driver averages, Chill Car Insurance Pricing Index (14 July 2026, sales
//   June 2025–May 2026): by age, county, years licensed, popular models, brands.
// - Market average €655 (NCID mid-year 2025: comprehensive €648).
// - Factor loadings from Irish insurers, brokers and comparison sites, 2026:
//   NCD ladder 20/30/40/50/55/60%; penalty points ~10% (2–5), 20–30% (6+),
//   50%+ (9+); an at-fault claim +30–50% for 3–5 years; learner and new-driver
//   examples; named-driver credit up to ~55%; excess and parking savings.
// Anything not from those sources is marked "assumption".
//
// Checked against published averages and example quotes by `npm run check:quotes`.

import { COUNTY_AVERAGES, COUNTY_BASELINE } from "./counties";
import { engineBand } from "./costs";
import { ageFromDob, yearsSince, type DriverDetails, type Occupation } from "./driver-profile";

// ---- Published data ----

// Chill, average premium by driver age.
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

// Chill, average premium by years the licence has been held.
const EXPERIENCE_BANDS = [
  { maxYears: 0, average: 1421 },
  { maxYears: 2, average: 1124 },
  { maxYears: 5, average: 899 },
  { maxYears: 10, average: 704 },
  { maxYears: 20, average: 585 },
  { maxYears: 30, average: 547 },
  { maxYears: Infinity, average: 533 },
];

// NCID Report 7: expected claims cost per policy by claim type, 2024 (€397 in total).
const CLAIM_COSTS = { injury: 205, thirdPartyDamage: 70, ownDamage: 100, fireTheft: 12, windscreen: 10 };
type ClaimType = keyof typeof CLAIM_COSTS;
const TOTAL_CLAIMS = Object.values(CLAIM_COSTS).reduce((a, b) => a + b, 0);

// Everything that isn't claims, split into a flat per-policy cost and a share
// of the premium. At the national average (€655) claims come to 68%, as in NCID.
const FLAT_COST = 110; // administration and claims handling per policy (NCID: ~17% + ~6% of premium, part fixed)
const PROPORTIONAL_LOADING = 0.15; // commission, MIBI, government levy (3%), ICF levy (1%) and profit

// Chill, average premium for the most popular models and cheapest brands. These
// also reflect who drives each car, so only half the difference is used (assumption).
const MARKET_REFERENCE = 640;
const MODEL_AVERAGES: Record<string, number> = {
  "hyundai tucson": 569,
  "nissan qashqai": 584,
  "skoda octavia": 585,
  "toyota corolla": 602,
  "toyota yaris": 608,
  "ford fiesta": 636,
  "ford focus": 659,
  "volkswagen passat": 683,
  "volkswagen golf": 725,
  "bmw 3 series": 783,
};
const BRAND_AVERAGES: Record<string, number> = {
  dacia: 545,
  skoda: 583,
  mg: 587,
  nissan: 591,
  kia: 592,
  hyundai: 592,
  peugeot: 593,
};

// Discount by years of no claims bonus, capped at 6 (published Irish ladder).
const NCD_DISCOUNT = [0, 0.2, 0.3, 0.4, 0.5, 0.55, 0.6];

// Assumption: loadings by occupation, ordered by Chill's cheapest occupations
// (legal secretary €521, teachers €526–532, Garda €535) and brokers' guidance
// that driving jobs and students cost more.
const OCCUPATION_FACTOR: Record<Occupation, number> = {
  "office-admin": 0.93,
  education: 0.9,
  "legal-finance": 0.92,
  healthcare: 0.95,
  "it-engineering": 0.97,
  "trades-construction": 1.06,
  "hospitality-retail": 1.06,
  "driving-delivery": 1.15,
  student: 1.1,
  retired: 0.95,
  "not-employed": 1.03,
  other: 1.0,
};

const MIN_PREMIUM = 300; // assumption: typical Irish insurer minimum premium
const TYPICAL_CAR_VALUE = 15_000; // assumption: typical insured car value

// ---- Types ----

export type Car = { make: string; model: string; year: number; engineSizeLitres: number; price: number };

// multiplier: how much this factor changes the final premium on its own.
export type Factor = { label: string; multiplier: number };

export type RatedQuote = {
  premium: number;
  // Likely spread of quotes across insurers for this driver and car.
  low: number;
  high: number;
  base: number;
  factors: Factor[];
  breakdown: { claims: number; costs: number };
};

// A rating factor multiplies the expected cost of the claim types it affects.
type Relativity = { label: string; value: number; applies: "all" | ClaimType[] };

// ---- Helpers ----

export function ageBand(age: number) {
  return AGE_BANDS.find((band) => age <= band.max) ?? AGE_BANDS[0];
}

// A premium curve by single year of age, interpolated on a log scale. It keeps
// each Chill band's average (checked in scripts/check-quotes.ts) but follows
// brokers' guidance that prices stay high until about 24 and fall sharply
// from 25, so a 20-year-old isn't priced like a 29-year-old.
const AGE_CURVE: [number, number][] = [
  [17, 2500],
  [18, 2212],
  [19, 2000],
  [20, 1850],
  [22, 1500],
  [24, 1200],
  [26, 920],
  [29, 780],
  [34.5, 689],
  [44.5, 596],
  [54.5, 567],
  [64.5, 494],
  [72, 505],
  [80, 632],
];

export function ageAverage(age: number) {
  if (age <= AGE_CURVE[0][0]) return AGE_CURVE[0][1];
  for (let i = 1; i < AGE_CURVE.length; i++) {
    const [a1, p1] = AGE_CURVE[i - 1];
    const [a2, p2] = AGE_CURVE[i];
    if (age <= a2) return Math.exp(Math.log(p1) + ((age - a1) / (a2 - a1)) * (Math.log(p2) - Math.log(p1)));
  }
  return AGE_CURVE[AGE_CURVE.length - 1][1];
}

function experienceAverage(years: number) {
  return EXPERIENCE_BANDS.find((band) => years <= band.maxYears)!.average;
}

function ncdMultiplier(years: number) {
  return 1 - NCD_DISCOUNT[Math.min(Math.max(Math.floor(years), 0), NCD_DISCOUNT.length - 1)];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalise(text: string) {
  return text.toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ").trim();
}

// Chill's model or brand average turned into a relativity, at half credibility.
function vehicleRelativity(car: Car) {
  const make = normalise(car.make === "VW" ? "Volkswagen" : car.make);
  const average = MODEL_AVERAGES[`${make} ${normalise(car.model)}`] ?? BRAND_AVERAGES[make];
  return average ? 1 + 0.5 * (average / MARKET_REFERENCE - 1) : 1;
}

// ---- Rating ----

function driverRelativities(driver: DriverDetails, age: number): Relativity[] {
  const licenceYears = yearsSince(driver.licenceDate);
  const list: Relativity[] = [];
  const add = (label: string, value: number, applies: Relativity["applies"] = "all") => {
    if (Math.abs(value - 1) > 0.005) list.push({ label, value, applies });
  };

  // The age averages already assume typical experience and NCD for that age,
  // so only the difference from typical is priced. Typical: licence at 18, and
  // NCD from about 21, as most young drivers start as named drivers (assumption).
  const typicalYears = Math.max(0, age - 18);
  const typicalNcd = clamp(age - 21, 0, 6);
  // Named-driver experience counts as half-experience, and insurers credit it
  // towards NCD when there's little of it (up to ~55%). Assumption: half its years.
  const effectiveYears = licenceYears + Math.min(driver.namedDriverYears, licenceYears + 2) * 0.5;
  const ncdCredit = driver.noClaimsYears < 3 ? Math.min(driver.namedDriverYears * 0.5, 3 - driver.noClaimsYears) : 0;
  const experience = experienceAverage(Math.floor(effectiveYears)) / experienceAverage(typicalYears);
  const ncd = ncdMultiplier(driver.noClaimsYears + ncdCredit) / ncdMultiplier(typicalNcd);
  // Experience and NCD rise together, so applying both in full double counts:
  // a new driver pays ~2–2.5× an experienced one of the same age, not 5×.
  // The 0.6 power is calibrated to the benchmarks in scripts/check-quotes.ts.
  const named = driver.namedDriverYears ? ` + ${driver.namedDriverYears} as a named driver` : "";
  add(`${licenceYears} ${licenceYears === 1 ? "year" : "years"} licensed${named}`, clamp(experience ** 0.6, 0.85, 1.7));
  add(
    `${driver.noClaimsYears} ${driver.noClaimsYears === 1 ? "year" : "years"} no claims bonus`,
    clamp(ncd ** 0.6, 0.75, 1.8),
  );

  if (driver.licenceType === "learner") add("Learner permit", 1.35);
  if (driver.licenceType === "full-other") add("Licence from outside the EU", 1.25);
  if (driver.licenceType === "full-eu-uk") add("EU or UK licence", 1.05);

  const points = driver.penaltyPoints;
  add(`${points} penalty points`, points >= 9 ? 1.5 : points >= 6 ? 1.25 : points >= 2 ? 1.1 : 1);
  add(driver.claimsLast3Years === 1 ? "1 claim in 3 years" : "2+ claims in 3 years", [1, 1.4, 1.8][driver.claimsLast3Years]);
  if (driver.convictions) add("Motoring conviction", 1.6);
  add("Occupation", OCCUPATION_FACTOR[driver.occupation]);

  // Assumptions from brokers' guidance (under 10,000 km saves €100–€200).
  const km = driver.annualKm;
  add(`${km.toLocaleString("en-IE")} km a year`, km < 10_000 ? 0.88 : km <= 20_000 ? 1 : km <= 30_000 ? 1.1 : 1.2);
  if (driver.usage === "business") add("Business use", 1.15);
  if (driver.usage === "social") add("No commuting", 0.93);

  // Parking mainly changes theft and damage while parked (off-street saves €50–€150).
  if (driver.parking === "garage") add("Garaged overnight", 0.75, ["fireTheft", "ownDamage"]);
  if (driver.parking === "street") add("Parked on the street", 1.3, ["fireTheft", "ownDamage", "windscreen"]);

  if (driver.namedDriver === "young") add("Young named driver", 1.35);
  if (driver.namedDriver === "experienced") add("Experienced named driver", 1.02);
  return list;
}

function carRelativities(driver: DriverDetails, car: Car): Relativity[] {
  const list: Relativity[] = [];
  const add = (label: string, value: number, applies: Relativity["applies"]) => {
    if (Math.abs(value - 1) > 0.005) list.push({ label, value, applies });
  };
  // Engine size stands in for power: more claims, and costlier ones (assumption, lib/costs.ts).
  add(`${car.engineSizeLitres.toFixed(1)}L engine`, engineBand(car.engineSizeLitres).insuranceMultiplier, "all");
  add(`${car.make} ${car.model} claims record`, vehicleRelativity(car), "all");
  // Own damage and theft scale with what the car costs to repair or replace (assumption: square root).
  add(
    `€${Math.round(car.price / 1000)}k car value`,
    clamp(Math.sqrt(car.price / TYPICAL_CAR_VALUE), 0.55, 2.2),
    ["ownDamage", "fireTheft"],
  );
  // Excess comes off each own damage claim (assumption: €300 is standard).
  add(`€${driver.excess} excess`, { 125: 1.15, 300: 1, 600: 0.82 }[driver.excess], ["ownDamage"]);
  return list;
}

function price(base: number, relativities: Relativity[], cover: DriverDetails["cover"]) {
  // The driver's average premium, less costs, is their expected claims, split by type.
  const expectedClaims = Math.max(150, base * (1 - PROPORTIONAL_LOADING) - FLAT_COST);
  const claims: Record<ClaimType, number> = { ...CLAIM_COSTS };
  for (const type of Object.keys(claims) as ClaimType[]) claims[type] *= expectedClaims / TOTAL_CLAIMS;
  // Third party, fire and theft doesn't cover damage to your own car or windscreen.
  if (cover === "tpft") {
    claims.ownDamage = 0;
    claims.windscreen = 0;
  }
  for (const r of relativities) {
    for (const type of Object.keys(claims) as ClaimType[]) {
      if (r.applies === "all" || r.applies.includes(type)) claims[type] *= r.value;
    }
  }
  const claimsTotal = Object.values(claims).reduce((a, b) => a + b, 0);
  const premium = Math.max(MIN_PREMIUM, (claimsTotal + FLAT_COST) / (1 - PROPORTIONAL_LOADING));
  return { premium, claims: claimsTotal };
}

export function rateQuote(driver: DriverDetails, car: Car): RatedQuote {
  const age = ageFromDob(driver.dateOfBirth);
  const base = ageAverage(age) * (COUNTY_AVERAGES[driver.county] / COUNTY_BASELINE);
  const relativities = [...driverRelativities(driver, age), ...carRelativities(driver, car)];
  const { premium, claims } = price(base, relativities, driver.cover);

  // Each factor's effect on the final price: the premium with it, over without it.
  const factors: Factor[] = relativities.map((r) => ({
    label: r.label,
    multiplier: r.value === 1 ? 1 : premium / price(base, relativities.filter((other) => other !== r), driver.cover).premium,
  }));
  if (driver.cover === "tpft") {
    const comprehensive = price(base, relativities, "comprehensive").premium;
    factors.push({ label: "Third party, fire and theft", multiplier: premium / comprehensive });
  }

  // Quotes for the same driver and car typically differ by €400–€500 between the
  // cheapest and dearest insurer, and more for young drivers.
  const spread = age < 25 || yearsSince(driver.licenceDate) < 2 ? [0.8, 1.3] : [0.85, 1.2];
  return {
    premium,
    low: premium * spread[0],
    high: premium * spread[1],
    base,
    factors: factors.filter((factor) => Math.abs(factor.multiplier - 1) > 0.005),
    breakdown: { claims, costs: premium - claims },
  };
}
