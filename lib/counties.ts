// Average car insurance premium by county.
// Source: Chill Car Insurance Pricing Index, updated 14 July 2026
// (https://www.chill.ie/blog/car-insurance-pricing-index/).
export const COUNTY_AVERAGES = {
  Carlow: 659,
  Cavan: 707,
  Clare: 644,
  Cork: 596,
  Donegal: 646,
  Dublin: 656,
  Galway: 637,
  Kerry: 616,
  Kildare: 643,
  Kilkenny: 584,
  Laois: 659,
  Leitrim: 628,
  Limerick: 710,
  Longford: 785,
  Louth: 745,
  Mayo: 616,
  Meath: 661,
  Monaghan: 704,
  Offaly: 674,
  Roscommon: 656,
  Sligo: 636,
  Tipperary: 638,
  Waterford: 587,
  Westmeath: 657,
  Wexford: 620,
  Wicklow: 592,
} as const;

export type County = keyof typeof COUNTY_AVERAGES;
export const COUNTIES = Object.keys(COUNTY_AVERAGES) as County[];

// Average of the 26 county figures.
export const COUNTY_BASELINE = 652;

export function isCounty(value: unknown): value is County {
  return typeof value === "string" && value in COUNTY_AVERAGES;
}
