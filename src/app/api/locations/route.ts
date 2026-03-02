import { NextRequest, NextResponse } from "next/server";
import { fetchCountries, fetchStatesByCountryCode } from "@/lib/csc-locations";

export async function GET(request: NextRequest) {
  try {
    const countryCode = request.nextUrl.searchParams.get("countryCode")?.trim();

    if (countryCode) {
      return NextResponse.json({ countryCode, states: await fetchStatesByCountryCode(countryCode) });
    }

    return NextResponse.json({ countries: await fetchCountries() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load locations.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
