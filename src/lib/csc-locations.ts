const CSC_BASE_URL = "https://api.countrystatecity.in/v1";
const CSC_API_KEY = process.env.CSC_API_KEY ?? "edebc3f5287bbe71b9c213302383496904dd12ff2f951ddd25830800a22997af";

type CscCountry = {
  name: string;
  iso2: string;
};

type CscState = {
  name: string;
  iso2: string;
};

export type LocationOption = {
  name: string;
  code: string;
};

async function cscFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${CSC_BASE_URL}${path}`, {
    method: "GET",
    headers: {
      "X-CSCAPI-KEY": CSC_API_KEY,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`CSC API request failed (${response.status}).`);
  }

  return (await response.json()) as T;
}

export async function fetchCountries(): Promise<LocationOption[]> {
  const countries = await cscFetch<CscCountry[]>("/countries");
  return countries
    .map((item) => ({ name: item.name, code: item.iso2 }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchStatesByCountryCode(countryCode: string): Promise<LocationOption[]> {
  if (!countryCode) return [];
  const states = await cscFetch<CscState[]>(`/countries/${countryCode}/states`);
  return states
    .map((item) => ({ name: item.name, code: item.iso2 }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function validateCountryState(countryName: string, stateName: string): Promise<boolean> {
  if (!countryName || !stateName) return false;

  const countries = await fetchCountries();
  const country = countries.find((item) => item.name.toLowerCase() === countryName.toLowerCase());
  if (!country) return false;

  const states = await fetchStatesByCountryCode(country.code);
  return states.some((item) => item.name.toLowerCase() === stateName.toLowerCase());
}
