import type { County } from "./costs";

export type Listing = {
  id: string;
  make: string;
  model: string;
  year: number;
  engineSizeLitres: number;
  price: number;
  odometerKm: number;
  location: County;
  description: string;
  createdAt: string;
};

// Mock storage. Resets when the server restarts; replace with a database later.
const listings: Listing[] = [
  {
    id: "1",
    make: "Toyota",
    model: "Yaris",
    year: 2019,
    engineSizeLitres: 1.0,
    price: 13_950,
    odometerKm: 68_000,
    location: "Dublin",
    description: "One owner, full Toyota service history. Ideal first car, very cheap to run.",
    createdAt: "2026-09-20",
  },
  {
    id: "2",
    make: "Volkswagen",
    model: "Golf",
    year: 2017,
    engineSizeLitres: 1.4,
    price: 14_500,
    odometerKm: 112_000,
    location: "Cork",
    description: "TSI Highline, heated seats, new tyres and NCT until next year.",
    createdAt: "2026-09-18",
  },
  {
    id: "3",
    make: "Skoda",
    model: "Octavia",
    year: 2018,
    engineSizeLitres: 1.6,
    price: 13_750,
    odometerKm: 131_000,
    location: "Galway",
    description: "Huge boot, reliable family car. Cambelt done at 150k.",
    createdAt: "2026-09-22",
  },
  {
    id: "4",
    make: "Ford",
    model: "Fiesta",
    year: 2022,
    engineSizeLitres: 1.0,
    price: 17_450,
    odometerKm: 38_000,
    location: "Limerick",
    description: "ST-Line EcoBoost, Bluetooth, two keys. Small scuff on rear bumper.",
    createdAt: "2026-09-15",
  },
  {
    id: "5",
    make: "Hyundai",
    model: "Tucson",
    year: 2021,
    engineSizeLitres: 1.6,
    price: 27_900,
    odometerKm: 54_000,
    location: "Kildare",
    description: "Executive spec with panoramic roof and reversing camera. Balance of warranty.",
    createdAt: "2026-09-24",
  },
  {
    id: "6",
    make: "Nissan",
    model: "Qashqai",
    year: 2018,
    engineSizeLitres: 1.2,
    price: 16_450,
    odometerKm: 91_000,
    location: "Kilkenny",
    description: "SV model, sat nav, 360 camera. Serviced every year at main dealer.",
    createdAt: "2026-09-19",
  },
  {
    id: "7",
    make: "BMW",
    model: "3 Series",
    year: 2015,
    engineSizeLitres: 2.0,
    price: 13_250,
    odometerKm: 149_000,
    location: "Dublin",
    description: "320i M Sport, leather interior, recently serviced.",
    createdAt: "2026-09-12",
  },
  {
    id: "8",
    make: "Mazda",
    model: "MX-5",
    year: 2012,
    engineSizeLitres: 1.8,
    price: 8_900,
    odometerKm: 121_000,
    location: "Wicklow",
    description: "Roadster, new soft top, great summer car.",
    createdAt: "2026-09-10",
  },
  {
    id: "9",
    make: "Toyota",
    model: "Corolla",
    year: 2023,
    engineSizeLitres: 1.8,
    price: 27_950,
    odometerKm: 29_000,
    location: "Waterford",
    description: "Luna trim, adaptive cruise, Apple CarPlay. Full history.",
    createdAt: "2026-09-25",
  },
  {
    id: "10",
    make: "Audi",
    model: "A6",
    year: 2013,
    engineSizeLitres: 3.0,
    price: 11_500,
    odometerKm: 187_000,
    location: "Louth",
    description: "Quattro, S line, very well kept. Timing chain replaced.",
    createdAt: "2026-09-08",
  },
  {
    id: "11",
    make: "Dacia",
    model: "Sandero",
    year: 2023,
    engineSizeLitres: 1.0,
    price: 15_750,
    odometerKm: 21_000,
    location: "Mayo",
    description: "Nearly new, Comfort trim, manufacturer warranty remaining.",
    createdAt: "2026-09-26",
  },
  {
    id: "12",
    make: "Ford",
    model: "Mustang",
    year: 2018,
    engineSizeLitres: 5.0,
    price: 39_000,
    odometerKm: 48_000,
    location: "Meath",
    description: "GT V8 fastback, imported and registered. A weekend car with running costs to match.",
    createdAt: "2026-09-05",
  },
];

export function getListings() {
  return listings;
}

export function getListing(id: string) {
  return listings.find((listing) => listing.id === id);
}

export function getMakes() {
  return [...new Set(listings.map((listing) => listing.make))].sort();
}

export function addListing(data: Omit<Listing, "id" | "createdAt">) {
  const listing: Listing = {
    ...data,
    id: String(Math.max(0, ...listings.map((l) => Number(l.id))) + 1),
    createdAt: new Date().toISOString().slice(0, 10),
  };
  listings.push(listing);
  return listing;
}
