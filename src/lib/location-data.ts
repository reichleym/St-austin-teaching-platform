export const locationData: Record<string, string[]> = {
  "United States": [
    "Alabama",
    "Alaska",
    "Arizona",
    "Arkansas",
    "California",
    "Colorado",
    "Connecticut",
    "Delaware",
    "Florida",
    "Georgia",
    "Hawaii",
    "Idaho",
    "Illinois",
    "Indiana",
    "Iowa",
    "Kansas",
    "Kentucky",
    "Louisiana",
    "Maine",
    "Maryland",
    "Massachusetts",
    "Michigan",
    "Minnesota",
    "Mississippi",
    "Missouri",
    "Montana",
    "Nebraska",
    "Nevada",
    "New Hampshire",
    "New Jersey",
    "New Mexico",
    "New York",
    "North Carolina",
    "North Dakota",
    "Ohio",
    "Oklahoma",
    "Oregon",
    "Pennsylvania",
    "Rhode Island",
    "South Carolina",
    "South Dakota",
    "Tennessee",
    "Texas",
    "Utah",
    "Vermont",
    "Virginia",
    "Washington",
    "West Virginia",
    "Wisconsin",
    "Wyoming"
  ],
  Canada: [
    "Alberta",
    "British Columbia",
    "Manitoba",
    "New Brunswick",
    "Newfoundland and Labrador",
    "Nova Scotia",
    "Ontario",
    "Prince Edward Island",
    "Quebec",
    "Saskatchewan"
  ],
  India: [
    "Andhra Pradesh",
    "Delhi",
    "Karnataka",
    "Kerala",
    "Maharashtra",
    "Tamil Nadu",
    "Telangana",
    "Uttar Pradesh",
    "West Bengal"
  ],
  Nigeria: ["Lagos", "Abuja", "Kano", "Oyo", "Rivers", "Kaduna"],
  Australia: ["New South Wales", "Queensland", "South Australia", "Tasmania", "Victoria", "Western Australia"],
  Philippines: ["Metro Manila", "Cebu", "Davao del Sur", "Iloilo", "Laguna", "Pampanga"]
};

export function getCountries() {
  return Object.keys(locationData).sort((a, b) => a.localeCompare(b));
}

export function getStatesByCountry(country: string) {
  return locationData[country] ?? [];
}

export function isValidCountryState(country: string, state: string) {
  if (!country || !state) return false;
  const states = getStatesByCountry(country);
  return states.includes(state);
}
