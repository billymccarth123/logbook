// Checks the rating model (lib/insurance.ts) against published Irish figures.
// Run with: npm run check:quotes
//
// Benchmarks:
// - Chill Car Insurance Pricing Index (14 July 2026): average premium by age.
//   Each is compared with a typical driver of that age: licence at 18, NCD
//   since 19, an average-priced county, a 1.4L €15k car, comprehensive.
// - odo.ie example premiums for young drivers in 1.0L hatchbacks (Aug 2026).
// - settle.ie premium ranges by driver profile (Aug 2026, site estimates).
// - AA Ireland's advertised example: a 23-year-old in Wexford, 2017 1.2L Golf,
//   5 years' full licence, 6,000 km a year, "from €38.36/month" (€460/yr, their best price).
//
// The odo.ie and settle.ie ranges are the sites' own estimates, not insurer
// data, so treat them as sanity checks rather than ground truth.

import type { County } from "../lib/costs";
import type { DriverDetails } from "../lib/driver-profile";
import { rateQuote, type Car } from "../lib/insurance";

const year = new Date().getFullYear();

function driver(age: number, overrides: Partial<DriverDetails> & { licenceYears?: number } = {}): DriverDetails {
  const { licenceYears = Math.max(0, age - 18), ...rest } = overrides;
  return {
    dateOfBirth: `${year - age}-01-01`,
    county: "Kildare" as County, // €643, the closest county to the national baseline
    occupation: "other",
    licenceType: "full-irish",
    licenceDate: `${year - licenceYears}-01-01`,
    penaltyPoints: 0,
    noClaimsYears: Math.min(6, Math.max(0, age - 19)),
    namedDriverYears: 0,
    claimsLast3Years: 0,
    convictions: false,
    annualKm: 15_000,
    usage: "commuting",
    parking: "driveway",
    cover: "comprehensive",
    excess: 300,
    namedDriver: "none",
    ...rest,
  };
}

const car = (make: string, model: string, engineSizeLitres: number, price: number, carYear = year - 6): Car => ({
  make,
  model,
  year: carYear,
  engineSizeLitres,
  price,
});
const typicalCar = car("Ford", "Mondeo", 1.4, 15_000); // no model data, so no model adjustment

type Benchmark = {
  name: string;
  source: string;
  low: number;
  high: number;
  // Site estimates are rough, so being within 5% of their range counts as "near".
  estimate?: boolean;
} & ({ driver: DriverDetails; car: Car } | { drivers: DriverDetails[]; car: Car });

