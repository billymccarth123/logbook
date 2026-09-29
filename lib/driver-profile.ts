// The details Irish insurers ask for before a quote, based on Aviva's published
// Private Motor Question Set. Sex is deliberately excluded: EU law (Test-Achats,
// December 2012) bans pricing car insurance by sex.
// Pure module: safe to import from client components.

import { isCounty, type County } from "./counties";

export const OCCUPATIONS = {
  "office-admin": "Office or administrative",
  education: "Teaching or education",
  "legal-finance": "Legal, finance or accounting",
  healthcare: "Healthcare",
  "it-engineering": "IT or engineering",
  "trades-construction": "Trades or construction",
  "hospitality-retail": "Hospitality or retail",
  "driving-delivery": "Driving or delivery",
  student: "Student",
  retired: "Retired",
  "not-employed": "Homemaker or not employed",
  other: "Other",
} as const;

export const LICENCE_TYPES = {
  "full-irish": "Full Irish licence",
  "full-eu-uk": "Full EU or UK licence",
  "full-other": "Full licence from another country",
  learner: "Learner permit",
} as const;

export const USAGE = {
  social: "Social, domestic and pleasure only",
  commuting: "Social plus commuting to work",
  business: "Business use (other than commuting)",
} as const;

export const PARKING = {
  garage: "Locked garage",
  driveway: "Driveway or private property",
  street: "On the street",
} as const;

export const COVER = {
  comprehensive: "Comprehensive",
  tpft: "Third party, fire and theft",
} as const;

export const EXCESS = [125, 300, 600] as const;

export const NAMED_DRIVERS = {
  none: "No other drivers",
  experienced: "An experienced driver (25+, full licence)",
  young: "A young or newly qualified driver",
} as const;

export type Occupation = keyof typeof OCCUPATIONS;
export type LicenceType = keyof typeof LICENCE_TYPES;
export type Usage = keyof typeof USAGE;
export type Parking = keyof typeof PARKING;
export type Cover = keyof typeof COVER;
export type Excess = (typeof EXCESS)[number];
export type NamedDriver = keyof typeof NAMED_DRIVERS;

// Everything that affects the price. No contact details, so it's safe to send to the AI.
export type DriverDetails = {
  dateOfBirth: string;
  county: County;
  occupation: Occupation;
  licenceType: LicenceType;
  licenceDate: string;
  penaltyPoints: number;
  noClaimsYears: number;
  // Years driving as a named driver on someone else's policy. Insurers give
  // credit for it (up to ~55%), which matters most before you earn NCD.
  namedDriverYears: number;
  claimsLast3Years: number;
  convictions: boolean;
  annualKm: number;
  usage: Usage;
  parking: Parking;
  cover: Cover;
  excess: Excess;
  namedDriver: NamedDriver;
};

export type Profile = DriverDetails & {
  name: string;
  email: string;
  phone: string;
};

export function ageFromDob(dob: string, today = new Date()) {
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthday) age--;
  return age;
}

export function yearsSince(date: string, today = new Date()) {
  return Math.max(0, ageFromDob(date, today));
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
}

function oneOf<T extends string>(options: Record<T, string>, value: string): value is T {
  return value in options;
}

// Parses and validates the quote form. Returns an error message or the profile.
export function parseProfile(get: (key: string) => string): { error: string } | { profile: Profile } {
  const name = get("name");
  const email = get("email");
  const phone = get("phone");
  const dateOfBirth = get("dateOfBirth");
  const county = get("county");
  const occupation = get("occupation");
  const licenceType = get("licenceType");
  const licenceDate = get("licenceDate");
  const penaltyPoints = Number(get("penaltyPoints"));
  const noClaimsYears = Number(get("noClaimsYears"));
  // Blank counts as 0, so accounts made before this question existed still load.
  const namedDriverYears = Number(get("namedDriverYears") || 0);
  const claimsLast3Years = Number(get("claimsLast3Years"));
  const annualKm = Number(get("annualKm"));
  const usage = get("usage");
  const parking = get("parking");
  const cover = get("cover");
  const excess = Number(get("excess"));
  const namedDriver = get("namedDriver");

  if (!name) return { error: "Enter your name." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email address." };
  if (!isValidDate(dateOfBirth)) return { error: "Enter your date of birth." };
  const age = ageFromDob(dateOfBirth);
  if (age < 17) return { error: "You need to be at least 17 to drive in Ireland." };
  if (age > 110) return { error: "Check your date of birth." };
  if (!isCounty(county)) return { error: "Choose the county where the car is kept overnight." };
  if (!oneOf(OCCUPATIONS, occupation)) return { error: "Choose your occupation." };
  if (!oneOf(LICENCE_TYPES, licenceType)) return { error: "Choose your licence type." };
  if (!isValidDate(licenceDate)) return { error: "Enter the date you got your licence or permit." };
  if (new Date(licenceDate) > new Date()) return { error: "Your licence date can't be in the future." };
  if (ageFromDob(dateOfBirth, new Date(licenceDate)) < 16) {
    return { error: "Your licence date is before you were old enough to hold one." };
  }
  if (!(Number.isInteger(penaltyPoints) && penaltyPoints >= 0 && penaltyPoints <= 12)) {
    return { error: "Penalty points must be between 0 and 12." };
  }
  if (!(Number.isInteger(noClaimsYears) && noClaimsYears >= 0 && noClaimsYears <= 30)) {
    return { error: "Enter your years of no claims bonus." };
  }
  if (noClaimsYears > yearsSince(licenceDate) + 1) {
    return { error: "No claims years can't be more than the years you've held a licence." };
  }
  if (!(Number.isInteger(namedDriverYears) && namedDriverYears >= 0 && namedDriverYears <= 30)) {
    return { error: "Enter your years as a named driver (0 if none)." };
  }
  if (![0, 1, 2].includes(claimsLast3Years)) return { error: "Choose how many claims you've made." };
  if (!(annualKm >= 1000 && annualKm <= 100_000)) return { error: "Yearly km should be between 1,000 and 100,000." };
  if (!oneOf(USAGE, usage)) return { error: "Choose how you'll use the car." };
  if (!oneOf(PARKING, parking)) return { error: "Choose where the car is parked overnight." };
  if (!oneOf(COVER, cover)) return { error: "Choose your level of cover." };
  if (!EXCESS.includes(excess as Excess)) return { error: "Choose your excess." };
  if (!oneOf(NAMED_DRIVERS, namedDriver)) return { error: "Choose any other drivers." };

  return {
    profile: {
      name,
      email,
      phone,
      dateOfBirth,
      county,
      occupation,
      licenceType,
      licenceDate,
      penaltyPoints,
      noClaimsYears,
      namedDriverYears,
      claimsLast3Years,
      convictions: get("convictions") === "yes",
      annualKm,
      usage,
      parking,
      cover,
      excess: excess as Excess,
      namedDriver,
    },
  };
}

export function driverDetails(profile: Profile): DriverDetails {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { name, email, phone, ...details } = profile;
  return details;
}
