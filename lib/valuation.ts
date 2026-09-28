// Car valuation: a market reference value for a make, model and year, then
// transparent adjustments for this particular car. Pure module: safe to import
// from client components.

import { isCounty, type County } from "./counties";

export const FUELS = {
  petrol: "Petrol",
  diesel: "Diesel",
  hybrid: "Hybrid",
  "plug-in-hybrid": "Plug-in hybrid",
  electric: "Electric",
} as const;

export const TRANSMISSIONS = { manual: "Manual", automatic: "Automatic" } as const;

export const CONDITIONS = {
  excellent: "Excellent: like new, no marks",
  good: "Good: normal wear for its age",
  fair: "Fair: visible wear, some small faults",
  poor: "Poor: needs work",
} as const;

export const SERVICE_HISTORY = {
  full: "Full service history",
  partial: "Partial service history",
  none: "No service history",
} as const;

export type Fuel = keyof typeof FUELS;
export type Transmission = keyof typeof TRANSMISSIONS;
export type Condition = keyof typeof CONDITIONS;
export type ServiceHistory = keyof typeof SERVICE_HISTORY;

export type CarForValuation = {
  make: string;
  model: string;
  year: number;
  engineSizeLitres: number;
  fuel: Fuel;
  transmission: Transmission;
  odometerKm: number;
  condition: Condition;
  serviceHistory: ServiceHistory;
  owners: number;
  nctValid: boolean;
  county: County;
};

export type Comparable = {
  title: string;
  askingPrice: number;
  year: number;
  odometerKm: number | null;
  source: string;
  url: string;
};

// One row in the market database: what a typical example of this car is worth.
export type MarketEntry = {
  key: string;
  make: string;
  model: string;
  year: number;
  fuel: Fuel;
  // Typical private asking price in Ireland for this car at typical mileage in good condition.
  referenceValue: number;
  low: number;
  high: number;
  typicalKm: number;
  comparables: Comparable[];
  confidence: "high" | "medium" | "low";
  notes: string;
  updatedAt: string;
};

export type Adjustment = { label: string; multiplier: number };

export type Valuation = {
  car: CarForValuation;
  market: MarketEntry;
  adjustments: Adjustment[];
  // Asking price we'd suggest for a private sale.
  privateAsking: number;
  // What a private buyer will likely pay after negotiation.
  privateSale: number;
  // Rough dealer trade-in offer.
  tradeIn: number;
  range: { low: number; high: number };
};

export const TYPICAL_KM_PER_YEAR = 17_000;
// Market entries older than this are researched again.
export const MARKET_ENTRY_MAX_AGE_DAYS = 14;

export function normalise(text: string) {
  return text.trim().replace(/\s+/g, " ");
}

const MAKE_ALIASES: Record<string, string> = {
  vw: "volkswagen",
  merc: "mercedesbenz",
  mercedes: "mercedesbenz",
  chevy: "chevrolet",
  vauxhall: "opel",
};

// Loose matching: "VW Golf" = "Volkswagen golf", "3-Series" = "3 Series".
export function canonicalMake(make: string) {
  const plain = make.toLowerCase().replace(/[^a-z0-9]/g, "");
  return MAKE_ALIASES[plain] ?? plain;
}