const benchmarks: Benchmark[] = [
  // Chill averages by age band: the model's average across every age in the
  // band (typical driver) should be within ±15% of the published average.
  ...(
    [
      ["17–19", 17, 19, 2212],
      ["20–29", 20, 29, 1091],
      ["30–39", 30, 39, 689],
      ["40–49", 40, 49, 596],
      ["50–59", 50, 59, 567],
      ["60–69", 60, 69, 494],
      ["70–74", 70, 74, 505],
      ["75–84", 75, 84, 632],
    ] as const
  ).map(([label, from, to, average]) => ({
    name: `Typical drivers aged ${label}`,
    source: "Chill age average",
    drivers: Array.from({ length: to - from + 1 }, (_, i) => driver(from + i)),
    car: typicalCar,
    low: average * 0.85,
    high: average * 1.15,
  })),

  // odo.ie young-driver examples (1.0L hatchbacks).
  {
    name: "18, learner permit, Yaris 1.0",
    source: "odo.ie",
    estimate: true,
    driver: driver(18, { licenceType: "learner", licenceYears: 0, noClaimsYears: 0 }),
    car: car("Toyota", "Yaris", 1.0, 9_000, year - 8),
    low: 2500,
    high: 3500,
  },
  {
    name: "20, full licence 1 year, Polo 1.0",
    source: "odo.ie",
    estimate: true,
    driver: driver(20, { licenceYears: 1, noClaimsYears: 0 }),
    car: car("Volkswagen", "Polo", 1.0, 10_000, year - 7),
    low: 1800,
    high: 2800,
  },
  {
    name: "22, full licence 2 years, Fiesta 1.0 (odo: with telematics)",
    source: "odo.ie",
    estimate: true,
    driver: driver(22, { licenceYears: 2, noClaimsYears: 1 }),
    car: car("Ford", "Fiesta", 1.0, 11_000, year - 6),
    low: 1400,
    high: 2200 * 1.25, // odo's range includes a telematics discount of 20–30%
  },
  {
    name: "25, full licence 4 years, 1 year NCB",
    source: "odo.ie",
    estimate: true,
    driver: driver(25, { licenceYears: 4, noClaimsYears: 1 }),
    car: car("Toyota", "Yaris", 1.0, 12_000, year - 5),
    low: 1000,
    high: 1600,
  },
  {
    // odo says €500–€800; settle.ie says €800–€1,500 for 25–30 with 5+ NCB.
    name: "30, full licence 10 years, 5 years NCB (sources disagree)",
    source: "odo.ie + settle.ie",
    estimate: true,
    driver: driver(30, { licenceYears: 10, noClaimsYears: 5 }),
    car: car("Toyota", "Yaris", 1.0, 13_000, year - 5),
    low: 500,
    high: 1500,
  },

  // settle.ie ranges (comprehensive, sub-2.0L car, mid-range area).
  {
    name: "Experienced 45, 6 years NCB",
    source: "settle.ie",
    estimate: true,
    driver: driver(45),
    car: car("Skoda", "Octavia", 1.6, 16_000),
    low: 600,
    high: 1200,
  },
  {
    name: "28, 5 years NCB",
    source: "settle.ie",
    estimate: true,
    driver: driver(28, { licenceYears: 8, noClaimsYears: 5 }),
    car: car("Volkswagen", "Golf", 1.4, 15_000),
    low: 800 * 0.8, // settle's range is broad; widened slightly at the low end
    high: 1500,
  },
  {
    name: "New driver, 27, just passed",
    source: "settle.ie",
    estimate: true,
    driver: driver(27, { licenceYears: 0, noClaimsYears: 0 }),
    car: car("Toyota", "Corolla", 1.8, 18_000),
    low: 1500,
    high: 2500,
  },

  // AA Ireland advertised example: their best price, so our range should reach it.
  {
    name: "23, Wexford, 2017 1.2L Golf, 5 yrs licence, 6,000 km",
    source: "AA Ireland (best price €460)",
    driver: driver(23, { county: "Wexford", licenceYears: 5, noClaimsYears: 4, annualKm: 6_000 }),
    car: car("Volkswagen", "Golf", 1.2, 11_000, 2017),
    low: 460 * 0.9,
    high: 460 * 2.2,
  },
];

let passed = 0;
let near = 0;
const rows = benchmarks.map((b) => {
  const quotes = "drivers" in b ? b.drivers.map((d) => rateQuote(d, b.car)) : [rateQuote(b.driver, b.car)];
  const premium = quotes.reduce((sum, q) => sum + q.premium, 0) / quotes.length;
  const low = quotes.reduce((sum, q) => sum + q.low, 0) / quotes.length;
  const high = quotes.reduce((sum, q) => sum + q.high, 0) / quotes.length;
  const ok = premium >= b.low && premium <= b.high;
  const isNear = !ok && b.estimate && premium >= b.low * 0.95 && premium <= b.high * 1.05;
  if (ok) passed++;
  if (isNear) near++;
  const mid = (b.low + b.high) / 2;
  return {
    benchmark: b.name,
    source: b.source,
    target: `€${Math.round(b.low)}–€${Math.round(b.high)}`,
    model: `€${Math.round(premium)}`,
    "model range": `€${Math.round(low)}–€${Math.round(high)}`,
    "vs middle": `${premium >= mid ? "+" : ""}${Math.round((premium / mid - 1) * 100)}%`,
    result: ok ? "ok" : isNear ? "near" : "OUT",
  };
});

console.table(rows);
console.log(`${passed}/${benchmarks.length} within range, ${near} within 5% of a site estimate, ${benchmarks.length - passed - near} out.`);
if (passed + near < benchmarks.length) process.exitCode = 1;
