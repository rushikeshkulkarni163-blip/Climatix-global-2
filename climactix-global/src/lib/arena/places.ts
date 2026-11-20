/**
 * Geographic navigation hierarchy: continents → countries → states → cities →
 * industrial clusters. Countries come from Natural Earth at runtime; this file
 * holds the curated levels below country. Coordinates are approximate centres
 * used for camera targets, not boundaries.
 */

export type PlaceKind = "continent" | "country" | "state" | "city" | "cluster";

export interface Place {
  id: string;
  kind: PlaceKind;
  name: string;
  lat: number;
  lon: number;
  /** Camera range in metres when focused. */
  range: number;
  parent?: string;
  iso3?: string;
  /** City has a full Climate Arena environment (buildings, facilities, traffic). */
  arena?: boolean;
  note?: string;
}

export const CONTINENTS: Place[] = [
  { id: "asia", kind: "continent", name: "Asia", lat: 30, lon: 90, range: 9_000_000 },
  { id: "europe", kind: "continent", name: "Europe", lat: 52, lon: 15, range: 6_000_000 },
  { id: "africa", kind: "continent", name: "Africa", lat: 3, lon: 20, range: 8_500_000 },
  { id: "namerica", kind: "continent", name: "North America", lat: 45, lon: -100, range: 8_500_000 },
  { id: "samerica", kind: "continent", name: "South America", lat: -18, lon: -60, range: 8_000_000 },
  { id: "oceania", kind: "continent", name: "Oceania", lat: -25, lon: 140, range: 7_000_000 },
];

export const STATES: Place[] = [
  { id: "in-mh", kind: "state", name: "Maharashtra", lat: 19.45, lon: 75.6, range: 1_100_000, parent: "IND" },
  { id: "in-gj", kind: "state", name: "Gujarat", lat: 22.6, lon: 71.6, range: 1_000_000, parent: "IND" },
  { id: "in-dl", kind: "state", name: "Delhi (NCT)", lat: 28.65, lon: 77.15, range: 160_000, parent: "IND" },
  { id: "in-ka", kind: "state", name: "Karnataka", lat: 15.0, lon: 75.8, range: 1_000_000, parent: "IND" },
  { id: "in-tn", kind: "state", name: "Tamil Nadu", lat: 11.0, lon: 78.5, range: 900_000, parent: "IND" },
  { id: "in-wb", kind: "state", name: "West Bengal", lat: 23.4, lon: 87.9, range: 900_000, parent: "IND" },
  { id: "in-od", kind: "state", name: "Odisha", lat: 20.5, lon: 84.4, range: 900_000, parent: "IND" },
];

export const CITIES: Place[] = [
  { id: "mumbai", kind: "city", name: "Mumbai", lat: 19.03, lon: 72.865, range: 38_000, parent: "in-mh", iso3: "IND", arena: true },
  { id: "pune", kind: "city", name: "Pune", lat: 18.52, lon: 73.86, range: 40_000, parent: "in-mh", iso3: "IND" },
  { id: "nagpur", kind: "city", name: "Nagpur", lat: 21.15, lon: 79.09, range: 40_000, parent: "in-mh", iso3: "IND" },
  { id: "delhi", kind: "city", name: "Delhi", lat: 28.61, lon: 77.21, range: 60_000, parent: "in-dl", iso3: "IND" },
  { id: "ahmedabad", kind: "city", name: "Ahmedabad", lat: 23.03, lon: 72.58, range: 45_000, parent: "in-gj", iso3: "IND" },
  { id: "chennai", kind: "city", name: "Chennai", lat: 13.08, lon: 80.27, range: 45_000, parent: "in-tn", iso3: "IND" },
  { id: "kolkata", kind: "city", name: "Kolkata", lat: 22.57, lon: 88.36, range: 45_000, parent: "in-wb", iso3: "IND" },
  { id: "bengaluru", kind: "city", name: "Bengaluru", lat: 12.97, lon: 77.59, range: 45_000, parent: "in-ka", iso3: "IND" },
  { id: "shanghai", kind: "city", name: "Shanghai", lat: 31.23, lon: 121.47, range: 60_000, iso3: "CHN" },
  { id: "tokyo", kind: "city", name: "Tokyo", lat: 35.68, lon: 139.76, range: 60_000, iso3: "JPN" },
  { id: "jakarta", kind: "city", name: "Jakarta", lat: -6.2, lon: 106.82, range: 55_000, iso3: "IDN" },
  { id: "london", kind: "city", name: "London", lat: 51.507, lon: -0.128, range: 50_000, iso3: "GBR" },
  { id: "newyork", kind: "city", name: "New York", lat: 40.71, lon: -74.0, range: 55_000, iso3: "USA" },
  { id: "lagos", kind: "city", name: "Lagos", lat: 6.52, lon: 3.38, range: 50_000, iso3: "NGA" },
  { id: "saopaulo", kind: "city", name: "São Paulo", lat: -23.55, lon: -46.63, range: 60_000, iso3: "BRA" },
];

export const CLUSTERS: Place[] = [
  { id: "trombay", kind: "cluster", name: "Trombay–Mahul industrial belt", lat: 19.01, lon: 72.895, range: 6_000, parent: "mumbai",
    note: "Thermal power, two refineries and fertiliser production on Thane Creek." },
  { id: "mbpt", kind: "cluster", name: "Mumbai Port & eastern docks", lat: 18.955, lon: 72.845, range: 6_000, parent: "mumbai" },
  { id: "jnpt", kind: "cluster", name: "JNPA container port (Nhava Sheva)", lat: 18.945, lon: 72.95, range: 9_000, parent: "mumbai" },
  { id: "bkc", kind: "cluster", name: "Bandra Kurla Complex (commercial)", lat: 19.065, lon: 72.865, range: 4_000, parent: "mumbai" },
];

export const ALL_SUB_COUNTRY: Place[] = [...STATES, ...CITIES, ...CLUSTERS];

export function placeById(id: string): Place | undefined {
  return [...CONTINENTS, ...ALL_SUB_COUNTRY].find((p) => p.id === id);
}
