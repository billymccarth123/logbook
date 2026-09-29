// Petrol and NCT running-cost rules. Insurance lives in insurance.ts.
// These figures are placeholder estimates; check them before launch.

export { COUNTIES, isCounty, type County } from "./counties";

export const DEFAULT_KM_PER_YEAR = 17_000;
export const PETROL_PRICE_PER_LITRE = 1.75;
export const NCT_FEE = 55;

export const ENGINE_BANDS = [
  { label: "up to 1.0L", maxLitres: 1.0, litresPer100Km: 5.0, insuranceMultiplier: 0.9 },
  { label: "1.1–1.4L", maxLitres: 1.4, litresPer100Km: 5.8, insuranceMultiplier: 1.0 },
  { label: "1.5–1.8L", maxLitres: 1.8, litresPer100Km: 6.8, insuranceMultiplier: 1.04 },
  { label: "1.9–2.4L", maxLitres: 2.4, litresPer100Km: 8.0, insuranceMultiplier: 1.15 },
  { label: "2.5–3.0L", maxLitres: 3.0, litresPer100Km: 9.5, insuranceMultiplier: 1.4 },
  { label: "over 3.0L", maxLitres: Infinity, litresPer100Km: 12.0, insuranceMultiplier: 1.8 },
];

export function engineBand(litres: number) {
  return ENGINE_BANDS.find((band) => litres <= band.maxLitres + 1e-9)!;
}

export function petrolPerYear(litres: number, kmPerYear: number) {
  return (kmPerYear / 100) * engineBand(litres).litresPer100Km * PETROL_PRICE_PER_LITRE;
}

// First NCT at 4 years, then every 2 years until 10, then yearly.
export function nctPerYear(carYear: number, currentYear = new Date().getFullYear()) {
  const carAge = currentYear - carYear;
  if (carAge < 4) return 0;
  if (carAge < 10) return NCT_FEE / 2;
  return NCT_FEE;
}

export function fixedRunningCosts(car: { engineSizeLitres: number; year: number }, kmPerYear = DEFAULT_KM_PER_YEAR) {
  const petrol = petrolPerYear(car.engineSizeLitres, kmPerYear);
  const nct = nctPerYear(car.year);
  return { petrol, nct, total: petrol + nct };
}