export function canonicalModel(model: string) {
  return model.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function marketKey(make: string, model: string, year: number, fuel: Fuel) {
  return [canonicalMake(make), canonicalModel(model), String(year), fuel].join("|");
}

// Assumed yearly depreciation when estimating beyond the researched years.
const YEARLY_DEPRECIATION = 0.1;
const MAX_YEARS_OUTSIDE = 4;

// Estimates a market value for a year that hasn't been researched, from the
// researched years of the same model: interpolates between the nearest years
// either side, or extends from the nearest year by typical depreciation.
export function estimateFromNearby(entries: MarketEntry[], year: number, fuel: Fuel): MarketEntry | null {
  if (!entries.length) return null;
  const sameFuel = entries.filter((entry) => entry.fuel === fuel);
  const pool = (sameFuel.length ? sameFuel : entries).slice().sort((a, b) => a.year - b.year);
  const older = pool.filter((entry) => entry.year < year).at(-1);
  const newer = pool.find((entry) => entry.year > year);
  const fuelNote = sameFuel.length ? "" : ` No ${FUELS[fuel].toLowerCase()} versions researched yet, so this uses other fuel types.`;
  const sameYear = pool.find((entry) => entry.year === year);
  if (sameYear) {
    return {
      ...sameYear,
      key: marketKey(sameYear.make, sameYear.model, year, fuel),
      fuel,
      comparables: [],
      confidence: "low",
      notes: `Based on researched ${sameYear.year} ${FUELS[sameYear.fuel].toLowerCase()} ${sameYear.model} values.${fuelNote}`,
    };
  }
  const base = older ?? newer!;

  let referenceValue: number;
  let typicalKm: number;
  let basis: string;
  if (older && newer) {
    const t = (year - older.year) / (newer.year - older.year);
    referenceValue = older.referenceValue * Math.pow(newer.referenceValue / older.referenceValue, t);
    typicalKm = older.typicalKm + (newer.typicalKm - older.typicalKm) * t;
    basis = `${older.year} and ${newer.year}`;
  } else {
    const gap = year - base.year;
    if (Math.abs(gap) > MAX_YEARS_OUTSIDE) return null;
    referenceValue = base.referenceValue * Math.pow(1 - YEARLY_DEPRECIATION, -gap);
    typicalKm = Math.max(0, base.typicalKm - gap * TYPICAL_KM_PER_YEAR);
    basis = String(base.year);
  }

  const scale = referenceValue / base.referenceValue;
  return {
    key: marketKey(base.make, base.model, year, fuel),
    make: base.make,
    model: base.model,
    year,
    fuel,
    referenceValue: Math.round(referenceValue / 50) * 50,
    low: Math.round((base.low * scale) / 50) * 50,
    high: Math.round((base.high * scale) / 50) * 50,
    typicalKm: Math.round(typicalKm / 1000) * 1000,
    comparables: [],
    confidence: older && newer && sameFuel.length ? "medium" : "low",
    notes: `Estimated from researched ${base.model} values for ${basis}.${fuelNote}`,
    updatedAt: base.updatedAt,
  };
}

export function typicalKmFor(year: number, currentYear = new Date().getFullYear()) {
  return Math.max(0, currentYear - year) * TYPICAL_KM_PER_YEAR;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, step: number) {
  return Math.round(value / step) * step;
}

// Adjustment rates are assumptions based on common Irish trade guidance.
export function valueCar(car: CarForValuation, market: MarketEntry): Valuation {
  const adjustments: Adjustment[] = [];
  const add = (label: string, multiplier: number) => {
    if (Math.abs(multiplier - 1) > 0.005) adjustments.push({ label, multiplier });
  };

  const kmDifference = car.odometerKm - market.typicalKm;
  add(
    `${Math.abs(Math.round(kmDifference / 1000))}k km ${kmDifference > 0 ? "above" : "below"} typical`,
    clamp(1 - (kmDifference / 10_000) * 0.015, 0.8, 1.12),
  );
  add(CONDITIONS[car.condition].split(":")[0] + " condition", { excellent: 1.05, good: 1, fair: 0.9, poor: 0.75 }[car.condition]);
  add(SERVICE_HISTORY[car.serviceHistory], { full: 1, partial: 0.95, none: 0.88 }[car.serviceHistory]);
  add(`${car.owners} previous ${car.owners === 1 ? "owner" : "owners"}`, car.owners >= 5 ? 0.93 : car.owners >= 3 ? 0.97 : 1);
  if (!car.nctValid && new Date().getFullYear() - car.year >= 4) add("No valid NCT", 0.95);

  const factor = adjustments.reduce((total, adjustment) => total * adjustment.multiplier, 1);
  const privateAsking = roundTo(market.referenceValue * factor, 50);
  // Buyers typically negotiate a few percent off; dealers offer well below retail.
  const privateSale = roundTo(privateAsking * 0.94, 50);
  const tradeIn = roundTo(privateAsking * 0.8, 50);
  const spread = market.confidence === "high" ? 0.06 : market.confidence === "medium" ? 0.1 : 0.15;

  return {
    car,
    market,
    adjustments,
    privateAsking,
    privateSale,
    tradeIn,
    range: { low: roundTo(privateSale * (1 - spread), 50), high: roundTo(privateAsking * (1 + spread / 2), 50) },
  };
}

export function parseCarForValuation(get: (key: string) => string): { error: string } | { car: CarForValuation } {
  const make = normalise(get("make"));
  const model = normalise(get("model"));
  const year = Number(get("year"));
  const engineSizeLitres = Number(get("engineSizeLitres"));
  const fuel = get("fuel");
  const transmission = get("transmission");
  const odometerKm = Number(get("odometerKm"));
  const condition = get("condition");
  const serviceHistory = get("serviceHistory");
  const owners = Number(get("owners"));
  const county = get("county");
  const currentYear = new Date().getFullYear();

  if (!make || !model) return { error: "Enter the make and model." };
  if (make.length > 40 || model.length > 60) return { error: "Make or model is too long." };
  if (!Number.isInteger(year) || year < 1980 || year > currentYear) return { error: "Enter a valid year." };
  if (fuel !== "electric" && !(engineSizeLitres >= 0.6 && engineSizeLitres <= 8)) {
    return { error: "Engine size should be between 0.6L and 8.0L." };
  }
  if (!(fuel in FUELS)) return { error: "Choose the fuel type." };
  if (!(transmission in TRANSMISSIONS)) return { error: "Choose the gearbox." };
  if (!(odometerKm >= 0 && odometerKm <= 1_000_000)) return { error: "Enter the odometer reading in km." };
  if (!(condition in CONDITIONS)) return { error: "Choose the condition." };
  if (!(serviceHistory in SERVICE_HISTORY)) return { error: "Choose the service history." };
  if (!(Number.isInteger(owners) && owners >= 1 && owners <= 20)) return { error: "Enter the number of owners." };
  if (!isCounty(county)) return { error: "Choose the county." };

  return {
    car: {
      make,
      model,
      year,
      engineSizeLitres: fuel === "electric" ? 0 : engineSizeLitres,
      fuel: fuel as Fuel,
      transmission: transmission as Transmission,
      odometerKm,
      condition: condition as Condition,
      serviceHistory: serviceHistory as ServiceHistory,
      owners,
      nctValid: get("nctValid") === "yes",
      county,
    },
  };
}
